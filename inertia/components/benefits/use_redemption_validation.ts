import { useCallback, useEffect, useRef, useState } from 'react'

import {
  RedemptionRequestError,
  confirmPresentation,
  inspectPresentation,
  type RedemptionRequestProblem,
} from '~/lib/redemption_validation'
import type {
  RedemptionPreview,
  RedemptionPreviewView,
  RedemptionReceipt,
  RedemptionRefusal,
} from '~/types/benefit_redemption'

export type ValidationStage =
  | { name: 'entry' }
  | { name: 'checking' }
  | { name: 'check_failed'; problem: RedemptionRequestProblem }
  | { name: 'preview'; preview: RedemptionPreviewView }
  | { name: 'confirming'; preview: RedemptionPreviewView }
  | { name: 'confirm_failed'; preview: RedemptionPreviewView; problem: RedemptionRequestProblem }
  | { name: 'receipt'; receipt: RedemptionReceipt; replay: boolean }
  | { name: 'refused'; refusal: RedemptionRefusal }

export interface ValidationStart {
  /** The token of a link opened from the phone's camera app, when it previews. */
  token?: string | null
  preview?: RedemptionPreview | null
  receipt?: RedemptionReceipt | null
  refusal?: RedemptionRefusal | null
}

function withoutToken(preview: RedemptionPreview): RedemptionPreviewView {
  return { expires_at: preview.expires_at, holder: preview.holder, benefit: preview.benefit }
}

function initialStage({ token, preview, receipt, refusal }: ValidationStart): ValidationStage {
  if (preview && token) return { name: 'preview', preview: withoutToken(preview) }
  if (receipt) return { name: 'receipt', receipt, replay: true }
  if (refusal) return { name: 'refused', refusal }
  return { name: 'entry' }
}

function problemOf(error: unknown): RedemptionRequestProblem {
  return error instanceof RedemptionRequestError ? error.problem : 'server'
}

/**
 * The validation flow: read → preview → explicit confirmation → receipt.
 *
 * The token lives only in a ref of this hook, for as long as the preview can
 * still be confirmed or retried. It is dropped as soon as the flow ends
 * (receipt or refusal) and when the partner starts over, and it goes away
 * with the page. It is never put in state that renders, in the URL or in a log.
 */
export function useRedemptionValidation(start: ValidationStart) {
  const tokenRef = useRef<string | null>(start.preview && start.token ? start.token : null)
  const [stage, setStage] = useState<ValidationStage>(() => initialStage(start))
  const stageRef = useRef(stage)
  const inspectionRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const update = useCallback((next: ValidationStage) => {
    if (!mountedRef.current) return
    stageRef.current = next
    setStage(next)
  }, [])

  const check = useCallback(
    async (token: string) => {
      inspectionRef.current?.abort()
      const controller = new AbortController()
      inspectionRef.current = controller
      tokenRef.current = token
      update({ name: 'checking' })

      try {
        const result = await inspectPresentation(token, controller.signal)
        if (controller.signal.aborted) return
        if (result.outcome === 'preview') {
          update({ name: 'preview', preview: result.preview })
          return
        }
        tokenRef.current = null
        update(
          result.outcome === 'redeemed'
            ? { name: 'receipt', receipt: result.receipt, replay: true }
            : { name: 'refused', refusal: result.refusal }
        )
      } catch (error) {
        if (controller.signal.aborted) return
        update({ name: 'check_failed', problem: problemOf(error) })
      }
    },
    [update]
  )

  const retryCheck = useCallback(() => {
    if (tokenRef.current) void check(tokenRef.current)
  }, [check])

  /**
   * Explicit confirmation. Not aborted on unmount: once sent, the server
   * decides, and a repeat with the same token returns the same receipt.
   */
  const confirm = useCallback(async () => {
    const current = stageRef.current
    const token = tokenRef.current
    if (!token || (current.name !== 'preview' && current.name !== 'confirm_failed')) return

    const preview = current.preview
    update({ name: 'confirming', preview })

    try {
      const result = await confirmPresentation(token)
      tokenRef.current = null
      update(
        result.outcome === 'confirmed'
          ? { name: 'receipt', receipt: result.receipt, replay: false }
          : { name: 'refused', refusal: result.refusal }
      )
    } catch (error) {
      update({ name: 'confirm_failed', preview, problem: problemOf(error) })
    }
  }, [update])

  const reset = useCallback(() => {
    inspectionRef.current?.abort()
    inspectionRef.current = null
    tokenRef.current = null
    update({ name: 'entry' })
  }, [update])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      // The token ref goes away with the component.
      mountedRef.current = false
      inspectionRef.current?.abort()
    }
  }, [])

  return { stage, check, retryCheck, confirm, reset }
}

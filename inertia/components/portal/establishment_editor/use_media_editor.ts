import { router } from '@inertiajs/react'
import type { FormEventHandler } from 'react'
import { useEffect, useRef, useState } from 'react'

import { firstError } from '~/lib/form_errors'
import { asRecord, stringValue } from '~/lib/establishment_editor'
import type { MediaAction } from './types'

interface UseEstablishmentMediaEditorOptions {
  tenantId: number
  establishmentId: number
  initialMediaCount: number
  beforeInternalVisit?: () => void
  tryStartOperation?: () => boolean
  finishOperation?: () => void
}

export interface EstablishmentMediaEditor {
  busy: boolean
  uploading: boolean
  uploadError: string | null
  uploadPurpose: string
  uploadAsCover: boolean
  uploadDraftDirty: boolean
  mediaAction: MediaAction | null
  mediaActionError: string | null
  setUploadPurpose: (value: string) => void
  setUploadAsCover: (value: boolean) => void
  markUploadDraftDirty: () => void
  resetUploadDraft: () => void
  uploadMedia: FormEventHandler<HTMLFormElement>
  setMediaCover: (mediaId: number) => Promise<void>
  deleteMedia: (mediaId: number) => Promise<void>
}

export function useEstablishmentMediaEditor({
  tenantId,
  establishmentId,
  initialMediaCount,
  beforeInternalVisit,
  tryStartOperation,
  finishOperation,
}: UseEstablishmentMediaEditorOptions): EstablishmentMediaEditor {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadPurpose, setUploadPurposeState] = useState('gallery')
  const [uploadAsCover, setUploadAsCoverState] = useState(initialMediaCount === 0)
  const [uploadDraftDirty, setUploadDraftDirty] = useState(false)
  const [mediaAction, setMediaAction] = useState<MediaAction | null>(null)
  const [mediaActionError, setMediaActionError] = useState<string | null>(null)
  const operationInFlightRef = useRef(false)
  const busy = uploading || mediaAction !== null

  useEffect(() => {
    if (uploadDraftDirty) return
    setUploadAsCoverState(initialMediaCount === 0)
  }, [initialMediaCount, uploadDraftDirty])

  function markUploadDraftDirty() {
    setUploadDraftDirty(true)
  }

  function setUploadPurpose(value: string) {
    setUploadPurposeState(value)
    setUploadDraftDirty(true)
  }

  function setUploadAsCover(value: boolean) {
    setUploadAsCoverState(value)
    setUploadDraftDirty(true)
  }

  function beginOperation(): boolean {
    if (operationInFlightRef.current) return false
    if (tryStartOperation && !tryStartOperation()) return false

    operationInFlightRef.current = true
    return true
  }

  function completeOperation() {
    if (!operationInFlightRef.current) return
    operationInFlightRef.current = false
    finishOperation?.()
  }

  function resetUploadDraft() {
    setUploadPurposeState('gallery')
    setUploadAsCoverState(initialMediaCount === 0)
    setUploadDraftDirty(false)
    setUploadError(null)
  }

  async function responseError(response: Response, fallback: string): Promise<string> {
    const payload = asRecord(await response.json().catch(() => null))
    return stringValue(payload, 'message') || firstError(payload?.errors) || fallback
  }

  function reloadEditor(): Promise<void> {
    beforeInternalVisit?.()

    return new Promise((resolve) => {
      router.reload({
        only: ['establishment', 'completeness'],
        onFinish: () => resolve(),
      })
    })
  }

  const uploadMedia: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    if (busy || !beginOperation()) return

    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    setUploading(true)
    setUploadError(null)

    try {
      const response = await fetch(`/api/v1/establishments/${establishmentId}/media`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': String(tenantId),
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível enviar a imagem.'))
      }

      formElement.reset()
      setUploadPurposeState('gallery')
      setUploadAsCoverState(false)
      setUploadDraftDirty(false)
      await reloadEditor()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Falha ao enviar a imagem.')
    } finally {
      setUploading(false)
      completeOperation()
    }
  }

  async function setMediaCover(mediaId: number): Promise<void> {
    if (busy || !beginOperation()) return

    setMediaAction({ id: mediaId, kind: 'cover' })
    setMediaActionError(null)

    try {
      const response = await fetch(
        `/api/v1/establishments/${establishmentId}/media/${mediaId}/cover`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'x-tenant-id': String(tenantId),
          },
        }
      )

      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível definir a capa.'))
      }

      await reloadEditor()
    } catch (error) {
      setMediaActionError(error instanceof Error ? error.message : 'Falha ao definir a capa.')
    } finally {
      setMediaAction(null)
      completeOperation()
    }
  }

  async function deleteMedia(mediaId: number): Promise<void> {
    if (busy || !beginOperation()) return

    setMediaAction({ id: mediaId, kind: 'delete' })
    setMediaActionError(null)

    try {
      const response = await fetch(`/api/v1/establishments/${establishmentId}/media/${mediaId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': String(tenantId),
        },
      })

      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível remover a imagem.'))
      }

      await reloadEditor()
    } catch (error) {
      setMediaActionError(error instanceof Error ? error.message : 'Falha ao remover a imagem.')
    } finally {
      setMediaAction(null)
      completeOperation()
    }
  }

  return {
    busy,
    uploading,
    uploadError,
    uploadPurpose,
    uploadAsCover,
    uploadDraftDirty,
    mediaAction,
    mediaActionError,
    setUploadPurpose,
    setUploadAsCover,
    markUploadDraftDirty,
    resetUploadDraft,
    uploadMedia,
    setMediaCover,
    deleteMedia,
  }
}

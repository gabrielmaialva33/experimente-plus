import { useForm } from '@inertiajs/react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useCallback, useRef, useState } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertContent, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { MODERATION_ISSUE_FIELD_GROUPS } from '~/lib/establishment_editor'

type ModerationOperation = 'approve' | 'request_changes' | 'reject'

interface IssueDraft {
  /** Stable local key so removing rows never recycles React state. */
  key: string
  field: string
  message: string
  severity: 'blocking' | 'warning'
}

interface ModerationActionsProps {
  revisionId: number
  blockingIssueCount: number
  /** PublicationGate (or other) failure flashed by the controller as `errors.moderation`. */
  moderationError: string | null
}

/**
 * Issues are structured corrections; the section/field selects are
 * presentation-only shortcuts over the fields the partner editor already
 * knows. The backend keeps validating code/field/severity on submission.
 */
const ISSUE_CODE = 'content_adjustment'

function createIssueDraft(key: string): IssueDraft {
  return { key, field: 'revision', message: '', severity: 'blocking' }
}

export function ModerationActions({
  revisionId,
  blockingIssueCount,
  moderationError,
}: ModerationActionsProps) {
  const approveForm = useForm({ reason: '' })
  const rejectForm = useForm({ reason: '' })
  const changesForm = useForm<{ reason: string; issues: IssueDraft[] }>({
    reason: '',
    issues: [createIssueDraft('issue-0')],
  })

  const issueKeyCounter = useRef(1)
  const operationRef = useRef<ModerationOperation | null>(null)
  const [activeOperation, setActiveOperation] = useState<ModerationOperation | null>(null)
  const [changesDialogOpen, setChangesDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  const beginOperation = useCallback((operation: ModerationOperation) => {
    if (operationRef.current) return false

    operationRef.current = operation
    setActiveOperation(operation)
    return true
  }, [])

  const finishOperation = useCallback(() => {
    operationRef.current = null
    setActiveOperation(null)
  }, [])

  const busy = activeOperation !== null
  const busyReason = busy ? 'Aguarde a ação em andamento terminar.' : undefined
  const changesErrors = changesForm.errors as Record<string, string | undefined>

  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginOperation('approve')) return

    approveForm.post(`/backoffice/moderation/${revisionId}/approve`, {
      preserveScroll: true,
      onFinish: finishOperation,
    })
  }

  function openChangesDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setChangesDialogOpen(true)
  }

  function confirmRequestChanges() {
    if (!beginOperation('request_changes')) return

    changesForm.transform((data) => ({
      reason: data.reason,
      issues: data.issues.map(({ field, message, severity }) => ({
        code: ISSUE_CODE,
        field,
        message,
        severity,
      })),
    }))
    changesForm.post(`/backoffice/moderation/${revisionId}/request-changes`, {
      preserveScroll: true,
      onFinish: () => {
        finishOperation()
        setChangesDialogOpen(false)
      },
    })
  }

  function openRejectDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setRejectDialogOpen(true)
  }

  function confirmReject() {
    if (!beginOperation('reject')) return

    rejectForm.post(`/backoffice/moderation/${revisionId}/reject`, {
      preserveScroll: true,
      onFinish: () => {
        finishOperation()
        setRejectDialogOpen(false)
      },
    })
  }

  function updateIssue(key: string, patch: Partial<Omit<IssueDraft, 'key'>>) {
    changesForm.setData(
      'issues',
      changesForm.data.issues.map((issue) => (issue.key === key ? { ...issue, ...patch } : issue))
    )
  }

  return (
    <div className="space-y-6">
      {moderationError ? (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertTitle>A ação de moderação não pôde ser concluída</AlertTitle>
            <AlertDescription>{moderationError}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <section aria-label="Ações de moderação" className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={approve} className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">Aprovar e publicar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A publicação troca o ponteiro público somente depois de todos os gates passarem.
            </p>
          </div>
          <EditorField
            htmlFor="approve-reason"
            label="Observação"
            hint="Opcional"
            error={approveForm.errors.reason ?? null}
          >
            <Textarea
              id="approve-reason"
              rows={4}
              maxLength={1000}
              disabled={busy}
              value={approveForm.data.reason}
              onChange={(event) => approveForm.setData('reason', event.target.value)}
              placeholder="Contexto da aprovação para o histórico"
              className="resize-y"
            />
          </EditorField>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || blockingIssueCount > 0}
            title={
              blockingIssueCount > 0
                ? 'Resolva os bloqueios do PublicationGate antes de aprovar.'
                : busyReason
            }
          >
            {activeOperation === 'approve' ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Aprovando…
              </>
            ) : (
              'Aprovar revisão'
            )}
          </Button>
        </form>

        <form
          onSubmit={openChangesDialog}
          className="space-y-4 rounded-3xl border border-border bg-card p-6 xl:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Solicitar correções</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A revisão volta ao parceiro e as pendências estruturadas permanecem no histórico
                após a ressubmissão.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                changesForm.setData('issues', [
                  ...changesForm.data.issues,
                  createIssueDraft(`issue-${issueKeyCounter.current++}`),
                ])
              }
            >
              <Plus aria-hidden="true" className="size-4" />
              Adicionar pendência
            </Button>
          </div>

          <EditorField
            htmlFor="changes-reason"
            label="Resumo da decisão"
            required
            error={changesErrors.reason ?? null}
          >
            <Input
              id="changes-reason"
              required
              minLength={3}
              maxLength={1000}
              disabled={busy}
              value={changesForm.data.reason}
              onChange={(event) => changesForm.setData('reason', event.target.value)}
              placeholder="O que precisa mudar antes da publicação"
            />
          </EditorField>

          <div className="space-y-3">
            {changesForm.data.issues.map((issue, index) => {
              const fieldError = changesErrors[`issues.${index}.field`]
              const messageError = changesErrors[`issues.${index}.message`]
              const severityError = changesErrors[`issues.${index}.severity`]

              return (
                <div
                  key={issue.key}
                  className="grid gap-3 rounded-2xl bg-muted/60 p-4 md:grid-cols-[1fr_1.6fr_0.8fr_auto] md:items-start"
                >
                  <EditorField
                    htmlFor={`${issue.key}-field`}
                    label="Onde corrigir"
                    error={fieldError ?? null}
                  >
                    <select
                      id={`${issue.key}-field`}
                      required
                      disabled={busy}
                      value={issue.field}
                      onChange={(event) => updateIssue(issue.key, { field: event.target.value })}
                      className={editorSelectClassName}
                    >
                      {MODERATION_ISSUE_FIELD_GROUPS.map((group) => (
                        <optgroup key={group.section} label={group.label}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </EditorField>
                  <EditorField
                    htmlFor={`${issue.key}-message`}
                    label="Correção necessária"
                    required
                    error={messageError ?? null}
                  >
                    <Input
                      id={`${issue.key}-message`}
                      required
                      minLength={3}
                      maxLength={1000}
                      disabled={busy}
                      value={issue.message}
                      onChange={(event) => updateIssue(issue.key, { message: event.target.value })}
                      placeholder="Instrução clara para o parceiro"
                    />
                  </EditorField>
                  <EditorField
                    htmlFor={`${issue.key}-severity`}
                    label="Severidade"
                    error={severityError ?? null}
                  >
                    <select
                      id={`${issue.key}-severity`}
                      disabled={busy}
                      value={issue.severity}
                      onChange={(event) =>
                        updateIssue(issue.key, {
                          severity: event.target.value as IssueDraft['severity'],
                        })
                      }
                      className={editorSelectClassName}
                    >
                      <option value="blocking">Bloqueio</option>
                      <option value="warning">Aviso</option>
                    </select>
                  </EditorField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive md:mt-7"
                    disabled={busy || changesForm.data.issues.length === 1}
                    onClick={() =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.filter((item) => item.key !== issue.key)
                      )
                    }
                    aria-label={`Remover pendência ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>

          <Button type="submit" variant="outline" disabled={busy} title={busyReason}>
            {activeOperation === 'request_changes' ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Enviando correções…
              </>
            ) : (
              'Enviar correções'
            )}
          </Button>

          <ConfirmDialog
            open={changesDialogOpen}
            onOpenChange={(open) => {
              if (!open && operationRef.current) return
              setChangesDialogOpen(open)
            }}
            title="Enviar correções ao parceiro?"
            description="A revisão sai da fila e volta ao parceiro como “Correções solicitadas”. Ele será orientado pelas pendências listadas e precisará ressubmeter a ficha."
            confirmLabel="Enviar correções"
            processing={activeOperation === 'request_changes'}
            onConfirm={confirmRequestChanges}
          />
        </form>
      </section>

      <form
        onSubmit={openRejectDialog}
        className="space-y-4 rounded-3xl border border-destructive/30 bg-card p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-destructive">Rejeitar definitivamente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A revisão será terminal. Uma nova tentativa exigirá a clonagem de outra revisão.
          </p>
        </div>
        <EditorField
          htmlFor="reject-reason"
          label="Motivo da rejeição"
          required
          error={rejectForm.errors.reason ?? null}
        >
          <Textarea
            id="reject-reason"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            disabled={busy}
            value={rejectForm.data.reason}
            onChange={(event) => rejectForm.setData('reason', event.target.value)}
            placeholder="Motivo registrado no histórico e visível para a equipe"
            className="resize-y"
          />
        </EditorField>
        <Button type="submit" variant="destructive" disabled={busy} title={busyReason}>
          {activeOperation === 'reject' ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Rejeitando…
            </>
          ) : (
            'Rejeitar revisão'
          )}
        </Button>

        <ConfirmDialog
          open={rejectDialogOpen}
          onOpenChange={(open) => {
            if (!open && operationRef.current) return
            setRejectDialogOpen(open)
          }}
          title="Rejeitar definitivamente esta revisão?"
          description="A rejeição é terminal: esta revisão não poderá ser reaberta e uma nova tentativa exigirá clonar outra revisão. O motivo fica registrado no histórico."
          confirmLabel="Rejeitar revisão"
          destructive
          processing={activeOperation === 'reject'}
          onConfirm={confirmReject}
        />
      </form>
    </div>
  )
}

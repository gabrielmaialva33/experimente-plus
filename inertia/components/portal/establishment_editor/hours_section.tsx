import type { FormEventHandler } from 'react'
import { CalendarClock, Clock3, Plus, Trash2 } from 'lucide-react'

import {
  EditorSaveBar,
  EditorSection,
  type EditorDisplayIssue,
} from '~/components/portal/editor_section'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { firstError } from '~/lib/form_errors'
import { cn } from '~/lib/utils'
import { EditorField } from './editor_field'
import type { HourInput, HoursForm } from './types'

const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface HoursSectionProps {
  form: HoursForm
  editable: boolean
  busy: boolean
  issues: EditorDisplayIssue[]
  availabilityType: string
  availabilityLabel: string
  onSubmit: FormEventHandler<HTMLFormElement>
  onReviewIdentity: () => void
}

export function HoursSection({
  form,
  editable,
  busy,
  issues,
  availabilityType,
  availabilityLabel,
  onSubmit,
  onReviewIdentity,
}: HoursSectionProps) {
  const controlsDisabled = !editable || busy

  function updateHour(index: number, change: Partial<HourInput>) {
    form.setData(
      'hours',
      form.data.hours.map((hour, itemIndex) =>
        itemIndex === index ? { ...hour, ...change } : hour
      )
    )
  }

  function addHour(weekday: number) {
    form.setData('hours', [
      ...form.data.hours,
      {
        weekday,
        opens_at: '08:00',
        closes_at: '18:00',
        spans_next_day: false,
        sort_order: form.data.hours.length,
      },
    ])
  }

  function removeHour(index: number) {
    form.setData(
      'hours',
      form.data.hours
        .filter((_, itemIndex) => itemIndex !== index)
        .map((hour, itemIndex) => ({ ...hour, sort_order: itemIndex }))
    )
  }

  return (
    <EditorSection
      id="hours"
      icon={CalendarClock}
      title="Horários e disponibilidade"
      description="Configure os intervalos semanais conforme a forma de atendimento escolhida na identidade."
      issues={issues}
      toolbar={
        <Badge variant="outline" size="sm">
          {availabilityLabel}
        </Badge>
      }
    >
      {availabilityType === 'regular_hours' ? (
        <form onSubmit={onSubmit} aria-busy={form.processing}>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium">Grade semanal</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Os intervalos são agrupados por dia para facilitar a leitura. Use mais de um
                intervalo quando houver pausa e marque os atendimentos que terminam depois da
                meia-noite.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {dayLabels.map((dayLabel, weekday) => {
                const intervals = form.data.hours
                  .map((hour, index) => ({ hour, index }))
                  .filter(({ hour }) => hour.weekday === weekday)

                return (
                  <section
                    key={dayLabel}
                    className="overflow-hidden rounded-xl border border-border/70 bg-background"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{dayLabel}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {intervals.length === 0
                            ? 'Fechado'
                            : `${intervals.length} ${intervals.length === 1 ? 'intervalo' : 'intervalos'}`}
                        </p>
                      </div>
                      {editable ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={controlsDisabled}
                          onClick={() => addHour(weekday)}
                        >
                          <Plus />
                          Intervalo
                        </Button>
                      ) : null}
                    </div>

                    <div className="space-y-3 p-3 sm:p-4">
                      {intervals.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                          Sem atendimento neste dia.
                        </div>
                      ) : (
                        intervals.map(({ hour, index }, intervalIndex) => (
                          <div
                            key={`${weekday}-${index}`}
                            className="rounded-lg border border-border/70 bg-muted/10 p-3"
                          >
                            <div
                              className={cn(
                                'grid items-end gap-2',
                                editable
                                  ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]'
                                  : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
                              )}
                            >
                              <EditorField
                                htmlFor={`opens-at-${index}`}
                                label={intervalIndex === 0 ? 'Abre às' : 'Retorna às'}
                                className="min-w-0"
                              >
                                <Input
                                  id={`opens-at-${index}`}
                                  name={`hours.${index}.opens_at`}
                                  variant="lg"
                                  type="time"
                                  disabled={controlsDisabled}
                                  value={hour.opens_at}
                                  onChange={(event) =>
                                    updateHour(index, { opens_at: event.target.value })
                                  }
                                  className="min-w-0"
                                />
                              </EditorField>

                              <span className="mb-3 text-xs font-medium text-muted-foreground">
                                até
                              </span>

                              <EditorField
                                htmlFor={`closes-at-${index}`}
                                label={intervalIndex === 0 ? 'Fecha às' : 'Pausa às'}
                                className="min-w-0"
                              >
                                <Input
                                  id={`closes-at-${index}`}
                                  name={`hours.${index}.closes_at`}
                                  variant="lg"
                                  type="time"
                                  disabled={controlsDisabled}
                                  value={hour.closes_at}
                                  onChange={(event) =>
                                    updateHour(index, { closes_at: event.target.value })
                                  }
                                  className="min-w-0"
                                />
                              </EditorField>

                              {editable ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  mode="icon"
                                  className="mb-0.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={`Remover intervalo de ${dayLabel}`}
                                  disabled={controlsDisabled}
                                  onClick={() => removeHour(index)}
                                >
                                  <Trash2 />
                                </Button>
                              ) : null}
                            </div>

                            <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                              <Checkbox
                                name={`hours.${index}.spans_next_day`}
                                checked={hour.spans_next_day}
                                disabled={controlsDisabled}
                                onCheckedChange={(checked) =>
                                  updateHour(index, { spans_next_day: checked === true })
                                }
                              />
                              Termina no dia seguinte
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )
              })}
            </div>

            {form.hasErrors ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {firstError(form.errors)}
              </p>
            ) : null}
          </div>

          {editable ? (
            <EditorSaveBar
              processing={form.processing}
              recentlySuccessful={form.recentlySuccessful}
              dirty={form.isDirty}
              disabled={busy && !form.processing}
              label="Salvar horários"
              onDiscard={() => {
                form.reset()
                form.clearErrors()
              }}
            />
          ) : null}
        </form>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-5">
            <Clock3 className="size-6 text-primary" />
            <p className="mt-3 font-semibold">
              {availabilityType === 'always_open'
                ? 'Esta unidade foi definida como sempre aberta.'
                : 'Esta unidade atende somente com agendamento.'}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {availabilityType === 'always_open'
                ? 'A grade semanal não é necessária. O servidor ainda valida se a categoria principal permite esse modelo.'
                : 'A grade semanal é opcional. Garanta um telefone, WhatsApp ou link de agendamento na etapa de identidade.'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={busy}
              onClick={onReviewIdentity}
            >
              Revisar forma de atendimento
            </Button>
          </div>
        </div>
      )}
    </EditorSection>
  )
}

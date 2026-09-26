import type { FormEventHandler } from 'react'
import { CalendarClock, Clock3, Copy, Plus, Trash2 } from 'lucide-react'

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
import type { HourInput, HoursForm } from './types'

const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
/** Rows start on Monday, the way a week is read on a door sign. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAYS_AFTER_MONDAY = [2, 3, 4, 5]

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

  const mondayIntervals = form.data.hours.filter((hour) => hour.weekday === 1)

  /** Tuesday to Friday take Monday's intervals, replacing what they had. */
  function copyMondayToWeekdays() {
    const kept = form.data.hours.filter((hour) => !WEEKDAYS_AFTER_MONDAY.includes(hour.weekday))
    const copies = WEEKDAYS_AFTER_MONDAY.flatMap((weekday) =>
      mondayIntervals.map((hour) => ({ ...hour, weekday }))
    )
    form.setData(
      'hours',
      [...kept, ...copies].map((hour, index) => ({ ...hour, sort_order: index }))
    )
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                Um horário por linha. Use mais de um intervalo quando houver pausa e marque “vira a
                noite” quando fechar depois da meia-noite.
              </p>
              {editable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  shape="pill"
                  className="shrink-0"
                  disabled={controlsDisabled || mondayIntervals.length === 0}
                  onClick={copyMondayToWeekdays}
                >
                  <Copy />
                  Copiar segunda para terça a sexta
                </Button>
              ) : null}
            </div>

            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border-subtle">
              <caption className="sr-only">Horários de atendimento por dia da semana</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Intervalos</th>
                  {editable ? <th scope="col">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {WEEK_ORDER.map((weekday, rowIndex) => {
                  const dayLabel = dayLabels[weekday]
                  const intervals = form.data.hours
                    .map((hour, index) => ({ hour, index }))
                    .filter(({ hour }) => hour.weekday === weekday)

                  return (
                    <tr key={dayLabel} className="align-top">
                      <th
                        scope="row"
                        className={cn(
                          'w-28 px-4 py-3 text-left text-sm font-semibold',
                          rowIndex > 0 && 'border-t border-border-subtle'
                        )}
                      >
                        <span className="flex h-10 items-center">{dayLabel}</span>
                      </th>
                      <td
                        className={cn(
                          'px-2 py-3 sm:px-4',
                          rowIndex > 0 && 'border-t border-border-subtle'
                        )}
                      >
                        {intervals.length === 0 ? (
                          <span className="flex h-10 items-center text-sm text-muted-foreground">
                            Fechado
                          </span>
                        ) : (
                          <ul className="space-y-2">
                            {intervals.map(({ hour, index }) => (
                              <li
                                key={`${weekday}-${index}`}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <Input
                                  id={`opens-at-${index}`}
                                  name={`hours.${index}.opens_at`}
                                  aria-label={`${dayLabel}, abre às`}
                                  variant="lg"
                                  type="time"
                                  disabled={controlsDisabled}
                                  value={hour.opens_at}
                                  onChange={(event) =>
                                    updateHour(index, { opens_at: event.target.value })
                                  }
                                  className="w-32"
                                />
                                <span className="text-sm text-muted-foreground">até</span>
                                <Input
                                  id={`closes-at-${index}`}
                                  name={`hours.${index}.closes_at`}
                                  aria-label={`${dayLabel}, fecha às`}
                                  variant="lg"
                                  type="time"
                                  disabled={controlsDisabled}
                                  value={hour.closes_at}
                                  onChange={(event) =>
                                    updateHour(index, { closes_at: event.target.value })
                                  }
                                  className="w-32"
                                />
                                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[0.8125rem] text-muted-foreground">
                                  <Checkbox
                                    name={`hours.${index}.spans_next_day`}
                                    checked={hour.spans_next_day}
                                    disabled={controlsDisabled}
                                    onCheckedChange={(checked) =>
                                      updateHour(index, { spans_next_day: checked === true })
                                    }
                                  />
                                  Vira a noite
                                </label>
                                {editable ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    mode="icon"
                                    className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Remover intervalo de ${dayLabel}`}
                                    disabled={controlsDisabled}
                                    onClick={() => removeHour(index)}
                                  >
                                    <Trash2 />
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      {editable ? (
                        <td
                          className={cn(
                            'w-px whitespace-nowrap px-4 py-3 text-right',
                            rowIndex > 0 && 'border-t border-border-subtle'
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            shape="pill"
                            aria-label={`Adicionar intervalo em ${dayLabel}`}
                            disabled={controlsDisabled}
                            onClick={() => addHour(weekday)}
                          >
                            <Plus />
                            Intervalo
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>

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
                ? 'Este lugar está marcado como sempre aberto.'
                : 'Este lugar atende somente com agendamento.'}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {availabilityType === 'always_open'
                ? 'Não é preciso informar horários. A categoria principal precisa permitir essa opção.'
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

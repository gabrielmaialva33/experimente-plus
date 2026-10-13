import { PiggyBank } from 'lucide-react'

import { Card, CardContent } from '~/components/ui/card'
import { formatCurrency } from '~/lib/helpers/format_helpers'
import type { BenefitSavings, SavingsTotals } from '~/types/benefit_savings'

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`

/**
 * The money of a period as the person reads it: exact when every value is a
 * fixed discount, "cerca de" as soon as an estimate is part of it, and nothing
 * when no use had a money value.
 */
export function savingsAmount(totals: SavingsTotals): string | null {
  const cents = totals.savings_exact_cents + totals.savings_estimated_cents
  if (cents <= 0) return null
  const money = formatCurrency(cents / 100)
  return totals.savings_estimated_cents > 0 ? `cerca de ${money}` : money
}

/** "Em 2026 você visitou 4 lugares e economizou cerca de R$ 120,00." */
export function recapSentence(year: number, totals: SavingsTotals): string {
  const visited = `Em ${year} você visitou ${plural(totals.places_visited, 'lugar', 'lugares')}`
  const amount = savingsAmount(totals)
  return amount
    ? `${visited} e economizou ${amount}.`
    : `${visited} e usou ${plural(totals.benefits_used, 'benefício', 'benefícios')}.`
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-2xl border border-border-subtle bg-success-soft p-4'
          : 'rounded-2xl border border-border-subtle bg-background p-4'
      }
    >
      <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 font-display text-2xl font-extrabold leading-tight tabular-nums">
        {value}
      </dd>
    </div>
  )
}

/** Where the numbers come from: the estimate is never presented as exact. */
function HowWeCount() {
  return (
    <details className="group rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-primary-accent">
        Como calculamos a economia
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-muted-foreground">
        <li>Descontos em reais entram pelo valor do desconto.</li>
        <li>
          Descontos em porcentagem são estimados com o ticket médio do lugar, o valor médio por
          pessoa que ele informa.
        </li>
        <li>Lugares sem ticket médio não entram na estimativa.</li>
        <li>Cortesias e “compre um, ganhe outro” contam como uso, sem valor em reais.</li>
      </ul>
    </details>
  )
}

export function WalletSavings({ savings }: { savings: BenefitSavings }) {
  const { current, past } = savings
  const amount = savingsAmount(current)
  const estimated = current.savings_estimated_cents > 0

  return (
    <section aria-labelledby="wallet-savings-title" className="mt-8">
      <Card className="border border-border-subtle bg-card">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-accent">
              <PiggyBank className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="wallet-savings-title"
                className="font-display text-[1.3125rem] font-extrabold leading-tight"
              >
                Sua economia
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {current.editions.length > 0
                  ? `Nesta edição: ${current.editions.map((edition) => edition.name).join(' · ')}`
                  : 'Lugares visitados e quanto você economizou com os benefícios.'}
              </p>
            </div>
          </div>

          {current.benefits_used === 0 ? (
            <p className="rounded-2xl border border-border-subtle bg-status-neutral px-4 py-3 text-sm font-semibold text-status-neutral-foreground">
              Use seu primeiro benefício para começar a contar.
            </p>
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Lugares visitados"
                  value={current.places_visited.toLocaleString('pt-BR')}
                />
                <Stat
                  label="Benefícios usados"
                  value={current.benefits_used.toLocaleString('pt-BR')}
                />
                <Stat
                  label={estimated ? 'Economia estimada' : 'Economia'}
                  value={amount ?? 'Sem valor em reais'}
                  accent
                />
              </dl>
              {current.uses_without_estimate > 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {plural(current.uses_without_estimate, 'uso ficou', 'usos ficaram')} fora da
                  estimativa porque o lugar não informa o ticket médio.
                </p>
              ) : null}
              {current.top_places.length > 0 ? (
                <div>
                  <h3
                    id="wallet-savings-places"
                    className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    Lugares mais visitados
                  </h3>
                  <ol
                    aria-labelledby="wallet-savings-places"
                    className="mt-2 divide-y divide-border-subtle text-sm"
                  >
                    {current.top_places.map((place, index) => (
                      <li
                        key={`${index}-${place.name}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
                      >
                        <span className="font-semibold">{place.name}</span>
                        <span className="text-muted-foreground">
                          {plural(place.visits, 'visita', 'visitas')}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </>
          )}

          {past.length > 0 ? (
            <div>
              <h3
                id="wallet-savings-past"
                className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground"
              >
                Edições anteriores
              </h3>
              <ul aria-labelledby="wallet-savings-past" className="mt-2 grid gap-3 md:grid-cols-2">
                {past.map((recap) => (
                  <li
                    key={recap.edition.id}
                    className="rounded-2xl border border-border-subtle bg-primary-soft p-4"
                  >
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                      {recap.edition.name}
                    </p>
                    <p className="mt-1.5 font-display text-lg font-extrabold leading-snug">
                      {recapSentence(recap.edition.year, recap)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <HowWeCount />
        </CardContent>
      </Card>
    </section>
  )
}

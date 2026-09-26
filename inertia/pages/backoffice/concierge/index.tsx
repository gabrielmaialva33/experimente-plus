import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, Info, Server, Sparkles } from 'lucide-react'

import { ResourceForm } from '~/components/backoffice/resource_form'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { record, text } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'

type ConciergePageProps = {
  policy: unknown
  infrastructure: unknown
}

/**
 * The operation's own choices about its assistant, in the order a person
 * weighs them: whether it answers, how much it reads, how much one person may
 * use. The ranges repeat the server's, so the hints are the rules, not advice.
 */
export const conciergePolicyFields: FieldSpec[] = [
  {
    name: 'enabled',
    label: 'Concierge ativo nesta operação',
    type: 'checkbox',
    hint: 'Desligado, o app mostra os lugares do catálogo sem consultar o modelo de IA.',
  },
  {
    name: 'max_catalog_items',
    label: 'Itens do catálogo por pergunta',
    type: 'number',
    step: '1',
    hint: 'De 8 a 40. Quantos lugares, experiências e eventos o modelo recebe para escolher.',
  },
  {
    name: 'daily_questions_per_person',
    label: 'Perguntas por pessoa por dia',
    type: 'number',
    step: '1',
    hint: 'De 1 a 200, para quem está conectado. Renova à meia-noite de Brasília; passado o limite, o app mostra o catálogo sem o modelo.',
  },
]

function yesNo(value: unknown, yes: string, no: string) {
  return value === true ? yes : no
}

export default function BackofficeConcierge({ policy, infrastructure }: ConciergePageProps) {
  const { can } = useAuth()
  const current = record(policy)
  const status = record(infrastructure)
  const canUpdate = can('settings.update')

  return (
    <MainLayout>
      <Head title="Concierge IA" />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Regras da operação"
          icon={Sparkles}
          title="Concierge IA"
          description="Como o assistente de descoberta responde nesta operação. Ele só cita lugares, experiências e eventos publicados no catálogo."
          actions={
            <Button asChild variant="outline" size="lg" shape="pill">
              <Link href="/backoffice/review-policy">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Todas as regras
              </Link>
            </Button>
          }
        />

        <section
          role="note"
          className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-accent" />
          <p>
            <strong>Valor provisório até a definição da operação.</strong> Provedor, modelo e
            limites de consumo de IA mantêm o assistente funcionando até lá e podem mudar.
          </p>
        </section>

        <section
          aria-labelledby="concierge-policy-heading"
          className="rounded-card border border-border-subtle bg-card p-5 sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Nesta operação
          </p>
          <h2
            id="concierge-policy-heading"
            className="mb-6 font-display text-xl font-extrabold tracking-[-0.01em]"
          >
            Parâmetros do assistente
          </h2>
          {current && canUpdate ? (
            <ResourceForm
              idPrefix="concierge-policy"
              fields={conciergePolicyFields}
              record={current}
              method="put"
              url="/backoffice/concierge"
              submitLabel="Salvar configuração"
            />
          ) : (
            <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted-foreground">
              Você pode consultar, mas não alterar, a configuração do Concierge desta operação.
            </p>
          )}
        </section>

        <section
          aria-labelledby="concierge-infrastructure-heading"
          className="rounded-card border border-border-subtle bg-card p-5 sm:p-7"
        >
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
              <Server aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <h2
                id="concierge-infrastructure-heading"
                className="font-display text-xl font-extrabold tracking-[-0.01em]"
              >
                Infraestrutura
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Definida na implantação, não nesta tela. A chave de acesso ao provedor nunca é
                exibida.
              </p>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ['Assistente na implantação', yesNo(status?.globally_enabled, 'Ligado', 'Desligado')],
              [
                'Provedor de IA',
                yesNo(status?.provider_configured, 'Configurado', 'Não configurado'),
              ],
              ['Modelo principal', text(status, 'primary_model') || 'Não definido'],
              ['Modelo de reserva', text(status, 'fallback_model') || 'Não definido'],
            ].map(([term, value]) => (
              <div key={term} className="border-t border-border-subtle pt-3">
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {term}
                </dt>
                <dd className="mt-1 font-semibold break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </MainLayout>
  )
}

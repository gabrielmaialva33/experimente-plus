import { Head } from '@inertiajs/react'
import { AlertTriangle, Sparkles } from 'lucide-react'

import { ResourceForm } from '~/components/backoffice/resource_form'
import { PageHeader } from '~/components/page_header'
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
      <div className="space-y-7">
        <PageHeader
          eyebrow="Administração"
          icon={Sparkles}
          title="Concierge IA"
          description="Como o assistente de descoberta responde nesta operação. Ele só cita lugares, experiências e eventos publicados no catálogo."
        />

        <section
          role="note"
          className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning-foreground"
          />
          <p>
            <strong>Valores provisórios.</strong> Pelo contrato (Anexo I, item 15), o provedor, o
            modelo e os limites de consumo de IA são definidos pelo contratante antes da produção.
            Os números abaixo existem para a plataforma funcionar até lá, e não registram uma
            decisão dele.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
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
            <p className="text-sm text-muted-foreground">
              Você pode consultar, mas não alterar, a configuração do Concierge desta operação.
            </p>
          )}
        </section>

        <section
          aria-labelledby="concierge-infrastructure-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <h2 id="concierge-infrastructure-heading" className="text-base font-semibold">
            Infraestrutura
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Definida na implantação, não nesta tela. A chave de acesso ao provedor nunca é exibida.
          </p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Assistente na implantação</dt>
              <dd className="font-medium">
                {yesNo(status?.globally_enabled, 'Ligado', 'Desligado')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Provedor de IA</dt>
              <dd className="font-medium">
                {yesNo(status?.provider_configured, 'Configurado', 'Não configurado')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modelo principal</dt>
              <dd className="font-medium break-all">
                {text(status, 'primary_model') || 'Não definido'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modelo de reserva</dt>
              <dd className="font-medium break-all">
                {text(status, 'fallback_model') || 'Não definido'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </MainLayout>
  )
}

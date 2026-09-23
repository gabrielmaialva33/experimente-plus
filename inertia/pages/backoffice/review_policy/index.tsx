import { Head } from '@inertiajs/react'
import { AlertTriangle, SlidersHorizontal } from 'lucide-react'

import { ResourceForm } from '~/components/backoffice/resource_form'
import { PageHeader } from '~/components/page_header'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { numeric, record } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'

interface ReviewPolicyPageProps {
  policy: unknown
  moderation_rules: unknown
}

/**
 * The fields the admin API accepts, in the order a person thinks about them.
 * `report_moderation_days` is not among them: it is read-only in the API today,
 * so the screen shows it rather than pretending it can change it.
 */
export const reviewPolicyFields: FieldSpec[] = [
  {
    name: 'require_visit_proof',
    label: 'Exigir comprovação de visita para avaliar',
    type: 'checkbox',
  },
  { name: 'min_text_length', label: 'Mínimo de caracteres', type: 'number', step: '1' },
  { name: 'max_text_length', label: 'Máximo de caracteres', type: 'number', step: '1' },
  { name: 'max_photos', label: 'Fotos por avaliação', type: 'number', step: '1' },
  { name: 'max_videos', label: 'Vídeos por avaliação', type: 'number', step: '1' },
  {
    name: 'daily_limit_per_user',
    label: 'Avaliações por pessoa por dia',
    type: 'number',
    step: '1',
  },
  {
    name: 'min_edit_interval_minutes',
    label: 'Intervalo mínimo entre edições',
    type: 'number',
    step: '1',
    hint: 'Em minutos',
  },
  {
    name: 'edit_window_days',
    label: 'Prazo para editar uma avaliação',
    type: 'number',
    step: '1',
    hint: 'Em dias',
  },
]

const modeOptions = [
  { value: 'off', label: 'Desligada' },
  { value: 'flag', label: 'Publica e abre denúncia' },
  { value: 'hold', label: 'Retém até uma pessoa decidir' },
]

/**
 * The automatic rules of ADR-0031, one mode each, plus the operation's own
 * list of blocked terms. The hints say what a hit looks like in practice,
 * because "contact" or "payment data" alone does not tell an operator what is
 * about to be held.
 */
export const moderationRuleFields: FieldSpec[] = [
  {
    name: 'contact_mode',
    label: 'Dados de contato',
    type: 'select',
    options: modeOptions,
    hint: 'E-mail e telefone publicados no texto.',
  },
  {
    name: 'payment_data_mode',
    label: 'Dados de pagamento',
    type: 'select',
    options: modeOptions,
    hint: 'Número de cartão válido e chave Pix.',
  },
  {
    name: 'link_mode',
    label: 'Links',
    type: 'select',
    options: modeOptions,
    hint: 'Endereços de sites e perfis (@usuario).',
  },
  {
    name: 'blocked_term_mode',
    label: 'Termos bloqueados',
    type: 'select',
    options: modeOptions,
    hint: 'Aplica a lista abaixo, por palavra inteira, sem diferenciar maiúsculas e acentos.',
  },
  {
    name: 'blocked_terms_text',
    label: 'Lista de termos bloqueados',
    type: 'textarea',
    hint: 'Um termo por linha. A lista começa vazia: quem define é a operação.',
  },
]

export default function BackofficeReviewPolicy({
  policy,
  moderation_rules: moderationRules,
}: ReviewPolicyPageProps) {
  const { can } = useAuth()
  const current = record(policy)
  const rules = record(moderationRules)
  const canUpdate = can('settings.update')

  return (
    <MainLayout>
      <Head title="Regras de avaliação" />
      <div className="space-y-7">
        <PageHeader
          eyebrow="Administração"
          icon={SlidersHorizontal}
          title="Regras de avaliação"
          description="Limites e exigências que valem para todas as avaliações desta operação. Mudar uma regra não reescreve avaliações já publicadas."
        />

        <section
          role="note"
          className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <p>
            <strong>Valores provisórios.</strong> Pelo contrato (Anexo I, item 15), estes parâmetros
            são definidos pelo contratante antes da produção. Os números abaixo existem para a
            plataforma funcionar até lá, e não registram uma decisão dele.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
          {canUpdate ? (
            <ResourceForm
              idPrefix="review-policy"
              fields={reviewPolicyFields}
              record={current}
              method="put"
              url="/backoffice/review-policy"
              submitLabel="Salvar regras"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Você pode consultar, mas não alterar, as regras desta operação.
            </p>
          )}

          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            Prazo de moderação de denúncias:{' '}
            <strong className="text-foreground">
              {numeric(current, 'report_moderation_days')} dias
            </strong>{' '}
            — definido pela operação, ainda sem ajuste por esta tela.
          </p>
        </section>

        <section
          aria-labelledby="moderation-rules-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <h2 id="moderation-rules-heading" className="text-base font-semibold">
            Moderação automática
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Regras que examinam avaliações, respostas de parceiros e conteúdo publicado por eles.
            Nenhuma regra apaga nada: cada ocorrência abre uma denúncia na fila, e uma pessoa decide.
          </p>
          {rules && canUpdate ? (
            <ResourceForm
              idPrefix="moderation-rules"
              fields={moderationRuleFields}
              record={rules}
              method="put"
              url="/backoffice/moderation-rules"
              submitLabel="Salvar regras de moderação"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Você pode consultar, mas não alterar, as regras de moderação desta operação.
            </p>
          )}
        </section>
      </div>
    </MainLayout>
  )
}

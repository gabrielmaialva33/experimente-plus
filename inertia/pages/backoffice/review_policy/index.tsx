import { Head, Link } from '@inertiajs/react'
import {
  ArrowRight,
  Info,
  Megaphone,
  MessageSquareText,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { ResourceForm } from '~/components/backoffice/resource_form'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { numeric, record } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'

interface ReviewPolicyPageProps {
  policy: unknown
  moderation_rules: unknown
  content_policy?: unknown
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

/**
 * What partners may publish without a person looking first, and how much. These
 * used to sit under the daily content queue; they are rules of the operation,
 * changed rarely, so they live with the others (audit W35). Same route, same
 * service, same platform-admin requirement.
 */
export const contentPolicyFields: FieldSpec[] = [
  {
    name: 'require_experience_approval',
    label: 'Aprovar experiências antes de publicar',
    type: 'checkbox',
  },
  { name: 'require_event_approval', label: 'Aprovar eventos antes de publicar', type: 'checkbox' },
  {
    name: 'require_showcase_item_approval',
    label: 'Aprovar itens de vitrine antes de publicar',
    type: 'checkbox',
  },
  {
    name: 'max_media_per_content',
    label: 'Máximo de mídias por conteúdo',
    type: 'number',
    step: '1',
  },
  {
    name: 'min_event_notice_minutes',
    label: 'Antecedência mínima do evento',
    type: 'number',
    step: '1',
    hint: 'Em minutos',
  },
]

const sections = [
  { id: 'avaliacoes', label: 'Avaliações' },
  { id: 'moderacao-automatica', label: 'Moderação automática' },
  { id: 'publicacao', label: 'Publicação de conteúdo' },
]

function RuleSection({
  id,
  overline,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string
  overline: string
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 rounded-card border border-border-subtle bg-card p-5 sm:p-7"
    >
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {overline}
          </p>
          <h2
            id={`${id}-heading`}
            className="font-display text-xl font-extrabold tracking-[-0.01em]"
          >
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function ReadOnly({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted-foreground">{children}</p>
  )
}

export default function BackofficeReviewPolicy({
  policy,
  moderation_rules: moderationRules,
  content_policy: contentPolicy,
}: ReviewPolicyPageProps) {
  const { can } = useAuth()
  const current = record(policy)
  const rules = record(moderationRules)
  const publication = record(contentPolicy)
  const canUpdate = can('settings.update')

  return (
    <MainLayout>
      <Head title="Regras da operação" />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Regras da operação"
          icon={SlidersHorizontal}
          title="Avaliações, moderação e publicação"
          description="Limites e exigências que valem para toda esta operação. Mudar uma regra não reescreve o que já foi publicado."
        />

        <section
          role="note"
          className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-accent" />
          <p>
            <strong>Valor provisório até a definição da operação.</strong> Os números abaixo mantêm
            a plataforma funcionando até lá e podem mudar a qualquer momento.
          </p>
        </section>

        <nav aria-label="Seções das regras" className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {section.label}
            </a>
          ))}
          <Link
            href="/backoffice/concierge"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Concierge IA
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </nav>

        <RuleSection
          id="avaliacoes"
          overline="Avaliações"
          title="Regras de avaliação"
          description="O que uma pessoa precisa para avaliar um lugar e quanto pode enviar."
          icon={MessageSquareText}
        >
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
            <ReadOnly>Você pode consultar, mas não alterar, as regras desta operação.</ReadOnly>
          )}

          <p className="mt-5 border-t border-border-subtle pt-4 text-sm text-muted-foreground">
            Prazo de moderação de denúncias:{' '}
            <strong className="text-foreground">
              {numeric(current, 'report_moderation_days')} dias
            </strong>{' '}
            — definido pela operação, ainda sem ajuste por esta tela.
          </p>
        </RuleSection>

        <RuleSection
          id="moderacao-automatica"
          overline="Moderação automática"
          title="Moderação automática"
          description="Regras que examinam avaliações, respostas de parceiros e conteúdo publicado por eles. Nenhuma regra apaga nada: cada ocorrência abre uma denúncia na fila, e uma pessoa decide."
          icon={ShieldAlert}
        >
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
            <ReadOnly>
              Você pode consultar, mas não alterar, as regras de moderação desta operação.
            </ReadOnly>
          )}
        </RuleSection>

        {publication ? (
          <RuleSection
            id="publicacao"
            overline="Conteúdo de parceiros"
            title="Publicação e limites"
            description="Quais experiências, eventos e itens de vitrine passam pela Caixa de moderação antes de aparecer, e quanto cada um pode ter."
            icon={Megaphone}
          >
            {canUpdate ? (
              <ResourceForm
                idPrefix="content-policy"
                fields={contentPolicyFields}
                record={publication}
                method="put"
                url="/backoffice/content/policy"
                submitLabel="Salvar regras de publicação"
              />
            ) : (
              <ReadOnly>
                Você pode consultar, mas não alterar, as regras de publicação desta operação.
              </ReadOnly>
            )}
          </RuleSection>
        ) : null}

        <section className="flex flex-col gap-4 rounded-card border border-border-subtle bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
              <Sparkles aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Concierge IA
              </p>
              <h2 className="font-display text-xl font-extrabold tracking-[-0.01em]">
                Limites do assistente
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Se o assistente responde nesta operação e quantas perguntas cada pessoa faz por dia.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="lg" shape="pill">
            <Link href="/backoffice/concierge">
              Abrir Concierge
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </section>
      </div>
    </MainLayout>
  )
}

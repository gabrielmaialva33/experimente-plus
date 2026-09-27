import {
  AtSign,
  CalendarCheck,
  Globe2,
  MapPinned,
  MessageCircleMore,
  Phone,
  Share2,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { analyticsEventId, trackAnalyticsEvents, trackedActionHref } from '~/lib/analytics'
import { formatPhoneBR, type CatalogDetail } from '~/lib/catalog'

interface EstablishmentActionsProps {
  detail: CatalogDetail
}

function externalInstagramHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return `https://instagram.com/${value.replace(/^@/, '')}`
}

export function EstablishmentActions({ detail }: EstablishmentActionsProps) {
  const [shareStatus, setShareStatus] = useState('')
  // The server builds the route from the published coordinates alone and answers
  // 404 without them, so a street or district is no reason to offer "Como chegar".
  const routeAvailable = detail.address.latitude !== null && detail.address.longitude !== null
  /*
   * The page's main action is navy (`primary`), not orange: direction A keeps
   * `cta` for converting a benefit or a purchase, the app's rule since audit A11.
   * Visiting comes first, as on the phone; without a route the first available
   * contact takes the place. The rest stay `contact`, so one action leads.
   */
  const primaryAction = (
    [
      ['route', routeAvailable],
      ['whatsapp', Boolean(detail.contacts.whatsapp)],
      ['phone', Boolean(detail.contacts.phone)],
      ['website', Boolean(detail.contacts.website)],
      ['booking', Boolean(detail.contacts.bookingUrl)],
    ] as const
  ).find(([, available]) => available)?.[0]
  const variantFor = (action: NonNullable<typeof primaryAction>) =>
    action === primaryAction ? 'primary' : 'contact'

  async function shareEstablishment() {
    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: detail.name,
          text: detail.shortDescription ?? `Conheça ${detail.name} no Experimente+.`,
          url,
        })
        setShareStatus('Compartilhado com sucesso.')
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareStatus('Link copiado para a área de transferência.')
      } else {
        setShareStatus('Copie o endereço desta página para compartilhar.')
        return
      }

      void trackAnalyticsEvents([
        {
          event_id: analyticsEventId(),
          event_type: 'share_click',
          city_slug: detail.city.slug,
          establishment_slug: detail.slug,
          category_slug: detail.categories.find((category) => category.isPrimary)?.slug,
        },
      ])
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareStatus('Não foi possível compartilhar agora.')
    }
  }

  return (
    <section
      aria-labelledby="contact-actions-title"
      className="rounded-card border border-border-subtle bg-card p-5"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
          Contato e rota
        </p>
        <h2
          id="contact-actions-title"
          className="mt-1 font-display text-lg font-extrabold leading-tight"
        >
          Entre em contato
        </h2>
      </div>

      <div className="mt-5 grid gap-2.5">
        {routeAvailable ? (
          <Button
            variant={variantFor('route')}
            size="xl"
            shape="pill"
            className="justify-start"
            asChild
          >
            <a
              href={trackedActionHref(detail.city.slug, detail.slug, 'route')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPinned className="size-4" /> Como chegar
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.whatsapp ? (
          <Button
            variant={variantFor('whatsapp')}
            size="xl"
            shape="pill"
            className="justify-start"
            asChild
          >
            <a
              href={trackedActionHref(detail.city.slug, detail.slug, 'whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleMore className="size-4" /> Chamar no WhatsApp
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.phone ? (
          <Button
            variant={variantFor('phone')}
            size="xl"
            shape="pill"
            className="justify-start"
            asChild
          >
            <a href={trackedActionHref(detail.city.slug, detail.slug, 'phone')}>
              <Phone className="size-4" /> Ligar para {formatPhoneBR(detail.contacts.phone)}
            </a>
          </Button>
        ) : null}

        {detail.contacts.website ? (
          <Button
            variant={variantFor('website')}
            size="xl"
            shape="pill"
            className="justify-start"
            asChild
          >
            <a
              href={trackedActionHref(detail.city.slug, detail.slug, 'website')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe2 className="size-4" /> Visitar o site
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.bookingUrl ? (
          <Button
            variant={variantFor('booking')}
            size="xl"
            shape="pill"
            className="justify-start"
            asChild
          >
            <a href={detail.contacts.bookingUrl} target="_blank" rel="noopener noreferrer">
              <CalendarCheck className="size-4" /> Agendar ou reservar
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.instagram ? (
          <Button variant="ghost" size="xl" shape="pill" className="justify-start" asChild>
            <a
              href={externalInstagramHref(detail.contacts.instagram)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <AtSign className="size-4" /> Ver Instagram
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="xl"
          shape="pill"
          className="justify-start"
          onClick={() => void shareEstablishment()}
        >
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>

      {/* Always mounted so the result is announced; it takes room only once it speaks. */}
      <p aria-live="polite" className="mt-3 text-xs text-muted-foreground empty:mt-0">
        {shareStatus}
      </p>
    </section>
  )
}

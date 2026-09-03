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
import type { CatalogDetail } from '~/lib/catalog'

interface EstablishmentActionsProps {
  detail: CatalogDetail
}

function externalInstagramHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return `https://instagram.com/${value.replace(/^@/, '')}`
}

export function EstablishmentActions({ detail }: EstablishmentActionsProps) {
  const [shareStatus, setShareStatus] = useState('')
  const routeAvailable = Boolean(
    (detail.address.latitude !== null && detail.address.longitude !== null) ||
    detail.address.street ||
    detail.address.district
  )

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
    <section aria-labelledby="contact-actions-title" className="rounded-lg border bg-card p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Contato e rota
        </p>
        <h2 id="contact-actions-title" className="mt-1 text-lg font-semibold">
          Entre em contato
        </h2>
      </div>

      <div className="mt-5 grid gap-2.5">
        {detail.contacts.whatsapp ? (
          <Button variant="cta" size="lg" className="h-11 justify-start" asChild>
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

        {routeAvailable ? (
          <Button variant="outline" size="lg" className="h-11 justify-start" asChild>
            <a
              href={trackedActionHref(detail.city.slug, detail.slug, 'route')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPinned className="size-4" /> Traçar rota
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.phone ? (
          <Button variant="outline" size="lg" className="h-11 justify-start" asChild>
            <a href={trackedActionHref(detail.city.slug, detail.slug, 'phone')}>
              <Phone className="size-4" /> Ligar para {detail.contacts.phone}
            </a>
          </Button>
        ) : null}

        {detail.contacts.website ? (
          <Button variant="outline" size="lg" className="h-11 justify-start" asChild>
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
          <Button variant="outline" size="lg" className="h-11 justify-start" asChild>
            <a href={detail.contacts.bookingUrl} target="_blank" rel="noopener noreferrer">
              <CalendarCheck className="size-4" /> Agendar ou reservar
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}

        {detail.contacts.instagram ? (
          <Button variant="ghost" size="lg" className="h-11 justify-start" asChild>
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
          size="lg"
          className="h-11 justify-start"
          onClick={() => void shareEstablishment()}
        >
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-xs text-muted-foreground">
        {shareStatus}
      </p>
    </section>
  )
}

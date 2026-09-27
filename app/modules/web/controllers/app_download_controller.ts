import type { HttpContext } from '@adonisjs/core/http'
import QRCode from 'qrcode'

import appDistribution from '#config/app_distribution'
import env from '#start/env'

export default class InertiaAppDownloadController {
  /**
   * The page testers are sent to. On a computer its QR code opens the same
   * page on the phone, where the instructions sit next to the download.
   */
  async show({ inertia, request }: HttpContext) {
    const origin = env.get('APP_URL') ?? `${request.protocol()}://${request.host()}`
    const pageUrl = new URL('/app', origin).toString()
    const qrSvg = await QRCode.toString(pageUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#13467c', light: '#ffffff' },
    })

    return inertia.render('app/download', {
      android: appDistribution.android,
      pageUrl,
      qrSvg,
    })
  }
}

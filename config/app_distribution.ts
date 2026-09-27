/**
 * Where the mobile app is handed out while it is outside the stores.
 *
 * The APK is attached to a release of the app's public repository under a fixed
 * name, so `releases/latest/download/experimente-plus.apk` always serves the
 * newest one: the download page never changes its link. The fields below only
 * describe the release it currently points at; update them with each release.
 * Everything here is public, and none of it is a credential.
 */
const appDistribution = {
  android: {
    /** A beta for testers: homologation data, simulated payments, not a store build. */
    channel: 'beta' as const,
    version: '1.0.0 beta 3',
    releasedAt: '2026-09-27',
    sizeMegabytes: 110,
    minimumAndroid: '7.0',
    downloadUrl:
      'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest/download/experimente-plus.apk',
    releaseUrl: 'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest',
    sha256: 'abe23ddc97bb87143ce3b1fffa6edd71f20e2aa36f450b04065c079e31c163b9',
  },
}

export type AndroidDistribution = typeof appDistribution.android

export default appDistribution

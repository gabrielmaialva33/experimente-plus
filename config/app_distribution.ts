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
    version: '1.0.0 beta 4',
    releasedAt: '2026-10-13',
    sizeMegabytes: 110,
    minimumAndroid: '7.0',
    downloadUrl:
      'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest/download/experimente-plus.apk',
    releaseUrl: 'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest',
    sha256: '0c9eb8fd350ec5b4b7680dfb16fe61055d994900ebd3e3cda893437f50b9c9b7',
  },
}

export type AndroidDistribution = typeof appDistribution.android

export default appDistribution

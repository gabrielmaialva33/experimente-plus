export default class AnalyticsTrackingPreferenceService {
  allows(dnt: string | undefined, globalPrivacyControl: string | undefined): boolean {
    return dnt?.trim() !== '1' && globalPrivacyControl?.trim() !== '1'
  }
}

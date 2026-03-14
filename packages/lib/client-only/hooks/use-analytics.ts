import { insights } from '@hanzo/insights';

import { extractInsightsConfig } from '@hanzo/sign-lib/constants/feature-flags';

export function useAnalytics() {
  // const featureFlags = useFeatureFlags();
  const isInsightsEnabled = extractInsightsConfig();

  /**
   * Capture an analytic event.
   *
   * @param event The event name.
   * @param properties Properties to attach to the event.
   */
  const capture = (event: string, properties?: Record<string, unknown>) => {
    if (!isInsightsEnabled) {
      return;
    }

    insights.capture(event, properties);
  };

  /**
   * Capture an analytic event.
   *
   * @param error The error to capture.
   * @param properties Properties to attach to the event.
   */
  const captureException = (error: Error, properties?: Record<string, unknown>) => {
    if (!isInsightsEnabled) {
      return;
    }

    insights.captureException(error, properties);
  };

  /**
   * Start the session recording.
   *
   * @param eventFlag The event to check against feature flags to determine whether tracking is enabled.
   */
  const startSessionRecording = (eventFlag?: string) => {
    return;
    // const isSessionRecordingEnabled = featureFlags.getFlag(FEATURE_FLAG_GLOBAL_SESSION_RECORDING);
    // const isSessionRecordingEnabledForEvent = Boolean(eventFlag && featureFlags.getFlag(eventFlag));

    // if (!isInsightsEnabled || !isSessionRecordingEnabled || !isSessionRecordingEnabledForEvent) {
    //   return;
    // }

    // insights.startSessionRecording();
  };

  /**
   * Stop the current session recording.
   */
  const stopSessionRecording = () => {
    return;
    // const isSessionRecordingEnabled = featureFlags.getFlag(FEATURE_FLAG_GLOBAL_SESSION_RECORDING);

    // if (!isInsightsEnabled || !isSessionRecordingEnabled) {
    //   return;
    // }

    // insights.stopSessionRecording();
  };

  return {
    capture,
    captureException,
    startSessionRecording,
    stopSessionRecording,
  };
}

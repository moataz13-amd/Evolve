const ranges = ['dispatch_days_min', 'dispatch_days_max', 'transit_days_min', 'transit_days_max'];
// Owner-confirmed timings also support existing stores before the settings migration is applied.
const confirmedDefaults = {
  delivery_estimates_enabled: true,
  dispatch_days_min: 2,
  dispatch_days_max: 2,
  transit_days_min: 1,
  transit_days_max: 5,
  delivery_skip_weekends: false,
  delivery_timezone: 'Africa/Cairo',
};

export function deliverySettingsError(settings) {
  if (!settings) return '';
  for (const key of ranges) {
    const value = settings[key];
    if (value == null || value === '') {
      if (settings.delivery_estimates_enabled)
        return 'Enter all dispatch and delivery durations before enabling estimates.';
      continue;
    }
    const min = key.startsWith('transit') ? 1 : 0;
    const max = key.startsWith('transit') ? 60 : 30;
    if (!Number.isInteger(value) || value < min || value > max)
      return `Durations must be whole days between ${min} and ${max}.`;
  }
  for (const prefix of ['dispatch', 'transit']) {
    const min = settings[`${prefix}_days_min`];
    const max = settings[`${prefix}_days_max`];
    if (min != null && max != null && max < min)
      return 'The maximum duration must be at least the minimum duration.';
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: settings.delivery_timezone || 'Africa/Cairo' });
  } catch {
    return 'Enter a valid time zone, for example Africa/Cairo.';
  }
  return '';
}

function addDays(date, days, skipWeekends) {
  const result = new Date(date);
  const weekend = () => [5, 6].includes(result.getUTCDay());
  // A zero-day dispatch on a closed day moves to the next working day.
  if (!days && skipWeekends) while (weekend()) result.setUTCDate(result.getUTCDate() + 1);
  while (days > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!skipWeekends || !weekend()) days--;
  }
  return result;
}

export function getDeliveryEstimate(settings, now = new Date()) {
  if (!settings) return null;
  settings = { ...confirmedDefaults, ...settings };
  if (!settings?.delivery_estimates_enabled || deliverySettingsError(settings)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.delivery_timezone || 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  // UTC stores calendar dates only; calculations remain stable across DST and client time zones.
  const ordered = new Date(
    Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day'))),
  );
  const skip = settings.delivery_skip_weekends;
  const dispatchMin = addDays(ordered, settings.dispatch_days_min, skip);
  const dispatchMax = addDays(ordered, settings.dispatch_days_max, skip);
  return {
    ordered,
    dispatchMin,
    dispatchMax,
    arrivalMin: addDays(dispatchMin, settings.transit_days_min, skip),
    arrivalMax: addDays(dispatchMax, settings.transit_days_max, skip),
  };
}

export function formatDeliveryDate(date, isArabic) {
  return new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

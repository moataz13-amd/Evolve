import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeliveryEstimate, deliverySettingsError } from '../src/utils/deliveryEstimate.js';

const settings = {
  delivery_estimates_enabled: true,
  dispatch_days_min: 2,
  dispatch_days_max: 2,
  transit_days_min: 1,
  transit_days_max: 5,
  delivery_timezone: 'Africa/Cairo',
  delivery_skip_weekends: false,
};
const day = (value) => value.toISOString().slice(0, 10);

test('confirmed preparation and transit ranges cross month and year boundaries', () => {
  const dates = getDeliveryEstimate(settings, new Date('2026-12-30T10:00:00Z'));
  assert.equal(day(dates.dispatchMin), '2027-01-01');
  assert.equal(day(dates.dispatchMax), '2027-01-01');
  assert.equal(day(dates.arrivalMin), '2027-01-02');
  assert.equal(day(dates.arrivalMax), '2027-01-06');
});
test('store timezone determines today rather than customer timezone', () => {
  const dates = getDeliveryEstimate(settings, new Date('2026-10-08T22:30:00Z'));
  assert.equal(day(dates.ordered), '2026-10-09');
});
test('Friday and Saturday are excluded from both preparation and transit when configured', () => {
  const dates = getDeliveryEstimate(
    { ...settings, delivery_skip_weekends: true },
    new Date('2026-10-08T10:00:00Z'),
  );
  assert.equal(day(dates.dispatchMin), '2026-10-12');
  assert.equal(day(dates.arrivalMin), '2026-10-13');
  assert.equal(day(dates.arrivalMax), '2026-10-19');
});
test('zero-day dispatch moves from a closed day to the next working day', () => {
  const dates = getDeliveryEstimate(
    { ...settings, delivery_skip_weekends: true, dispatch_days_min: 0, dispatch_days_max: 0 },
    new Date('2026-10-09T10:00:00Z'),
  );
  assert.equal(day(dates.dispatchMin), '2026-10-11');
});
test('disabled, missing and invalid configurations never produce customer promises', () => {
  for (const value of [
    undefined,
    { ...settings, delivery_estimates_enabled: false },
    { ...settings, transit_days_min: null },
    { ...settings, dispatch_days_max: 1 },
    { ...settings, transit_days_min: 1.5 },
    { ...settings, delivery_timezone: 'invalid' },
  ]) {
    assert.equal(getDeliveryEstimate(value), null);
  }
  assert.equal(deliverySettingsError(settings), '');
});

test('existing settings without new columns use the owner-confirmed durations', () => {
  const dates = getDeliveryEstimate({ store_name: 'EVOLVE' }, new Date('2026-10-08T10:00:00Z'));
  assert.equal(day(dates.dispatchMin), '2026-10-10');
  assert.equal(day(dates.arrivalMax), '2026-10-15');
});

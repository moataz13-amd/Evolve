import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeOfferAnnouncements,
  offerAnnouncementText,
} from '../src/utils/offerAnnouncements.js';

const offer = {
  id: 'one',
  active: true,
  discount_type: 'percentage',
  discount_value: 29,
  offer_products: [{ products: { active: true, archived: false, tags: [] } }],
};
test('the top bar advertises only live offers with published, orderable products', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const cases = [
    offer,
    { ...offer, id: 'off', active: false },
    { ...offer, id: 'expired', ends_at: '2026-10-09T12:00:00Z' },
    { ...offer, id: 'future', starts_at: '2026-10-10T00:00:00Z' },
    { ...offer, id: 'empty', offer_products: [] },
    { ...offer, id: 'draft', offer_products: [{ products: { active: false } }] },
    {
      ...offer,
      id: 'preview',
      offer_products: [{ products: { active: true, tags: ['coming-soon'] } }],
    },
  ];
  assert.deepEqual(
    activeOfferAnnouncements(cases, now).map((value) => value.id),
    ['one'],
  );
});
test('announcements describe the actual calculation in English and Arabic using EGP', () => {
  assert.match(offerAnnouncementText(offer), /29% OFF/);
  assert.match(offerAnnouncementText(offer, true), /خصم 29%/);
  assert.equal(
    offerAnnouncementText({ ...offer, discount_type: 'buy_get', buy_quantity: 2, get_quantity: 1 }),
    'Buy 2, get 1 free',
  );
  assert.match(
    offerAnnouncementText({ ...offer, discount_type: 'fixed', discount_value: 50 }),
    /EGP.*50/,
  );
});

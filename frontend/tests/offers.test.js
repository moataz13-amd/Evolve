import test from 'node:test';
import assert from 'node:assert/strict';
import { offerPrice, liveQuantityOffers, quantityOfferLabel } from '../src/utils/offers.js';
import { productBadge, productBadges } from '../src/utils/productBadge.js';

test('automatic discounts choose the best active offer and never produce a negative price', () => {
  const offers = [
    { id: '1', active: true, discount_type: 'percentage', discount_value: 20 },
    { id: '2', active: true, discount_type: 'fixed', discount_value: 30 },
  ];
  assert.equal(offerPrice(100, offers).price, 70);
  assert.equal(offerPrice(25, offers).price, 0);
  assert.equal(offerPrice(100, []).price, 100);
  assert.equal(
    offerPrice(0.29, [{ active: true, discount_type: 'percentage', discount_value: 50 }]).price,
    0.15,
    'half-cent values round like PostgreSQL numeric',
  );
  assert.equal(
    offerPrice(
      100,
      offers.map((offer) => ({ ...offer, active: false })),
    ).price,
    100,
  );
});

test('offer start and end times exclude upcoming and expired discounts', () => {
  const offer = {
    active: true,
    discount_type: 'percentage',
    discount_value: 10,
    starts_at: '2026-10-09T00:00:00Z',
    ends_at: '2026-10-10T00:00:00Z',
  };
  assert.equal(offerPrice(100, [offer], Date.parse('2026-10-08T23:59:59Z')).price, 100);
  assert.equal(offerPrice(100, [offer], Date.parse('2026-10-09T00:00:00Z')).price, 90);
  assert.equal(offerPrice(100, [offer], Date.parse('2026-10-10T00:00:00Z')).price, 100);
});

test('card badges support automatic labels, offer labels, custom labels and hiding', () => {
  const product = { sizes: ['M'], tag: 'SALE' };
  assert.equal(productBadge(product).label, 'Sale');
  assert.equal(productBadge({ ...product, badgeMode: 'hidden' }), null);
  assert.equal(
    productBadge({
      ...product,
      badgeMode: 'custom',
      badgeLabel: 'Limited',
      badgeLabelAr: 'محدود',
      badgeVariant: 'restock',
    }).arabicLabel,
    'محدود',
  );
  assert.equal(
    productBadge({ ...product, offerBadge: { label: 'Gym Week', variant: 'sale' } }).label,
    'Gym Week',
  );
  assert.equal(productBadge({ ...product, sizes: [] }).label, 'Sold Out');
});

test('quantity offers are displayed without a misleading per-item discount', () => {
  const offer = {
    id: 'gift',
    active: true,
    discount_type: 'buy_get',
    discount_value: null,
    buy_quantity: 2,
    get_quantity: 1,
  };
  assert.equal(offerPrice(100, [offer]).price, 100);
  assert.equal(liveQuantityOffers([offer]).length, 1);
  assert.equal(liveQuantityOffers([{ ...offer, active: false }]).length, 0);
  assert.equal(quantityOfferLabel(offer), 'Buy 2, get 1 free');
  assert.equal(
    liveQuantityOffers([{ ...offer, ends_at: '2026-01-01' }], Date.parse('2026-10-09')).length,
    0,
  );
});

test('product cards show the actual discount and quantity offer as separate badges', () => {
  const product = {
    sizes: ['M'],
    price: 72,
    compareAtPrice: 100,
    discountOffer: { show_badge: true, badge_label: 'Offer', badge_label_ar: 'عرض' },
    quantityOffers: [{ buy_quantity: 2, get_quantity: 1, show_badge: true, badge_label: 'Offer' }],
  };
  const badges = productBadges(product);
  assert.deepEqual(
    badges.map((badge) => badge.label),
    ['28% OFF', 'BUY 2 GET 1 FREE'],
  );
  assert.deepEqual(
    badges.map((badge) => badge.variant),
    ['sale', 'quantity-offer'],
  );
  assert.equal(productBadges({ ...product, price: 100 }).length, 1);
  assert.equal(productBadges({ ...product, badgeMode: 'hidden' }).length, 0);
  assert.equal(productBadges({ ...product, sizes: [] })[0].label, 'Sold Out');
  assert.equal(productBadges({ ...product, discountOffer: { show_badge: false } }).length, 1);
  assert.equal(
    productBadges({
      ...product,
      quantityOffers: [{ ...product.quantityOffers[0], show_badge: false }],
    }).length,
    1,
  );
  assert.equal(
    productBadges({ ...product, badgeMode: 'custom', badgeLabel: 'Limited' })[0].label,
    'Limited',
  );
});

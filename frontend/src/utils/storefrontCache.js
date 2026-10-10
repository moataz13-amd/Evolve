import { readStoredValue, writeStoredValue } from './storage.js';

const MAX_AGE = 24 * 60 * 60 * 1000;
const cacheKey = (source) => `evolve-storefront-content-v1:${source}`;

export function validStorefrontContent(data) {
  return (
    !!data &&
    typeof data.settings === 'object' &&
    data.settings !== null &&
    ['categories', 'collections', 'faqs', 'banners', 'sections'].every((key) =>
      Array.isArray(data[key]),
    ) &&
    data.sections.every(
      (section) =>
        section &&
        typeof section.key === 'string' &&
        Array.isArray(section.homepage_content) &&
        Array.isArray(section.homepage_products),
    )
  );
}

export function readStorefrontCache(storage, source, now = Date.now()) {
  const cached = readStoredValue(
    storage,
    cacheKey(source),
    null,
    (value) =>
      value &&
      Number.isFinite(value.savedAt) &&
      value.savedAt <= now &&
      now - value.savedAt < MAX_AGE &&
      validStorefrontContent(value.data),
  );
  return cached?.data;
}

export function saveStorefrontCache(storage, source, data, now = Date.now()) {
  if (validStorefrontContent(data))
    writeStoredValue(storage, cacheKey(source), { savedAt: now, data });
}

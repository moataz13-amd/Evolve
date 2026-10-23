const SOCIAL_HOSTS = {
  instagram: 'instagram.com',
  facebook: 'facebook.com',
  tiktok: 'tiktok.com',
};

export function isSafeStorefrontPath(value) {
  return (
    typeof value === 'string' &&
    /^\/(?!\/)[^\s\\]*$/.test(value) &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) &&
    !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  );
}

export function safeStorefrontPath(value, fallback = '/shop') {
  return isSafeStorefrontPath(value) ? value : fallback;
}

export function safeSocialUrl(value, platform) {
  const host = SOCIAL_HOSTS[platform];
  if (typeof value !== 'string' || !host) return null;
  try {
    const url = new globalThis.URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      (url.hostname !== host && !url.hostname.endsWith(`.${host}`))
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

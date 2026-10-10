let storeCurrency = 'EGP';
export function setStoreCurrency(currency) {
  if (/^[A-Z]{3}$/.test(currency || '')) storeCurrency = currency;
}
export function formatMoney(amount, currency = storeCurrency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}

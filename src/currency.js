"use strict";
const currency = {
  LOCAL_CURRENCY: "SGD",
  STORE_CURRENCY: "USD"
};

export const CURRENCY = {
  get LOCAL() { return currency.LOCAL_CURRENCY; },
  get STORE() { return currency.STORE_CURRENCY; }
};

// Load stored values from Chrome storage
chrome.storage.local.get(currency, (r) => {
  currency.LOCAL_CURRENCY = r.LOCAL_CURRENCY;
  currency.STORE_CURRENCY = r.STORE_CURRENCY;
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.LOCAL_CURRENCY) currency.LOCAL_CURRENCY = changes.LOCAL_CURRENCY.newValue;
  if (changes.STORE_CURRENCY) currency.STORE_CURRENCY = changes.STORE_CURRENCY.newValue;
});

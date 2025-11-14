"use strict";
(function(){
  const currency = {
    LOCAL_CURRENCY: "SGD",
    STORE_CURRENCY: "USD"
  };

  chrome.storage.local.get({ LOCAL_CURRENCY: "SGD", STORE_CURRENCY: "USD" }, (r) => {
    currency.LOCAL_CURRENCY = r.LOCAL_CURRENCY;
    currency.STORE_CURRENCY = r.STORE_CURRENCY;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.LOCAL_CURRENCY) currency.LOCAL_CURRENCY = changes.LOCAL_CURRENCY.newValue;
    if (changes.STORE_CURRENCY) currency.STORE_CURRENCY = changes.STORE_CURRENCY.newValue;
  });

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, currency);
})();
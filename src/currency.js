"use strict";
(function(){
  const currency = {
    LOCAL_CURRENCY: "SGD",
    STORE_CURRENCY: "USD"
  };

  chrome.storage.local.get(currency, (r) => {
    currency.LOCAL_CURRENCY = r.LOCAL_CURRENCY;
    currency.STORE_CURRENCY = r.STORE_CURRENCY;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.LOCAL_CURRENCY) currency.LOCAL_CURRENCY = changes.LOCAL_CURRENCY.newValue;
    if (changes.STORE_CURRENCY) currency.STORE_CURRENCY = changes.STORE_CURRENCY.newValue;
  });

  window.mhMarketChecker = {
    get LOCAL_CURRENCY() { return currency.LOCAL_CURRENCY; },
    get STORE_CURRENCY() { return currency.STORE_CURRENCY; }
  };
})();

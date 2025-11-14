"use strict";
(function(){
  const state = {
    LOCAL_CURRENCY: "SGD",
    STORE_CURRENCY: "USD"
  };

  chrome.storage.local.get({ LOCAL_CURRENCY: "SGD", STORE_CURRENCY: "USD" }, (r) => {
    state.LOCAL_CURRENCY = r.LOCAL_CURRENCY;
    state.STORE_CURRENCY = r.STORE_CURRENCY;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.LOCAL_CURRENCY) state.LOCAL_CURRENCY = changes.LOCAL_CURRENCY.newValue;
    if (changes.STORE_CURRENCY) state.STORE_CURRENCY = changes.STORE_CURRENCY.newValue;
  });

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, state);
})();

"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const storeSelect = document.getElementById("storeCurrency");
  const localSelect = document.getElementById("localCurrency");
  const statusMsg = document.getElementById("statusMsg");
  const toggleBtn = document.getElementById("toggleOverlayBtn");
  const fetchBtn = document.getElementById("mhFetchBtn");

  async function loadCurrencies() {
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await res.json();
      const currencies = Object.keys(data.rates).sort();
      storeSelect.innerHTML = "";
      localSelect.innerHTML = "";
      for (const code of currencies) {
        const sOpt = document.createElement("option");
        sOpt.value = code;
        sOpt.textContent = code;
        storeSelect.appendChild(sOpt);
        const lOpt = document.createElement("option");
        lOpt.value = code;
        lOpt.textContent = code;
        localSelect.appendChild(lOpt);
      }
      const { STORE_CURRENCY, LOCAL_CURRENCY } = await chrome.storage.local.get({ STORE_CURRENCY: "USD", LOCAL_CURRENCY: "SGD" });
      storeSelect.value = STORE_CURRENCY;
      localSelect.value = LOCAL_CURRENCY;
    } catch (err) {
      console.error("Failed to load currencies:", err);
      statusMsg.textContent = "⚠️ Could not load currency list.";
    }
  }

  async function saveCurrency() {
    await chrome.storage.local.set({ STORE_CURRENCY: storeSelect.value, LOCAL_CURRENCY: localSelect.value });
    statusMsg.textContent = "Currency updated - please fetch market data again.";
  }

  function toggleOverlay() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleOverlay" });
    });
  }

  loadCurrencies();
  storeSelect.addEventListener("change", saveCurrency);
  localSelect.addEventListener("change", saveCurrency);
  toggleBtn.addEventListener("click", toggleOverlay);
  fetchBtn.addEventListener("click", () => { statusMsg.textContent = ""; });
});

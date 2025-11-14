"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const storeSelect = document.getElementById("storeCurrency");
  const localSelect = document.getElementById("localCurrency");
  const statusMsg   = document.getElementById("statusMsg");
  const toggleBtn   = document.getElementById("toggleOverlayBtn");
  const fetchBtn    = document.getElementById("mhFetchBtn");

  const EXCHANGE_URL = "https://api.exchangerate-api.com/v4/latest/USD";
  const DEFAULT_STORE_CURRENCY = "USD";
  const DEFAULT_LOCAL_CURRENCY = "SGD";

  async function loadCurrencies() {
    try {
      // Fetch list of currencies
      const res = await fetch(EXCHANGE_URL);
      const data = await res.json();
      const currencies = Object.keys(data.rates).sort();

      storeSelect.innerHTML = "";
      localSelect.innerHTML = "";

      // Populate dropdowns with currencies
      for (const code of currencies) {
        // Store currency option
        const sOpt = document.createElement("option");
        sOpt.value = code;
        sOpt.textContent = code;
        storeSelect.appendChild(sOpt);
        
        // Local currency option
        const lOpt = document.createElement("option");
        lOpt.value = code;
        lOpt.textContent = code;
        localSelect.appendChild(lOpt);
      }

      // Set selected values from storage if available
      const { STORE_CURRENCY, LOCAL_CURRENCY } = await chrome.storage.local.get({ STORE_CURRENCY: DEFAULT_STORE_CURRENCY, LOCAL_CURRENCY: DEFAULT_LOCAL_CURRENCY });
      storeSelect.value = STORE_CURRENCY;
      localSelect.value = LOCAL_CURRENCY;
    } catch (err) {
      console.error("Failed to load currencies:", err);
      statusMsg.textContent = "⚠️ Could not load currency list.";
    }
  }

  async function saveCurrency() {
    // Save selected currencies to storage
    await chrome.storage.local.set({ STORE_CURRENCY: storeSelect.value, LOCAL_CURRENCY: localSelect.value });
    statusMsg.textContent = "Currency updated - please fetch market data again.";
  }

  function toggleOverlay() {
    // Send message to content script to toggle wdiget visibility
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleOverlay" });
    });
  }

  loadCurrencies();

  // Add listeners
  storeSelect.addEventListener("change", saveCurrency);
  localSelect.addEventListener("change", saveCurrency);
  toggleBtn.addEventListener("click", toggleOverlay);
  fetchBtn.addEventListener("click", () => { statusMsg.textContent = ""; });
});

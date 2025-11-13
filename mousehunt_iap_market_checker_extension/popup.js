document.addEventListener('DOMContentLoaded', async () => {
  const storeSelect = document.getElementById('storeCurrency');
  const localSelect = document.getElementById('localCurrency');
  const statusMsg = document.getElementById('statusMsg');

  // Load currencies dynamically
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    const currencies = Object.keys(data.rates).sort();

    // Clear any existing options
    storeSelect.innerHTML = '';
    localSelect.innerHTML = '';

    // Populate both dropdowns
    currencies.forEach(code => {
      const opt1 = document.createElement('option');
      opt1.value = code;
      opt1.textContent = code;
      storeSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = code;
      opt2.textContent = code;
      localSelect.appendChild(opt2);
    });

    // Load previously saved selection
    const { STORE_CURRENCY, LOCAL_CURRENCY } = await chrome.storage.local.get({
      STORE_CURRENCY: 'USD',
      LOCAL_CURRENCY: 'SGD'
    });

    storeSelect.value = STORE_CURRENCY;
    localSelect.value = LOCAL_CURRENCY;

  } catch (err) {
    console.error('Failed to load currencies:', err);
    statusMsg.textContent = '⚠️ Could not load currency list.';
  }

  // Save selection automatically
  async function saveCurrency() {
    await chrome.storage.local.set({
      STORE_CURRENCY: storeSelect.value,
      LOCAL_CURRENCY: localSelect.value
    });
    statusMsg.textContent = 'Currency updated - please fetch market data again.';
  }

  storeSelect.addEventListener('change', saveCurrency);
  localSelect.addEventListener('change', saveCurrency);

  // Handle overlay toggle button
  document.getElementById('toggleOverlayBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleOverlay' });
    });
  });

  document.getElementById('mhFetchBtn').addEventListener('click', () => {
    statusMsg.textContent = '';
  });

});

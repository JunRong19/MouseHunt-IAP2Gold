(async () => {
  if (window.hasRunMHMarketChecker) return; // avoid multiple injections
  window.hasRunMHMarketChecker = true;

  const MARKET_SEARCH_URL = "https://api.markethunt.win/items/search?query=";
  const MARKET_ITEM_RANGE_URL = "https://api.markethunt.win/items/{item_id}/stock?from={from_date}&to={to_date}";
  const CONCURRENCY_LIMIT = 8;

    let LOCAL_CURRENCY = "SGD"; // default local currency
    let STORE_CURRENCY = "USD"; // default store currency

    // Get stored values from chrome.storage at startup
    chrome.storage.local.get(
    { LOCAL_CURRENCY: "SGD", STORE_CURRENCY: "USD" }, 
    (result) => {
        LOCAL_CURRENCY = result.LOCAL_CURRENCY;
        STORE_CURRENCY = result.STORE_CURRENCY;
    }
    );

    // Listen for changes to update values dynamically
    chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        if (changes.LOCAL_CURRENCY) {
        LOCAL_CURRENCY = changes.LOCAL_CURRENCY.newValue;
        }
        if (changes.STORE_CURRENCY) {
        STORE_CURRENCY = changes.STORE_CURRENCY.newValue;
        }
    }
    });


    // UI setup
    const overlay = document.createElement("div");
    overlay.id = "mhMarketOverlay";
    overlay.innerHTML = `
        <div class="header">
            <h3>MouseHunt Market Checker</h3>
            <button id="mhCloseBtn">✖</button>
        </div>
        <button id="mhFetchBtn">Fetch Market Data</button>
        <div id="mhProgress"><div></div></div>
        <div id="mhResults"><p>No data yet.</p></div>
    `;
    document.body.appendChild(overlay);

    // Close button functionality
    const closeBtn = overlay.querySelector("#mhCloseBtn");
    closeBtn.addEventListener("click", () => {
        overlay.style.display = "none";
    });


    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'toggleOverlay' && overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        }
    });

    async function getRatesCached() {
        const cache = await chrome.storage.local.get(['exchangeRates', 'ratesTimestamp']);
        const oneDay = 24 * 60 * 60 * 1000;

        if (cache.exchangeRates && Date.now() - cache.ratesTimestamp < oneDay) {
            fx.base = 'USD';
            fx.rates = cache.exchangeRates;
            console.log('Loaded cached rates');
        } else {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            fx.base = data.base;
            fx.rates = data.rates;
            await chrome.storage.local.set({
            exchangeRates: data.rates,
            ratesTimestamp: Date.now()
            });
            console.log('Fetched new rates');
        }
    }

    getRatesCached();

interact('#mhMarketOverlay')
  .draggable({
    inertia: true,
    allowFrom: 'h3', // only allow dragging from the <h3> header
    modifiers: [
      interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })
    ],
    listeners: {
      move(event) {
        const el = event.target;
        const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.dy;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.setAttribute('data-x', x);
        el.setAttribute('data-y', y);
      },
      start(event) {
        // Disable text selection only for the overlay
        event.target.style.userSelect = 'none';
      },
      end(event) {
        // Re-enable text selection for the overlay
        event.target.style.userSelect = '';
      }
    }
  });

  const fetchBtn = overlay.querySelector("#mhFetchBtn");
  const progressBar = overlay.querySelector("#mhProgress div");
  const resultsDiv = overlay.querySelector("#mhResults");

  async function fetchIAPs() {
    const response = await fetch("/managers/ajax/donations/rewards.php", {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: "action=getRewards"
    });
    const json = await response.json();
    return json.checkout?.rewards || [];
  }

function parseIAPs(rewards) {
  return rewards.map(item => {
    const fullName = item.name;
    const match = fullName.match(/(\d+)\s+(.*)/);
    const quantity = match ? parseInt(match[1]) : 1;
    const name = match ? match[2] : fullName;

    // Convert from STORE_CURRENCY to LOCAL_CURRENCY
    let totalCost =   fx(item.value).from(STORE_CURRENCY).to(LOCAL_CURRENCY);

    const unitCost = totalCost / quantity;
    return { full_name: fullName, name, quantity, total_cost: totalCost, unit_cost: unitCost };
  });
}

  const singularize = (n) => (n.endsWith('s') ? n.slice(0, -1) : n);

  async function fetchMarketPrice(iap) {
    const cleanName = singularize(iap.name).replace(/[|+]/g, "");
    const q = encodeURIComponent(cleanName);
    try {
      const r = await fetch(`${MARKET_SEARCH_URL}${q}`);
      const data = await r.json();
      const match = data.find(x => x.item_info?.name?.toLowerCase() === cleanName.toLowerCase());
      if (!match) return null;

      const id = match.item_info.item_id;
      const today = new Date();
      const from = new Date(today - 86400000).toISOString().split("T")[0];
      const to = new Date(today + 86400000).toISOString().split("T")[0];
      const range = await fetch(MARKET_ITEM_RANGE_URL
        .replace("{item_id}", id)
        .replace("{from_date}", from)
        .replace("{to_date}", to)
      ).then(r => r.json());

      const latest = range.stock_data?.slice(-1)[0];
      if (!latest?.bid) return null;
      const bid = latest.bid;
      const goldTotal = iap.quantity * bid;
      const goldPerCost = Math.round(goldTotal / iap.total_cost);
      return { name: iap.full_name, cost: iap.total_cost.toFixed(2), bid, goldPerCost };
    } catch {
      return null;
    }
  }

  async function runConcurrent(tasks, limit, onProgress) {
    const results = [];
    let index = 0, done = 0;
    async function worker() {
      while (index < tasks.length) {
        const i = index++;
        results[i] = await tasks[i]().catch(() => null);
        done++;
        onProgress(done / tasks.length);
      }
    }
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  function renderTable(results) {
    resultsDiv.innerHTML = "";

    if (!results.length) {
        resultsDiv.innerHTML = "<p>No market data found.</p>";
        return;
    }

    const tableData = results.map(r => ({
        name: r.name,
        cost: r.cost + " " + LOCAL_CURRENCY,        
        bid: r.bid,
        goldPerCost: r.goldPerCost
    }));

    new Tabulator(resultsDiv, {
        data: tableData,
        layout: "fitColumns",
        reactiveData: true,
        columns: [
            { 
                title: "IAP Name", 
                field: "name", 
                hozAlign: "left",          // left-align
                headerHozAlign:"left",
                headerSort: false, 
                resizable: false,
                formatter: "textarea",     // wrap long text
                headerWordWrap: true
            },
            { 
                title: "Cost", 
                field: "cost", 
                hozAlign: "right",     
                headerHozAlign:"right",
                headerSort: false, 
                resizable: false,
                headerWordWrap: true
            },
            { 
                title: "Highest Bid per Unit", 
                field: "bid", 
                hozAlign: "right",     
                headerHozAlign:"right",
                headerSort: false, 
                resizable: false,
                formatter: "money",        // number with commas
                formatterParams: {
                    precision: 0,
                    thousandsSeparator: ","
                },
                headerWordWrap: true
            },
            { 
                title: `Gold per ${LOCAL_CURRENCY}`, 
                field: "goldPerCost", 
                hozAlign: "right",     
                headerHozAlign:"right",
                headerSort: false, 
                resizable: false, 
                formatter: "money",        // number with commas
                formatterParams: {
                    precision: 0,
                    thousandsSeparator: ","
                },
                headerWordWrap: true
            },
        ],
        height: "100%",
    });
}




  fetchBtn.addEventListener("click", async () => {
    fetchBtn.disabled = true;
    fetchBtn.textContent = "Fetching...";

    const rewards = await fetchIAPs();
    const iaps = parseIAPs(rewards);
    const tasks = iaps.map(iap => () => fetchMarketPrice(iap));
    const results = (await runConcurrent(tasks, CONCURRENCY_LIMIT, p => {
      progressBar.style.width = (p * 100).toFixed(1) + "%";
    })).filter(Boolean);

    results.sort((a, b) => b.goldPerCost - a.goldPerCost);
    renderTable(results);
    fetchBtn.textContent = "Fetch Market Data";
    fetchBtn.disabled = false;
  });
})();

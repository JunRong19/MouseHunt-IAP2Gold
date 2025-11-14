"use strict";
(function(){
  if (window.hasRunMHMarketChecker) return; window.hasRunMHMarketChecker = true;
  const { createWidget, setupInteract, renderTable, setDailyRates, fetchIAPs, parseIAPs, fetchMarketPrice } = window.mhMarketChecker;
  
  const WORKERS_LIMIT = 8;

  // Draw widget
  const overlay = setupInteract(createWidget());

  // Get widget elements
  const fetchBtn = overlay.querySelector("#mhFetchBtn");
  const progressBar = overlay.querySelector("#mhProgress div");
  const lastFetch = overlay.querySelector("#mhLastFetch");

  // Listen for toggling visibility button click
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== "toggleOverlay" || !overlay) return;
    const hidden = overlay.style.visibility === "hidden";
    overlay.style.visibility = hidden ? "visible" : "hidden";
    overlay.style.pointerEvents = hidden ? "auto" : "none";
  });

  // Listen for fetch button click
  fetchBtn.addEventListener("click", async () => {
    // Disable button
    fetchBtn.disabled = true; fetchBtn.textContent = "Fetching...";

    // Get daily exchange rates
    await setDailyRates();

    // Get all IAPs in premium store
    const rewards = await fetchIAPs();
    const iaps = parseIAPs(rewards);

    // Fetch market prices of IAPs
    const tasks = iaps.map(i => () => fetchMarketPrice(i));
    const results = (await runWithConcurrency(tasks, WORKERS_LIMIT, p => {
      progressBar.style.width = (p * 100).toFixed(1) + "%";
    })).filter(Boolean);
    results.sort((a,b) => b.goldPerCost - a.goldPerCost);

    // Display IAPs in table
    const { LOCAL_CURRENCY } = window.mhMarketChecker;
    renderTable(results, LOCAL_CURRENCY);

    // Re-enable button
    fetchBtn.textContent = "Fetch Market Data"; fetchBtn.disabled = false;

    // Show last fetch time
    lastFetch.textContent = "Last Fetch: " + new Date().toLocaleTimeString();
  });

  async function runWithConcurrency(tasks, limit, onProgress){
    const results = []; let index = 0; let done = 0;
    async function worker(){
      while(index < tasks.length){
        const i = index++;
        try { results[i] = await tasks[i](); } catch { results[i] = null; }
        done++; onProgress(done / tasks.length);
      }
    }
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
    await Promise.all(workers); return results;
}
})();


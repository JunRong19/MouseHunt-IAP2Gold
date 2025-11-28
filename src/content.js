"use strict";
import { createWidget, setupInteract, renderTable } from "./ui.js";
import { marketplaceCache, setDailyRates, fetchIAPs, parseIAPs, fetchMarketPrice } from "./api.js";

(function(){
  const WORKERS_LIMIT = 8;

  // Draw widget
  const widget = setupInteract(createWidget());

  // Get widget elements
  const fetchBtn = widget.querySelector("#mhFetchBtn");
  const progressBar = widget.querySelector("#mhProgress div");
  const lastFetch = widget.querySelector("#mhLastFetch");

  chrome.storage.local.get({ widgetVisible: "visible" }, (result) => {
    widget.style.visibility = result.widgetVisible;
  });

  // Listen for toggling visibility button click
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== "toggleWidget" || !widget) return;

    const hidden = widget.style.visibility === "hidden";
    widget.style.visibility = hidden ? "visible" : "hidden";
    widget.style.pointerEvents = hidden ? "auto" : "none";

    // Save state
    chrome.storage.local.set({ widgetVisible: widget.style.visibility });
  });

  // Listen for fetch button click
  fetchBtn.addEventListener("click", async () => {
    // Clear previous cache to get new market data
    marketplaceCache.clear();

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
    results.sort((a,b) => b.gold_per_cost - a.gold_per_cost);

    // Display IAPs in table
    await renderTable(results);

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


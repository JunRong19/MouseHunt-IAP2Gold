"use strict";
(function(){
  if (window.hasRunMHMarketChecker) return; window.hasRunMHMarketChecker = true;
  const { createOverlay, setupInteract, renderTable, ensureRates, fetchIAPs, parseIAPs, fetchMarketPrice } = window.mhMarketChecker;

  const overlay = setupInteract(createOverlay());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== "toggleOverlay" || !overlay) return;
    const hidden = overlay.style.visibility === "hidden";
    overlay.style.visibility = hidden ? "visible" : "hidden";
    overlay.style.pointerEvents = hidden ? "auto" : "none";
  });

  const fetchBtn = overlay.querySelector("#mhFetchBtn");
  const progressBar = overlay.querySelector("#mhProgress div");
  const lastFetch = overlay.querySelector("#mhLastFetch");

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

  fetchBtn.addEventListener("click", async () => {
    const { LOCAL_CURRENCY } = window.mhMarketChecker;
    fetchBtn.disabled = true; fetchBtn.textContent = "Fetching...";
    await ensureRates();
    const rewards = await fetchIAPs();
    const iaps = parseIAPs(rewards);
    const tasks = iaps.map(i => () => fetchMarketPrice(i));
    const results = (await runWithConcurrency(tasks, 8, p => {
      progressBar.style.width = (p * 100).toFixed(1) + "%";
    })).filter(Boolean);
    results.sort((a,b) => b.goldPerCost - a.goldPerCost);
    renderTable(results, LOCAL_CURRENCY);
    fetchBtn.textContent = "Fetch Market Data"; fetchBtn.disabled = false;
    lastFetch.textContent = "Last Fetch: " + new Date().toLocaleTimeString();
  });
})();
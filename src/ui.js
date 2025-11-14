"use strict";
(function(){
  function createOverlay(){
    const el = document.createElement("div");
    el.id = "mhMarketOverlay";
    el.innerHTML = `
      <div class="header">
        <h3>MouseHunt Market Checker</h3>
        <span id="mhLastFetch">Last Fetch: --</span>
        <button id="mhCloseBtn">✖</button>
      </div>
      <button id="mhFetchBtn">Fetch Market Data</button>
      <div id="mhProgress"><div></div></div>
      <div id="mhResults"><p>No data yet.</p></div>`;
    document.body.appendChild(el);
    el.querySelector("#mhCloseBtn").addEventListener("click", () => {
      el.style.visibility = "hidden"; el.style.pointerEvents = "none";
    });
    return el;
  }

  function setupInteract(overlay){
    interact("#mhMarketOverlay")
      .draggable({
        inertia: true,
        allowFrom: ".header",
        modifiers: [interact.modifiers.restrictRect({ restriction: "parent", endOnly: true })],
        listeners: {
          move(evt){
            const el = evt.target;
            const x = (parseFloat(el.getAttribute("data-x")) || 0) + evt.dx;
            const y = (parseFloat(el.getAttribute("data-y")) || 0) + evt.dy;
            el.style.transform = `translate(${x}px, ${y}px)`;
            el.setAttribute("data-x", x); el.setAttribute("data-y", y);
          },
          start(e){ e.target.style.userSelect = "none"; },
          end(e){ e.target.style.userSelect = ""; }
        }
      })
      .resizable({
        edges: { left:true, right:true, bottom:true, top:false },
        modifiers: [
          interact.modifiers.restrictEdges({ outer: "parent" }),
          interact.modifiers.restrictSize({ min: { width:300, height:200 } })
        ],
        inertia: true
      })
      .on("resizestart", () => { document.body.style.userSelect = "none"; })
      .on("resizemove", (evt) => {
        const t = evt.target;
        let x = parseFloat(t.getAttribute("data-x")) || 0;
        let y = parseFloat(t.getAttribute("data-y")) || 0;
        t.style.width = evt.rect.width + "px";
        t.style.height = evt.rect.height + "px";
        x += evt.deltaRect.left; y += evt.deltaRect.top;
        t.style.transform = `translate(${x}px, ${y}px)`;
        t.setAttribute("data-x", x); t.setAttribute("data-y", y);
      })
      .on("resizeend", () => { document.body.style.userSelect = ""; });
    return overlay;
  }

  function renderTable(results, LOCAL_CURRENCY){
    const resultsDiv = document.querySelector("#mhResults");
    resultsDiv.innerHTML = "";
    if (!results.length){ resultsDiv.innerHTML = "<p>No market data found.</p>"; return; }
    const tableData = results.map(r => ({
      name: r.name,
      item: r.item_name,
      cost: `${r.cost} ${LOCAL_CURRENCY}`,
      sellableUnit: r.sellableUnit,
      goldTotal: r.goldTotal,
      goldPerCost: r.goldPerCost
    }));
    new Tabulator(resultsDiv, {
      data: tableData,
      layout: "fitColumns",
      reactiveData: true,
      columns: [
        { title: "IAP Name", field: "name", hozAlign: "left", headerHozAlign: "left", resizable:false, headerWordWrap:true },
        { title: "Item Name", field: "item", hozAlign:"left", headerHozAlign:"left", resizable:false, headerWordWrap:true,
          formatter(cell){ const text = cell.getValue() ?? ""; const span = document.createElement("span"); span.className = "mh-copy"; span.textContent = text; span.title = "Click to copy"; return span; },
          async cellClick(_, cell){ const text = cell.getValue() ?? ""; try{ await navigator.clipboard.writeText(text); alert(`Copied! - ${text}`); }catch(e){ console.warn("Copy failed:", e); } }
        },
        { title: "Cost", field: "cost", hozAlign:"right", headerHozAlign:"right", resizable:false, headerWordWrap:true },
        { title: "Sellable Units", field: "sellableUnit", hozAlign:"right", headerHozAlign:"right", resizable:false, headerWordWrap:true },
        { title: "Total Gold (includes 10% tariff)", field:"goldTotal", hozAlign:"right", headerHozAlign:"right", resizable:false, formatter:"money", formatterParams:{ precision:0, thousandsSeparator:"," }, headerWordWrap:true },
        { title: `Gold per ${LOCAL_CURRENCY}`, field:"goldPerCost", hozAlign:"right", headerHozAlign:"right", resizable:false, formatter:"money", formatterParams:{ precision:0, thousandsSeparator:"," }, headerWordWrap:true }
      ],
      height: "100%"
    });
  }

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, { createOverlay, setupInteract, renderTable });
})();

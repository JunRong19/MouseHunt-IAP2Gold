"use strict";
(function(){
  // Simple tooltip helpers (custom, independent of Tabulator's tooltip)
  function ensureTooltipEl(){
    let tip = document.getElementById("mhGoldTooltip");
    if (!tip){
      tip = document.createElement("div");
      tip.id = "mhGoldTooltip";
      tip.style.position = "fixed";
      tip.style.maxWidth = "320px";
      tip.style.background = "rgba(20,20,20,0.95)";
      tip.style.color = "#e5e7eb";
      tip.style.border = "1px solid #374151";
      tip.style.borderRadius = "8px";
      tip.style.padding = "8px 10px";
      tip.style.fontSize = "12px";
      tip.style.lineHeight = "1.35";
      tip.style.pointerEvents = "none";
      tip.style.zIndex = "1000001"; // above overlay
      tip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.35)";
      tip.style.display = "none";
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(x, y, html){
    const tip = ensureTooltipEl();
    tip.innerHTML = html;
    const offset = 12;
    tip.style.left = Math.round(x + offset) + "px";
    tip.style.top = Math.round(y + offset) + "px";
    tip.style.display = "block";
  }

  function moveTooltip(x, y){
    const tip = ensureTooltipEl();
    if (tip.style.display !== "block") return;
    const offset = 12;
    tip.style.left = Math.round(x + offset) + "px";
    tip.style.top = Math.round(y + offset) + "px";
  }

  function hideTooltip(){
    const tip = ensureTooltipEl();
    tip.style.display = "none";
  }

  // Create widget layout
  function createWidget(){
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

    // Close button
    el.querySelector("#mhCloseBtn").addEventListener("click", () => {
      el.style.visibility = "hidden"; el.style.pointerEvents = "none";
    });

    return el;
  }

  // Setup drag and resize interactions for widget
  function setupInteract(widget){
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
    return widget;
  }

  // Render IAPs result in table
  function renderTable(results){
    const { LOCAL_CURRENCY } = window.mhMarketChecker;

    const resultsDiv = document.querySelector("#mhResults");
    resultsDiv.innerHTML = "";
    
    if (!results.length){ resultsDiv.innerHTML = "<p>No market data found.</p>"; return; }

    // IAPs data
    const tableData = results.map(r => ({
      name: r.name,
      item: r.item_name,
      cost: r.iap_cost,
      units: r.units,
      gold: r.gold,
      gold_per_cost: r.gold_per_cost,

      // Tooltip details
      remaining_units: r.remaining_units,
      buy_order: r.buy_order,
      buy_order_remaining: r.buy_order_remaining
    }));

    // Tabulator table
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
        {
          title: "Cost",
          field: "cost",
          hozAlign: "left",
          headerHozAlign: "left",
          resizable: false,
          headerWordWrap: true,

          formatter: function (cell) {
            const value = cell.getValue();
            return `${value} ${LOCAL_CURRENCY}`;
          }
        },
        { title: "Units", field: "units", hozAlign:"left", headerHozAlign:"left", resizable:false, headerWordWrap:true },
        {
          title: "Gold",
          field: "gold",
          hozAlign: "left",
          headerHozAlign: "left",
          resizable: false,
          headerWordWrap: true,
          formatter: function(cell){
            const val = Number(cell.getValue()) || 0;
            return `<span class="tooltip-underline">${val.toLocaleString()}</span>`;
          },
          cellMouseEnter: function(e, cell){
            const row = cell.getRow().getData();
            const buyOrders = Array.isArray(row.buy_order) ? row.buy_order : [];
            const remainingUnits = Number(row.remaining_units) || 0;
            const buy_order_remaining_units = Number(row.buy_order_remaining.quantity) || 0;
            const buy_order_remaining_limit = Number(row.buy_order_remaining.limit) || 0;
            const units = Number(row.units) || 0;
            const gold = Number(row.gold) || 0;
            const guaranteed_units = units - remainingUnits;

            let html = `<b>Buy Orders:</b><br>`;

            // Start table for alignment
            html += `<table style="border-collapse: collapse;">`;

            if (buyOrders.length){
              for (const o of buyOrders){
                const q = Number(o.quantity) || 0;
                const p = Number(o.unit_price) || 0;
                html += `
                  <tr>
                    <td style="text-align: right; padding-right: 4px;">${q}</td>
                    <td style="text-align: center; padding: 0 4px;">@</td>
                    <td style="text-align: left; padding-left: 4px;">${p.toLocaleString()}g</td>
                  </tr>
                `;
              }
            } else {
              html += `<tr><td colspan="3">No buy orders available.</td></tr>`;
            }

            // End table
            html += `</table>`;

            if (guaranteed_units > 0){
              html += `<br><b>Sellable Units:</b> ${guaranteed_units}<br>`;
              html += `${guaranteed_units} unit(s) can be sold for ${gold.toLocaleString()}g after tariff.<br>`;
            }

            if (remainingUnits > 0){
              const sellableUnits = Math.min(remainingUnits, buy_order_remaining_units);
              const unsellableUnits = Math.max(remainingUnits - buy_order_remaining_units, 0);

              if (sellableUnits){ 
                html += `<br><b>Remaining Units:</b> ${remainingUnits}<br>`;
                html += `Remaining ${sellableUnits} unit(s) can be sold for ${buy_order_remaining_limit.toLocaleString()}g or less.<br>`; 
              } 
              
              if (unsellableUnits){
                html += `<br><b>Unsellable Units:</b> ${unsellableUnits}<br>`;
                html += `No buyers for ${unsellableUnits} unit(s).<br>`;
              }
            }
            showTooltip(e.clientX, e.clientY, html);
          },
          cellMouseMove: function(e){ moveTooltip(e.clientX, e.clientY); },
          cellMouseLeave: function(){ hideTooltip(); }
        },
        { title: `Gold / ${LOCAL_CURRENCY}`, field:"gold_per_cost", hozAlign:"left", headerHozAlign:"left", resizable:false, formatter:"money", formatterParams:{ precision:0, thousandsSeparator:"," }, headerWordWrap:true }
      ],
      height: "100%"
    });
  }

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, { createWidget, setupInteract, renderTable });
})();

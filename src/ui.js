import { showTooltip, hideTooltip, moveTooltip } from "./tooltip.js";
import { getSBPrice } from "./api.js";
import { CURRENCY } from "./currency.js";

export function createWidget(){
  const el = document.createElement("div");
  el.id = "mhMarketOverlay";

  el.innerHTML = `
    <div class="header">
      <h3>MouseHunt IAP2GOLD</h3>
      <span id="mhLastFetch">Last Fetch: --</span>
      <button id="mhCloseBtn">✖</button>
    </div>
    <button id="mhFetchBtn">Fetch Market Data</button>
    <div id="mhProgress"><div></div></div>
    <div id="columnToggle"></div>
    <div id="mhResults"><p>No data yet.</p></div>`;

  document.body.appendChild(el);

  // Close button
  el.querySelector("#mhCloseBtn").addEventListener("click", () => {
    el.style.visibility = "hidden"; el.style.pointerEvents = "none";
    chrome.storage.local.set({ widgetVisible: el.style.visibility});
  });

  return el;
}

export function setupInteract(widget){
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

let table;
export async function renderTable(results){
  const resultsDiv = document.querySelector("#mhResults");

  if (!results.length){
    resultsDiv.innerHTML = "<p>No market data found.</p>"; 
    return;
  }

  let sb_price = await getSBPrice();
  sb_price = sb_price.toLocaleString();

  const tableData = results.map(r => ({
    full_name: r.full_name,
    name: r.name,
    cost: r.iap_cost,
    units: r.units,
    super_brie: Math.floor(r.super_brie ?? 0),
    gold: r.gold,
    gold_per_cost: r.gold_per_cost,
    remaining_units: r.remaining_units,
    buy_order: r.buy_order,
    buy_order_sum: r.buy_order_sum
  }));

  // Initialize Tabulator
  table = new Tabulator(resultsDiv, {
    data: tableData,
    layout: "fitColumns",
    reactiveData: true,
    height: "100%",
    columns: [
      { title: "IAP", field: "full_name", hozAlign: "left", headerHozAlign: "left", resizable:false, headerWordWrap:true },
      { title: "Item", field: "name", hozAlign:"left", headerHozAlign:"left", resizable:false, headerWordWrap:true,
        formatter(cell){ 
          const text = cell.getValue() ?? ""; 
          const span = document.createElement("span"); 
          span.className = "mh-copy"; 
          span.textContent = text; 
          span.title = "Click to copy"; 
          return span; 
        },
        async cellClick(_, cell){ 
          const text = cell.getValue() ?? ""; 
          try{ await navigator.clipboard.writeText(text); alert(`Copied! - ${text}`); } 
          catch(e){ console.warn("Copy failed:", e); } 
        }
      },
      { title: "Cost", field: "cost", hozAlign: "left", headerHozAlign:"left", resizable:false, headerWordWrap:true,
        formatter: function (cell) {
          const value = cell.getValue();
          return `${value} ${CURRENCY.LOCAL}`;
        }
      },
      { title: "Units", field: "units", hozAlign:"left", headerHozAlign:"left", resizable:false, headerWordWrap:true },
      { title: "Gold", field: "gold", hozAlign: "left", headerHozAlign: "left", resizable:false, headerWordWrap:true,
        formatter: function(cell){
          const val = Number(cell.getValue()) || 0;
          return `<span class="tooltip-underline">${val.toLocaleString()}</span>`;
        },
        cellMouseEnter: function(e, cell){
          const row = cell.getRow().getData();
          const buyOrders = Array.isArray(row.buy_order) ? row.buy_order : [];
          const remainingUnits = Number(row.remaining_units) || 0;
          const buy_order_sum_units = Number(row.buy_order_sum.quantity) || 0;
          const buy_order_sum_price = Number(row.buy_order_sum.limit) || 0;
          const units = Number(row.units) || 0;
          const gold = Number(row.gold) || 0;
          const guaranteed_units = units - remainingUnits;

          let html = `<div style="text-align: center; margin: auto; width: 80%;"><b>${row.name}</b></div><br>`;
          html += `<b>Buy Orders:</b><br>`;
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
          html += `</table>`;

          if (guaranteed_units > 0){
            html += `<br><b>Sellable Units:</b> ${guaranteed_units}<br>`;
            html += `${guaranteed_units} unit(s) can be sold for ${gold.toLocaleString()}g after tariff.<br>`;
          }

          if (remainingUnits > 0){
            const sellableUnits = Math.min(remainingUnits, buy_order_sum_units);
            const unsellableUnits = Math.max(remainingUnits - buy_order_sum_units, 0);

            if (sellableUnits){ 
              html += `<br><b>Remaining Units:</b> ${remainingUnits}<br>`;
              html += `Remaining ${sellableUnits} unit(s) can be sold for ${buy_order_sum_price.toLocaleString()}g each or less.<br>`; 
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
      { title: `Gold / ${CURRENCY.LOCAL}`, field:"gold_per_cost", hozAlign:"left", headerHozAlign:"left", resizable:false,
        formatter:"money", formatterParams:{ precision:0, thousandsSeparator:"," }, headerWordWrap:true,
        titleFormatter: function(){
          return `<span class="tooltip-underline">Gold / ${CURRENCY.LOCAL}</span>`;
        },
        titleFormatterParams: { html: true },
        headerMouseEnter:function(e, column){
          const html = `<b>Note:</b><br>Gold from sellable units per ${CURRENCY.LOCAL}.`;
          showTooltip(e.clientX, e.clientY, html);
        },
        headerMouseMove:function(e){ moveTooltip(e.clientX, e.clientY); },
        headerMouseLeave:function(){ hideTooltip(); }
      },
      { title: `SUPER|brie+`, field:"super_brie", hozAlign:"left", headerHozAlign:"left", resizable:false, headerWordWrap:true,
        titleFormatter: function(){ return `<span class="tooltip-underline">SUPER|brie+</span>`; },
        titleFormatterParams: { html: true },
        headerMouseEnter:function(e, column){
          const html = `
            <b>SUPER|brie+ Market Price: ${sb_price}g</b><br>
            This shows the value of the IAP in SUPER|brie+.<br><br>
            <b>Note:</b><br>
            • Based on the latest sale history.<br>
            • May not reflect actual worth.<br>
            • A value of 0 means there were no recent marketplace sales.
          `;
          showTooltip(e.clientX, e.clientY, html);
        },
        headerMouseMove:function(e){ moveTooltip(e.clientX, e.clientY); },
        headerMouseLeave:function(){ hideTooltip(); }
      }
    ]
  });

  table.on("tableBuilt", function(){
      setupColumnToggle();

      table.redraw(true);
      table.off("tableBuilt");
  });
}

async function setupColumnToggle() {
  const toggleContainer = document.querySelector("#columnToggle");
  toggleContainer.innerHTML = ""; // clear old checkboxes

  const { columnVisibility = {} } = await new Promise(resolve => {
    chrome.storage.local.get(["columnVisibility"], resolve);
  });

  table.getColumns().forEach(col => {
    const field = col.getField();

    // Apply saved visibility to the column
    if (columnVisibility[field] === false) {
      col.hide();
    } else {
      col.show();
    }

    // Build UI checkbox
    const label = document.createElement("label");
    label.style.marginRight = "10px";
    label.style.fontSize = "14px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = columnVisibility[field] !== false;
    checkbox.style.marginRight = "4px";

    checkbox.addEventListener("change", () => {
      checkbox.checked ? col.show() : col.hide();
      table.redraw(true, true);

      // Save state
      const state = {};
      table.getColumns().forEach(c => {
        state[c.getField()] = c.isVisible();
      });
      chrome.storage.local.set({ columnVisibility: state });
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(col.getDefinition().title));
    toggleContainer.appendChild(label);
  });
}



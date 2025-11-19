"use strict";
function ensureTooltipEl() {
    let tip = document.getElementById("mhGoldTooltip");
    if (!tip) {
        tip = document.createElement("div");
        tip.id = "mhGoldTooltip";
        document.body.appendChild(tip);
    }
    return tip;
}

export function showTooltip(x, y, html){
    const tip = ensureTooltipEl();
    tip.innerHTML = html;
    const offset = 12;
    tip.style.left = Math.round(x + offset) + "px";
    tip.style.top = Math.round(y + offset) + "px";
    tip.style.display = "block";
}

export function moveTooltip(x, y){
    const tip = ensureTooltipEl();
    if (tip.style.display !== "block") return;
    const offset = 12;
    tip.style.left = Math.round(x + offset) + "px";
    tip.style.top = Math.round(y + offset) + "px";
}

export function hideTooltip(){
    const tip = ensureTooltipEl();
    tip.style.display = "none";
}
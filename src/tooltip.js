"use strict";
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
"use strict";
import { CURRENCY } from "./currency.js";
import itemMap from "./data/itemMap.json";

const EXCHANGE_URL  = "https://api.exchangerate-api.com/v4/latest/USD";
const MARKET_ITEMS  = "https://api.markethunt.win/items"
const MARKET_QUERY  = query => `https://api.markethunt.win/items/search?query=${query}`;


// Fetch all SB prices of items.
const sb_map = new Map();
(async () => {
  const data = await fetch(MARKET_ITEMS);
  const items = await data.json();
  for (const item of items){
    const id = item.item_info.item_id;
    const sb_price = item.latest_market_data?.sb_price || 0;
    sb_map.set(id, sb_price);
  }
})();

export async function getSBPrice(){
  const SB_ITEM_ID = 114;
  const data = await fetch(`${MARKET_ITEMS}/${SB_ITEM_ID}`);
  const sb_history = await data.json();

  const marketData = sb_history.market_data;
  if (!marketData || marketData.length === 0) return 0;

  const latest = marketData[marketData.length - 1]; // last element
  return latest.price ?? 0;
}

export async function setDailyRates(){
  const dayMs = 86400000; // 24 hours

  // Check if we have recent rates stored
  const { exchangeRates, ratesTimestamp } = await chrome.storage.local.get(["exchangeRates","ratesTimestamp"]);

  // Use stored rates if recent
  if (exchangeRates && Date.now() - ratesTimestamp < dayMs){
    fx.base = "USD"; fx.rates = exchangeRates; return;
  }

  // Fetch and use new rates
  const res = await fetch(EXCHANGE_URL);
  const data = await res.json();
  fx.base = data.base; fx.rates = data.rates;

  // Store new rates
  await chrome.storage.local.set({ exchangeRates: data.rates, ratesTimestamp: Date.now() });
}

export async function fetchIAPs(){
  // Fetch premium store rewards IAPs
  const res = await fetch("/managers/ajax/donations/rewards.php", {
    method: "POST",
    headers: {"X-Requested-With":"XMLHttpRequest","Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"},
    body: "action=getRewards"
  });
  const json = await res.json();
  return json.checkout?.rewards || [];
}

export function parseIAPs(rewards){
  // Parse and format IAP data
  return rewards.map(item => {
    const full_name = item.name;
    
    // Separate units and name
    const match = full_name.match(/(\d+)\s+(.*)/);
    const units = match ? parseInt(match[1],10) : 1;
    const name = match ? match[2] : full_name;

    // Convert cost of IAP to local currency
    const iap_cost = fx(item.value).from(CURRENCY.STORE).to(CURRENCY.LOCAL);
    const unit_cost = iap_cost / units;

    return { full_name, name, units, iap_cost, unit_cost };
  });
}


export async function fetchMarketPrice(iap){
  // Remove plural for search
  const cleanName = singularize(iap.name).replace(/[|+]/g, "").toLowerCase();

  try {
    let itemId;

    // Use pre-generated map first
    if (itemMap[cleanName]) {
      itemId = itemMap[cleanName];
    } else {
      // Fallback: fetch from API
      const q = encodeURIComponent(cleanName);
      const r = await fetch(MARKET_QUERY(q));
      const data = await r.json();
      const match = data.find(x => x.item_info?.name?.toLowerCase() === cleanName.toLowerCase());
      if (!match){
        return null;
      }
      itemId = match.item_info.item_id;
    }

    // Fetch marketplace item
    const item = await fetchMarketplaceItem(itemId);

    let remaining_units = iap.units; 
    let gold = 0;
    
    // Calculate total gold from buy orders
    for (const listing of item.buy_order){
      if (!remaining_units) break;

      // Calculate sellable units from buy orders
      const sellable_units = Math.min(remaining_units, listing.quantity);
      const unit_price_tariffed = Math.floor(listing.unit_price / 1.1); // Remove 10% tariff
      gold += sellable_units * unit_price_tariffed
      remaining_units -= sellable_units;
    }
    
    return {
      full_name: iap.full_name,
      name: singularize(iap.name),
      iap_cost: iap.iap_cost.toFixed(2),
      units: iap.units,
      gold,
      gold_per_cost: Math.floor(gold / iap.iap_cost),
      super_brie: sb_map.get(itemId) * iap.units,

      // Tooltip details
      remaining_units,
      buy_order: item.buy_order,
      buy_order_sum: item.buy_order_sum
    };
  } catch(err){ console.error("Error fetching marketplace item:", err); return null; }
}

function singularize(name){
  return name.endsWith("s") ? name.slice(0,-1) : name; 
}

// Stores and return item data if fetching the same item id again.
export const marketplaceCache = new Map();
async function fetchMarketplaceItem(itemId) {
  // Check cache first
  if (marketplaceCache.has(itemId)) {
    return marketplaceCache.get(itemId);
  }

  // Fetch marketplace listings for given item ID
  const res = await fetch("/managers/ajax/users/marketplace.php", {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: `action=get_item_listings&item_id=${itemId}`
  });

  const json = await res.json();

  const buy_orders = json.marketplace_item_listings?.[itemId]?.buy ?? [];
  const buy_order_sum = json.marketplace_item_sum_listings?.[itemId]?.buy ?? [];

  const result = {
    buy_order: buy_orders,
    buy_order_sum: buy_order_sum
  };

  // Store in cache
  marketplaceCache.set(itemId, result);
  return result;
}

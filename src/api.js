"use strict";
(function(){
  const EXCHANGE_URL = "https://api.exchangerate-api.com/v4/latest/USD";
  const MARKET_SEARCH_URL = "https://api.markethunt.win/items/search?query=";

  function singularize(name){
    return name.endsWith("s") ? name.slice(0,-1) : name; 
  }

  async function setDailyRates(){
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

  async function fetchIAPs(){
    // Fetch premium store rewards IAPs
    const res = await fetch("/managers/ajax/donations/rewards.php", {
      method: "POST",
      headers: {"X-Requested-With":"XMLHttpRequest","Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"},
      body: "action=getRewards"
    });
    const json = await res.json();
    return json.checkout?.rewards || [];
  }

  function parseIAPs(rewards){
    const { STORE_CURRENCY, LOCAL_CURRENCY } = window.mhMarketChecker;

    // Parse and format IAP data
    return rewards.map(item => {
      const fullName = item.name;
      
      // Separate units and name
      const match = fullName.match(/(\d+)\s+(.*)/);
      const units = match ? parseInt(match[1],10) : 1;
      const name = match ? match[2] : fullName;

      // Convert cost of IAP to local currency
      const iap_cost = fx(item.value).from(STORE_CURRENCY).to(LOCAL_CURRENCY);
      const unit_cost = iap_cost / units;

      return { full_name: fullName, name, units, iap_cost: iap_cost, unit_cost: unit_cost };
    });
  }

  async function fetchMarketplaceItem(itemId){
    // Fetch marketplace listings for given item ID
    const res = await fetch("/managers/ajax/users/marketplace.php", {
      method: "POST",
      headers: {"X-Requested-With":"XMLHttpRequest","Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"},
      body: `action=get_item_listings&item_id=${itemId}`
    });
    const json = await res.json();

    // Extract buy orders
    const buy_orders = json.marketplace_item_listings?.[itemId]?.buy ?? [];
    const buy_order_remaining = json.marketplace_item_sum_listings?.[itemId]?.buy ?? [];

    return {
      buy_order: buy_orders,
      buy_order_remaining: buy_order_remaining
    };
  }

  async function fetchMarketPrice(iap){
    // Remove plural for search
    const cleanName = singularize(iap.name).replace(/[|+]/g, "");

    try {
      // Seach for item that is in market
      const q = encodeURIComponent(cleanName);
      const r = await fetch(`${MARKET_SEARCH_URL}${q}`);
      const data = await r.json();
      
      // Find exact match of item name
      const match = data.find(x => x.item_info?.name?.toLowerCase() === cleanName.toLowerCase());
      if (!match) return null;

      // Fetch item from marketplace using item ID
      const item = await fetchMarketplaceItem(match.item_info.item_id);

      let remaining_units = iap.units; 
      let gold = 0;
      
      // Calculate total gold from buy orders
      for (const listing of item.buy_order){
        if (!remaining_units) break;

        // Calculate sellable units from buy orders
        const sellable_units = Math.min(remaining_units, listing.quantity);
        gold += sellable_units * listing.unit_price;
        remaining_units -= sellable_units;
      }
      
      // 10% tariff deduction
      gold *= 0.9;
      gold = Math.floor(gold);

      return {
        name: iap.full_name,
        item_name: singularize(iap.name),
        iap_cost: iap.iap_cost.toFixed(2),
        units: iap.units,
        gold,
        gold_per_cost: Math.floor(gold / iap.iap_cost),

        // Tooltip details
        remaining_units: remaining_units,
        buy_order: item.buy_order,
        buy_order_remaining: item.buy_order_remaining
      };
    } catch(err){ console.error("Error fetching marketplace item:", err); return null; }
  }

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, { setDailyRates, fetchIAPs, parseIAPs, fetchMarketPrice });
})();

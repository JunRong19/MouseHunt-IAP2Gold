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
      
      // Separate quantity and name
      const match = fullName.match(/(\d+)\s+(.*)/);
      const quantity = match ? parseInt(match[1],10) : 1;
      const name = match ? match[2] : fullName;

      // Convert cost of IAP to local currency
      const totalCost = fx(item.value).from(STORE_CURRENCY).to(LOCAL_CURRENCY);

      return { full_name: fullName, name, quantity, total_cost: totalCost, unit_cost: totalCost/quantity };
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

    // Extract buy/sell orders
    const listings = json.marketplace_item_listings?.[itemId] || { buy: [], sell: [] };

    // Extract sum orders
    const sums = json.marketplace_item_sum_listings?.[itemId] || { buy: [], sell: [] };

    return { buy: listings.buy, sell: listings.sell, buy_limit: sums.buy, sell_limit: sums.sell, itemId };
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

      let remaining = iap.quantity; 
      let goldTotal = 0;
      
      // Calculate total gold from buy orders
      for (const listing of item.buy){
        if (!remaining) break;

        // Calculate purchasable units from buy orders
        const purchasable = Math.min(remaining, listing.quantity);
        goldTotal += purchasable * listing.unit_price;
        remaining -= purchasable;
      }
      
      // 10% tariff deduction
      goldTotal *= 0.9;

      return {
        name: iap.full_name,
        item_name: singularize(iap.name),
        cost: iap.total_cost.toFixed(2),
        sellableUnit: iap.quantity - remaining, // Units that could be sold to the current buy orders
        goldTotal,
        goldPerCost: Math.round(goldTotal / iap.total_cost)
      };
    } catch(err){ console.error("Error fetching marketplace item:", err); return null; }
  }

  window.mhMarketChecker = window.mhMarketChecker || {};
  Object.assign(window.mhMarketChecker, { setDailyRates, fetchIAPs, parseIAPs, fetchMarketPrice });
})();

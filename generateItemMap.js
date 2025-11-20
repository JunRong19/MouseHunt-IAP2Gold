import fs from "fs";
import fetch from "node-fetch";
import path from "path";

function singularize(name){
  return name.endsWith("s") ? name.slice(0,-1) : name; 
}

async function generateItemMap() {
  const res = await fetch("https://api.markethunt.win/items");
  const items = await res.json();

  const map = {};
  for (const item of items) {
    if (item.item_info?.name && item.item_info?.item_id) {
      // Normalize name for matching
      const cleanName = singularize(item.item_info.name).replace(/[|+]/g, "").toLowerCase();
      map[cleanName] = item.item_info.item_id;
    }
  }

  const dataDir = path.resolve("src/data");
  const filePath = path.join(dataDir, "itemMap.json");

    // Make sure directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(map, null, 2));
  console.log("Item map generated!");
}

generateItemMap();

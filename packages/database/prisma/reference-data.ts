/**
 * Reference data for the demo dataset. Kenyan towns/counties and product
 * names are realistic so charts, filters and forecasts look plausible.
 */

export const TOWNS = [
  { town: "Nairobi", county: "Nairobi" },
  { town: "Mombasa", county: "Mombasa" },
  { town: "Kisumu", county: "Kisumu" },
  { town: "Nakuru", county: "Nakuru" },
  { town: "Uasin Gishu", county: "Uasin Gishu" },
  { town: "Kakamega", county: "Kakamega" },
  { town: "Meru", county: "Meru" },
];

export const BUSINESS_TYPES = [
  "Retail Shop",
  "Hardware Store",
  "Phone Accessories",
  "Supermarket",
  "Fashion Boutique",
  "Pharmacy",
  "Electronics",
  "Agro Supplies",
];

export const FIRST_NAMES = [
  "John", "Mary", "David", "Grace", "Peter", "Faith", "Samuel", "Alice",
  "Joseph", "Esther", "Daniel", "Lucy", "Michael", "Mercy", "James", "Sarah",
];

export const LAST_NAMES = [
  "Otieno", "Wanjiku", "Kimani", "Achieng", "Mwangi", "Njeri", "Barasa",
  "Cherotich", "Mutua", "Nyambura", "Kiptoo", "Wafula", "Ochieng", "Atieno",
];

export const CATALOG: Record<
  string,
  Array<{ name: string; category: string; cost: number; price: number }>
> = {
  "Retail Shop": [
    { name: "Maize Flour 2kg", category: "Groceries", cost: 110, price: 145 },
    { name: "Sugar 1kg", category: "Groceries", cost: 130, price: 168 },
    { name: "Cooking Oil 1L", category: "Groceries", cost: 180, price: 235 },
    { name: "Rice 1kg", category: "Groceries", cost: 95, price: 128 },
    { name: "Bathing Soap", category: "Household", cost: 60, price: 90 },
    { name: "Laundry Detergent", category: "Household", cost: 210, price: 275 },
    { name: "Toothpaste", category: "Personal Care", cost: 85, price: 120 },
    { name: "Paracetamol 20s", category: "Health", cost: 45, price: 75 },
  ],
  "Hardware Store": [
    { name: "Cement 32.5kg", category: "Building", cost: 950, price: 1150 },
    { name: "Steel Bar 12mm", category: "Building", cost: 780, price: 950 },
    { name: "Nails 3kg", category: "Building", cost: 420, price: 545 },
    { name: "Wire Roll 100m", category: "Electrical", cost: 3200, price: 3850 },
    { name: "Bulb 9W LED", category: "Electrical", cost: 95, price: 150 },
    { name: "Switch Socket", category: "Electrical", cost: 70, price: 120 },
    { name: "Paint 5L White", category: "Building", cost: 3400, price: 4100 },
    { name: "Brush 4 inch", category: "Tools", cost: 150, price: 250 },
  ],
  "Phone Accessories": [
    { name: "Phone Case Universal", category: "Accessories", cost: 150, price: 350 },
    { name: "Tempered Glass", category: "Accessories", cost: 60, price: 150 },
    { name: "Charger Type-C 20W", category: "Chargers", cost: 480, price: 750 },
    { name: "Power Bank 10000mAh", category: "Chargers", cost: 1450, price: 2200 },
    { name: "Earphones Wired", category: "Audio", cost: 220, price: 450 },
    { name: "Bluetooth Earbuds", category: "Audio", cost: 1250, price: 2200 },
    { name: "USB OTG Adapter", category: "Accessories", cost: 90, price: 200 },
    { name: "Car Charger", category: "Chargers", cost: 300, price: 600 },
  ],

  Supermarket: [
    { name: "Milk 1L", category: "Dairy", cost: 120, price: 155 },
    { name: "Bread Loaf", category: "Bakery", cost: 90, price: 130 },
    { name: "Eggs Tray 30", category: "Dairy", cost: 380, price: 470 },
    { name: "Chicken 1kg", category: "Meat", cost: 420, price: 520 },
    { name: "Beef 1kg", category: "Meat", cost: 780, price: 900 },
    { name: "Onion 1kg", category: "Produce", cost: 70, price: 110 },
    { name: "Tomato 1kg", category: "Produce", cost: 85, price: 130 },
    { name: "Bananas 1kg", category: "Produce", cost: 60, price: 100 },
  ],
  "Fashion Boutique": [
    { name: "Ankara Gown", category: "Women", cost: 1200, price: 2200 },
    { name: "Cotton T-Shirt", category: "Unisex", cost: 350, price: 700 },
    { name: "Denim Jeans", category: "Unisex", cost: 900, price: 1600 },
    { name: "Shoes Pair", category: "Footwear", cost: 1100, price: 1950 },
    { name: "Handbag", category: "Accessories", cost: 800, price: 1600 },
    { name: "Watch Strap", category: "Accessories", cost: 250, price: 550 },
    { name: "Kids Dress", category: "Kids", cost: 600, price: 1200 },
    { name: "Socks 3 Pack", category: "Unisex", cost: 180, price: 380 },
  ],
  Pharmacy: [
    { name: "Amoxicillin 500mg", category: "Antibiotics", cost: 320, price: 450 },
    { name: "ORS Sachet", category: "Antidote", cost: 18, price: 35 },
    { name: "Vitamin C 100mg", category: "Supplements", cost: 220, price: 350 },
    { name: "Bandage Roll", category: "First Aid", cost: 120, price: 200 },
    { name: "Cough Syrup 100ml", category: "Antitussive", cost: 380, price: 520 },
    { name: "Antimalarial Course", category: "Antimalarial", cost: 260, price: 400 },
    { name: "Thermometer", category: "Devices", cost: 350, price: 600 },
    { name: "Surgical Mask 50pc", category: "Consumables", cost: 300, price: 450 },
  ],
  Electronics: [
    { name: "LED TV 32 inch", category: "TVs", cost: 28000, price: 34500 },
    { name: "Bluetooth Speaker", category: "Audio", cost: 3200, price: 4800 },
    { name: "Rice Cooker 5L", category: "Appliances", cost: 4800, price: 6500 },
    { name: "Electric Kettle 1.7L", category: "Appliances", cost: 1600, price: 2450 },
    { name: "Extension Cord 5m", category: "Electrical", cost: 900, price: 1400 },
    { name: "Solar Lantern", category: "Lighting", cost: 2400, price: 3600 },
    { name: "USB Flash Drive 32GB", category: "Accessories", cost: 700, price: 1150 },
    { name: "Phone Charger 10W", category: "Chargers", cost: 350, price: 600 },
  ],
  "Agro Supplies": [
    { name: "DAP Fertilizer 50kg", category: "Fertilizer", cost: 4200, price: 5100 },
    { name: "NPK 50kg", category: "Fertilizer", cost: 3800, price: 4600 },
    { name: "Maize Seed 10kg", category: "Seeds", cost: 4500, price: 5500 },
    { name: "Beans Seed 10kg", category: "Seeds", cost: 3200, price: 4000 },
    { name: "Knapsack Sprayer 16L", category: "Equipment", cost: 6800, price: 8500 },
    { name: "Watering Can", category: "Equipment", cost: 700, price: 1050 },
    { name: "Jute Sack", category: "Packaging", cost: 180, price: 280 },
    { name: "Animal Feed 50kg", category: "Feed", cost: 2600, price: 3300 },
  ],
};

export const LOYALTY_TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

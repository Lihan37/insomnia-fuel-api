import "dotenv/config";
import { initMongo } from "../config/mongo";
import { menuItems } from "../models/MenuItem";

type CateringSeedItem = {
  name: string;
  description?: string;
  price: number;
  section: string;
};

const cateringItems: CateringSeedItem[] = [
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Fresh Fruit Platter",
    description: "Seasonal Fruit to Share",
    price: 69,
  },
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Assorted Savoury Platter",
    description: "Selection of Quiches, Sausage or Spinach Rolls, Pies",
    price: 69,
  },
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Assorted Sweet Platter",
    description:
      "Selection of assorted muffins, friands, danishes, sweet slices, banana breads",
    price: 69,
  },
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Bacon & Egg Slider Platter",
    price: 69,
  },
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Savoury Croissant Platter",
    price: 79,
  },
  {
    section: "Breakfast or Afternoon Platters to Share",
    name: "Sweet Croissant Platter",
    price: 79,
  },
  {
    section: "Lunch Platters to Share",
    name: "Assorted Gourment Wraps Platter (Large)",
    description: "Mixed wraps from our Wraps Menu",
    price: 99,
  },
  {
    section: "Lunch Platters to Share",
    name: "Assorted Gourment Wraps Platter (Med)",
    description: "Mixed wraps from our Wraps Menu",
    price: 79,
  },
  {
    section: "Lunch Platters to Share",
    name: "Assorted Point Sandwiches Platter (Med)",
    description: "Mixed sandwiches from our Sandwich Menu",
    price: 69,
  },
  {
    section: "Lunch Platters to Share",
    name: "Assorted Point Sandwiches Platter (Large)",
    description: "Mixed sandwiches from our Sandwich Menu",
    price: 89,
  },
  {
    section: "Lunch Platters to Share",
    name: "BBQ Grilled Platter large",
    price: 119,
  },
  {
    section: "Lunch Platters to Share",
    name: "Cheese Platter (with Crackers and Dry fruits)",
    price: 89,
  },
  {
    section: "Lunch Platters to Share",
    name: "Gourmet Mezze Platter (with Dips)",
    price: 89,
  },
  {
    section: "Lunch Platters to Share",
    name: "Lunch Slider Platter",
    price: 79,
  },
  {
    section: "Lunch Platters to Share",
    name: "Salad Trays",
    price: 79,
  },
  {
    section: "Lunch Platters to Share",
    name: "Schnitzel Bites Platter",
    price: 69,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Spaghetti Bolognese Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 99,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Penne Pesto with Chicken Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 99,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Tortellini Boscaiola Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 99,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Chicken & Mushroom Risotto Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 99,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Chicken and Veg Fried Rice Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 99,
  },
  {
    section: "Gourmet Hot Food Platter",
    name: "Chicken, Chorizo & Seafood Paella Large (10-12 People)",
    description: "Serve 12-14 people",
    price: 119,
  },
];

async function run() {
  await initMongo();
  const col = menuItems();
  const now = new Date();

  let inserted = 0;
  let updated = 0;

  for (const item of cateringItems) {
    const filter = {
      category: "catering",
      section: item.section,
      name: item.name,
    };
    const update = {
      $set: {
        description: item.description ?? "",
        price: item.price,
        isAvailable: true,
        isFeatured: false,
        updatedAt: now,
      },
      $setOnInsert: {
        category: "catering",
        section: item.section,
        name: item.name,
        createdAt: now,
      },
    };

    const res = await col.updateOne(filter, update, { upsert: true });
    if (res.upsertedCount > 0) inserted += 1;
    else if (res.matchedCount > 0) updated += 1;
  }

  console.log(
    `Catering seed complete: inserted ${inserted}, updated ${updated}.`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Catering seed failed:", err);
  process.exit(1);
});

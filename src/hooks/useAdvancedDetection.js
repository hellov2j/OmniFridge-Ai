import { useState, useRef, useCallback } from 'react';

// ── Comprehensive food vocabulary for CLIP zero-shot classification ──
// Each entry: { label, name, category, shelfLife (days), unit }
// Labels are phrased for best CLIP matching (descriptive, natural language)
const FOOD_VOCABULARY = [
  // ── Fruits (21) ───────────────────────────────────────────────────
  { label: 'apple',         name: 'Apple',         category: 'fruit', shelfLife: 14, unit: 'pieces' },
  { label: 'banana',        name: 'Banana',        category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'orange',        name: 'Orange',        category: 'fruit', shelfLife: 10, unit: 'pieces' },
  { label: 'grapes',        name: 'Grapes',        category: 'fruit', shelfLife: 7,  unit: 'bunches' },
  { label: 'strawberry',    name: 'Strawberries',  category: 'fruit', shelfLife: 5,  unit: 'packs' },
  { label: 'blueberry',     name: 'Blueberries',   category: 'fruit', shelfLife: 7,  unit: 'packs' },
  { label: 'watermelon',    name: 'Watermelon',    category: 'fruit', shelfLife: 7,  unit: 'pieces' },
  { label: 'pineapple',     name: 'Pineapple',     category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'mango',         name: 'Mango',         category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'kiwi fruit',    name: 'Kiwi',          category: 'fruit', shelfLife: 7,  unit: 'pieces' },
  { label: 'peach',         name: 'Peach',         category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'pear',          name: 'Pear',          category: 'fruit', shelfLife: 7,  unit: 'pieces' },
  { label: 'lemon',         name: 'Lemon',         category: 'fruit', shelfLife: 21, unit: 'pieces' },
  { label: 'lime',          name: 'Lime',          category: 'fruit', shelfLife: 21, unit: 'pieces' },
  { label: 'avocado',       name: 'Avocado',       category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'pomegranate',   name: 'Pomegranate',   category: 'fruit', shelfLife: 14, unit: 'pieces' },
  { label: 'cherry',        name: 'Cherries',      category: 'fruit', shelfLife: 5,  unit: 'packs' },
  { label: 'plum',          name: 'Plum',          category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'coconut',       name: 'Coconut',       category: 'fruit', shelfLife: 14, unit: 'pieces' },
  { label: 'papaya',        name: 'Papaya',        category: 'fruit', shelfLife: 5,  unit: 'pieces' },
  { label: 'guava',         name: 'Guava',         category: 'fruit', shelfLife: 5,  unit: 'pieces' },

  // ── Vegetables (26) ───────────────────────────────────────────────
  { label: 'tomato',          name: 'Tomato',        category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'potato',          name: 'Potato',        category: 'vegetable', shelfLife: 21, unit: 'kg' },
  { label: 'onion',           name: 'Onion',         category: 'vegetable', shelfLife: 30, unit: 'pieces' },
  { label: 'garlic',          name: 'Garlic',        category: 'vegetable', shelfLife: 30, unit: 'pieces' },
  { label: 'carrot',          name: 'Carrot',        category: 'vegetable', shelfLife: 14, unit: 'pieces' },
  { label: 'broccoli',        name: 'Broccoli',      category: 'vegetable', shelfLife: 5,  unit: 'pieces' },
  { label: 'spinach leaves',  name: 'Spinach',       category: 'vegetable', shelfLife: 5,  unit: 'packs' },
  { label: 'lettuce',         name: 'Lettuce',       category: 'vegetable', shelfLife: 5,  unit: 'pieces' },
  { label: 'cucumber',        name: 'Cucumber',      category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'bell pepper',     name: 'Bell Pepper',   category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'chili pepper',    name: 'Chili Pepper',  category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'cabbage',         name: 'Cabbage',       category: 'vegetable', shelfLife: 14, unit: 'pieces' },
  { label: 'cauliflower',     name: 'Cauliflower',   category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'corn on the cob', name: 'Corn',          category: 'vegetable', shelfLife: 5,  unit: 'pieces' },
  { label: 'green peas',      name: 'Green Peas',    category: 'vegetable', shelfLife: 5,  unit: 'packs' },
  { label: 'green beans',     name: 'Green Beans',   category: 'vegetable', shelfLife: 5,  unit: 'packs' },
  { label: 'mushroom',        name: 'Mushrooms',     category: 'vegetable', shelfLife: 5,  unit: 'packs' },
  { label: 'eggplant',        name: 'Eggplant',      category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'zucchini',        name: 'Zucchini',      category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'celery',          name: 'Celery',        category: 'vegetable', shelfLife: 10, unit: 'pieces' },
  { label: 'asparagus',       name: 'Asparagus',     category: 'vegetable', shelfLife: 5,  unit: 'bunches' },
  { label: 'sweet potato',    name: 'Sweet Potato',  category: 'vegetable', shelfLife: 21, unit: 'pieces' },
  { label: 'ginger root',     name: 'Ginger',        category: 'vegetable', shelfLife: 21, unit: 'pieces' },
  { label: 'beetroot',        name: 'Beetroot',      category: 'vegetable', shelfLife: 14, unit: 'pieces' },
  { label: 'radish',          name: 'Radish',        category: 'vegetable', shelfLife: 7,  unit: 'pieces' },
  { label: 'spring onion',    name: 'Spring Onion',  category: 'vegetable', shelfLife: 5,  unit: 'bunches' },

  // ── Dairy & Eggs (12) ─────────────────────────────────────────────
  { label: 'milk bottle or carton',   name: 'Milk',           category: 'dairy', shelfLife: 7,  unit: 'liters' },
  { label: 'cheese block or slices',  name: 'Cheese',         category: 'dairy', shelfLife: 21, unit: 'packs' },
  { label: 'butter',                  name: 'Butter',         category: 'dairy', shelfLife: 30, unit: 'packs' },
  { label: 'yogurt cup',              name: 'Yogurt',         category: 'dairy', shelfLife: 14, unit: 'pieces' },
  { label: 'eggs in carton',          name: 'Eggs',           category: 'dairy', shelfLife: 21, unit: 'dozen' },
  { label: 'cream',                   name: 'Cream',          category: 'dairy', shelfLife: 10, unit: 'packs' },
  { label: 'cottage cheese',          name: 'Cottage Cheese', category: 'dairy', shelfLife: 10, unit: 'packs' },
  { label: 'sour cream',              name: 'Sour Cream',     category: 'dairy', shelfLife: 14, unit: 'packs' },
  { label: 'cream cheese',            name: 'Cream Cheese',   category: 'dairy', shelfLife: 14, unit: 'packs' },
  { label: 'paneer Indian cheese',    name: 'Paneer',         category: 'dairy', shelfLife: 5,  unit: 'packs' },
  { label: 'ice cream tub',           name: 'Ice Cream',      category: 'dairy', shelfLife: 60, unit: 'packs' },
  { label: 'whipped cream can',       name: 'Whipped Cream',  category: 'dairy', shelfLife: 14, unit: 'cans' },

  // ── Meat (9) ──────────────────────────────────────────────────────
  { label: 'raw chicken meat',  name: 'Chicken',      category: 'meat', shelfLife: 3, unit: 'kg' },
  { label: 'beef steak',        name: 'Beef',         category: 'meat', shelfLife: 3, unit: 'kg' },
  { label: 'pork meat',         name: 'Pork',         category: 'meat', shelfLife: 3, unit: 'kg' },
  { label: 'ground meat',       name: 'Ground Meat',  category: 'meat', shelfLife: 2, unit: 'kg' },
  { label: 'sausage links',     name: 'Sausages',     category: 'meat', shelfLife: 5, unit: 'packs' },
  { label: 'bacon strips',      name: 'Bacon',        category: 'meat', shelfLife: 7, unit: 'packs' },
  { label: 'ham slices',        name: 'Ham',          category: 'meat', shelfLife: 5, unit: 'packs' },
  { label: 'turkey meat',       name: 'Turkey',       category: 'meat', shelfLife: 3, unit: 'kg' },
  { label: 'lamb meat',         name: 'Lamb',         category: 'meat', shelfLife: 3, unit: 'kg' },

  // ── Seafood (4) ───────────────────────────────────────────────────
  { label: 'fish fillet',         name: 'Fish',    category: 'seafood', shelfLife: 2, unit: 'pieces' },
  { label: 'salmon fillet',       name: 'Salmon',  category: 'seafood', shelfLife: 2, unit: 'pieces' },
  { label: 'shrimp or prawns',    name: 'Shrimp',  category: 'seafood', shelfLife: 2, unit: 'packs' },
  { label: 'tuna fish',           name: 'Tuna',    category: 'seafood', shelfLife: 2, unit: 'pieces' },

  // ── Grains & Bakery (12) ──────────────────────────────────────────
  { label: 'loaf of bread',         name: 'Bread',      category: 'grain', shelfLife: 5,   unit: 'packs' },
  { label: 'rice bag or bowl',      name: 'Rice',       category: 'grain', shelfLife: 180, unit: 'kg' },
  { label: 'pasta or spaghetti',    name: 'Pasta',      category: 'grain', shelfLife: 365, unit: 'packs' },
  { label: 'noodles',               name: 'Noodles',    category: 'grain', shelfLife: 180, unit: 'packs' },
  { label: 'breakfast cereal box',  name: 'Cereal',     category: 'grain', shelfLife: 180, unit: 'packs' },
  { label: 'oats',                  name: 'Oats',       category: 'grain', shelfLife: 180, unit: 'packs' },
  { label: 'flour bag',             name: 'Flour',      category: 'grain', shelfLife: 180, unit: 'kg' },
  { label: 'tortilla wraps',        name: 'Tortilla',   category: 'grain', shelfLife: 14,  unit: 'packs' },
  { label: 'bagel',                 name: 'Bagel',      category: 'grain', shelfLife: 5,   unit: 'pieces' },
  { label: 'croissant',             name: 'Croissant',  category: 'grain', shelfLife: 3,   unit: 'pieces' },
  { label: 'muffin',                name: 'Muffin',     category: 'grain', shelfLife: 3,   unit: 'pieces' },
  { label: 'baguette french bread', name: 'Baguette',   category: 'grain', shelfLife: 2,   unit: 'pieces' },

  // ── Beverages (9) ─────────────────────────────────────────────────
  { label: 'water bottle',        name: 'Water Bottle',  category: 'beverage', shelfLife: 365, unit: 'bottles' },
  { label: 'fruit juice bottle',  name: 'Juice',         category: 'beverage', shelfLife: 7,   unit: 'bottles' },
  { label: 'soda can or cola',    name: 'Soda',          category: 'beverage', shelfLife: 180, unit: 'cans' },
  { label: 'beer bottle or can',  name: 'Beer',          category: 'beverage', shelfLife: 180, unit: 'bottles' },
  { label: 'wine bottle',         name: 'Wine',          category: 'beverage', shelfLife: 365, unit: 'bottles' },
  { label: 'coffee bag or jar',   name: 'Coffee',        category: 'beverage', shelfLife: 180, unit: 'packs' },
  { label: 'tea box',             name: 'Tea',           category: 'beverage', shelfLife: 365, unit: 'packs' },
  { label: 'energy drink can',    name: 'Energy Drink',  category: 'beverage', shelfLife: 180, unit: 'cans' },
  { label: 'coconut water',       name: 'Coconut Water', category: 'beverage', shelfLife: 14,  unit: 'bottles' },

  // ── Condiments & Sauces (14) ──────────────────────────────────────
  { label: 'ketchup bottle',          name: 'Ketchup',       category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'mustard bottle',          name: 'Mustard',       category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'mayonnaise jar',          name: 'Mayonnaise',    category: 'condiment', shelfLife: 90,  unit: 'bottles' },
  { label: 'hot sauce bottle',        name: 'Hot Sauce',     category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'soy sauce bottle',        name: 'Soy Sauce',     category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'olive oil bottle',        name: 'Olive Oil',     category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'vinegar bottle',          name: 'Vinegar',       category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'honey jar',               name: 'Honey',         category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'jam or jelly jar',        name: 'Jam',           category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'peanut butter jar',       name: 'Peanut Butter', category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'salsa jar',               name: 'Salsa',         category: 'condiment', shelfLife: 14,  unit: 'bottles' },
  { label: 'barbecue sauce bottle',   name: 'BBQ Sauce',     category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'maple syrup bottle',      name: 'Maple Syrup',   category: 'condiment', shelfLife: 365, unit: 'bottles' },
  { label: 'nutella chocolate spread', name: 'Nutella',      category: 'condiment', shelfLife: 180, unit: 'bottles' },

  // ── Snacks (12) ───────────────────────────────────────────────────
  { label: 'potato chips bag',  name: 'Chips',       category: 'snack', shelfLife: 60,  unit: 'packs' },
  { label: 'chocolate bar',     name: 'Chocolate',   category: 'snack', shelfLife: 180, unit: 'pieces' },
  { label: 'granola bar',       name: 'Granola Bar', category: 'snack', shelfLife: 180, unit: 'packs' },
  { label: 'mixed nuts',        name: 'Nuts',        category: 'snack', shelfLife: 90,  unit: 'packs' },
  { label: 'dried fruit',       name: 'Dried Fruit', category: 'snack', shelfLife: 180, unit: 'packs' },
  { label: 'popcorn',           name: 'Popcorn',     category: 'snack', shelfLife: 60,  unit: 'packs' },
  { label: 'cookies',           name: 'Cookies',     category: 'snack', shelfLife: 30,  unit: 'packs' },
  { label: 'crackers',          name: 'Crackers',    category: 'snack', shelfLife: 90,  unit: 'packs' },
  { label: 'candy',             name: 'Candy',       category: 'snack', shelfLife: 180, unit: 'packs' },
  { label: 'protein bar',       name: 'Protein Bar', category: 'snack', shelfLife: 180, unit: 'pieces' },
  { label: 'donut pastry',      name: 'Donut',       category: 'snack', shelfLife: 3,   unit: 'pieces' },
  { label: 'cake dessert',      name: 'Cake',        category: 'snack', shelfLife: 4,   unit: 'pieces' },

  // ── Prepared / Ready-to-eat (15) ──────────────────────────────────
  { label: 'sandwich',              name: 'Sandwich',    category: 'grain',   shelfLife: 2, unit: 'pieces' },
  { label: 'pizza',                 name: 'Pizza',       category: 'grain',   shelfLife: 3, unit: 'slices' },
  { label: 'salad bowl',            name: 'Salad',       category: 'vegetable', shelfLife: 2, unit: 'pieces' },
  { label: 'soup in bowl',          name: 'Soup',        category: 'other',   shelfLife: 3, unit: 'pieces' },
  { label: 'sushi rolls',           name: 'Sushi',       category: 'seafood', shelfLife: 1, unit: 'pieces' },
  { label: 'fried rice',            name: 'Fried Rice',  category: 'grain',   shelfLife: 3, unit: 'pieces' },
  { label: 'curry dish',            name: 'Curry',       category: 'other',   shelfLife: 3, unit: 'pieces' },
  { label: 'burrito wrap',          name: 'Burrito',     category: 'grain',   shelfLife: 2, unit: 'pieces' },
  { label: 'hot dog',               name: 'Hot Dog',     category: 'meat',    shelfLife: 5, unit: 'pieces' },
  { label: 'hamburger',             name: 'Hamburger',   category: 'meat',    shelfLife: 2, unit: 'pieces' },
  { label: 'french fries',          name: 'French Fries', category: 'snack',  shelfLife: 1, unit: 'pieces' },
  { label: 'taco',                  name: 'Taco',        category: 'grain',   shelfLife: 2, unit: 'pieces' },
  { label: 'pasta dish with sauce', name: 'Pasta Dish',  category: 'grain',   shelfLife: 3, unit: 'pieces' },
  { label: 'ramen noodle soup',     name: 'Ramen',       category: 'grain',   shelfLife: 2, unit: 'pieces' },
  { label: 'dumplings',             name: 'Dumplings',   category: 'grain',   shelfLife: 3, unit: 'pieces' },

  // ── Canned & Packaged (6) ─────────────────────────────────────────
  { label: 'canned food',    name: 'Canned Food',  category: 'other',     shelfLife: 365, unit: 'cans' },
  { label: 'canned beans',   name: 'Canned Beans', category: 'vegetable', shelfLife: 365, unit: 'cans' },
  { label: 'canned soup',    name: 'Canned Soup',  category: 'other',     shelfLife: 365, unit: 'cans' },
  { label: 'canned tuna',    name: 'Canned Tuna',  category: 'seafood',   shelfLife: 365, unit: 'cans' },
  { label: 'jar of pickles', name: 'Pickles',      category: 'condiment', shelfLife: 180, unit: 'bottles' },
  { label: 'jar of olives',  name: 'Olives',       category: 'condiment', shelfLife: 180, unit: 'bottles' },

  // ── Frozen (4) ────────────────────────────────────────────────────
  { label: 'frozen vegetables bag', name: 'Frozen Vegetables', category: 'frozen', shelfLife: 180, unit: 'packs' },
  { label: 'frozen pizza box',      name: 'Frozen Pizza',      category: 'frozen', shelfLife: 180, unit: 'packs' },
  { label: 'frozen berries',        name: 'Frozen Berries',    category: 'frozen', shelfLife: 180, unit: 'packs' },
  { label: 'frozen fish',           name: 'Frozen Fish',       category: 'frozen', shelfLife: 180, unit: 'packs' },

  // ── Herbs & Plant-based (5) ───────────────────────────────────────
  { label: 'fresh herbs basil or cilantro', name: 'Fresh Herbs',  category: 'vegetable', shelfLife: 5,  unit: 'bunches' },
  { label: 'parsley',                       name: 'Parsley',      category: 'vegetable', shelfLife: 5,  unit: 'bunches' },
  { label: 'mint leaves',                   name: 'Mint',         category: 'vegetable', shelfLife: 5,  unit: 'bunches' },
  { label: 'tofu block',                    name: 'Tofu',         category: 'other',     shelfLife: 7,  unit: 'packs' },
  { label: 'plant based milk carton',       name: 'Plant Milk',   category: 'beverage',  shelfLife: 10, unit: 'liters' },
];

// Pre-compute lookup structures
const CANDIDATE_LABELS = FOOD_VOCABULARY.map(f => f.label);
const LABEL_MAP = new Map(FOOD_VOCABULARY.map(f => [f.label, f]));

// ── Non-food "absorber" labels ──────────────────────────────────────
// These compete with food labels in CLIP's softmax and soak up probability
// when the image doesn't actually contain food. Without these, CLIP is
// forced to distribute 100% across food labels even for a picture of a shoe.
const NON_FOOD_LABELS = [
  'an empty table or countertop',
  'a room with no food visible',
  'a person standing or sitting',
  'furniture in a room',
  'an electronic device or computer screen',
  'clothing or fabric',
  'paper documents or books',
  'an outdoor scene with buildings or nature',
  'a wall or floor surface',
  'a hand or fingers with no food',
];
const NON_FOOD_SET = new Set(NON_FOOD_LABELS);
const ALL_CANDIDATE_LABELS = [...CANDIDATE_LABELS, ...NON_FOOD_LABELS];

/**
 * Hook for advanced offline detection using CLIP zero-shot image classification.
 * Can identify 150+ food items — runs entirely in the browser via Transformers.js.
 * Model is ~150 MB, downloaded & cached on first use.
 */
export function useAdvancedDetection() {
  const [detecting, setDetecting] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const classifierRef = useRef(null);

  const loadModel = useCallback(async () => {
    if (classifierRef.current) return classifierRef.current;

    setModelLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      const { pipeline } = await import('@huggingface/transformers');

      const classifier = await pipeline(
        'zero-shot-image-classification',
        'Xenova/clip-vit-base-patch32',
        {
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress != null) {
              setLoadProgress(Math.round(p.progress));
            }
          },
        }
      );

      classifierRef.current = classifier;
      return classifier;
    } catch (err) {
      console.error('Failed to load CLIP model:', err);
      setError(
        'Failed to load advanced model. First download is ~150 MB — check your internet connection.'
      );
      return null;
    } finally {
      setModelLoading(false);
    }
  }, []);

  const detectFromImage = useCallback(async (imageSource) => {
    setDetecting(true);
    setError(null);

    try {
      const classifier = await loadModel();
      if (!classifier) {
        setDetecting(false);
        return [];
      }

      // For base64 data URLs, convert to a Blob URL for Transformers.js compatibility
      let input = imageSource;
      if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
        const res = await fetch(imageSource);
        const blob = await res.blob();
        input = URL.createObjectURL(blob);
      }

      // Run CLIP against food labels + non-food absorber labels
      const output = await classifier(input, ALL_CANDIDATE_LABELS);

      // Clean up blob URL if we created one
      if (input !== imageSource) {
        URL.revokeObjectURL(input);
      }

      // ── Anti-hallucination filtering ─────────────────────────────
      // 1. Find the best non-food score — this is our "background baseline".
      //    If a non-food label wins, the image probably doesn't contain food.
      const bestNonFoodScore = output
        .filter(r => NON_FOOD_SET.has(r.label))
        .reduce((max, r) => Math.max(max, r.score), 0);

      // 2. Extract only food labels, already sorted by score descending
      const foodResults = output.filter(r => !NON_FOOD_SET.has(r.label));
      const topFoodScore = foodResults[0]?.score || 0;

      // 3. If the best non-food label beats ALL food labels, nothing is real
      if (bestNonFoodScore > topFoodScore) {
        setError('No food items detected. Try a clearer image with visible food.');
        return [];
      }

      // 4. Dynamic threshold — food items must clear ALL of these:
      //    a) Higher than the best non-food label (must beat background)
      //    b) Absolute minimum of 1.5% (with 160 labels, random is ~0.6%)
      //    c) At least 35% of the top food score (relative filter)
      const threshold = Math.max(
        bestNonFoodScore,
        0.20,
        topFoodScore * 0.35
      );

      // 5. Score-gap analysis: if there's a sudden drop between consecutive
      //    items (ratio > 2.5×), that's where real detections end and noise begins
      let gapCutoff = foodResults.length;
      for (let i = 0; i < Math.min(foodResults.length - 1, 5); i++) {
        if (foodResults[i].score > threshold && foodResults[i + 1].score > 0) {
          if (foodResults[i].score / foodResults[i + 1].score > 2.5) {
            gapCutoff = i + 1;
            break;
          }
        }
      }

      // 6. Build final results
      const results = foodResults
        .filter(r => r.score >= threshold)
        .slice(0, Math.min(gapCutoff, 5))  // Max 5 items, respect gap cutoff
        .map(r => {
          const meta = LABEL_MAP.get(r.label);
          if (!meta) return null;
          return {
            name: meta.name,
            category: meta.category,
            estimatedShelfLifeDays: meta.shelfLife,
            suggestedUnit: meta.unit,
            confidence: r.score,
          };
        })
        .filter(Boolean);

      if (results.length === 0) {
        setError('No food items detected. Try a clearer image with visible food.');
      }

      return results;
    } catch (err) {
      console.error('Advanced detection error:', err);
      setError('Detection failed: ' + (err.message || 'Unknown error'));
      return [];
    } finally {
      setDetecting(false);
    }
  }, [loadModel]);

  return {
    detectFromImage,
    detecting,
    modelLoading,
    loadProgress,
    error,
    clearError: () => setError(null),
    isModelLoaded: !!classifierRef.current,
  };
}

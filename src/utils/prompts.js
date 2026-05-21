export const FOOD_DETECTION_PROMPT = `You are a smart fridge AI assistant. Analyze this image of food items and identify every food item you can see.

Return ONLY a valid JSON array (no markdown, no code fences, no explanation) with objects in this exact format:
[
  {
    "name": "Item Name",
    "category": "dairy|vegetable|fruit|meat|grain|beverage|condiment|snack|other",
    "estimatedShelfLifeDays": 7,
    "suggestedUnit": "pieces|liters|kg|grams|packs|bottles|cans|dozen"
  }
]

Rules:
- Be specific: "whole milk" not just "milk", "red bell pepper" not just "pepper"
- Estimate realistic shelf life in days from today
- If you cannot identify an item clearly, skip it
- Return an empty array [] if no food items are visible
- DO NOT include any text outside the JSON array`;

export const RECIPE_SUGGESTION_PROMPT = (items) => {
  const itemList = items.map(i => `${i.quantity} ${i.unit} of ${i.name}`).join(', ');

  return `You are a creative chef AI. I have these ingredients in my fridge: ${itemList}.

Suggest 4-5 recipes I can make using ONLY these ingredients (plus basic pantry staples like salt, pepper, oil, butter, sugar, flour, garlic, onion, and common spices).

Return ONLY a valid JSON array (no markdown, no code fences, no explanation) with this exact format:
[
  {
    "title": "Recipe Name",
    "description": "Brief 1-sentence description",
    "difficulty": "Easy|Medium|Hard",
    "cookTime": "15 mins",
    "servings": 2,
    "ingredients": ["ingredient 1", "ingredient 2"],
    "steps": ["Step 1 instruction", "Step 2 instruction"],
    "matchedIngredients": ["names of fridge items used"]
  }
]

Rules:
- Prioritize recipes that use ingredients expiring soon
- Include a mix of quick and elaborate recipes
- Be practical and realistic
- DO NOT include any text outside the JSON array`;
};

import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FOOD_DETECTION_PROMPT, RECIPE_SUGGESTION_PROMPT } from '../utils/prompts';

const getApiKey = () => localStorage.getItem('smartfridge_gemini_key') || '';
const getModel = () => localStorage.getItem('smartfridge_gemini_model') || 'gemini-2.0-flash-lite';
const isDemoMode = () => localStorage.getItem('smartfridge_demo_mode') !== 'false';

// Cached Gemini client (avoids re-instantiation per call)
let _cachedClient = null;
let _cachedKey = null;

// ── Demo / mock data (works without API) ────────────────────────────
const DEMO_DETECTIONS = [
  { name: 'Milk', category: 'dairy', estimatedShelfLifeDays: 7, suggestedUnit: 'liters' },
  { name: 'Eggs', category: 'dairy', estimatedShelfLifeDays: 14, suggestedUnit: 'dozen' },
  { name: 'Tomatoes', category: 'vegetable', estimatedShelfLifeDays: 5, suggestedUnit: 'pieces' },
  { name: 'Cheese', category: 'dairy', estimatedShelfLifeDays: 21, suggestedUnit: 'packs' },
  { name: 'Chicken Breast', category: 'meat', estimatedShelfLifeDays: 3, suggestedUnit: 'kg' },
  { name: 'Spinach', category: 'vegetable', estimatedShelfLifeDays: 4, suggestedUnit: 'packs' },
  { name: 'Bread', category: 'grain', estimatedShelfLifeDays: 5, suggestedUnit: 'packs' },
  { name: 'Apples', category: 'fruit', estimatedShelfLifeDays: 10, suggestedUnit: 'pieces' },
  { name: 'Yogurt', category: 'dairy', estimatedShelfLifeDays: 10, suggestedUnit: 'pieces' },
  { name: 'Orange Juice', category: 'beverage', estimatedShelfLifeDays: 7, suggestedUnit: 'bottles' },
];

const DEMO_RECIPES = [
  {
    title: 'Cheese Omelette',
    ingredients: ['Eggs', 'Cheese', 'Milk', 'Salt', 'Pepper'],
    steps: ['Whisk eggs with milk', 'Heat pan with butter', 'Pour egg mixture', 'Add cheese on top', 'Fold and serve'],
    prepTime: '10 mins',
    difficulty: 'Easy',
  },
  {
    title: 'Tomato Spinach Pasta',
    ingredients: ['Tomatoes', 'Spinach', 'Pasta', 'Garlic', 'Olive oil'],
    steps: ['Boil pasta al dente', 'Sauté garlic in olive oil', 'Add diced tomatoes and cook 5 min', 'Toss in spinach until wilted', 'Mix with pasta and season'],
    prepTime: '20 mins',
    difficulty: 'Easy',
  },
  {
    title: 'Chicken Stir Fry',
    ingredients: ['Chicken Breast', 'Spinach', 'Tomatoes', 'Soy sauce', 'Garlic'],
    steps: ['Slice chicken into strips', 'Stir-fry chicken until golden', 'Add garlic and tomatoes', 'Add spinach and soy sauce', 'Cook 3 more minutes and serve'],
    prepTime: '25 mins',
    difficulty: 'Medium',
  },
];

function getDemoDetections() {
  // Return 3-5 random items to simulate varied detection
  const count = 3 + Math.floor(Math.random() * 3);
  const shuffled = [...DEMO_DETECTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Retry with exponential backoff ──────────────────────────────────
async function withRetry(fn, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('RESOURCE_EXHAUSTED');
      if (!isRateLimit || attempt === maxRetries) throw err;
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.warn(`Rate limited. Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Error formatting ────────────────────────────────────────────────
function formatError(err) {
  const msg = err.message || '';
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('RESOURCE_EXHAUSTED')) {
    const retryMatch = msg.match(/retry in ([\d.]+)s/i);
    const seconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
    return `Rate limit reached after retries — wait ~${seconds}s or enable Demo Mode in Settings.`;
  }
  if (msg.includes('API key')) {
    return 'Invalid API key. Check your key in Settings.';
  }
  if (msg.includes('not found') || msg.includes('404')) {
    return 'Model not found. Switch models in Settings.';
  }
  return msg || 'Something went wrong. Try again or enable Demo Mode.';
}

function getClient(apiKey) {
  if (_cachedKey !== apiKey) {
    _cachedClient = new GoogleGenerativeAI(apiKey);
    _cachedKey = apiKey;
  }
  return _cachedClient;
}

// ── Hook ────────────────────────────────────────────────────────────
export function useGemini() {
  const [detecting, setDetecting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);

  const detectFood = useCallback(async (imageBase64) => {
    // ── Demo mode: return mock data instantly ──
    if (isDemoMode()) {
      setDetecting(true);
      setError(null);
      await new Promise(r => setTimeout(r, 1200)); // Simulate processing
      setDetecting(false);
      return getDemoDetections();
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Set your Gemini API key in Settings, or enable Demo Mode.');
      return [];
    }

    setDetecting(true);
    setError(null);

    try {
      const model = getClient(apiKey).getGenerativeModel({ model: getModel() });

      const imagePart = {
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      };

      const text = await withRetry(async () => {
        const result = await model.generateContent([FOOD_DETECTION_PROMPT, imagePart]);
        const response = await result.response;
        return response.text();
      });

      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Food detection error:', err);
      setError(formatError(err));
      return [];
    } finally {
      setDetecting(false);
    }
  }, []);

  const suggestRecipes = useCallback(async (items) => {
    // ── Demo mode ──
    if (isDemoMode()) {
      setSuggesting(true);
      setError(null);
      await new Promise(r => setTimeout(r, 1500));
      setSuggesting(false);
      return DEMO_RECIPES;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Set your Gemini API key in Settings, or enable Demo Mode.');
      return [];
    }

    if (!items.length) {
      setError('No items in your fridge to suggest recipes for');
      return [];
    }

    setSuggesting(true);
    setError(null);

    try {
      const model = getClient(apiKey).getGenerativeModel({ model: getModel() });

      const prompt = RECIPE_SUGGESTION_PROMPT(items);
      const text = await withRetry(async () => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      });

      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Recipe suggestion error:', err);
      setError(formatError(err));
      return [];
    } finally {
      setSuggesting(false);
    }
  }, []);

  return {
    detectFood,
    suggestRecipes,
    detecting,
    suggesting,
    error,
    clearError: () => setError(null),
  };
}

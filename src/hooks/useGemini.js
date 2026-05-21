import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FOOD_DETECTION_PROMPT, RECIPE_SUGGESTION_PROMPT } from '../utils/prompts';

const getApiKey = () => localStorage.getItem('smartfridge_gemini_key') || '';
const getModel = () => localStorage.getItem('smartfridge_gemini_model') || 'gemini-2.0-flash-lite';
const isDemoMode = () => localStorage.getItem('smartfridge_demo_mode') !== 'false';

// Cached Gemini client (avoids re-instantiation per call)
let _cachedClient = null;
let _cachedKey = null;

// Models to try in order — each has a SEPARATE quota pool
const FALLBACK_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

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
  const count = 3 + Math.floor(Math.random() * 3);
  const shuffled = [...DEMO_DETECTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Rate limit detection ────────────────────────────────────────────
function isRateLimitError(err) {
  const msg = (err.message || '') + (err.status || '');
  return msg.includes('429') || msg.includes('quota') || msg.includes('rate')
    || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests');
}

// ── Error formatting ────────────────────────────────────────────────
function formatError(err) {
  const msg = err.message || '';
  if (isRateLimitError(err)) {
    return 'All models are rate-limited. Please wait 1-2 minutes and try again, or enable Demo Mode in Settings.';
  }
  if (msg.includes('API key') || msg.includes('API_KEY_INVALID')) {
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

// ── Smart retry: tries fallback models, then waits and retries ──────
async function callWithFallback(apiKey, contentArgs, onStatus) {
  const preferredModel = getModel();

  // Build ordered model list: preferred first, then others
  const models = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
  const client = getClient(apiKey);

  // Phase 1: Try each model once
  for (const modelName of models) {
    try {
      onStatus?.(`Trying ${modelName}...`);
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contentArgs);
      const response = await result.response;
      return response.text();
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`${modelName} rate-limited, trying next model...`);
        continue;
      }
      throw err; // Non-rate-limit error, don't retry
    }
  }

  // Phase 2: All models failed — wait and retry preferred model
  const delays = [15, 30, 60]; // seconds
  for (let i = 0; i < delays.length; i++) {
    const waitSec = delays[i];
    onStatus?.(`All models rate-limited. Waiting ${waitSec}s before retry...`);
    await new Promise(r => setTimeout(r, waitSec * 1000));

    try {
      onStatus?.(`Retrying ${preferredModel}... (attempt ${i + 2})`);
      const model = client.getGenerativeModel({ model: preferredModel });
      const result = await model.generateContent(contentArgs);
      const response = await result.response;
      return response.text();
    } catch (err) {
      if (isRateLimitError(err) && i < delays.length - 1) {
        console.warn(`Still rate-limited after ${waitSec}s wait`);
        continue;
      }
      throw err;
    }
  }

  throw new Error('RESOURCE_EXHAUSTED');
}

// ── Hook ────────────────────────────────────────────────────────────
export function useGemini() {
  const [detecting, setDetecting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);
  const [retryStatus, setRetryStatus] = useState(null);

  const detectFood = useCallback(async (imageBase64) => {
    if (isDemoMode()) {
      setDetecting(true);
      setError(null);
      setRetryStatus(null);
      await new Promise(r => setTimeout(r, 1200));
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
    setRetryStatus(null);

    try {
      const imagePart = {
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      };

      const text = await callWithFallback(
        apiKey,
        [FOOD_DETECTION_PROMPT, imagePart],
        (status) => setRetryStatus(status)
      );

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
      setRetryStatus(null);
    }
  }, []);

  const suggestRecipes = useCallback(async (items) => {
    if (isDemoMode()) {
      setSuggesting(true);
      setError(null);
      setRetryStatus(null);
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
    setRetryStatus(null);

    try {
      const prompt = RECIPE_SUGGESTION_PROMPT(items);
      const text = await callWithFallback(
        apiKey,
        prompt,
        (status) => setRetryStatus(status)
      );

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
      setRetryStatus(null);
    }
  }, []);

  return {
    detectFood,
    suggestRecipes,
    detecting,
    suggesting,
    error,
    retryStatus,
    clearError: () => setError(null),
  };
}

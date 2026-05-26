import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FOOD_DETECTION_PROMPT, RECIPE_SUGGESTION_PROMPT, RECEIPT_PARSE_PROMPT, VOICE_COMMAND_PROMPT } from '../utils/prompts';

const getApiKey = () => localStorage.getItem('smartfridge_gemini_key') || '';
const getModel = () => {
  const m = localStorage.getItem('smartfridge_gemini_model');
  // Migrate any deprecated model names to the current default
  if (!m || m.startsWith('gemini-1.') || m.startsWith('gemini-2.') || m === 'gemini-3.1-flash') {
    return 'gemini-2.5-flash';
  }
  return m;
};
const isDemoMode = () => localStorage.getItem('smartfridge_demo_mode') !== 'false';

// Cached Gemini client (avoids re-instantiation per call)
let _cachedClient = null;
let _cachedKey = null;

// Models to try in order — each has a SEPARATE quota pool
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
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

const DEMO_RECEIPT_ITEMS = [
  { name: 'Amul Toned Milk 1L', category: 'dairy', quantity: 2, unit: 'packs', price: 54, estimatedShelfLifeDays: 5 },
  { name: 'Brown Bread', category: 'grain', quantity: 1, unit: 'packs', price: 45, estimatedShelfLifeDays: 4 },
  { name: 'Farm Eggs (12 pack)', category: 'dairy', quantity: 1, unit: 'dozen', price: 84, estimatedShelfLifeDays: 14 },
  { name: 'Onions', category: 'vegetable', quantity: 1, unit: 'kg', price: 35, estimatedShelfLifeDays: 14 },
  { name: 'Tomatoes', category: 'vegetable', quantity: 0.5, unit: 'kg', price: 25, estimatedShelfLifeDays: 5 },
  { name: 'Cheddar Cheese Slices', category: 'dairy', quantity: 1, unit: 'packs', price: 120, estimatedShelfLifeDays: 30 },
  { name: 'Coca-Cola 750ml', category: 'beverage', quantity: 2, unit: 'bottles', price: 40, estimatedShelfLifeDays: 180 },
  { name: 'Chicken Breast', category: 'meat', quantity: 0.5, unit: 'kg', price: 180, estimatedShelfLifeDays: 2 },
];

// ── Rate limit detection ────────────────────────────────────────────
function isRateLimitError(err) {
  const msg = (err.message || '') + (err.status || '');
  const lowerMsg = msg.toLowerCase();
  return msg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit')
    || msg.includes('RESOURCE_EXHAUSTED') || lowerMsg.includes('too many requests');
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

// ── Smart retry: tries fallback models with cooldown, then a single delayed retry ──
async function callWithFallback(apiKey, contentArgs, onStatus) {
  const preferredModel = getModel();

  // Build ordered model list: preferred first, then others
  const models = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
  const client = getClient(apiKey);

  let lastError = null;

  // Phase 1: Try each model once, with a brief cooldown between attempts
  //          so we don't slam all quotas in under a second
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      onStatus?.(`Trying ${modelName}...`);
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contentArgs);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err)) {
        console.warn(`${modelName} rate-limited, trying next model...`);
        // Wait 2s before trying the next model to avoid rapid-fire quota burn
        if (i < models.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
        continue;
      }
      throw err; // Non-rate-limit error, don't retry
    }
  }

  // Phase 2: All models failed — wait once and retry the preferred model
  onStatus?.(`All models rate-limited. Waiting 30s before retry...`);
  await new Promise(r => setTimeout(r, 30000));

  try {
    onStatus?.(`Retrying ${preferredModel}...`);
    const model = client.getGenerativeModel({ model: preferredModel });
    const result = await model.generateContent(contentArgs);
    const response = await result.response;
    return response.text();
  } catch (err) {
    // If still rate-limited, give up with a clear message
    throw lastError || err;
  }
}

// ── Hook ────────────────────────────────────────────────────────────
export function useGemini() {
  const [detecting, setDetecting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
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
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        cleaned = match[0];
      } else {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        cleaned = match[0];
      } else {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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

  const parseReceipt = useCallback(async (imageBase64) => {
    if (isDemoMode()) {
      setParsingReceipt(true);
      setError(null);
      setRetryStatus(null);
      await new Promise(r => setTimeout(r, 1800));
      setParsingReceipt(false);
      return DEMO_RECEIPT_ITEMS;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Set your Gemini API key in Settings, or enable Demo Mode.');
      return [];
    }

    setParsingReceipt(true);
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
        [RECEIPT_PARSE_PROMPT, imagePart],
        (status) => setRetryStatus(status)
      );

      let cleaned = text.trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        cleaned = match[0];
      } else {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Receipt parse error:', err);
      setError(formatError(err));
      return [];
    } finally {
      setParsingReceipt(false);
      setRetryStatus(null);
    }
  }, []);

  const parseVoiceCommand = useCallback(async (transcript, currentInventory) => {
    if (isDemoMode()) {
      setProcessingVoice(true);
      setError(null);
      setRetryStatus(null);
      await new Promise(r => setTimeout(r, 1200));
      setProcessingVoice(false);
      // Demo: parse simple patterns
      const demoActions = [];
      const lower = transcript.toLowerCase();
      if (lower.includes('add') || lower.includes('bought') || lower.includes('got')) {
        demoActions.push({ action: 'add', name: 'Milk', category: 'dairy', quantity: 1, unit: 'liters', estimatedShelfLifeDays: 5, matchedItemId: null });
      }
      if (lower.includes('ate') || lower.includes('used') || lower.includes('drank')) {
        demoActions.push({ action: 'consume', name: 'Apple', category: 'fruit', quantity: 1, unit: 'pieces', estimatedShelfLifeDays: null, matchedItemId: null });
      }
      return demoActions.length ? demoActions : [{ action: 'add', name: 'Banana', category: 'fruit', quantity: 2, unit: 'pieces', estimatedShelfLifeDays: 5, matchedItemId: null }];
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Set your Gemini API key in Settings, or enable Demo Mode.');
      return [];
    }

    setProcessingVoice(true);
    setError(null);
    setRetryStatus(null);

    try {
      const prompt = VOICE_COMMAND_PROMPT(currentInventory);
      const fullPrompt = `${prompt}\n\nUser said: "${transcript}"`;

      const text = await callWithFallback(
        apiKey,
        fullPrompt,
        (status) => setRetryStatus(status)
      );

      let cleaned = text.trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        cleaned = match[0];
      } else {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Voice command parse error:', err);
      setError(formatError(err));
      return [];
    } finally {
      setProcessingVoice(false);
      setRetryStatus(null);
    }
  }, []);

  return {
    detectFood,
    suggestRecipes,
    parseReceipt,
    parseVoiceCommand,
    detecting,
    suggesting,
    parsingReceipt,
    processingVoice,
    error,
    retryStatus,
    clearError: () => setError(null),
  };
}

import { useState, useRef, useCallback } from 'react';

// ── COCO-SSD food label → category + shelf life mapping ─────────────
// COCO has 12 food/drink classes – map every single one
const FOOD_MAP = {
  banana:    { category: 'fruit',     shelfLife: 5,  unit: 'pieces', displayName: 'Banana' },
  apple:     { category: 'fruit',     shelfLife: 14, unit: 'pieces', displayName: 'Apple' },
  orange:    { category: 'fruit',     shelfLife: 10, unit: 'pieces', displayName: 'Orange' },
  broccoli:  { category: 'vegetable', shelfLife: 5,  unit: 'pieces', displayName: 'Broccoli' },
  carrot:    { category: 'vegetable', shelfLife: 14, unit: 'pieces', displayName: 'Carrot' },
  sandwich:  { category: 'grain',     shelfLife: 2,  unit: 'pieces', displayName: 'Sandwich' },
  pizza:     { category: 'grain',     shelfLife: 3,  unit: 'slices', displayName: 'Pizza' },
  donut:     { category: 'snack',     shelfLife: 3,  unit: 'pieces', displayName: 'Donut' },
  cake:      { category: 'snack',     shelfLife: 4,  unit: 'pieces', displayName: 'Cake' },
  'hot dog': { category: 'meat',      shelfLife: 5,  unit: 'pieces', displayName: 'Hot Dog' },
};

// Non-food items from COCO that are still useful as kitchen/beverage items
const KITCHEN_MAP = {
  bottle:       { category: 'beverage',  shelfLife: 30, unit: 'bottles', displayName: 'Bottle' },
  'wine glass': { category: 'beverage',  shelfLife: 5,  unit: 'pieces',  displayName: 'Wine Glass' },
  cup:          { category: 'beverage',  shelfLife: 1,  unit: 'pieces',  displayName: 'Cup' },
  bowl:         { category: 'other',     shelfLife: 3,  unit: 'pieces',  displayName: 'Bowl (food)' },
  spoon:        { category: 'other',     shelfLife: 999, unit: 'pieces', displayName: 'Spoon' },
  knife:        { category: 'other',     shelfLife: 999, unit: 'pieces', displayName: 'Knife' },
  fork:         { category: 'other',     shelfLife: 999, unit: 'pieces', displayName: 'Fork' },
  'dining table': { category: 'other',   shelfLife: 999, unit: 'pieces', displayName: 'Dining Table' },
};

// Only show actual food + beverage items by default; skip utensils/furniture
const FOOD_LABELS = { ...FOOD_MAP, ...KITCHEN_MAP };
// Labels to completely ignore (utensils, furniture — they clutter results)
const IGNORE_LABELS = new Set(['spoon', 'knife', 'fork', 'dining table']);
const ALL_LABELS = FOOD_LABELS;

/**
 * Hook for offline object detection using TensorFlow.js COCO-SSD.
 * Runs entirely in the browser — no API calls needed.
 */
export function useLocalDetection() {
  const [detecting, setDetecting] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState(null);
  const modelRef = useRef(null);

  const loadModel = useCallback(async () => {
    if (modelRef.current) return modelRef.current;

    setModelLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid loading TF.js unless needed
      const tf = await import('@tensorflow/tfjs');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      
      // Use the full 'mobilenet_v2' base for significantly better accuracy
      // (~5 MB larger than lite but dramatically fewer false negatives)
      const model = await cocoSsd.load({ base: 'mobilenet_v2' });
      modelRef.current = model;
      return model;
    } catch (err) {
      console.error('Failed to load COCO-SSD model:', err);
      setError('Failed to load detection model. Check your internet for the first download.');
      return null;
    } finally {
      setModelLoading(false);
    }
  }, []);

  const detectFromImage = useCallback(async (imageSource) => {
    setDetecting(true);
    setError(null);

    try {
      const model = await loadModel();
      if (!model) {
        setDetecting(false);
        return [];
      }

      // imageSource can be: HTMLImageElement, HTMLVideoElement, HTMLCanvasElement, or base64 string
      let element = imageSource;

      // If it's a base64 data URL string, convert to an Image element
      if (typeof imageSource === 'string') {
        element = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = imageSource;
        });
      }

      // Run detection — higher maxDetections catches more items in cluttered scenes
      // Confidence threshold 0.4 balances recall vs precision (was 0.3 → too noisy)
      const predictions = await model.detect(element, 30, 0.4);

      // Filter to food/kitchen items, deduplicate, keep highest-confidence per label
      const bestByLabel = new Map();

      for (const pred of predictions) {
        const label = pred.class.toLowerCase();
        const mapping = ALL_LABELS[label];
        if (!mapping) continue; // Skip non-food items (person, car, etc.)
        if (IGNORE_LABELS.has(label)) continue; // Skip utensils / furniture

        const existing = bestByLabel.get(label);
        if (!existing || pred.score > existing.score) {
          bestByLabel.set(label, pred);
        }
      }

      const results = [];
      for (const [label, pred] of bestByLabel) {
        const mapping = ALL_LABELS[label];
        results.push({
          name: mapping.displayName || (label.charAt(0).toUpperCase() + label.slice(1)),
          category: mapping.category,
          estimatedShelfLifeDays: mapping.shelfLife,
          suggestedUnit: mapping.unit,
          confidence: pred.score,
          bbox: pred.bbox, // [x, y, width, height] for drawing boxes
        });
      }

      // Sort by confidence descending so the most certain items appear first
      results.sort((a, b) => b.confidence - a.confidence);

      if (results.length === 0) {
        setError('No food items detected. Try a clearer image with visible food.');
      }

      return results;
    } catch (err) {
      console.error('Detection error:', err);
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
    error,
    clearError: () => setError(null),
    isModelLoaded: !!modelRef.current,
  };
}

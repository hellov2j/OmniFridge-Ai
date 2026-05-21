import { useState, useRef, useCallback } from 'react';

// ── COCO-SSD food label → category + shelf life mapping ─────────────
const FOOD_MAP = {
  banana:    { category: 'fruit',     shelfLife: 5,  unit: 'pieces' },
  apple:     { category: 'fruit',     shelfLife: 14, unit: 'pieces' },
  orange:    { category: 'fruit',     shelfLife: 10, unit: 'pieces' },
  broccoli:  { category: 'vegetable', shelfLife: 5,  unit: 'pieces' },
  carrot:    { category: 'vegetable', shelfLife: 14, unit: 'pieces' },
  sandwich:  { category: 'grain',     shelfLife: 2,  unit: 'pieces' },
  pizza:     { category: 'grain',     shelfLife: 3,  unit: 'pieces' },
  donut:     { category: 'snack',     shelfLife: 3,  unit: 'pieces' },
  cake:      { category: 'snack',     shelfLife: 4,  unit: 'pieces' },
  'hot dog': { category: 'meat',      shelfLife: 5,  unit: 'pieces' },
};

// Non-food items that COCO detects but we still show as "kitchen items"
const KITCHEN_MAP = {
  bottle:       { category: 'beverage',  shelfLife: 30, unit: 'bottles' },
  'wine glass': { category: 'beverage',  shelfLife: 5,  unit: 'pieces' },
  cup:          { category: 'beverage',  shelfLife: 1,  unit: 'pieces' },
  bowl:         { category: 'other',     shelfLife: 3,  unit: 'pieces' },
};

const ALL_LABELS = { ...FOOD_MAP, ...KITCHEN_MAP };

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
      
      // Use the lightweight 'lite_mobilenet_v2' base for faster load
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
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

      // Run detection
      const predictions = await model.detect(element, 20, 0.3);

      // Filter to food/kitchen items and deduplicate
      const seen = new Set();
      const results = [];

      for (const pred of predictions) {
        const label = pred.class.toLowerCase();
        const mapping = ALL_LABELS[label];
        if (!mapping) continue; // Skip non-food items (person, car, etc.)
        if (seen.has(label)) continue; // Deduplicate
        seen.add(label);

        results.push({
          name: label.charAt(0).toUpperCase() + label.slice(1),
          category: mapping.category,
          estimatedShelfLifeDays: mapping.shelfLife,
          suggestedUnit: mapping.unit,
          confidence: Math.round(pred.score * 100),
          bbox: pred.bbox, // [x, y, width, height] for drawing boxes
        });
      }

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

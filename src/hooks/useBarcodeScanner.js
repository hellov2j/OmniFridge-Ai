import { useState, useCallback } from 'react';

const CATEGORY_MAP = {
  'en:dairy': 'dairy',
  'en:milk': 'dairy',
  'en:cheeses': 'dairy',
  'en:yogurts': 'dairy',
  'en:meats': 'meat',
  'en:poultry': 'meat',
  'en:seafood': 'meat',
  'en:fruits': 'fruit',
  'en:vegetables': 'vegetable',
  'en:cereals': 'grain',
  'en:breads': 'grain',
  'en:pastas': 'grain',
  'en:beverages': 'beverage',
  'en:sodas': 'beverage',
  'en:juices': 'beverage',
  'en:waters': 'beverage',
  'en:sauces': 'condiment',
  'en:spices': 'condiment',
  'en:snacks': 'snack',
  'en:chips': 'snack',
  'en:chocolates': 'snack',
  'en:candies': 'snack',
};

function mapCategory(categories) {
  if (!categories) return 'other';
  const tags = categories.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (tags.includes(key.replace('en:', ''))) return value;
  }
  return 'other';
}

function parseQuantity(product) {
  const qty = product.quantity || product.product_quantity;
  if (!qty) return { quantity: 1, unit: 'pieces' };

  const str = String(qty).toLowerCase();
  const numMatch = str.match(/([\d.]+)\s*/);
  const num = numMatch ? parseFloat(numMatch[1]) : 1;

  if (str.includes('ml') || str.includes('cl') || str.includes('l')) {
    if (str.includes('ml') || str.includes('cl')) return { quantity: num, unit: 'grams' };
    return { quantity: num, unit: 'liters' };
  }
  if (str.includes('kg')) return { quantity: num, unit: 'kg' };
  if (str.includes('g')) return { quantity: num, unit: 'grams' };

  return { quantity: num, unit: 'pieces' };
}

export function useBarcodeScanner() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookupBarcode = useCallback(async (barcode) => {
    if (!barcode) return null;

    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        {
          headers: { 'User-Agent': 'SmartFridge/1.0 (viraj-smartfridge)' },
        }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        setError(`Product not found for barcode: ${barcode}. You can add it manually.`);
        return null;
      }

      const p = data.product;
      const { quantity, unit } = parseQuantity(p);

      const result = {
        name: p.product_name || p.generic_name || 'Unknown Product',
        brand: p.brands || '',
        category: mapCategory(p.categories_tags?.join(',') || p.categories || ''),
        quantity,
        unit,
        imageUrl: p.image_front_small_url || p.image_url || '',
        barcode,
        nutrition: {
          calories: p.nutriments?.['energy-kcal_100g'] || null,
          fat: p.nutriments?.fat_100g || null,
          carbs: p.nutriments?.carbohydrates_100g || null,
          protein: p.nutriments?.proteins_100g || null,
          sugar: p.nutriments?.sugars_100g || null,
        },
        nutriScore: p.nutriscore_grade || null,
      };

      setProduct(result);
      return result;
    } catch (err) {
      console.error('Barcode lookup error:', err);
      setError(err.message || 'Failed to look up barcode');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearProduct = useCallback(() => {
    setProduct(null);
    setError(null);
  }, []);

  return { product, loading, error, lookupBarcode, clearProduct };
}

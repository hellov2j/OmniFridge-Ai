import { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useGemini } from '../hooks/useGemini';
import './RecipesView.css';

export default function RecipesView() {
  const { getNonExpiredItems } = useInventory();
  const { suggestRecipes, suggesting, error, clearError } = useGemini();
  const [recipes, setRecipes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const availableItems = getNonExpiredItems();

  const handleSuggest = async () => {
    clearError();
    setHasSearched(true);
    const results = await suggestRecipes(availableItems);
    setRecipes(results);
  };

  const getDifficultyClass = (d) => {
    if (!d) return '';
    const lower = d.toLowerCase();
    if (lower === 'easy') return 'difficulty-easy';
    if (lower === 'medium') return 'difficulty-medium';
    return 'difficulty-hard';
  };

  return (
    <div className="recipes-view">
      <h1>Recipe Suggestions</h1>
      <p>AI-powered recipes based on what's in your fridge</p>

      {availableItems.length > 0 && (
        <div className="suggest-info">
          🧊 You have {availableItems.length} item(s) available in your fridge
        </div>
      )}

      {error && (
        <div className="scan-error" style={{ marginBottom: 'var(--space-lg)' }}>⚠️ {error}</div>
      )}

      {suggesting ? (
        <div className="recipe-loading glass-panel">
          <div className="recipe-loading-dots">
            <div className="recipe-loading-dot" />
            <div className="recipe-loading-dot" />
            <div className="recipe-loading-dot" />
          </div>
          <div className="recipe-loading-text">Generating recipes with AI...</div>
          <div className="recipe-loading-subtext">Analyzing your ingredients and finding the best combinations</div>
        </div>
      ) : recipes.length > 0 ? (
        <>
          <div className="recipes-header">
            <h2>🍳 {recipes.length} Recipes Found</h2>
            <button className="btn btn-secondary" onClick={handleSuggest}>
              🔄 Regenerate
            </button>
          </div>
          <div className="recipes-grid">
            {recipes.map((recipe, i) => (
              <div key={recipe.title || `recipe-${i}`} className="recipe-card glass-panel">
                <div className="recipe-card-header">
                  <div className="recipe-card-title">{recipe.title || recipe.name || 'Untitled Recipe'}</div>
                  {recipe.description && (
                    <div className="recipe-card-description">{recipe.description}</div>
                  )}
                </div>

                <div className="recipe-card-meta">
                  {recipe.cookTime && (
                    <div className="recipe-meta-item">
                      <span className="recipe-meta-icon">⏱️</span>
                      {recipe.cookTime}
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="recipe-meta-item">
                      <span className="recipe-meta-icon">👥</span>
                      {recipe.servings} servings
                    </div>
                  )}
                  {recipe.difficulty && (
                    <div className={`recipe-meta-item ${getDifficultyClass(recipe.difficulty)}`}>
                      <span className="recipe-meta-icon">📊</span>
                      {recipe.difficulty}
                    </div>
                  )}
                </div>

                <div className="recipe-card-body">
                  {recipe.ingredients && (
                    <>
                      <div className="recipe-section-title">Ingredients</div>
                      <div className="recipe-ingredients">
                        {recipe.ingredients.map((ing, j) => {
                          const isMatched = recipe.matchedIngredients?.some(m =>
                            ing.toLowerCase().includes(m.toLowerCase()) ||
                            m.toLowerCase().includes(ing.toLowerCase())
                          );
                          return (
                            <span key={j} className={`recipe-ingredient ${isMatched ? 'matched' : ''}`}>
                              {ing}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {recipe.steps && (
                    <>
                      <div className="recipe-section-title">Instructions</div>
                      <ol className="recipe-steps">
                        {recipe.steps.map((step, j) => (
                          <li key={j} className="recipe-step">{step}</li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>

                {recipe.matchedIngredients && recipe.matchedIngredients.length > 0 && (
                  <div className="recipe-matched-note">
                    ✅ Uses {recipe.matchedIngredients.length} item(s) from your fridge
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="suggest-section glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🍳</div>
            <div className="empty-state-title">
              {hasSearched ? 'No recipes generated' : 'Ready to Cook?'}
            </div>
            <div className="empty-state-text">
              {availableItems.length === 0
                ? 'Add some food items to your fridge first, then come back for recipe ideas!'
                : hasSearched
                  ? 'Try again or add more items to your fridge'
                  : `Click below to get AI-powered recipe suggestions based on your ${availableItems.length} fridge item(s)`}
            </div>
            {availableItems.length > 0 && (
              <button
                className="btn btn-primary btn-lg"
                style={{ marginTop: 'var(--space-lg)' }}
                onClick={handleSuggest}
              >
                ✨ Suggest Recipes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import PlusIcon from './icons/PlusIcon';

export interface SavedMeal {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    isFavorite?: boolean;
    timesLogged?: number;
}

interface QuickAddMealProps {
    recentMeals: SavedMeal[];
    favorites: SavedMeal[];
    onQuickAdd: (meal: SavedMeal) => void;
    onAddToFavorites?: (meal: SavedMeal) => void;
}

const QuickAddMeal: React.FC<QuickAddMealProps> = ({
    recentMeals,
    favorites,
    onQuickAdd
}) => {
    const MealChip: React.FC<{ meal: SavedMeal }> = ({ meal }) => (
        <button
            onClick={() => onQuickAdd(meal)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors group"
        >
            <div className="flex-1 text-left">
                <div className="text-sm font-medium text-white truncate max-w-[120px]">{meal.name}</div>
                <div className="text-xs text-gray-500">{meal.calories} cal</div>
            </div>
            <div className="text-gray-600 group-hover:text-[var(--color-primary)] transition-colors">
                <PlusIcon className="w-4 h-4" />
            </div>
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Favorites */}
            {favorites.length > 0 && (
                <div>
                    <h4 className="text-xs uppercase text-gray-500 font-bold mb-2 flex items-center gap-2">
                        <span>★</span> Favorites
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {favorites.slice(0, 6).map(meal => (
                            <MealChip key={meal.id} meal={meal} />
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Meals */}
            {recentMeals.length > 0 && (
                <div>
                    <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">Recent</h4>
                    <div className="flex flex-wrap gap-2">
                        {recentMeals.slice(0, 4).map(meal => (
                            <MealChip key={meal.id} meal={meal} />
                        ))}
                    </div>
                </div>
            )}

            {favorites.length === 0 && recentMeals.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                    <p>No saved meals yet.</p>
                    <p className="text-xs mt-1">Log a meal to see it here.</p>
                </div>
            )}
        </div>
    );
};

export default QuickAddMeal;

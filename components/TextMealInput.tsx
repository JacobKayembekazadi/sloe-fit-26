import React, { useState } from 'react';
import { analyzeTextMeal, TextMealAnalysisResult } from '../services/geminiService';
import LoaderIcon from './icons/LoaderIcon';

interface TextMealInputProps {
    userGoal: string | null;
    onAnalysisComplete: (result: TextMealAnalysisResult) => void;
}

const QUICK_EXAMPLES = [
    'chicken and rice',
    'protein shake with banana',
    'chipotle bowl double chicken',
    '2 eggs with toast'
];

const TextMealInput: React.FC<TextMealInputProps> = ({ userGoal, onAnalysisComplete }) => {
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!description.trim()) {
            setError('Please describe your meal');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await analyzeTextMeal(description, userGoal);
            if (result) {
                onAnalysisComplete(result);
                setDescription('');
            } else {
                setError('Could not analyze the meal. Please try again.');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickExample = (example: string) => {
        setDescription(example);
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <textarea
                    value={description}
                    onChange={(e) => {
                        setDescription(e.target.value);
                        setError(null);
                    }}
                    placeholder="Describe your meal... e.g., 'grilled chicken with rice and broccoli'"
                    className="input-field w-full min-h-[100px] resize-none"
                    disabled={isLoading}
                />
                {description && !isLoading && (
                    <button
                        onClick={() => setDescription('')}
                        className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Quick examples */}
            {!description && (
                <div className="flex flex-wrap gap-2">
                    {QUICK_EXAMPLES.map(example => (
                        <button
                            key={example}
                            onClick={() => handleQuickExample(example)}
                            className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            {example}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
                onClick={handleAnalyze}
                disabled={isLoading || !description.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    'Analyze Meal'
                )}
            </button>
        </div>
    );
};

export default TextMealInput;

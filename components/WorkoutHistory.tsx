
import React, { useState } from 'react';
import type { CompletedWorkout } from '../App';
import ArrowLeftIcon from './icons/ArrowLeftIcon';

interface WorkoutHistoryProps {
    history: CompletedWorkout[];
    onBack: () => void;
}

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ history, onBack }) => {
    const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(0);

    const toggleLogDetails = (index: number) => {
        setSelectedLogIndex(prevIndex => (prevIndex === index ? null : index));
    };

    if (history.length === 0) {
        return (
            <div className="w-full animate-fade-in text-center">
                <h2 className="text-3xl font-bold text-white">Workout History</h2>
                <div className="mt-6 bg-gray-900 border border-gray-800 p-8 rounded-lg">
                    <p className="text-gray-400">You haven't completed any workouts yet.</p>
                    <p className="text-gray-500 text-sm mt-2">Once you log a workout on the dashboard, it will appear here.</p>
                </div>
                 <button onClick={onBack} className="mt-6 flex items-center justify-center gap-2 w-full max-w-xs mx-auto bg-gray-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors">
                    <ArrowLeftIcon />
                    Back to Dashboard
                </button>
            </div>
        );
    }
    
    return (
        <div className="w-full animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white">Workout History</h2>
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-md text-white font-semibold hover:bg-gray-700 transition-colors">
                    <ArrowLeftIcon />
                    Back
                </button>
            </div>

            <div className="space-y-4">
                {history.map((workout, index) => (
                    <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                        <button 
                            className="w-full p-4 text-left flex justify-between items-center hover:bg-gray-800"
                            onClick={() => toggleLogDetails(index)}
                            aria-expanded={selectedLogIndex === index}
                        >
                            <div>
                                <p className="font-bold text-white">{workout.title}</p>
                                <p className="text-sm text-gray-400">{workout.date}</p>
                            </div>
                            <span className={`transform transition-transform duration-300 ${selectedLogIndex === index ? 'rotate-180' : ''}`}>
                                 ▼
                            </span>
                        </button>
                        {selectedLogIndex === index && (
                            <div className="p-4 border-t border-gray-800 animate-fade-in">
                                <ul className="space-y-2 text-gray-300">
                                    {workout.log.map(ex => (
                                        <li key={ex.id} className="p-3 bg-gray-800/50 rounded-md text-sm">
                                            <span className="font-bold text-white">{ex.name}:</span>
                                            <span className="ml-2">{ex.sets} sets</span>
                                            <span className="mx-1">×</span>
                                            <span>{ex.reps} reps</span>
                                            {ex.weight && <span className="ml-2 text-gray-300">@ {ex.weight} lbs</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorkoutHistory;

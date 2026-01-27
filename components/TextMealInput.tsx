import React, { useState, useRef } from 'react';
import { analyzeTextMeal, TextMealAnalysisResult, transcribeAudio } from '../services/openaiService';
import LoaderIcon from './icons/LoaderIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';

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
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                setIsTranscribing(true);
                try {
                    const transcription = await transcribeAudio(audioBlob);
                    if (transcription) {
                        setDescription(prev => prev ? `${prev} ${transcription}` : transcription);
                    } else {
                        setError('Could not transcribe audio. Please try again.');
                    }
                } catch (err) {
                    setError('Voice transcription failed. Please try typing instead.');
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError(null);
        } catch (err) {
            setError('Microphone access denied. Please allow microphone access to use voice input.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

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
                    className="input-field w-full min-h-[100px] resize-none pr-12"
                    disabled={isLoading || isRecording || isTranscribing}
                />
                {/* Voice input button */}
                <button
                    onClick={toggleRecording}
                    disabled={isLoading || isTranscribing}
                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${
                        isRecording
                            ? 'bg-red-500 text-white animate-pulse'
                            : isTranscribing
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-gray-800 text-gray-400 hover:bg-[var(--color-primary)] hover:text-black'
                    }`}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                    {isTranscribing ? (
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                    ) : (
                        <MicrophoneIcon className="w-5 h-5" />
                    )}
                </button>
                {description && !isLoading && !isRecording && !isTranscribing && (
                    <button
                        onClick={() => setDescription('')}
                        className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Recording indicator */}
            {isRecording && (
                <div className="flex items-center gap-2 text-red-400 text-sm animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Recording... tap mic to stop
                </div>
            )}

            {/* Quick examples */}
            {!description && !isRecording && (
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
                disabled={isLoading || !description.trim() || isRecording || isTranscribing}
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

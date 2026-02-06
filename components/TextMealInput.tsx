import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { analyzeTextMeal, TextMealAnalysisResult, transcribeAudio, TranscribeResult } from '../services/aiService';
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
    const { showToast } = useToast();
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
    const [successFeedback, setSuccessFeedback] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(true);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);

    // Recording timer
    useEffect(() => {
        if (isRecording) {
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setRecordingTime(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    // Audio level visualization
    const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(average / 255);
            animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
    };

    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Set up audio analyser for visualization
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

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
                audioContext.close();
                analyserRef.current = null;
                setAudioLevel(0);

                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }

                setIsTranscribing(true);
                try {
                    const result = await transcribeAudio(audioBlob);
                    if (result.text) {
                        setDescription(prev => prev ? `${prev} ${result.text}` : result.text!);
                        // Success feedback
                        setSuccessFeedback(true);
                        setTimeout(() => setSuccessFeedback(false), 1000);
                    } else if (result.unsupported) {
                        setVoiceSupported(false);
                        setError('Voice input is not available with the current AI provider.');
                        setRetryAction(null);
                    } else {
                        setError('Could not transcribe audio. Please try again or type your meal.');
                        setRetryAction(() => startRecording);
                    }
                } catch (err) {
                    setError('Voice transcription failed. Please check your connection and try again.');
                    setRetryAction(() => startRecording);
                    showToast('Voice transcription failed', 'error');
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError(null);
            setRetryAction(null);

            // Start audio level visualization
            animationRef.current = requestAnimationFrame(updateAudioLevel);
        } catch (err) {
            setError('Microphone access denied. Please allow microphone access in your browser settings.');
            setRetryAction(() => startRecording);
            showToast('Microphone access denied', 'error');
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
            setError('Please describe your meal first');
            return;
        }

        setIsLoading(true);
        setError(null);
        setRetryAction(null);

        try {
            const result = await analyzeTextMeal(description, userGoal);
            if (result) {
                onAnalysisComplete(result);
                setDescription('');
                // Success feedback
                setSuccessFeedback(true);
                setTimeout(() => setSuccessFeedback(false), 500);
            } else {
                setError('Could not analyze the meal. Please try rephrasing or adding more detail.');
                setRetryAction(() => handleAnalyze);
            }
        } catch (err) {
            setError('Analysis failed. Please check your connection and try again.');
            setRetryAction(() => handleAnalyze);
            showToast('Meal analysis failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickExample = (example: string) => {
        setDescription(example);
        setError(null);
        setRetryAction(null);
    };

    const dismissError = () => {
        setError(null);
        setRetryAction(null);
    };

    // Waveform bars for recording visualization
    const WaveformBars = () => (
        <div className="flex items-center justify-center gap-1 h-6">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full transition-all duration-75"
                    style={{
                        height: `${Math.max(4, audioLevel * 24 * (0.5 + Math.random() * 0.5))}px`,
                        opacity: 0.6 + audioLevel * 0.4
                    }}
                />
            ))}
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Text input with voice button */}
            <div className={`relative transition-all duration-200 ${successFeedback ? 'scale-[1.02]' : ''}`}>
                <textarea
                    value={description}
                    onChange={(e) => {
                        setDescription(e.target.value);
                        setError(null);
                        setRetryAction(null);
                    }}
                    placeholder={isRecording ? "Listening..." : "Describe your meal... e.g., 'grilled chicken with rice and broccoli'"}
                    className={`input-field w-full min-h-[100px] resize-none pr-14 transition-all duration-200 ${
                        isRecording ? 'border-red-500/50 bg-red-500/5' : ''
                    } ${successFeedback ? 'border-green-500/50 bg-green-500/5' : ''}`}
                    disabled={isLoading || isRecording || isTranscribing}
                />

                {/* Voice input button */}
                {voiceSupported && (
                    <button
                        onClick={toggleRecording}
                        disabled={isLoading || isTranscribing}
                        className={`absolute bottom-3 right-3 p-3 rounded-full transition-all duration-200 ${
                            isRecording
                                ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30'
                                : isTranscribing
                                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                                    : 'bg-gray-800 text-gray-400 hover:bg-[var(--color-primary)] hover:text-black hover:scale-105 active:scale-95'
                        }`}
                        title={isRecording ? 'Tap to stop' : isTranscribing ? 'Processing...' : 'Voice input'}
                    >
                        {isTranscribing ? (
                            <LoaderIcon className="w-5 h-5 animate-spin" />
                        ) : (
                            <MicrophoneIcon className="w-5 h-5" />
                        )}
                    </button>
                )}

                {/* Clear button */}
                {description && !isLoading && !isRecording && !isTranscribing && (
                    <button
                        onClick={() => {
                            setDescription('');
                            setError(null);
                            setRetryAction(null);
                        }}
                        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Recording indicator with timer and waveform */}
            {isRecording && (
                <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-red-400 font-medium">Recording</span>
                        <span className="text-red-300 font-mono text-sm">{formatTime(recordingTime)}</span>
                    </div>
                    <WaveformBars />
                </div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <LoaderIcon className="w-4 h-4 text-blue-400 animate-spin" />
                    <span className="text-blue-400 font-medium">Transcribing your voice...</span>
                </div>
            )}

            {/* Quick examples */}
            {!description && !isRecording && !isTranscribing && (
                <div className="space-y-2">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Quick examples</p>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_EXAMPLES.map(example => (
                            <button
                                key={example}
                                onClick={() => handleQuickExample(example)}
                                className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-full hover:bg-gray-700 hover:text-white transition-all active:scale-95"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Error message with retry option */}
            {error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                        <p className="text-red-400 text-sm">{error}</p>
                        <div className="flex gap-2 mt-2">
                            {retryAction && (
                                <button
                                    onClick={() => {
                                        setError(null);
                                        retryAction();
                                    }}
                                    className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition-colors"
                                >
                                    Try Again
                                </button>
                            )}
                            <button
                                onClick={dismissError}
                                className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-full transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Analyze button */}
            <button
                onClick={handleAnalyze}
                disabled={isLoading || !description.trim() || isRecording || isTranscribing}
                className={`btn-primary w-full flex items-center justify-center gap-2 transition-all duration-200 ${
                    isLoading ? 'animate-pulse' : ''
                } ${!description.trim() || isRecording || isTranscribing ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
            >
                {isLoading ? (
                    <>
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                        <span>Analyzing your meal...</span>
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span>Analyze Meal</span>
                    </>
                )}
            </button>

            {/* Tip text */}
            {!isRecording && !isTranscribing && !error && (
                <p className="text-center text-gray-600 text-xs">
                    💡 Tip: Be specific about portions for better accuracy
                </p>
            )}
        </div>
    );
};

export default TextMealInput;

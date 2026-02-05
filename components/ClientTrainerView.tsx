'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabaseGet, supabaseGetSingle, supabaseInsert, supabaseUpdate } from '@/services/supabaseRawFetch';
import LoaderIcon from './icons/LoaderIcon';

// Skeleton component
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
);

// Loading skeleton for trainer view
const TrainerViewSkeleton = () => (
    <div className="w-full space-y-6 pb-8">
        {/* Header skeleton */}
        <header className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        </header>

        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="card text-center py-3 space-y-2">
                    <Skeleton className="h-8 w-10 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                </div>
            ))}
        </div>

        {/* Tab skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />

        {/* Content skeleton */}
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

interface ClientTrainerViewProps {
    onBack: () => void;
    trainerId: string;
}

interface TrainerInfo {
    id: string;
    full_name: string | null;
}

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface AssignedWorkout {
    id: string;
    template_name: string;
    exercises: WorkoutExercise[];
    status: 'pending' | 'completed' | 'skipped';
    assigned_at: string;
    completed_at?: string;
    notes?: string;
}

interface WorkoutExercise {
    name: string;
    sets: number;
    reps: string;
    weight?: string;
    notes?: string;
}

type ViewTab = 'workouts' | 'messages';

const ClientTrainerView: React.FC<ClientTrainerViewProps> = ({ onBack, trainerId }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [trainer, setTrainer] = useState<TrainerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ViewTab>('workouts');

    // Workouts state
    const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
    const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
    const [updatingWorkout, setUpdatingWorkout] = useState<string | null>(null);

    // Messages state
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user && trainerId) {
            fetchData();
        }
    }, [user, trainerId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch trainer info
            const { data: trainerData } = await supabaseGetSingle<TrainerInfo>(
                `profiles?id=eq.${trainerId}&select=id,full_name`
            );

            if (trainerData) {
                setTrainer(trainerData);
            }

            // Fetch assigned workouts
            const { data: workoutsData } = await supabaseGet<AssignedWorkout[]>(
                `assigned_workouts?client_id=eq.${user.id}&select=*&order=assigned_at.desc`
            );

            if (workoutsData) {
                setAssignedWorkouts(workoutsData);
            }

            // Fetch messages
            await fetchMessages();
        } catch (err) {
                        showToast('Failed to load trainer info', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        if (!user) return;

        try {
            const { data } = await supabaseGet<Message[]>(
                `trainer_messages?or=(and(sender_id.eq.${user.id},receiver_id.eq.${trainerId}),and(sender_id.eq.${trainerId},receiver_id.eq.${user.id}))&select=*&order=created_at.asc`
            );

            if (data) {
                setMessages(data);

                // Count unread messages from trainer
                const unread = data.filter(m => m.sender_id === trainerId && !m.is_read).length;
                setUnreadCount(unread);

                // Mark messages as read
                if (unread > 0) {
                    await supabaseUpdate(
                        `trainer_messages?sender_id=eq.${trainerId}&receiver_id=eq.${user.id}&is_read=eq.false`,
                        { is_read: true }
                    );

                    setUnreadCount(0);
                }
            }
        } catch (err) {
                        setMessages([]);
            // Don't show toast - messages feature may not be set up yet
        }
    };

    const sendMessage = async () => {
        if (!user || !newMessage.trim()) return;
        setSendingMessage(true);

        try {
            const { error } = await supabaseInsert('trainer_messages', {
                sender_id: user.id,
                receiver_id: trainerId,
                content: newMessage.trim(),
                is_read: false
            });

            if (!error) {
                setNewMessage('');
                await fetchMessages();
            }
        } catch (err) {
                        showToast('Failed to send message', 'error');
        } finally {
            setSendingMessage(false);
        }
    };

    const updateWorkoutStatus = async (workoutId: string, status: 'completed' | 'skipped') => {
        if (!user) return;
        setUpdatingWorkout(workoutId);

        try {
            const updateData: { status: string; completed_at?: string } = { status };
            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }

            const { error } = await supabaseUpdate(
                `assigned_workouts?id=eq.${workoutId}&client_id=eq.${user.id}`,
                updateData
            );

            if (!error) {
                setAssignedWorkouts(prev =>
                    prev.map(w => w.id === workoutId
                        ? { ...w, status, completed_at: updateData.completed_at }
                        : w
                    )
                );
            }
        } catch (err) {
                        showToast('Failed to update workout', 'error');
        } finally {
            setUpdatingWorkout(null);
        }
    };

    const pendingWorkouts = assignedWorkouts.filter(w => w.status === 'pending');
    const completedWorkouts = assignedWorkouts.filter(w => w.status === 'completed');

    if (loading) {
        return <TrainerViewSkeleton />;
    }

    return (
        <div className="w-full space-y-6 pb-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    aria-label="Go back"
                    className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                            {trainer?.full_name?.[0]?.toUpperCase() || 'T'}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white">MY TRAINER</h2>
                        <p className="text-gray-400 text-sm">{trainer?.full_name || 'Your Trainer'}</p>
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="card text-center py-3">
                    <p className="text-2xl font-black text-yellow-400">{pendingWorkouts.length}</p>
                    <p className="text-gray-400 text-xs">Pending</p>
                </div>
                <div className="card text-center py-3">
                    <p className="text-2xl font-black text-green-400">{completedWorkouts.length}</p>
                    <p className="text-gray-400 text-xs">Completed</p>
                </div>
                <div className="card text-center py-3">
                    <p className="text-2xl font-black text-[var(--color-primary)]">{messages.length}</p>
                    <p className="text-gray-400 text-xs">Messages</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('workouts')}
                    className={`flex-1 py-3 min-h-[44px] rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'workouts'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Workouts
                    {pendingWorkouts.length > 0 && (
                        <span className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-black text-xs font-bold">
                            {pendingWorkouts.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab('messages'); fetchMessages(); }}
                    className={`flex-1 py-3 min-h-[44px] rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'messages'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Messages
                    {unreadCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Workouts Tab */}
            {activeTab === 'workouts' && (
                <div className="space-y-4">
                    {/* Pending Workouts */}
                    {pendingWorkouts.length > 0 && (
                        <div>
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                                Pending Workouts
                            </h3>
                            <div className="space-y-3">
                                {pendingWorkouts.map((workout) => (
                                    <div key={workout.id} className="card border-yellow-500/30">
                                        <div
                                            className="flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                                        >
                                            <div>
                                                <p className="font-bold text-white">{workout.template_name}</p>
                                                <p className="text-gray-400 text-xs">
                                                    Assigned {new Date(workout.assigned_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <svg
                                                className={`w-5 h-5 text-gray-400 transition-transform ${expandedWorkout === workout.id ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>

                                        {expandedWorkout === workout.id && (
                                            <div className="mt-4 pt-4 border-t border-gray-700">
                                                {/* Exercise List */}
                                                <div className="space-y-2 mb-4">
                                                    {workout.exercises?.map((ex, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-sm py-2 bg-gray-800/50 rounded-lg px-3">
                                                            <span className="text-white">{ex.name}</span>
                                                            <span className="text-[var(--color-primary)] font-medium">{ex.sets} × {ex.reps}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => updateWorkoutStatus(workout.id, 'completed')}
                                                        disabled={updatingWorkout === workout.id}
                                                        className="flex-1 py-3 min-h-[44px] bg-green-500 text-white font-bold rounded-xl disabled:opacity-50 transition-all hover:bg-green-600 flex items-center justify-center gap-2"
                                                    >
                                                        {updatingWorkout === workout.id ? (
                                                            <LoaderIcon className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        Complete
                                                    </button>
                                                    <button
                                                        onClick={() => updateWorkoutStatus(workout.id, 'skipped')}
                                                        disabled={updatingWorkout === workout.id}
                                                        className="px-4 py-3 min-h-[44px] bg-gray-700 text-gray-300 font-bold rounded-xl disabled:opacity-50 transition-all hover:bg-gray-600"
                                                    >
                                                        Skip
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Workouts */}
                    {completedWorkouts.length > 0 && (
                        <div>
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Completed
                            </h3>
                            <div className="space-y-3">
                                {completedWorkouts.slice(0, 5).map((workout) => (
                                    <div key={workout.id} className="card border-green-500/20 opacity-80">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-white">{workout.template_name}</p>
                                                <p className="text-gray-400 text-xs">
                                                    Completed {workout.completed_at ? new Date(workout.completed_at).toLocaleDateString() : ''}
                                                </p>
                                            </div>
                                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold">
                                                Done
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {assignedWorkouts.length === 0 && (
                        <div className="card text-center py-12">
                            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-gray-400 text-lg font-medium">No workouts assigned yet</p>
                            <p className="text-gray-500 text-sm mt-1">Your trainer will assign workouts for you soon!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
                <div className="space-y-4">
                    {/* Messages Container */}
                    <div className="card h-80 overflow-y-auto flex flex-col">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <svg className="w-16 h-16 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <p className="text-gray-400 text-sm">No messages yet</p>
                                <p className="text-gray-500 text-xs">Send a message to your trainer!</p>
                            </div>
                        ) : (
                            <div className="space-y-3 flex-1">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                                                msg.sender_id === user?.id
                                                    ? 'bg-[var(--color-primary)] text-black'
                                                    : 'bg-purple-600 text-white'
                                            }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            <p className={`text-xs mt-1 ${
                                                msg.sender_id === user?.id ? 'text-black/60' : 'text-white/60'
                                            }`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Quick Messages */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {['Done with workout!', 'Need help', 'Feeling great!', 'Questions about form'].map(msg => (
                            <button
                                key={msg}
                                onClick={() => setNewMessage(msg)}
                                className="flex-shrink-0 px-3 py-2.5 min-h-[44px] bg-gray-800 text-gray-400 text-xs rounded-full hover:bg-gray-700 transition-colors"
                            >
                                {msg}
                            </button>
                        ))}
                    </div>

                    {/* Message Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder="Type a message..."
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)]"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sendingMessage || !newMessage.trim()}
                            aria-label="Send message"
                            className="px-6 min-h-[44px] bg-[var(--color-primary)] text-black font-bold rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                        >
                            {sendingMessage ? (
                                <LoaderIcon className="w-5 h-5 animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientTrainerView;

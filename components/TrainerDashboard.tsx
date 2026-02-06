'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabaseGet, supabaseGetSingle, supabaseInsert, supabaseUpdate, supabaseUpsert } from '@/services/supabaseRawFetch';
import LoaderIcon from './icons/LoaderIcon';

import Skeleton from './ui/Skeleton';

// Client card skeleton
const ClientCardSkeleton = () => (
    <div className="card p-4">
        <div className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-4 mt-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
        </div>
    </div>
);

// Client detail skeleton
const ClientDetailSkeleton = () => (
    <div className="space-y-6">
        {/* Stats grid skeleton */}
        <div className="card">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="text-center p-3 bg-gray-800/50 rounded-xl space-y-2">
                        <Skeleton className="h-8 w-16 mx-auto" />
                        <Skeleton className="h-3 w-12 mx-auto" />
                    </div>
                ))}
            </div>
        </div>
        {/* Activity skeleton */}
        <div className="card">
            <Skeleton className="h-5 w-36 mb-3" />
            <div className="grid grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
            </div>
        </div>
        {/* Workouts skeleton */}
        <div className="card">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-3 bg-gray-800/30 rounded-lg space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// Dashboard loading skeleton
const DashboardSkeleton = () => (
    <div className="w-full space-y-6 pb-8">
        {/* Header skeleton */}
        <header className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
            </div>
        </header>

        {/* Tab skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-lg flex-shrink-0" />
            ))}
        </div>

        {/* Client cards skeleton */}
        <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
                <ClientCardSkeleton key={i} />
            ))}
        </div>
    </div>
);

interface TrainerDashboardProps {
    onBack: () => void;
}

interface Client {
    id: string;
    full_name: string | null;
    email: string;
    goal: string | null;
    created_at: string;
    last_workout?: string;
    workouts_this_week?: number;
    total_workouts?: number;
    avg_calories?: number;
    notes?: string;
    unread_messages?: number;
}

interface Invite {
    id: string;
    invite_code: string;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

interface Workout {
    id: string;
    date: string;
    title: string;
    exercises: WorkoutExercise[];
    duration_minutes?: number;
    notes?: string;
}

interface WorkoutExercise {
    name: string;
    sets: number;
    reps: string;
    weight?: string;
    notes?: string;
}

interface NutritionLog {
    id: string;
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
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

interface WorkoutTemplate {
    id: string;
    name: string;
    description?: string;
    exercises: WorkoutExercise[];
    target_muscles?: string[];
    estimated_duration?: number;
}

type MainTab = 'clients' | 'invites' | 'templates';
type ClientTab = 'progress' | 'messages' | 'assign' | 'history' | 'notes';
type SortOption = 'name' | 'recent' | 'activity' | 'goal';

const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
    {
        id: 'default-1',
        name: 'Full Body Strength',
        description: 'Complete full body workout targeting all major muscle groups',
        target_muscles: ['chest', 'back', 'legs', 'shoulders'],
        estimated_duration: 45,
        exercises: [
            { name: 'Squats', sets: 4, reps: '8-10' },
            { name: 'Bench Press', sets: 4, reps: '8-10' },
            { name: 'Barbell Rows', sets: 4, reps: '8-10' },
            { name: 'Shoulder Press', sets: 3, reps: '10-12' },
            { name: 'Romanian Deadlifts', sets: 3, reps: '10-12' },
        ]
    },
    {
        id: 'default-2',
        name: 'Upper Body Push',
        description: 'Focus on chest, shoulders, and triceps',
        target_muscles: ['chest', 'shoulders', 'triceps'],
        estimated_duration: 40,
        exercises: [
            { name: 'Bench Press', sets: 4, reps: '8-10' },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
            { name: 'Overhead Press', sets: 4, reps: '8-10' },
            { name: 'Lateral Raises', sets: 3, reps: '12-15' },
            { name: 'Tricep Dips', sets: 3, reps: '10-12' },
            { name: 'Cable Tricep Pushdowns', sets: 3, reps: '12-15' },
        ]
    },
    {
        id: 'default-3',
        name: 'Upper Body Pull',
        description: 'Focus on back and biceps',
        target_muscles: ['back', 'biceps', 'rear delts'],
        estimated_duration: 40,
        exercises: [
            { name: 'Pull-ups', sets: 4, reps: '6-10' },
            { name: 'Barbell Rows', sets: 4, reps: '8-10' },
            { name: 'Seated Cable Rows', sets: 3, reps: '10-12' },
            { name: 'Face Pulls', sets: 3, reps: '15-20' },
            { name: 'Barbell Curls', sets: 3, reps: '10-12' },
            { name: 'Hammer Curls', sets: 3, reps: '12-15' },
        ]
    },
    {
        id: 'default-4',
        name: 'Lower Body Power',
        description: 'Build leg strength and power',
        target_muscles: ['quads', 'hamstrings', 'glutes', 'calves'],
        estimated_duration: 50,
        exercises: [
            { name: 'Squats', sets: 5, reps: '5' },
            { name: 'Deadlifts', sets: 4, reps: '5' },
            { name: 'Leg Press', sets: 3, reps: '10-12' },
            { name: 'Walking Lunges', sets: 3, reps: '10 each' },
            { name: 'Leg Curls', sets: 3, reps: '12-15' },
            { name: 'Calf Raises', sets: 4, reps: '15-20' },
        ]
    },
    {
        id: 'default-5',
        name: 'HIIT Cardio',
        description: 'High intensity interval training for conditioning',
        target_muscles: ['full body', 'cardio'],
        estimated_duration: 25,
        exercises: [
            { name: 'Burpees', sets: 4, reps: '30 sec work / 30 sec rest' },
            { name: 'Mountain Climbers', sets: 4, reps: '30 sec work / 30 sec rest' },
            { name: 'Jump Squats', sets: 4, reps: '30 sec work / 30 sec rest' },
            { name: 'High Knees', sets: 4, reps: '30 sec work / 30 sec rest' },
            { name: 'Plank Hold', sets: 3, reps: '45 sec' },
        ]
    },
    {
        id: 'default-6',
        name: 'Core & Abs',
        description: 'Targeted core strengthening routine',
        target_muscles: ['abs', 'obliques', 'lower back'],
        estimated_duration: 20,
        exercises: [
            { name: 'Plank', sets: 3, reps: '60 sec' },
            { name: 'Hanging Leg Raises', sets: 3, reps: '12-15' },
            { name: 'Cable Woodchops', sets: 3, reps: '12 each side' },
            { name: 'Ab Wheel Rollouts', sets: 3, reps: '10-12' },
            { name: 'Dead Bug', sets: 3, reps: '10 each side' },
        ]
    },
];

const TrainerDashboard: React.FC<TrainerDashboardProps> = ({ onBack }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Main state
    const [clients, setClients] = useState<Client[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingInvite, setCreatingInvite] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<MainTab>('clients');

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [filterGoal, setFilterGoal] = useState<string | null>(null);

    // Client detail state
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientWorkouts, setClientWorkouts] = useState<Workout[]>([]);
    const [clientNutrition, setClientNutrition] = useState<NutritionLog[]>([]);
    const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
    const [loadingClientData, setLoadingClientData] = useState(false);
    const [clientDetailTab, setClientDetailTab] = useState<ClientTab>('progress');

    // Messaging state
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Workout templates state
    const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>(DEFAULT_TEMPLATES);
    const [assigningWorkout, setAssigningWorkout] = useState(false);
    const [assignedSuccess, setAssignedSuccess] = useState<string | null>(null);
    const [showCreateTemplate, setShowCreateTemplate] = useState(false);
    const [newTemplate, setNewTemplate] = useState<Partial<WorkoutTemplate>>({
        name: '',
        description: '',
        exercises: [{ name: '', sets: 3, reps: '10' }],
    });

    // Client notes state
    const [clientNotes, setClientNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    // Refresh interval for real-time updates
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (user) {
            fetchData();

            // Set up polling for real-time updates (every 30 seconds)
            refreshIntervalRef.current = setInterval(() => {
                fetchData(true); // Silent refresh
            }, 30000);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load custom templates from local storage
    useEffect(() => {
        const savedTemplates = localStorage.getItem('trainer_custom_templates');
        if (savedTemplates) {
            try {
                const parsed = JSON.parse(savedTemplates);
                setWorkoutTemplates([...DEFAULT_TEMPLATES, ...parsed]);
            } catch (e) {
                                showToast('Failed to load workout templates', 'error');
            }
        }
    }, []);

    const fetchData = async (silent = false) => {
        if (!user) return;
        if (!silent) setLoading(true);

        try {
            
            // Fetch clients with their stats (using raw fetch)
            const { data: clientData, error: clientError } = await supabaseGet<any[]>(
                `profiles?trainer_id=eq.${user.id}&select=id,full_name,goal,created_at`
            );

            
            if (clientError) {
                            }

            if (clientData) {
                // Fetch additional stats for each client in parallel
                const clientsWithStats = await Promise.all(
                    clientData.map(async (client) => {
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        const weekAgoStr = weekAgo.toISOString().split('T')[0];

                        // Parallel fetch for performance (using raw fetch)
                        const [workoutsResult, nutritionResult, messagesResult] = await Promise.all([
                            supabaseGet<any[]>(`workouts?user_id=eq.${client.id}&select=id,date&order=date.desc`),
                            supabaseGet<any[]>(`nutrition_logs?user_id=eq.${client.id}&date=gte.${weekAgoStr}&select=calories`),
                            supabaseGet<any[]>(`trainer_messages?sender_id=eq.${client.id}&receiver_id=eq.${user.id}&is_read=eq.false&select=id`)
                        ]);

                        const workouts = workoutsResult.data || [];
                        const nutrition = nutritionResult.data || [];
                        const unreadMessages = messagesResult.data || [];

                        const workoutsThisWeek = workouts.filter(w => new Date(w.date) >= weekAgo).length;
                        const avgCalories = nutrition.length > 0
                            ? Math.round(nutrition.reduce((sum, n) => sum + (n.calories || 0), 0) / nutrition.length)
                            : undefined;

                        return {
                            ...client,
                            email: 'Client',
                            workouts_this_week: workoutsThisWeek,
                            total_workouts: workouts.length,
                            last_workout: workouts[0]?.date,
                            avg_calories: avgCalories,
                            unread_messages: unreadMessages.length,
                        };
                    })
                );

                setClients(clientsWithStats);
            }

            // Fetch invites (using raw fetch)
                        const { data: inviteData, error: inviteError } = await supabaseGet<any[]>(
                `trainer_invites?trainer_id=eq.${user.id}&select=*&order=created_at.desc`
            );

            
            if (inviteError) {
                            }

            if (inviteData) {
                setInvites(inviteData);
            }
        } catch (err) {
                        showToast('Failed to load trainer dashboard', 'error');
        } finally {
                        if (!silent) setLoading(false);
        }
    };

    const fetchClientDetails = async (client: Client) => {
        setLoadingClientData(true);
        setSelectedClient(client);
        setClientDetailTab('progress');

        try {
            // Parallel fetch for better performance (using raw fetch)
            const [workoutsResult, nutritionResult, assignedResult, notesResult] = await Promise.all([
                supabaseGet<any[]>(`workouts?user_id=eq.${client.id}&select=*&order=date.desc&limit=20`),
                supabaseGet<any[]>(`nutrition_logs?user_id=eq.${client.id}&select=*&order=date.desc&limit=14`),
                supabaseGet<any[]>(`assigned_workouts?client_id=eq.${client.id}&select=*&order=assigned_at.desc&limit=20`),
                supabaseGetSingle<any>(`client_notes?trainer_id=eq.${user?.id}&client_id=eq.${client.id}&select=notes`)
            ]);

            setClientWorkouts(workoutsResult.data || []);
            setClientNutrition(nutritionResult.data || []);
            setAssignedWorkouts(assignedResult.data || []);
            setClientNotes(notesResult.data?.notes || '');

            // Fetch messages
            await fetchMessages(client.id);
        } catch (err) {
                        showToast('Failed to load client details', 'error');
        } finally {
            setLoadingClientData(false);
        }
    };

    const fetchMessages = async (clientId: string) => {
        if (!user) return;

        try {
            // Using raw fetch with OR filter
            const { data } = await supabaseGet<any[]>(
                `trainer_messages?or=(and(sender_id.eq.${user.id},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${user.id}))&select=*&order=created_at.asc`
            );

            if (data) {
                setMessages(data);

                // Mark messages as read
                await supabaseUpdate(
                    `trainer_messages?sender_id=eq.${clientId}&receiver_id=eq.${user.id}&is_read=eq.false`,
                    { is_read: true }
                );
            }
        } catch (err) {
                        setMessages([]);
            // Don't show toast - messages feature may not be set up yet
        }
    };

    const sendMessage = async () => {
        if (!user || !selectedClient || !newMessage.trim()) return;
        setSendingMessage(true);

        try {
            const { error } = await supabaseInsert('trainer_messages', {
                sender_id: user.id,
                receiver_id: selectedClient.id,
                content: newMessage.trim(),
                is_read: false
            });

            if (!error) {
                setNewMessage('');
                await fetchMessages(selectedClient.id);
            }
        } catch (err) {
                        showToast('Failed to send message', 'error');
        } finally {
            setSendingMessage(false);
        }
    };

    const assignWorkout = async (template: WorkoutTemplate) => {
        if (!user || !selectedClient) return;
        setAssigningWorkout(true);

        try {
            const { error } = await supabaseInsert('assigned_workouts', {
                trainer_id: user.id,
                client_id: selectedClient.id,
                template_name: template.name,
                exercises: template.exercises,
                status: 'pending',
                assigned_at: new Date().toISOString()
            });

            if (!error) {
                setAssignedSuccess(template.name);
                setTimeout(() => setAssignedSuccess(null), 3000);
                showToast('Workout assigned!', 'success');

                // Refresh assigned workouts
                const { data } = await supabaseGet<any[]>(
                    `assigned_workouts?client_id=eq.${selectedClient.id}&select=*&order=assigned_at.desc&limit=20`
                );

                if (data) setAssignedWorkouts(data);

                // Send notification message
                await supabaseInsert('trainer_messages', {
                    sender_id: user.id,
                    receiver_id: selectedClient.id,
                    content: `📋 New workout assigned: "${template.name}" - Check your assigned workouts!`,
                    is_read: false
                });
            }
        } catch (err) {
                        showToast('Failed to assign workout', 'error');
        } finally {
            setAssigningWorkout(false);
        }
    };

    const saveClientNotes = async () => {
        if (!user || !selectedClient) return;
        setSavingNotes(true);

        try {
            const { error } = await supabaseUpsert('client_notes', {
                trainer_id: user.id,
                client_id: selectedClient.id,
                notes: clientNotes,
                updated_at: new Date().toISOString()
            }, 'trainer_id,client_id');

            if (!error) {
                setNotesSaved(true);
                setTimeout(() => setNotesSaved(false), 2000);
                showToast('Notes saved', 'success');
            }
        } catch (err) {
                        showToast('Failed to save notes', 'error');
        } finally {
            setSavingNotes(false);
        }
    };

    const createCustomTemplate = () => {
        if (!newTemplate.name || !newTemplate.exercises?.length) return;

        const customTemplate: WorkoutTemplate = {
            id: `custom-${Date.now()}`,
            name: newTemplate.name,
            description: newTemplate.description,
            exercises: newTemplate.exercises.filter(e => e.name.trim()),
        };

        const customTemplates = workoutTemplates.filter(t => t.id.startsWith('custom-'));
        customTemplates.push(customTemplate);

        localStorage.setItem('trainer_custom_templates', JSON.stringify(customTemplates));
        setWorkoutTemplates([...DEFAULT_TEMPLATES, ...customTemplates]);

        // Reset form
        setNewTemplate({ name: '', description: '', exercises: [{ name: '', sets: 3, reps: '10' }] });
        setShowCreateTemplate(false);
    };

    const deleteCustomTemplate = (templateId: string) => {
        if (!templateId.startsWith('custom-')) return;

        const customTemplates = workoutTemplates.filter(t => t.id.startsWith('custom-') && t.id !== templateId);
        localStorage.setItem('trainer_custom_templates', JSON.stringify(customTemplates));
        setWorkoutTemplates([...DEFAULT_TEMPLATES, ...customTemplates]);
    };

    const addExerciseToTemplate = () => {
        setNewTemplate(prev => ({
            ...prev,
            exercises: [...(prev.exercises || []), { name: '', sets: 3, reps: '10' }]
        }));
    };

    const updateTemplateExercise = (index: number, field: keyof WorkoutExercise, value: string | number) => {
        setNewTemplate(prev => ({
            ...prev,
            exercises: prev.exercises?.map((ex, i) =>
                i === index ? { ...ex, [field]: value } : ex
            )
        }));
    };

    const removeTemplateExercise = (index: number) => {
        setNewTemplate(prev => ({
            ...prev,
            exercises: prev.exercises?.filter((_, i) => i !== index)
        }));
    };

    const createInvite = async () => {
        if (!user) return;
        setCreatingInvite(true);

        try {
            const code = `SLOE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const { error } = await supabaseInsert('trainer_invites', {
                trainer_id: user.id,
                invite_code: code,
                max_uses: 10,
                is_active: true
            });

            if (!error) {
                await fetchData();
                showToast('Invite link created!', 'success');
            }
        } catch (err) {
                        showToast('Failed to create invite link', 'error');
        } finally {
            setCreatingInvite(false);
        }
    };

    const copyInviteLink = (code: string) => {
        const link = `${window.location.origin}/join/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const deactivateInvite = async (inviteId: string) => {
        await supabaseUpdate(`trainer_invites?id=eq.${inviteId}`, { is_active: false });
        await fetchData();
    };

    // Filter and sort clients
    const filteredClients = clients
        .filter(client => {
            const matchesSearch = !searchQuery ||
                client.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.goal?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesGoal = !filterGoal || client.goal === filterGoal;
            return matchesSearch && matchesGoal;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.full_name || '').localeCompare(b.full_name || '');
                case 'recent':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'activity':
                    return (b.workouts_this_week || 0) - (a.workouts_this_week || 0);
                case 'goal':
                    return (a.goal || 'z').localeCompare(b.goal || 'z');
                default:
                    return 0;
            }
        });

    // Get unique goals for filter
    const uniqueGoals = [...new Set(clients.map(c => c.goal).filter(Boolean))];

    // Calculate nutrition averages
    const nutritionAvg = clientNutrition.length > 0 ? {
        calories: Math.round(clientNutrition.reduce((sum, n) => sum + (n.calories || 0), 0) / clientNutrition.length),
        protein: Math.round(clientNutrition.reduce((sum, n) => sum + (n.protein || 0), 0) / clientNutrition.length),
        carbs: Math.round(clientNutrition.reduce((sum, n) => sum + (n.carbs || 0), 0) / clientNutrition.length),
        fat: Math.round(clientNutrition.reduce((sum, n) => sum + (n.fat || 0), 0) / clientNutrition.length),
    } : null;

    // Calculate completion rate for assigned workouts
    const completionRate = assignedWorkouts.length > 0
        ? Math.round((assignedWorkouts.filter(w => w.status === 'completed').length / assignedWorkouts.length) * 100)
        : 0;

    // Get days since last workout
    const daysSinceLastWorkout = clientWorkouts[0]
        ? Math.floor((Date.now() - new Date(clientWorkouts[0].date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    if (loading) {
        return <DashboardSkeleton />;
    }

    // Client Detail View
    if (selectedClient) {
        return (
            <div className="w-full space-y-6 pb-8">
                {/* Header */}
                <header className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedClient(null)}
                        aria-label="Back to clients list"
                        className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-primary)] to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-lg font-bold text-white">
                                {selectedClient.full_name?.[0]?.toUpperCase() || '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-black text-white truncate">{selectedClient.full_name || 'Client'}</h2>
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    selectedClient.goal === 'CUT' ? 'bg-red-500/20 text-red-400' :
                                    selectedClient.goal === 'BULK' ? 'bg-blue-500/20 text-blue-400' :
                                    selectedClient.goal === 'RECOMP' ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-gray-700 text-gray-400'
                                }`}>
                                    {selectedClient.goal || 'No goal'}
                                </span>
                                {daysSinceLastWorkout !== null && (
                                    <span className={`text-xs ${daysSinceLastWorkout > 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                        {daysSinceLastWorkout === 0 ? 'Worked out today' :
                                         daysSinceLastWorkout === 1 ? '1 day ago' :
                                         `${daysSinceLastWorkout} days ago`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="card text-center py-3">
                        <p className="text-2xl font-black text-[var(--color-primary)]">{selectedClient.workouts_this_week || 0}</p>
                        <p className="text-gray-400 text-xs">This Week</p>
                    </div>
                    <div className="card text-center py-3">
                        <p className="text-2xl font-black text-white">{completionRate}%</p>
                        <p className="text-gray-400 text-xs">Completion</p>
                    </div>
                    <div className="card text-center py-3">
                        <p className="text-2xl font-black text-blue-400">{selectedClient.avg_calories || '-'}</p>
                        <p className="text-gray-400 text-xs">Avg Cal</p>
                    </div>
                </div>

                {/* Client Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                    {(['progress', 'messages', 'assign', 'history', 'notes'] as ClientTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setClientDetailTab(tab)}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                clientDetailTab === tab
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-gray-800 text-gray-400'
                            }`}
                        >
                            {tab === 'messages' && messages.filter(m => !m.is_read && m.sender_id === selectedClient.id).length > 0 && (
                                <span className="w-2 h-2 bg-red-500 rounded-full inline-block mr-1" />
                            )}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {loadingClientData ? (
                    <ClientDetailSkeleton />
                ) : (
                    <>
                        {/* Progress Tab */}
                        {clientDetailTab === 'progress' && (
                            <div className="space-y-6">
                                {/* Nutrition Summary */}
                                <div className="card">
                                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        14-Day Nutrition Average
                                    </h3>
                                    {nutritionAvg ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                                                <p className="text-xl sm:text-2xl font-black text-[var(--color-primary)]">{nutritionAvg.calories}</p>
                                                <p className="text-gray-400 text-xs">Calories</p>
                                            </div>
                                            <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                                                <p className="text-xl sm:text-2xl font-black text-blue-400">{nutritionAvg.protein}g</p>
                                                <p className="text-gray-400 text-xs">Protein</p>
                                            </div>
                                            <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                                                <p className="text-xl sm:text-2xl font-black text-yellow-400">{nutritionAvg.carbs}g</p>
                                                <p className="text-gray-400 text-xs">Carbs</p>
                                            </div>
                                            <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                                                <p className="text-xl sm:text-2xl font-black text-red-400">{nutritionAvg.fat}g</p>
                                                <p className="text-gray-400 text-xs">Fat</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-gray-800/30 rounded-xl">
                                            <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="text-gray-400 text-sm">No nutrition data logged yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* Activity Heatmap (simplified week view) */}
                                <div className="card">
                                    <h3 className="font-bold text-white mb-3">This Week's Activity</h3>
                                    <div className="grid grid-cols-7 gap-2">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                                            const today = new Date();
                                            const dayOfWeek = today.getDay();
                                            const targetDate = new Date(today);
                                            targetDate.setDate(today.getDate() - dayOfWeek + index);
                                            const dateStr = targetDate.toISOString().split('T')[0];

                                            const hasWorkout = clientWorkouts.some(w => w.date.split('T')[0] === dateStr);
                                            const hasNutrition = clientNutrition.some(n => n.date === dateStr);
                                            const isToday = index === dayOfWeek;

                                            return (
                                                <div key={index} className="text-center">
                                                    <p className={`text-xs mb-1 ${isToday ? 'text-[var(--color-primary)] font-bold' : 'text-gray-500'}`}>
                                                        {day}
                                                    </p>
                                                    <div className={`aspect-square rounded-lg flex items-center justify-center ${
                                                        hasWorkout && hasNutrition ? 'bg-green-500' :
                                                        hasWorkout ? 'bg-[var(--color-primary)]' :
                                                        hasNutrition ? 'bg-blue-500' :
                                                        'bg-gray-800'
                                                    }`}>
                                                        {hasWorkout && (
                                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 bg-[var(--color-primary)] rounded" /> Workout
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 bg-blue-500 rounded" /> Nutrition
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 bg-green-500 rounded" /> Both
                                        </span>
                                    </div>
                                </div>

                                {/* Recent Workouts */}
                                <div>
                                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        Recent Workouts
                                    </h3>
                                    {clientWorkouts.length > 0 ? (
                                        <div className="space-y-3">
                                            {clientWorkouts.slice(0, 5).map((workout) => (
                                                <div key={workout.id} className="card">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="font-bold text-white">{workout.title || 'Workout'}</p>
                                                        <span className="text-gray-400 text-xs">
                                                            {new Date(workout.date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-gray-400">
                                                            {Array.isArray(workout.exercises) ? workout.exercises.length : 0} exercises
                                                        </span>
                                                        {workout.duration_minutes && (
                                                            <span className="text-gray-400">
                                                                {workout.duration_minutes} min
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="card text-center py-6">
                                            <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            <p className="text-gray-400">No workouts logged yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Messages Tab */}
                        {clientDetailTab === 'messages' && (
                            <div className="space-y-4">
                                {/* Messages Container */}
                                <div className="card h-80 overflow-y-auto flex flex-col">
                                    {messages.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            <svg className="w-16 h-16 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <p className="text-gray-400 text-sm">No messages yet</p>
                                            <p className="text-gray-500 text-xs">Start the conversation!</p>
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
                                                                : 'bg-gray-700 text-white'
                                                        }`}
                                                    >
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                        <p className={`text-xs mt-1 ${
                                                            msg.sender_id === user?.id ? 'text-black/60' : 'text-gray-400'
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
                                    {['Great work!', 'Keep it up!', 'How are you feeling?', 'Check your new workout'].map(msg => (
                                        <button
                                            key={msg}
                                            onClick={() => setNewMessage(msg)}
                                            className="flex-shrink-0 px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-full hover:bg-gray-700 transition-colors"
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
                                        className="px-6 bg-[var(--color-primary)] text-black font-bold rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
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

                        {/* Assign Workout Tab */}
                        {clientDetailTab === 'assign' && (
                            <div className="space-y-4">
                                {assignedSuccess && (
                                    <div className="bg-green-500/20 border border-green-500/50 rounded-xl px-4 py-3 text-green-400 text-sm flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        "{assignedSuccess}" assigned to {selectedClient.full_name}!
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-white">Workout Templates</h3>
                                        <p className="text-gray-400 text-sm">Assign a workout for your client</p>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('templates')}
                                        className="text-[var(--color-primary)] text-sm font-medium"
                                    >
                                        Manage Templates
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {workoutTemplates.map((template) => (
                                        <div key={template.id} className="card">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <p className="font-bold text-white">{template.name}</p>
                                                    {template.description && (
                                                        <p className="text-gray-400 text-sm mt-0.5">{template.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                        <span>{template.exercises.length} exercises</span>
                                                        {template.estimated_duration && (
                                                            <span>~{template.estimated_duration} min</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => assignWorkout(template)}
                                                    disabled={assigningWorkout}
                                                    className="px-4 py-2 bg-[var(--color-primary)] text-black font-bold text-sm rounded-lg disabled:opacity-50 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                                                >
                                                    {assigningWorkout ? 'Assigning...' : 'Assign'}
                                                </button>
                                            </div>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {template.exercises.slice(0, 4).map((ex, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-sm py-1">
                                                        <span className="text-gray-300">{ex.name}</span>
                                                        <span className="text-gray-500">{ex.sets} × {ex.reps}</span>
                                                    </div>
                                                ))}
                                                {template.exercises.length > 4 && (
                                                    <p className="text-gray-500 text-xs pt-1">+{template.exercises.length - 4} more exercises</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Workout History Tab */}
                        {clientDetailTab === 'history' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Assigned Workouts
                                </h3>

                                {assignedWorkouts.length === 0 ? (
                                    <div className="card text-center py-8">
                                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p className="text-gray-400">No workouts assigned yet</p>
                                        <button
                                            onClick={() => setClientDetailTab('assign')}
                                            className="mt-3 text-[var(--color-primary)] font-medium text-sm"
                                        >
                                            Assign a workout
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {assignedWorkouts.map((workout) => (
                                            <div key={workout.id} className={`card ${workout.status === 'completed' ? 'border-green-500/30' : workout.status === 'skipped' ? 'border-red-500/30 opacity-60' : ''}`}>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <p className="font-bold text-white">{workout.template_name}</p>
                                                        <p className="text-gray-400 text-xs">
                                                            Assigned {new Date(workout.assigned_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                        workout.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                        workout.status === 'skipped' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                        {workout.status.charAt(0).toUpperCase() + workout.status.slice(1)}
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 text-sm">
                                                    {workout.exercises?.length || 0} exercises
                                                    {workout.completed_at && (
                                                        <span className="ml-2">• Completed {new Date(workout.completed_at).toLocaleDateString()}</span>
                                                    )}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Completion Stats */}
                                {assignedWorkouts.length > 0 && (
                                    <div className="card">
                                        <h4 className="font-bold text-white mb-3">Completion Stats</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Completed</span>
                                                <span className="text-green-400 font-bold">
                                                    {assignedWorkouts.filter(w => w.status === 'completed').length}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Pending</span>
                                                <span className="text-yellow-400 font-bold">
                                                    {assignedWorkouts.filter(w => w.status === 'pending').length}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Skipped</span>
                                                <span className="text-red-400 font-bold">
                                                    {assignedWorkouts.filter(w => w.status === 'skipped').length}
                                                </span>
                                            </div>
                                            <div className="pt-2 border-t border-gray-700">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white font-medium">Completion Rate</span>
                                                    <span className="text-[var(--color-primary)] font-black text-lg">{completionRate}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes Tab */}
                        {clientDetailTab === 'notes' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Client Notes
                                </h3>
                                <p className="text-gray-400 text-sm -mt-2">Private notes about this client (only visible to you)</p>

                                <textarea
                                    value={clientNotes}
                                    onChange={(e) => setClientNotes(e.target.value)}
                                    placeholder="Add notes about this client's preferences, injuries, goals, progress observations..."
                                    className="w-full min-h-[200px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] resize-none"
                                />

                                <button
                                    onClick={saveClientNotes}
                                    disabled={savingNotes}
                                    className={`btn-primary w-full flex items-center justify-center gap-2 ${notesSaved ? 'bg-green-500' : ''}`}
                                >
                                    {savingNotes ? (
                                        <>
                                            <LoaderIcon className="w-5 h-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : notesSaved ? (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Saved!
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Save Notes
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    // Main Dashboard View
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
                <div>
                    <h2 className="text-2xl font-black text-white">TRAINER DASHBOARD</h2>
                    <p className="text-gray-400 text-sm">Manage your clients & workouts</p>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
                <div className="card text-center py-4">
                    <p className="text-3xl font-black text-[var(--color-primary)]">{clients.length}</p>
                    <p className="text-gray-400 text-xs">Clients</p>
                </div>
                <div className="card text-center py-4">
                    <p className="text-3xl font-black text-blue-400">
                        {clients.reduce((sum, c) => sum + (c.workouts_this_week || 0), 0)}
                    </p>
                    <p className="text-gray-400 text-xs">Workouts/Week</p>
                </div>
                <div className="card text-center py-4">
                    <p className="text-3xl font-black text-yellow-400">
                        {clients.reduce((sum, c) => sum + (c.unread_messages || 0), 0)}
                    </p>
                    <p className="text-gray-400 text-xs">Unread</p>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex gap-2">
                {(['clients', 'invites', 'templates'] as MainTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            activeTab === tab
                                ? 'bg-[var(--color-primary)] text-black'
                                : 'bg-gray-800 text-gray-400'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Clients Tab */}
            {activeTab === 'clients' && (
                <div className="space-y-4">
                    {/* Search and Filter */}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search clients..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-gray-800 border border-gray-700 rounded-xl px-3 text-white focus:outline-none focus:border-[var(--color-primary)]"
                        >
                            <option value="recent">Recent</option>
                            <option value="name">Name</option>
                            <option value="activity">Activity</option>
                            <option value="goal">Goal</option>
                        </select>
                    </div>

                    {/* Goal Filter Pills */}
                    {uniqueGoals.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <button
                                onClick={() => setFilterGoal(null)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    !filterGoal ? 'bg-[var(--color-primary)] text-black' : 'bg-gray-800 text-gray-400'
                                }`}
                            >
                                All
                            </button>
                            {uniqueGoals.map(goal => (
                                <button
                                    key={goal}
                                    onClick={() => setFilterGoal(goal === filterGoal ? null : goal)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        filterGoal === goal ? 'bg-[var(--color-primary)] text-black' : 'bg-gray-800 text-gray-400'
                                    }`}
                                >
                                    {goal}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Client List */}
                    {filteredClients.length === 0 ? (
                        <div className="card text-center py-8">
                            {clients.length === 0 ? (
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-gray-400 mb-2">No clients yet</p>
                                    <p className="text-gray-500 text-sm">Create an invite link and share it with your clients</p>
                                    <button
                                        onClick={() => setActiveTab('invites')}
                                        className="mt-4 text-[var(--color-primary)] font-medium"
                                    >
                                        Create Invite
                                    </button>
                                </>
                            ) : (
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <p className="text-gray-400">No clients match your search</p>
                                </>
                            )}
                        </div>
                    ) : (
                        filteredClients.map(client => (
                            <div
                                key={client.id}
                                className="card cursor-pointer hover:bg-gray-800/80 transition-colors"
                                onClick={() => fetchClientDetails(client)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-primary)] to-purple-600 rounded-full flex items-center justify-center">
                                            <span className="text-lg font-bold text-white">
                                                {client.full_name?.[0]?.toUpperCase() || '?'}
                                            </span>
                                        </div>
                                        {(client.unread_messages || 0) > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {client.unread_messages}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white truncate">{client.full_name || 'Unnamed Client'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                client.goal === 'CUT' ? 'bg-red-500/20 text-red-400' :
                                                client.goal === 'BULK' ? 'bg-blue-500/20 text-blue-400' :
                                                client.goal === 'RECOMP' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-gray-700 text-gray-400'
                                            }`}>
                                                {client.goal || 'No goal'}
                                            </span>
                                            <span className="text-gray-500 text-xs">
                                                {client.workouts_this_week || 0} workouts this week
                                            </span>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Invites Tab */}
            {activeTab === 'invites' && (
                <div className="space-y-4">
                    <button
                        onClick={createInvite}
                        disabled={creatingInvite}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {creatingInvite ? (
                            <>
                                <LoaderIcon className="w-5 h-5 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Invite
                            </>
                        )}
                    </button>

                    {invites.length === 0 ? (
                        <div className="card text-center py-8">
                            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <p className="text-gray-400">No invites yet</p>
                            <p className="text-gray-500 text-sm">Create an invite to start adding clients</p>
                        </div>
                    ) : (
                        invites.map(invite => (
                            <div key={invite.id} className={`card ${!invite.is_active ? 'opacity-50' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <code className="text-[var(--color-primary)] font-mono text-lg">{invite.invite_code}</code>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        invite.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {invite.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                                    <span>Uses: {invite.uses_count}/{invite.max_uses || '∞'}</span>
                                    <span>{new Date(invite.created_at).toLocaleDateString()}</span>
                                </div>
                                {invite.is_active && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => copyInviteLink(invite.invite_code)}
                                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            {copiedCode === invite.invite_code ? (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    Copy Link
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => deactivateInvite(invite.id)}
                                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Deactivate
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    <button
                        onClick={() => setShowCreateTemplate(true)}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Custom Template
                    </button>

                    {/* Create Template Modal */}
                    {showCreateTemplate && (
                        <div className="card border-[var(--color-primary)] border-2">
                            <h3 className="font-bold text-white mb-4">New Workout Template</h3>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={newTemplate.name || ''}
                                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Template name (e.g., Push Day A)"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)]"
                                />

                                <input
                                    type="text"
                                    value={newTemplate.description || ''}
                                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Description (optional)"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)]"
                                />

                                <div className="space-y-3">
                                    <label className="text-sm text-gray-400">Exercises</label>
                                    {newTemplate.exercises?.map((ex, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={ex.name}
                                                onChange={(e) => updateTemplateExercise(index, 'name', e.target.value)}
                                                placeholder="Exercise name"
                                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)]"
                                            />
                                            <input
                                                type="number"
                                                value={ex.sets}
                                                onChange={(e) => updateTemplateExercise(index, 'sets', parseInt(e.target.value) || 0)}
                                                placeholder="Sets"
                                                className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[var(--color-primary)]"
                                            />
                                            <input
                                                type="text"
                                                value={ex.reps}
                                                onChange={(e) => updateTemplateExercise(index, 'reps', e.target.value)}
                                                placeholder="Reps"
                                                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[var(--color-primary)]"
                                            />
                                            <button
                                                onClick={() => removeTemplateExercise(index)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addExerciseToTemplate}
                                        className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 text-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                                    >
                                        + Add Exercise
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowCreateTemplate(false);
                                            setNewTemplate({ name: '', description: '', exercises: [{ name: '', sets: 3, reps: '10' }] });
                                        }}
                                        className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createCustomTemplate}
                                        disabled={!newTemplate.name || !newTemplate.exercises?.some(e => e.name.trim())}
                                        className="flex-1 py-3 bg-[var(--color-primary)] text-black rounded-xl font-bold disabled:opacity-50 transition-all"
                                    >
                                        Create Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Template List */}
                    <div className="space-y-3">
                        {workoutTemplates.map((template) => (
                            <div key={template.id} className="card">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-white">{template.name}</p>
                                            {template.id.startsWith('custom-') && (
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs">Custom</span>
                                            )}
                                        </div>
                                        {template.description && (
                                            <p className="text-gray-400 text-sm mt-0.5">{template.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                            <span>{template.exercises.length} exercises</span>
                                            {template.estimated_duration && (
                                                <span>~{template.estimated_duration} min</span>
                                            )}
                                            {template.target_muscles && (
                                                <span>{template.target_muscles.join(', ')}</span>
                                            )}
                                        </div>
                                    </div>
                                    {template.id.startsWith('custom-') && (
                                        <button
                                            onClick={() => deleteCustomTemplate(template.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {template.exercises.slice(0, 4).map((ex, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm py-1">
                                            <span className="text-gray-300">{ex.name}</span>
                                            <span className="text-gray-500">{ex.sets} × {ex.reps}</span>
                                        </div>
                                    ))}
                                    {template.exercises.length > 4 && (
                                        <p className="text-gray-500 text-xs pt-1">+{template.exercises.length - 4} more exercises</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainerDashboard;

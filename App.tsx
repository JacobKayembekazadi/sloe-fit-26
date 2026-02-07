
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineBanner from './components/OfflineBanner';
import { useUserData } from './hooks/useUserData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useWeeklyPlan } from './hooks/useWeeklyPlan';
import { supabase } from './supabaseClient';
import { getTodaysWorkout } from './services/workoutService';
import { generateWorkout, GeneratedWorkout } from './services/aiService';
import { findExerciseByName } from './data/exercises';
import { getTemplates, updateLastUsed, templateToExerciseLogs } from './services/templateService';
import { calculateTotalVolume } from './utils/workoutUtils';
import type { WorkoutTemplate } from './services/templateService';
import type { RecoveryState } from './components/RecoveryCheckIn';
import type { WorkoutDraft } from './components/WorkoutSession';
import type { UserProfile } from './hooks/useUserData';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const BodyAnalysis = lazy(() => import('./components/BodyAnalysis'));
const MealTracker = lazy(() => import('./components/MealTracker'));
const Mindset = lazy(() => import('./components/Mindset'));
const WorkoutHistory = lazy(() => import('./components/WorkoutHistory'));
const TrainTab = lazy(() => import('./components/TrainTab'));
const Settings = lazy(() => import('./components/Settings'));
const TrainerDashboard = lazy(() => import('./components/TrainerDashboard'));
const ClientTrainerView = lazy(() => import('./components/ClientTrainerView'));
const CartDrawer = lazy(() => import('./components/CartDrawer'));
const Onboarding = lazy(() => import('./components/Onboarding'));

// Lazy load workout overlay components
const RecoveryCheckIn = lazy(() => import('./components/RecoveryCheckIn'));
const WorkoutPreview = lazy(() => import('./components/WorkoutPreview'));
const WorkoutSession = lazy(() => import('./components/WorkoutSession'));
const WorkoutSummary = lazy(() => import('./components/WorkoutSummary'));
const ExerciseLibrary = lazy(() => import('./components/ExerciseLibrary'));
const WorkoutBuilder = lazy(() => import('./components/WorkoutBuilder'));
const WeeklyPlanView = lazy(() => import('./components/WeeklyPlanView'));
const QuickRecoveryCheck = lazy(() => import('./components/QuickRecoveryCheck'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ShopifyProvider } from './contexts/ShopifyContext';

// Lazy load LoginScreen - only needed for unauthenticated users
const LoginScreen = lazy(() => import('./components/LoginScreen'));

const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
  </div>
);

type Tab = 'dashboard' | 'train' | 'body' | 'meal' | 'mindset';
type View = 'tabs' | 'settings' | 'trainer' | 'myTrainer' | 'history';
type WorkoutStatus = 'idle' | 'recovery' | 'generating' | 'preview' | 'active' | 'completed';

const DRAFT_STORAGE_KEY = 'sloefit_workout_draft';

export interface ExerciseLog {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  notes?: string;
  targetMuscles?: string[];
  restSeconds?: number;
  formCues?: string[];
  exerciseId?: string;
}

export interface CompletedWorkout {
  date: string;
  rawDate?: string;  // ISO timestamp for calculations
  title: string;
  log: ExerciseLog[];
}

export interface NutritionLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// Convert AI workout to exercise log format (module-level)
const aiWorkoutToExerciseLog = (workout: GeneratedWorkout): ExerciseLog[] => {
    return workout.exercises.map((ex, idx) => {
        const libEntry = findExerciseByName(ex.name);
        return {
            id: idx + 1,
            name: ex.name,
            sets: String(ex.sets),
            reps: ex.reps,
            weight: '',
            notes: ex.notes,
            targetMuscles: ex.target_muscles,
            restSeconds: ex.rest_seconds,
            formCues: libEntry?.formCues,
            exerciseId: libEntry?.id,
        };
    });
};

// Helper function to extract muscle groups from workout title
function extractMuscleGroups(title: string): string[] {
    const titleLower = title.toLowerCase();
    const muscles: string[] = [];
    if (titleLower.includes('push') || titleLower.includes('chest')) muscles.push('chest', 'shoulders', 'triceps');
    if (titleLower.includes('pull') || titleLower.includes('back')) muscles.push('back', 'biceps');
    if (titleLower.includes('leg') || titleLower.includes('lower')) muscles.push('legs', 'glutes');
    if (titleLower.includes('upper')) muscles.push('chest', 'back', 'shoulders', 'arms');
    if (titleLower.includes('full body')) muscles.push('chest', 'back', 'legs', 'shoulders');
    if (titleLower.includes('arm')) muscles.push('biceps', 'triceps');
    if (titleLower.includes('shoulder')) muscles.push('shoulders');
    if (titleLower.includes('core')) muscles.push('core');
    return muscles.length > 0 ? muscles : ['full body'];
}

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentView, setCurrentView] = useState<View>('tabs');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');

  // Online status for offline banner
  const isOnline = useOnlineStatus();

  // Supabase Data Hook
  const { goal, onboardingComplete, userProfile, nutritionTargets, workouts, nutritionLogs, mealEntries, favorites, updateGoal, addWorkout, saveNutrition, addMealToDaily, saveMealEntry, deleteMealEntry, addToFavorites, refetchProfile, loading: dataLoading, error: dataError, retry: retryData } = useUserData();
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  // ============================================================================
  // Workout State Machine (lifted from Dashboard)
  // ============================================================================
  const [workoutStatus, setWorkoutStatus] = useState<WorkoutStatus>('idle');
  const [aiWorkout, setAiWorkout] = useState<GeneratedWorkout | null>(null);
  const [completedLog, setCompletedLog] = useState<ExerciseLog[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [recoveryDraft, setRecoveryDraft] = useState<WorkoutDraft | null>(null);
  const [activeDraft, setActiveDraft] = useState<WorkoutDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Workout log/title for preview and session
  const workoutsThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return workouts.filter(w => {
      const workoutDate = new Date(w.rawDate || w.date);
      return workoutDate >= startOfWeek;
    }).length;
  }, [workouts]);

  const fallbackWorkout = useMemo(() => getTodaysWorkout(goal, workoutsThisWeek), [goal, workoutsThisWeek]);
  const [workoutLog, setWorkoutLog] = useState<ExerciseLog[]>(fallbackWorkout.exercises);
  const [workoutTitle, setWorkoutTitle] = useState<string>(fallbackWorkout.title);

  const recentWorkouts = useMemo(() => {
    return workouts.slice(0, 3).map(w => ({
      title: w.title,
      date: w.rawDate || w.date,
      muscles: extractMuscleGroups(w.title)
    }));
  }, [workouts]);

  // Check for draft workout on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved && workoutStatus === 'idle') {
      try {
        const draft: WorkoutDraft = JSON.parse(saved);
        const ageMinutes = (Date.now() - draft.savedAt) / 60000;

        // Draft must be less than 2 hours old AND from today
        const draftDate = new Date(draft.savedAt).toDateString();
        const todayDate = new Date().toDateString();
        const isSameDay = draftDate === todayDate;

        if (ageMinutes < 120 && isSameDay) {
          setRecoveryDraft(draft);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
  }, [workoutStatus]);

  // Get today's nutrition for saving with workout
  const todayNutrition = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return nutritionLogs.find(entry => entry.date === today) || {
      date: today, calories: 0, protein: 0, carbs: 0, fats: 0
    };
  }, [nutritionLogs]);

  const handleWorkoutComplete = useCallback((exercises: ExerciseLog[], title: string) => {
    setCompletedLog(exercises);
    setWorkoutTitle(title);
    setEndTime(Date.now());
    setActiveDraft(null);
    setWorkoutStatus('completed');
  }, []);

  // Note: handleWorkoutCancel is defined after resetWorkoutState to use it
  const handleWorkoutCancel = useCallback(() => {
    // Clean up all workout-related state atomically
    setActiveDraft(null);
    setWorkoutStatus('idle');
    setAiWorkout(null);
    setWorkoutFromPlanDayIndex(null);
    setShowQuickRecovery(false);
    setPendingPlanWorkout(null);
  }, []);

  const handleAddWorkoutToHistory = useCallback(async (log: ExerciseLog[], title: string, rating?: number): Promise<boolean> => {
    const validLog = log.filter(ex => ex.name);
    return await addWorkout(title, validLog, rating);
  }, [addWorkout]);

  const handleResumeDraft = useCallback(() => {
    if (!recoveryDraft) return;
    setActiveDraft(recoveryDraft);
    setWorkoutTitle(recoveryDraft.workoutTitle);
    setStartTime(Date.now() - (recoveryDraft.elapsedTime * 1000));
    setRecoveryDraft(null);
    setWorkoutStatus('active');
  }, [recoveryDraft]);

  const handleDiscardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setRecoveryDraft(null);
  }, []);

  const startNewWorkout = useCallback(() => {
    setWorkoutStatus('recovery');
    setAiWorkout(null);
  }, []);

  const handleRecoveryComplete = useCallback(async (recovery: RecoveryState) => {
    setWorkoutStatus('generating');

    const profile: UserProfile = userProfile || {
      goal: goal,
      height_inches: null,
      weight_lbs: null,
      age: null,
      training_experience: 'beginner',
      equipment_access: 'gym',
      days_per_week: 4,
      role: 'consumer',
      trainer_id: null,
      full_name: null
    };

    try {
      const workout = await generateWorkout({ profile, recovery, recentWorkouts });
      if (workout) {
        setAiWorkout(workout);
        setWorkoutLog(aiWorkoutToExerciseLog(workout));
        setWorkoutTitle(workout.title);
      } else {
        setWorkoutLog(fallbackWorkout.exercises);
        setWorkoutTitle(fallbackWorkout.title);
        showToast('Using fallback workout — AI unavailable', 'info');
      }
    } catch {
      setWorkoutLog(fallbackWorkout.exercises);
      setWorkoutTitle(fallbackWorkout.title);
      showToast('Using fallback workout - AI unavailable', 'info');
    }

    setWorkoutStatus('preview');
  }, [userProfile, goal, recentWorkouts, fallbackWorkout, showToast]);

  const handleStartFromPreview = useCallback(() => {
    setStartTime(Date.now());
    setWorkoutStatus('active');
  }, []);

  // Use shared utility for volume calculation
  const calculateVolume = useCallback((logs: ExerciseLog[]) => {
    return calculateTotalVolume(logs);
  }, []);

  const getDurationString = useCallback(() => {
    const diff = (endTime - startTime) / 1000 / 60;
    const hrs = Math.floor(diff / 60);
    const mins = Math.floor(diff % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }, [endTime, startTime]);

  // ============================================================================
  // Weekly Plan Integration
  // ============================================================================
  const {
    plan: weeklyPlan,
    todaysPlan,
    todaysWorkout,
    completedDays,
    isLoading: isWeeklyPlanLoading,
    isGenerating: isGeneratingPlan,
    generateNewPlan,
    refreshPlan,
    markDayCompleted
  } = useWeeklyPlan();

  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);
  const [showQuickRecovery, setShowQuickRecovery] = useState(false);
  const [pendingPlanWorkout, setPendingPlanWorkout] = useState<GeneratedWorkout | null>(null);
  const [workoutFromPlanDayIndex, setWorkoutFromPlanDayIndex] = useState<number | null>(null);

  // Centralized state cleanup to prevent orphaned state across exit paths
  const resetWorkoutState = useCallback(() => {
    setWorkoutStatus('idle');
    setAiWorkout(null);
    setShowQuickRecovery(false);
    setPendingPlanWorkout(null);
    setWorkoutFromPlanDayIndex(null);
    setActiveDraft(null);
    setCompletedLog([]);
  }, []);

  // Step 1: User clicks "Start" on plan workout -> show quick recovery check
  const handleStartFromPlan = useCallback((workout: GeneratedWorkout) => {
    setPendingPlanWorkout(workout);
    setShowWeeklyPlan(false);
    setShowQuickRecovery(true);
  }, []);

  // Step 2a: Quick check passed -> proceed to preview
  const handleQuickRecoveryProceed = useCallback(() => {
    if (!pendingPlanWorkout) return;

    // Capture day index NOW before any async operations
    const dayIndexAtStart = new Date().getDay();

    setAiWorkout(pendingPlanWorkout);
    setWorkoutLog(aiWorkoutToExerciseLog(pendingPlanWorkout));
    setWorkoutTitle(pendingPlanWorkout.title);
    setShowQuickRecovery(false);
    setPendingPlanWorkout(null);
    // Track that this workout is from today's plan (captured at start time)
    setWorkoutFromPlanDayIndex(dayIndexAtStart);
    setWorkoutStatus('preview');
  }, [pendingPlanWorkout]);

  // Step 2b: User wants full check-in -> go to recovery flow (will generate new workout)
  const handleQuickRecoveryFullCheckIn = useCallback(() => {
    setShowQuickRecovery(false);
    setPendingPlanWorkout(null);
    setWorkoutFromPlanDayIndex(null); // Clear plan association when going to full recovery
    setWorkoutStatus('recovery');
  }, []);

  // Step 2c: User cancels quick recovery
  const handleQuickRecoveryCancel = useCallback(() => {
    setShowQuickRecovery(false);
    setPendingPlanWorkout(null);
  }, []);

  const handleViewWeeklyPlan = useCallback(() => setShowWeeklyPlan(true), []);
  const handleCloseWeeklyPlan = useCallback(() => setShowWeeklyPlan(false), []);

  // Handle workout rating and save (defined here to access markDayCompleted)
  const handleRateWorkout = useCallback(async (rating: number): Promise<boolean> => {
    setIsSaving(true);
    const saved = await handleAddWorkoutToHistory(completedLog, workoutTitle, rating);
    saveNutrition(todayNutrition);
    setIsSaving(false);

    if (saved) {
      // Mark plan day as completed if this workout was from the weekly plan
      if (workoutFromPlanDayIndex !== null) {
        const planSaved = await markDayCompleted(workoutFromPlanDayIndex);
        setWorkoutFromPlanDayIndex(null);
        if (!planSaved) {
          // Workout saved but plan completion failed - warn user but don't block
          showToast('Workout saved! (Plan sync may have failed)', 'info');
        } else {
          showToast('Workout Saved!', 'success');
        }
      } else {
        showToast('Workout Saved!', 'success');
      }
      setWorkoutStatus('idle');
      return true;
    } else {
      showToast('Failed to save workout. Please try again.', 'error');
      return false;
    }
  }, [completedLog, workoutTitle, todayNutrition, handleAddWorkoutToHistory, saveNutrition, showToast, workoutFromPlanDayIndex, markDayCompleted]);

  // ============================================================================
  // Builder / Library / Templates
  // ============================================================================
  const [showBuilder, setShowBuilder] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(() => getTemplates());

  // Pending custom workout for recovery check (from builder or template)
  const [pendingCustomWorkout, setPendingCustomWorkout] = useState<{
    exercises: ExerciseLog[];
    title: string;
  } | null>(null);

  const refreshTemplates = useCallback(() => setTemplates(getTemplates()), []);

  // Convert ExerciseLog[] to a GeneratedWorkout-like structure for QuickRecoveryCheck
  const customWorkoutForRecoveryCheck = useMemo((): GeneratedWorkout | null => {
    if (!pendingCustomWorkout) return null;
    return {
      title: pendingCustomWorkout.title,
      exercises: pendingCustomWorkout.exercises.map(ex => ({
        name: ex.name,
        sets: parseInt(ex.sets) || 3,
        reps: ex.reps,
        target_muscles: ex.targetMuscles || [],
        notes: ex.notes,
        rest_seconds: ex.restSeconds || 60,
      })),
      duration_minutes: 45,
      intensity: 'moderate' as const,
      recovery_adjusted: false,
      warmup: { duration_minutes: 5, exercises: [] },
      cooldown: { duration_minutes: 5, exercises: [] },
    };
  }, [pendingCustomWorkout]);

  // Show quick recovery check before starting custom workout
  const handleStartCustomWorkout = useCallback((exercises: ExerciseLog[], title: string) => {
    setPendingCustomWorkout({ exercises, title });
    setShowBuilder(false);
    setShowQuickRecovery(true);
  }, []);

  // Show quick recovery check before starting template
  const handleStartTemplate = useCallback((template: WorkoutTemplate) => {
    updateLastUsed(template.id);
    refreshTemplates();
    const logs = templateToExerciseLogs(template);
    setPendingCustomWorkout({ exercises: logs, title: template.name });
    setShowBuilder(false);
    setShowLibrary(false);
    setShowQuickRecovery(true);
  }, [refreshTemplates]);

  // Handle quick recovery proceed for custom/template workouts
  const handleCustomRecoveryProceed = useCallback(() => {
    if (!pendingCustomWorkout) return;
    setWorkoutLog(pendingCustomWorkout.exercises);
    setWorkoutTitle(pendingCustomWorkout.title);
    setShowQuickRecovery(false);
    setPendingCustomWorkout(null);
    setWorkoutStatus('preview');
  }, [pendingCustomWorkout]);

  // Handle full check-in for custom/template workouts (generates new AI workout)
  const handleCustomRecoveryFullCheckIn = useCallback(() => {
    setShowQuickRecovery(false);
    setPendingCustomWorkout(null);
    setWorkoutStatus('recovery');
  }, []);

  // Handle cancel for custom/template workouts
  const handleCustomRecoveryCancel = useCallback(() => {
    setShowQuickRecovery(false);
    setPendingCustomWorkout(null);
  }, []);

  const handleOpenBuilder = useCallback(() => setShowBuilder(true), []);
  const handleCloseBuilder = useCallback(() => setShowBuilder(false), []);
  const handleOpenLibrary = useCallback(() => setShowLibrary(true), []);
  const handleCloseLibrary = useCallback(() => setShowLibrary(false), []);

  // ============================================================================
  // End Workout State Machine
  // ============================================================================

  // Fetch user's name for avatar
  useEffect(() => {
    const fetchName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data?.full_name) setUserName(data.full_name);
    };
    fetchName();
  }, [user]);

  const handleGoalUpdate = useCallback((goalText: string) => {
    const goalMatch = goalText.match(/RECOMMENDED GOAL: \[(.+)\]/);
    if (goalMatch && goalMatch[1]) {
      updateGoal(goalMatch[1]);
    }
  }, [updateGoal]);

  const handleOnboardingComplete = useCallback(() => {
    refetchProfile();
  }, [refetchProfile]);

  // Stable callbacks for memo'd children
  const showHistoryView = useCallback(() => setCurrentView('history'), []);
  const showDashboard = useCallback(() => {
    setCurrentView('tabs');
    setActiveTab('dashboard');
  }, []);
  const showMyTrainer = useCallback(() => setCurrentView('myTrainer'), []);
  const showSettings = useCallback(() => setCurrentView('settings'), []);
  const showTrainer = useCallback(() => setCurrentView('trainer'), []);
  const showTabs = useCallback(() => setCurrentView('tabs'), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  // Debug loading states (dev only)
  if (import.meta.env.DEV) {
    console.log('[App] loading:', loading, 'dataLoading:', dataLoading, 'user:', user?.id || 'null', 'onboardingComplete:', onboardingComplete);
  }

  if (loading || dataLoading) {
    return <LoadingScreen message="Loading your data..." subMessage="Setting up your personalized experience" />;
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <LoginScreen />
      </Suspense>
    );
  }

  // Show error state with retry option
  if (dataError && dataError.retryable) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Issue</h2>
          <p className="text-gray-400 mb-6">{dataError.message}</p>
          <button
            onClick={retryData}
            aria-label="Retry loading data"
            className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-105 transition-transform focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (onboardingComplete === false) {
    return (
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <Onboarding onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  const renderContent = () => {
    if (import.meta.env.DEV) {
      console.log('[App] renderContent called, currentView:', currentView);
    }

    if (currentView === 'settings') {
      return (
        <Suspense fallback={<LazyFallback />}>
          <Settings onBack={showTabs} />
        </Suspense>
      );
    }

    if (currentView === 'trainer') {
      return (
        <Suspense fallback={<LazyFallback />}>
          <TrainerDashboard onBack={showTabs} />
        </Suspense>
      );
    }

    if (currentView === 'myTrainer' && userProfile.trainer_id) {
      return (
        <Suspense fallback={<LazyFallback />}>
          <ClientTrainerView onBack={showTabs} trainerId={userProfile.trainer_id} />
        </Suspense>
      );
    }

    if (currentView === 'history') {
      return (
        <Suspense fallback={<LazyFallback />}>
          <WorkoutHistory
            history={workouts}
            nutritionLogs={nutritionLogs}
            nutritionTargets={nutritionTargets}
            onBack={showDashboard}
            goal={goal}
            mealEntries={mealEntries}
          />
        </Suspense>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Suspense fallback={<LazyFallback />}>
            <Dashboard
              setActiveTab={setActiveTab}
              showHistoryView={showHistoryView}
              showTrainerView={userProfile.trainer_id ? showMyTrainer : undefined}
              nutritionLog={nutritionLogs}
              nutritionTargets={nutritionTargets}
              goal={goal}
              workoutHistory={workouts}
              userProfile={userProfile}
              onStartWorkout={startNewWorkout}
              workoutStatus={workoutStatus}
              weeklyPlan={weeklyPlan}
              todaysPlan={todaysPlan}
              isWeeklyPlanLoading={isWeeklyPlanLoading}
              isGeneratingPlan={isGeneratingPlan}
              onGeneratePlan={generateNewPlan}
              onViewWeeklyPlan={handleViewWeeklyPlan}
              onStartPlanWorkout={handleStartFromPlan}
            />
          </Suspense>
        );
      case 'train':
        return (
          <Suspense fallback={<LazyFallback />}>
            <TrainTab
              workoutHistory={workouts}
              onStartWorkout={startNewWorkout}
              recoveryDraft={recoveryDraft}
              onResumeDraft={handleResumeDraft}
              onDiscardDraft={handleDiscardDraft}
              onStartBuilder={handleOpenBuilder}
              onOpenLibrary={handleOpenLibrary}
              onStartTemplate={handleStartTemplate}
              templates={templates}
              weeklyPlan={weeklyPlan}
              todaysPlan={todaysPlan}
              onViewWeeklyPlan={handleViewWeeklyPlan}
              onStartPlanWorkout={handleStartFromPlan}
            />
          </Suspense>
        );
      case 'body':
        return (
          <Suspense fallback={<LazyFallback />}>
            <BodyAnalysis onAnalysisComplete={handleGoalUpdate} />
          </Suspense>
        );
      case 'meal': {
        const now = new Date();
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayLog = nutritionLogs.find(l => l.date === todayDate);
        return (
          <Suspense fallback={<LazyFallback />}>
            <MealTracker
              userGoal={goal}
              onLogMeal={addMealToDaily}
              todayNutrition={todayLog ? { calories: todayLog.calories, protein: todayLog.protein, carbs: todayLog.carbs, fats: todayLog.fats } : undefined}
              nutritionTargets={nutritionTargets}
              mealEntries={mealEntries}
              favorites={favorites}
              onSaveMealEntry={saveMealEntry}
              onDeleteMealEntry={deleteMealEntry}
              onAddToFavorites={addToFavorites}
              nutritionLogs={nutritionLogs}
              goal={goal}
            />
          </Suspense>
        );
      }
      case 'mindset':
        return (
          <Suspense fallback={<LazyFallback />}>
            <Mindset />
          </Suspense>
        );
      default:
        return null;
    }
  }

  return (
    <div className={`flex flex-col h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden ${!isOnline ? 'pt-10' : ''}`}>
      {!isOnline && <OfflineBanner />}
      <Suspense fallback={null}>
        <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      </Suspense>
      <InstallPrompt />
      <UpdatePrompt />

      {/* Mobile Shell Layout */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="w-full max-w-lg mx-auto p-4 sm:p-6">
          <Header
            onCartClick={openCart}
            onSettingsClick={showSettings}
            onTrainerClick={showTrainer}
            onMyTrainerClick={showMyTrainer}
            isTrainer={userProfile.role === 'trainer'}
            hasTrainer={!!userProfile.trainer_id}
            userName={userName}
          />

          <main className="mt-6">
            <div className="animate-slide-up">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      {currentView === 'tabs' && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* ================================================================ */}
      {/* Workout Overlays — rendered at App level, above all tabs         */}
      {/* ================================================================ */}

      {/* Recovery Check-In Modal */}
      {workoutStatus === 'recovery' && (
        <Suspense fallback={null}>
          <RecoveryCheckIn
            onComplete={handleRecoveryComplete}
            onSkip={() => setWorkoutStatus('idle')}
            isLoading={false}
          />
        </Suspense>
      )}

      {/* Workout Preview */}
      {workoutStatus === 'preview' && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background-dark">
          <Suspense fallback={<LazyFallback />}>
            <WorkoutPreview
              title={workoutTitle}
              duration={aiWorkout?.duration_minutes || 45}
              difficulty="Intermediate"
              description={aiWorkout?.recovery_notes || "A balanced session targeting hypertrophy."}
              exercises={workoutLog.map(ex => ({
                name: ex.name,
                sets: parseInt(ex.sets),
                reps: ex.reps,
                targetMuscles: ex.targetMuscles,
                formCues: ex.formCues,
                notes: ex.notes,
              }))}
              onStart={handleStartFromPreview}
              onBack={() => setWorkoutStatus('idle')}
            />
          </Suspense>
        </div>
      )}

      {/* Active Workout Session */}
      {workoutStatus === 'active' && (
        <div className="fixed inset-0 z-[60] overflow-hidden bg-background-dark">
          <Suspense fallback={<LazyFallback />}>
            <WorkoutSession
              initialExercises={workoutLog}
              workoutTitle={workoutTitle}
              onComplete={handleWorkoutComplete}
              onCancel={handleWorkoutCancel}
              recoveryAdjusted={aiWorkout?.recovery_adjusted}
              recoveryNotes={aiWorkout?.recovery_notes}
              initialDraft={activeDraft ?? undefined}
              initialElapsedTime={activeDraft?.elapsedTime}
            />
          </Suspense>
        </div>
      )}

      {/* Workout Summary */}
      {workoutStatus === 'completed' && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background-dark">
          <Suspense fallback={<LazyFallback />}>
            <WorkoutSummary
              duration={getDurationString()}
              volume={calculateVolume(completedLog)}
              exercisesCount={completedLog.length}
              onShare={() => showToast('Shared to feed!', 'success')}
              onClose={() => handleRateWorkout(3)}
              onRate={handleRateWorkout}
              onViewHistory={async () => {
                const saved = await handleRateWorkout(3);
                if (saved) showHistoryView();
              }}
              isSaving={isSaving}
            />
          </Suspense>
        </div>
      )}

      {/* Workout Builder Overlay */}
      {showBuilder && (
        <Suspense fallback={<LazyFallback />}>
          <WorkoutBuilder
            onBack={handleCloseBuilder}
            onStartWorkout={handleStartCustomWorkout}
            onTemplateSaved={() => {
              refreshTemplates();
              showToast('Template saved!', 'success');
            }}
          />
        </Suspense>
      )}

      {/* Exercise Library Overlay */}
      {showLibrary && (
        <Suspense fallback={<LazyFallback />}>
          <ExerciseLibrary
            onBack={handleCloseLibrary}
            mode="browse"
          />
        </Suspense>
      )}

      {/* Weekly Plan View Overlay */}
      {showWeeklyPlan && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background-dark">
          <Suspense fallback={<LazyFallback />}>
            <WeeklyPlanView
              plan={weeklyPlan}
              isLoading={isWeeklyPlanLoading}
              isGenerating={isGeneratingPlan}
              onBack={handleCloseWeeklyPlan}
              onGenerate={generateNewPlan}
              onStartWorkout={handleStartFromPlan}
              completedDays={completedDays}
            />
          </Suspense>
        </div>
      )}

      {/* Quick Recovery Check (for plan workouts) */}
      {showQuickRecovery && pendingPlanWorkout && (
        <Suspense fallback={null}>
          <QuickRecoveryCheck
            workout={pendingPlanWorkout}
            onProceed={handleQuickRecoveryProceed}
            onFullCheckIn={handleQuickRecoveryFullCheckIn}
            onCancel={handleQuickRecoveryCancel}
          />
        </Suspense>
      )}

      {/* Quick Recovery Check (for custom/template workouts) */}
      {showQuickRecovery && customWorkoutForRecoveryCheck && !pendingPlanWorkout && (
        <Suspense fallback={null}>
          <QuickRecoveryCheck
            workout={customWorkoutForRecoveryCheck}
            onProceed={handleCustomRecoveryProceed}
            onFullCheckIn={handleCustomRecoveryFullCheckIn}
            onCancel={handleCustomRecoveryCancel}
          />
        </Suspense>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <ShopifyProvider>
                <AppContent />
              </ShopifyProvider>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;


import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineBanner from './components/OfflineBanner';
import { useUserData } from './hooks/useUserData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { supabase } from './supabaseClient';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const BodyAnalysis = lazy(() => import('./components/BodyAnalysis'));
const MealTracker = lazy(() => import('./components/MealTracker'));
const Mindset = lazy(() => import('./components/Mindset'));
const WorkoutHistory = lazy(() => import('./components/WorkoutHistory'));
const Settings = lazy(() => import('./components/Settings'));
const TrainerDashboard = lazy(() => import('./components/TrainerDashboard'));
const ClientTrainerView = lazy(() => import('./components/ClientTrainerView'));
const CartDrawer = lazy(() => import('./components/CartDrawer'));
const Onboarding = lazy(() => import('./components/Onboarding'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
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

type Tab = 'dashboard' | 'history' | 'body' | 'meal' | 'mindset';
type View = 'tabs' | 'settings' | 'trainer' | 'myTrainer';

export interface ExerciseLog {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

export interface CompletedWorkout {
  date: string;
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

  const handleAddWorkoutToHistory = useCallback(async (log: ExerciseLog[], title: string, rating?: number): Promise<boolean> => {
    const validLog = log.filter(ex => ex.name);
    return await addWorkout(title, validLog, rating);
  }, [addWorkout]);

  const handleSaveNutritionLog = useCallback((data: NutritionLog) => {
    saveNutrition(data);
  }, [saveNutrition]);

  const handleOnboardingComplete = useCallback(() => {
    refetchProfile();
  }, [refetchProfile]);

  // Stable callbacks for memo'd children
  const showHistoryView = useCallback(() => setActiveTab('history'), []);
  const showDashboard = useCallback(() => setActiveTab('dashboard'), []);
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
      if (import.meta.env.DEV) {
        console.log('[App] Rendering Settings component...');
      }
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

    switch (activeTab) {
      case 'dashboard':
        return (
          <Suspense fallback={<LazyFallback />}>
            <Dashboard
              setActiveTab={setActiveTab}
              addWorkoutToHistory={handleAddWorkoutToHistory}
              showHistoryView={showHistoryView}
              showTrainerView={userProfile.trainer_id ? showMyTrainer : undefined}
              nutritionLog={nutritionLogs}
              saveNutritionLog={handleSaveNutritionLog}
              nutritionTargets={nutritionTargets}
              goal={goal}
              workoutHistory={workouts}
              userProfile={userProfile}
            />
          </Suspense>
        );
      case 'history':
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
      case 'body':
        return (
          <Suspense fallback={<LazyFallback />}>
            <BodyAnalysis onAnalysisComplete={handleGoalUpdate} />
          </Suspense>
        );
      case 'meal':
        const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD to match database
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
            />
          </Suspense>
        );
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

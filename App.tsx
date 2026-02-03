
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import BodyAnalysis from './components/BodyAnalysis';
import MealTracker from './components/MealTracker';
import Mindset from './components/Mindset';
import WorkoutHistory from './components/WorkoutHistory';
import Settings from './components/Settings';
import TrainerDashboard from './components/TrainerDashboard';
import ClientTrainerView from './components/ClientTrainerView';
import CartDrawer from './components/CartDrawer';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import InstallPrompt from './components/InstallPrompt';
import { useUserData } from './hooks/useUserData';
import { supabase } from './supabaseClient';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import LoginScreen from './components/LoginScreen';

type Tab = 'dashboard' | 'body' | 'meal' | 'mindset';
type View = 'tabs' | 'history' | 'settings' | 'trainer' | 'myTrainer';

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

  // Supabase Data Hook
  const { goal, onboardingComplete, userProfile, nutritionTargets, workouts, nutritionLogs, updateGoal, addWorkout, saveNutrition, addMealToDaily, refetchProfile, loading: dataLoading, error: dataError, retry: retryData } = useUserData();
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

  const handleGoalUpdate = (goalText: string) => {
    const goalMatch = goalText.match(/RECOMMENDED GOAL: \[(.+)\]/);
    if (goalMatch && goalMatch[1]) {
      updateGoal(goalMatch[1]);
    }
  };

  const handleAddWorkoutToHistory = (log: ExerciseLog[], title: string) => {
    const validLog = log.filter(ex => ex.name);
    addWorkout(title, validLog);
  };

  const handleSaveNutritionLog = (data: NutritionLog) => {
    saveNutrition(data);
  };

  const handleOnboardingComplete = () => {
    refetchProfile();
  };

  // Debug loading states
  console.log('[App] loading:', loading, 'dataLoading:', dataLoading, 'user:', user?.id || 'null', 'onboardingComplete:', onboardingComplete);

  if (loading || dataLoading) {
    return <LoadingScreen message="Loading your data..." subMessage="Setting up your personalized experience" />;
  }

  if (!user) {
    return <LoginScreen />;
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
            className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-105 transition-transform"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (onboardingComplete === false) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderContent = () => {
    if (currentView === 'history') {
      return <WorkoutHistory
        history={workouts}
        nutritionLogs={nutritionLogs}
        nutritionTargets={nutritionTargets}
        onBack={() => setCurrentView('tabs')}
        goal={goal}
      />;
    }

    if (currentView === 'settings') {
      return <Settings onBack={() => setCurrentView('tabs')} />;
    }

    if (currentView === 'trainer') {
      return <TrainerDashboard onBack={() => setCurrentView('tabs')} />;
    }

    if (currentView === 'myTrainer' && userProfile.trainer_id) {
      return <ClientTrainerView onBack={() => setCurrentView('tabs')} trainerId={userProfile.trainer_id} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
          setActiveTab={setActiveTab}
          addWorkoutToHistory={handleAddWorkoutToHistory}
          showHistoryView={() => setCurrentView('history')}
          showTrainerView={userProfile.trainer_id ? () => setCurrentView('myTrainer') : undefined}
          nutritionLog={nutritionLogs}
          saveNutritionLog={handleSaveNutritionLog}
          nutritionTargets={nutritionTargets}
          goal={goal}
          workoutHistory={workouts}
          userProfile={userProfile}
        />;
      case 'body':
        return <BodyAnalysis onAnalysisComplete={handleGoalUpdate} />;
      case 'meal':
        const todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const todayLog = nutritionLogs.find(l => l.date === todayDate);
        return <MealTracker
          userGoal={goal}
          onLogMeal={addMealToDaily}
          todayNutrition={todayLog ? { calories: todayLog.calories, protein: todayLog.protein, carbs: todayLog.carbs, fats: todayLog.fats } : undefined}
          nutritionTargets={nutritionTargets}
        />;
      case 'mindset':
        return <Mindset />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] text-white overflow-hidden">
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <InstallPrompt />

      {/* Mobile Shell Layout */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="w-full max-w-lg mx-auto p-4 sm:p-6">
          <Header
            onCartClick={() => setIsCartOpen(true)}
            onSettingsClick={() => setCurrentView('settings')}
            onTrainerClick={() => setCurrentView('trainer')}
            onMyTrainerClick={() => setCurrentView('myTrainer')}
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
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

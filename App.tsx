
import React, { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import BodyAnalysis from './components/BodyAnalysis';
import MealTracker from './components/MealTracker';
import Mindset from './components/Mindset';
import ProgressTracker from './components/ProgressTracker';
import WorkoutHistory from './components/WorkoutHistory';
import CartDrawer from './components/CartDrawer';
import { useUserData } from './hooks/useUserData';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';

type Tab = 'dashboard' | 'body' | 'meal' | 'mindset' | 'progress';
type View = 'tabs' | 'history';

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

  // Supabase Data Hook
  const { goal, workouts, nutritionLogs, updateGoal, addWorkout, saveNutrition, loading: dataLoading } = useUserData();

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


  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen bg-black flex items-center justify-center text-[var(--color-primary)]">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderContent = () => {
    if (currentView === 'history') {
      return <WorkoutHistory history={workouts} onBack={() => setCurrentView('tabs')} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
          setActiveTab={setActiveTab}
          addWorkoutToHistory={handleAddWorkoutToHistory}
          showHistoryView={() => setCurrentView('history')}
          nutritionLog={nutritionLogs}
          saveNutritionLog={handleSaveNutritionLog}
        />;
      case 'body':
        return <BodyAnalysis onAnalysisComplete={handleGoalUpdate} />;
      case 'meal':
        return <MealTracker userGoal={goal} />;
      case 'mindset':
        return <Mindset />;
      case 'progress':
        return <ProgressTracker />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] text-white overflow-hidden">
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Mobile Shell Layout */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="w-full max-w-lg mx-auto p-4 sm:p-6">
          <Header onCartClick={() => setIsCartOpen(true)} />

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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

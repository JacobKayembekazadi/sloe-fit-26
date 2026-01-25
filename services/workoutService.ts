import type { ExerciseLog } from '../App';

interface WorkoutTemplate {
    title: string;
    exercises: Omit<ExerciseLog, 'id'>[];
}

interface WorkoutTemplates {
    [key: string]: WorkoutTemplate[];
}

// Workout templates organized by goal
const WORKOUT_TEMPLATES: WorkoutTemplates = {
    CUT: [
        {
            title: "Full Body HIIT A",
            exercises: [
                { name: "Barbell Squat", sets: "4", reps: "12-15", weight: "" },
                { name: "Push-Ups", sets: "3", reps: "15-20", weight: "" },
                { name: "Bent Over Row (Barbell)", sets: "4", reps: "12-15", weight: "" },
                { name: "Walking Lunges", sets: "3", reps: "12 each", weight: "" },
                { name: "Plank", sets: "3", reps: "45 sec", weight: "" },
            ]
        },
        {
            title: "Full Body HIIT B",
            exercises: [
                { name: "Deadlift (Conventional)", sets: "4", reps: "10-12", weight: "" },
                { name: "Dumbbell Bench Press", sets: "3", reps: "12-15", weight: "" },
                { name: "Lat Pulldown", sets: "4", reps: "12-15", weight: "" },
                { name: "Goblet Squat", sets: "3", reps: "15", weight: "" },
                { name: "Mountain Climbers", sets: "3", reps: "30 sec", weight: "" },
            ]
        },
        {
            title: "Full Body HIIT C",
            exercises: [
                { name: "Front Squat", sets: "4", reps: "12-15", weight: "" },
                { name: "Incline Dumbbell Bench Press", sets: "3", reps: "12-15", weight: "" },
                { name: "Cable Row", sets: "4", reps: "12-15", weight: "" },
                { name: "Step-Ups", sets: "3", reps: "10 each", weight: "" },
                { name: "Bicycle Crunches", sets: "3", reps: "20 each", weight: "" },
            ]
        },
        {
            title: "Full Body HIIT D",
            exercises: [
                { name: "Romanian Deadlift", sets: "4", reps: "12-15", weight: "" },
                { name: "Overhead Press (Dumbbell)", sets: "3", reps: "12-15", weight: "" },
                { name: "Pull-Ups", sets: "3", reps: "8-12", weight: "" },
                { name: "Bulgarian Split Squat", sets: "3", reps: "10 each", weight: "" },
                { name: "Russian Twists", sets: "3", reps: "20 each", weight: "" },
            ]
        },
    ],
    BULK: [
        {
            title: "Push Day",
            exercises: [
                { name: "Barbell Bench Press", sets: "4", reps: "6-8", weight: "" },
                { name: "Overhead Press (Barbell)", sets: "4", reps: "6-8", weight: "" },
                { name: "Incline Dumbbell Bench Press", sets: "3", reps: "8-10", weight: "" },
                { name: "Cable Crossover", sets: "3", reps: "10-12", weight: "" },
                { name: "Tricep Pushdown", sets: "3", reps: "10-12", weight: "" },
                { name: "Lateral Raises (Dumbbell)", sets: "3", reps: "12-15", weight: "" },
            ]
        },
        {
            title: "Pull Day",
            exercises: [
                { name: "Deadlift (Conventional)", sets: "4", reps: "5-6", weight: "" },
                { name: "Bent Over Row (Barbell)", sets: "4", reps: "6-8", weight: "" },
                { name: "Pull-Ups", sets: "3", reps: "8-10", weight: "" },
                { name: "Face Pulls", sets: "3", reps: "12-15", weight: "" },
                { name: "Barbell Curl", sets: "3", reps: "10-12", weight: "" },
                { name: "Hammer Curl", sets: "3", reps: "10-12", weight: "" },
            ]
        },
        {
            title: "Legs Day",
            exercises: [
                { name: "Barbell Squat", sets: "4", reps: "6-8", weight: "" },
                { name: "Romanian Deadlift", sets: "4", reps: "8-10", weight: "" },
                { name: "Leg Press", sets: "3", reps: "10-12", weight: "" },
                { name: "Leg Curl", sets: "3", reps: "10-12", weight: "" },
                { name: "Leg Extension", sets: "3", reps: "12-15", weight: "" },
                { name: "Calf Raise (Standing)", sets: "4", reps: "15-20", weight: "" },
            ]
        },
    ],
    RECOMP: [
        {
            title: "Upper Power",
            exercises: [
                { name: "Barbell Bench Press", sets: "4", reps: "4-6", weight: "" },
                { name: "Bent Over Row (Barbell)", sets: "4", reps: "4-6", weight: "" },
                { name: "Overhead Press (Barbell)", sets: "3", reps: "5-6", weight: "" },
                { name: "Weighted Pull-Ups", sets: "3", reps: "5-6", weight: "" },
                { name: "Barbell Curl", sets: "2", reps: "6-8", weight: "" },
                { name: "Skull Crushers", sets: "2", reps: "6-8", weight: "" },
            ]
        },
        {
            title: "Lower Power",
            exercises: [
                { name: "Barbell Squat", sets: "4", reps: "4-6", weight: "" },
                { name: "Deadlift (Conventional)", sets: "4", reps: "4-6", weight: "" },
                { name: "Leg Press", sets: "3", reps: "6-8", weight: "" },
                { name: "Leg Curl", sets: "3", reps: "6-8", weight: "" },
                { name: "Calf Raise (Standing)", sets: "4", reps: "8-10", weight: "" },
            ]
        },
        {
            title: "Upper Hypertrophy",
            exercises: [
                { name: "Incline Dumbbell Bench Press", sets: "4", reps: "10-12", weight: "" },
                { name: "Cable Row", sets: "4", reps: "10-12", weight: "" },
                { name: "Dumbbell Shoulder Press", sets: "3", reps: "10-12", weight: "" },
                { name: "Lat Pulldown", sets: "3", reps: "10-12", weight: "" },
                { name: "Lateral Raises (Dumbbell)", sets: "3", reps: "15-20", weight: "" },
                { name: "Face Pulls", sets: "3", reps: "15-20", weight: "" },
                { name: "Incline Dumbbell Curl", sets: "3", reps: "12-15", weight: "" },
                { name: "Tricep Pushdown", sets: "3", reps: "12-15", weight: "" },
            ]
        },
        {
            title: "Lower Hypertrophy",
            exercises: [
                { name: "Front Squat", sets: "4", reps: "10-12", weight: "" },
                { name: "Romanian Deadlift", sets: "4", reps: "10-12", weight: "" },
                { name: "Walking Lunges", sets: "3", reps: "12 each", weight: "" },
                { name: "Leg Extension", sets: "3", reps: "12-15", weight: "" },
                { name: "Leg Curl", sets: "3", reps: "12-15", weight: "" },
                { name: "Calf Raise (Seated)", sets: "4", reps: "15-20", weight: "" },
            ]
        },
    ],
};

// Get workout templates for a specific goal
export const getWorkoutTemplates = (goal: string | null): WorkoutTemplate[] => {
    if (!goal || !WORKOUT_TEMPLATES[goal]) {
        return WORKOUT_TEMPLATES.RECOMP; // Default to RECOMP
    }
    return WORKOUT_TEMPLATES[goal];
};

// Get today's workout based on goal and completed workout count
export const getTodaysWorkout = (goal: string | null, completedWorkoutsThisWeek: number): { title: string; exercises: ExerciseLog[] } => {
    const templates = getWorkoutTemplates(goal);
    const workoutIndex = completedWorkoutsThisWeek % templates.length;
    const template = templates[workoutIndex];

    // Add IDs to exercises
    const exercises: ExerciseLog[] = template.exercises.map((ex, index) => ({
        id: index + 1,
        ...ex
    }));

    return {
        title: template.title,
        exercises
    };
};

// Get workout schedule description for a goal
export const getWorkoutScheduleDescription = (goal: string | null): string => {
    switch (goal) {
        case 'CUT':
            return '4-day Full Body HIIT rotation - High frequency, moderate volume for maximum fat burn';
        case 'BULK':
            return '3-day Push/Pull/Legs split - Higher volume for muscle growth';
        case 'RECOMP':
        default:
            return '4-day PHUL split - Power + Hypertrophy for simultaneous fat loss and muscle gain';
    }
};

import type { ExerciseLog } from '../App';
import { getExerciseById } from '../data/exercises';

const TEMPLATES_KEY = 'sloefit_workout_templates';

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: {
    exerciseId: string;
    name: string;
    sets: number;
    reps: string;
    restSeconds: number;
  }[];
  createdAt: string;
  lastUsedAt?: string;
}

function readTemplates(): WorkoutTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: WorkoutTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // QuotaExceededError or SecurityError — silently fail
  }
}

export function getTemplates(): WorkoutTemplate[] {
  return readTemplates().sort((a, b) => {
    const aTime = a.lastUsedAt || a.createdAt;
    const bTime = b.lastUsedAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export function saveTemplate(template: Omit<WorkoutTemplate, 'id' | 'createdAt'>): WorkoutTemplate {
  const templates = readTemplates();
  const newTemplate: WorkoutTemplate = {
    ...template,
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  templates.push(newTemplate);
  writeTemplates(templates);
  return newTemplate;
}

export function deleteTemplate(id: string): void {
  const templates = readTemplates().filter(t => t.id !== id);
  writeTemplates(templates);
}

export function updateLastUsed(id: string): void {
  const templates = readTemplates();
  const tpl = templates.find(t => t.id === id);
  if (tpl) {
    tpl.lastUsedAt = new Date().toISOString();
    writeTemplates(templates);
  }
}

export function templateToExerciseLogs(template: WorkoutTemplate): ExerciseLog[] {
  return template.exercises.map((ex, idx) => {
    const libEntry = getExerciseById(ex.exerciseId);
    return {
      id: idx + 1,
      name: ex.name,
      sets: String(ex.sets),
      reps: ex.reps,
      weight: '',
      restSeconds: ex.restSeconds,
      formCues: libEntry?.formCues,
      targetMuscles: libEntry ? [...libEntry.primaryMuscles, ...libEntry.secondaryMuscles] : undefined,
      exerciseId: ex.exerciseId,
    };
  });
}

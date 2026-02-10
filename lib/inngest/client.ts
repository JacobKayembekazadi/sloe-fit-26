/**
 * Inngest Client
 *
 * Central client instance for all Inngest functions.
 * Used for sending events and defining functions.
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'sloe-fit',
  // Event key is automatically picked up from INNGEST_EVENT_KEY env var
});

// Event types for type-safe event sending
export interface AIPhotoAnalyzeEvent {
  name: 'ai/photo.analyze';
  data: {
    imageBase64: string;
    userGoal: string | null;
    userId: string;
  };
}

export interface AIWeeklyPlanEvent {
  name: 'ai/weekly-plan.generate';
  data: {
    profile: Record<string, unknown>;
    recentWorkouts: Record<string, unknown>[];
    recoveryPatterns: Record<string, unknown>[];
    preferredSchedule?: number[];
    userId: string;
  };
}

export interface AIBodyAnalyzeEvent {
  name: 'ai/body.analyze';
  data: {
    imageBase64: string;
    userId: string;
  };
}

export type AIEvents = AIPhotoAnalyzeEvent | AIWeeklyPlanEvent | AIBodyAnalyzeEvent;

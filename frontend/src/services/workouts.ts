/**
 * Service do domínio Workouts (treinos estruturados). Inclui a sub-família de
 * endpoints do ATLETA (`/athlete/students/:sid/workouts/*`) e os de feedback
 * diário.
 */
import { apiFetch } from '../lib/api';
import type {
  AthleteWorkoutAssignment,
  WorkoutTodayFeedback,
} from './types';

export type SubmitWorkoutFeedbackPayload = {
  scores: Record<string, number>;
  notes?: string;
};

export const athleteWorkoutsApi = {
  list(studentId: string): Promise<AthleteWorkoutAssignment[]> {
    return apiFetch<AthleteWorkoutAssignment[]>(
      `/athlete/students/${studentId}/workouts`,
    );
  },

  getTodayFeedback(
    studentId: string,
    workoutId: string,
  ): Promise<WorkoutTodayFeedback> {
    return apiFetch<WorkoutTodayFeedback>(
      `/athlete/students/${studentId}/workouts/${workoutId}/feedback/today`,
    );
  },

  submitFeedback(
    studentId: string,
    workoutId: string,
    payload: SubmitWorkoutFeedbackPayload,
  ): Promise<WorkoutTodayFeedback> {
    return apiFetch<WorkoutTodayFeedback>(
      `/athlete/students/${studentId}/workouts/${workoutId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify({
          scores: payload.scores,
          notes: payload.notes?.trim() || undefined,
        }),
      },
    );
  },
};

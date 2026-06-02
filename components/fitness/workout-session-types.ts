export type SessionSet = {
  id: string;
  prevWeightKg: number | null;
  prevReps: number | null;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
};

export type SessionExercise = {
  id: string;
  name: string;
  plannedSets: number;
  repsRange: string | null;
  restSeconds: number;
  sets: SessionSet[];
  bests?: {
    maxWeightKg: number | null;
    maxSessionVolume: number | null;
    repsAtWeight: Record<string, number>;
  };
};

export type ActiveSession = {
  routineId: string | null;
  routineName: string | null;
  startedAtMs: number;
  exercises: SessionExercise[];
};

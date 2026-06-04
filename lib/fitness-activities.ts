// lib/fitness-activities.ts
// Mapa slug ↔ WorkoutType + metadata visual de cada actividad del menú.

export type ActivitySlug = "caminar" | "correr" | "nadar" | "bici" | "gym";
export type ActivityWorkoutType = "WALKING" | "RUNNING" | "SWIMMING" | "CYCLING" | "GYM";

export type ActivityMeta = {
  slug: ActivitySlug;
  type: ActivityWorkoutType;
  label: string;
  icon: string;   // material-symbols
  color: string;  // hex
  isCardio: boolean;
};

export const ACTIVITIES: Record<ActivitySlug, ActivityMeta> = {
  gym:     { slug: "gym",     type: "GYM",      label: "Gym",     icon: "fitness_center",  color: "#06B6D4", isCardio: false },
  correr:  { slug: "correr",  type: "RUNNING",  label: "Correr",  icon: "directions_run",  color: "#FB923C", isCardio: true },
  nadar:   { slug: "nadar",   type: "SWIMMING", label: "Nadar",   icon: "pool",            color: "#60A5FA", isCardio: true },
  caminar: { slug: "caminar", type: "WALKING",  label: "Caminar", icon: "directions_walk", color: "#34D399", isCardio: true },
  bici:    { slug: "bici",    type: "CYCLING",  label: "Bici",    icon: "pedal_bike",      color: "#A78BFA", isCardio: true },
};

export const ACTIVITY_ORDER: ActivitySlug[] = ["gym", "correr", "nadar", "caminar", "bici"];

export function getActivityBySlug(slug: string): ActivityMeta | null {
  return (ACTIVITIES as Record<string, ActivityMeta>)[slug] ?? null;
}

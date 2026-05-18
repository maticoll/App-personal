// ============================================================
// Tipos compartidos entre módulos y agentes
// Todos los agentes reciben y devuelven objetos tipados
// ============================================================

// --- Auth ---

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

// --- Scoring ---

export type ModuleScores = {
  sleep?: number | null;
  fitness?: number | null;
  nutrition?: number | null;
  projects?: number | null;
  finances?: number | null;
};

export type DailyScoreData = ModuleScores & {
  global: number;
  date: Date;
  details?: ScoreDetails;
};

// Turno de conversación para memoria de WhatsApp
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string
};

export type ScoreDetails = {
  sleep?: { met: string[]; missed: string[] };
  fitness?: { met: string[]; missed: string[] };
  nutrition?: { met: string[]; missed: string[] };
  projects?: { met: string[]; missed: string[] };
  finances?: { met: string[]; missed: string[] };
};

// --- Módulos ---

export type SleepSummary = {
  date: Date;
  durationMinutes: number | null;
  quality: number | null;
  bedTime: Date;
  wakeTime: Date | null;
};

export type FitnessSummary = {
  date: Date;
  workouts: WorkoutSummary[];
  didGym: boolean;
  totalActivityMinutes: number;
};

export type WorkoutSummary = {
  id: string;
  type: string;
  durationMinutes: number | null;
  notes: string | null;
};

export type NutritionSummary = {
  date: Date;
  meals: MealSummary[];
  waterThermos: number;
  waterGoalThermos: number;
  totalCalories: number | null;
};

export type MealSummary = {
  id: string;
  mealType: string;
  description: string;
  calories: number | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  deadline: Date | null;
  taskCount: number;
  doneTaskCount: number;
};

export type IdeaSummary = {
  id: string;
  rawText: string;
  cleanedText: string | null;
  title: string | null;
  createdAt: Date;
};

// --- Agentes (WhatsApp) ---

export type AgentInput = {
  userId: string;
  message: string;
  timestamp: Date;
  whatsappMessageId?: string;
};

export type AgentOutput = {
  success: boolean;
  message: string; // Respuesta para enviar al usuario
  data?: unknown;  // Datos adicionales para el orquestrador
  error?: string;
};

export type OrchestratorInput = AgentInput & {
  isAudio?: boolean;
  audioUrl?: string;
};

export type IntentClassification = {
  module: "sleep" | "fitness" | "nutrition" | "projects" | "ideas" | "finances" | "calendar" | "scoring" | "sync" | "unknown";
  confidence: number;
  extractedData?: Record<string, unknown>;
};

// --- Notificaciones ---

export type Notification = {
  id: string;
  userId: string;
  type: "reminder" | "alert" | "suggestion" | "summary";
  module: string;
  message: string;
  scheduledFor?: Date;
  sentAt?: Date;
};

// --- Dashboard ---

export type DashboardData = {
  user: AuthUser;
  todayScore: DailyScoreData | null;
  sleep: SleepSummary | null;
  fitness: FitnessSummary | null;
  nutrition: NutritionSummary | null;
  projects: ProjectSummary[];
  recentIdeas: IdeaSummary[];
};

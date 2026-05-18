-- ============================================================
-- Migración: UserGoals + ConversationMemory + financesScore
-- Aplicar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de objetivos del usuario
CREATE TABLE IF NOT EXISTS user_goals (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"                    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Sueño
  "sleepTargetHours"          FLOAT   NOT NULL DEFAULT 8.0,
  "sleepTargetBedTime"        TEXT    NOT NULL DEFAULT '23:00',
  "sleepTargetWakeTime"       TEXT    NOT NULL DEFAULT '07:00',

  -- Fitness
  "fitnessCurrentWeight"      FLOAT,
  "fitnessTargetWeight"       FLOAT,
  "fitnessTargetBodyFat"      FLOAT,
  "fitnessTargetGymDuration"  INT     NOT NULL DEFAULT 60,
  "fitnessTargetCardioWeekly" INT     NOT NULL DEFAULT 120,

  -- Nutrición
  "nutritionTargetCalories"   INT     NOT NULL DEFAULT 2200,
  "nutritionTargetProtein"    INT     NOT NULL DEFAULT 160,
  "nutritionTargetCarbs"      INT     NOT NULL DEFAULT 220,
  "nutritionTargetFat"        INT     NOT NULL DEFAULT 70,

  -- Finanzas
  "financesMonthlyIncome"     FLOAT   NOT NULL DEFAULT 3000,
  "financesMonthlyTarget"     FLOAT   NOT NULL DEFAULT 600,
  "financesMonthlyBudget"     FLOAT   NOT NULL DEFAULT 2400,

  -- Proyectos
  "projectsTargetTasksPerWeek" INT    NOT NULL DEFAULT 10,

  -- Pesos del score global (1–5)
  "weightSleep"               INT     NOT NULL DEFAULT 5,
  "weightFitness"             INT     NOT NULL DEFAULT 5,
  "weightNutrition"           INT     NOT NULL DEFAULT 3,
  "weightFinances"            INT     NOT NULL DEFAULT 2,
  "weightProjects"            INT     NOT NULL DEFAULT 2,

  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de memoria de conversación
CREATE TABLE IF NOT EXISTS conversation_memory (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"          TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "recentMessages"  JSONB NOT NULL DEFAULT '[]',
  summary           TEXT,
  "turnCount"       INT NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Agregar financesScore a daily_scores
ALTER TABLE daily_scores
  ADD COLUMN IF NOT EXISTS "financesScore" INT;

-- 4. Comentario en globalScore para documentar que es ponderado
COMMENT ON COLUMN daily_scores."globalScore"
  IS 'Promedio ponderado según user_goals.weight* — no promedio simple';

// ============================================================
// POST /api/nutrition/meal
// Registrar comida con NLP (Claude calcula macros)
// Body: { description: string, mealType: MealType, date?: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { logMealNLP, deleteMeal } from "@/lib/nutrition";
import type { MealType } from "@prisma/client";

const VALID_MEAL_TYPES: MealType[] = [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
  "OTHER",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { description, mealType, date } = body;

  if (!description || typeof description !== "string") {
    return NextResponse.json(
      { error: "description es requerido" },
      { status: 400 }
    );
  }

  if (!mealType || !VALID_MEAL_TYPES.includes(mealType)) {
    return NextResponse.json(
      { error: `mealType inválido. Valores: ${VALID_MEAL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const mealDate = date ? new Date(date) : new Date();

  const meal = await logMealNLP(
    session.user.id,
    description.trim(),
    mealType as MealType,
    mealDate
  );

  return NextResponse.json(meal, { status: 201 });
}

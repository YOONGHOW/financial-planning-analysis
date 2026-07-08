import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/goals
export async function GET() {
  try {
    const result = await query("SELECT * FROM goals ORDER BY target_date ASC, created_at DESC");
    const formatted = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount),
      completed: !!row.completed
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET goals error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/goals
export async function POST(req) {
  try {
    const body = await req.json();
    const { id, title, amount, target_date, category, completed } = body;

    if (!title || amount === undefined || !target_date || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validCategories = ["house", "car", "travel", "product"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const isCompleted = completed === undefined ? false : !!completed;

    if (id) {
      // Update existing
      await query(
        `UPDATE goals 
         SET title = $1, amount = $2, target_date = $3, category = $4, completed = $5 
         WHERE id = $6`,
        [title, parseFloat(amount), target_date, category, isCompleted, id]
      );
      return NextResponse.json({ success: true, id });
    } else {
      // Create new
      const newId = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await query(
        `INSERT INTO goals (id, title, amount, target_date, category, completed) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId, title, parseFloat(amount), target_date, category, isCompleted]
      );
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error) {
    console.error("POST goals error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/goals
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing goal ID" }, { status: 400 });
    }

    await query("DELETE FROM goals WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE goal error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/transactions
export async function GET() {
  try {
    const result = await query("SELECT id, title, amount, type, category, date::TEXT, description, created_at FROM transactions ORDER BY date DESC, created_at DESC");
    const formatted = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET transactions error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/transactions
export async function POST(req) {
  try {
    const body = await req.json();
    const { id, title, amount, type, category, date, description } = body;

    if (!title || !amount || !type || !category || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (id) {
      // Edit existing
      await query(
        `UPDATE transactions 
         SET title = $1, amount = $2, type = $3, category = $4, date = $5, description = $6 
         WHERE id = $7`,
        [title, parseFloat(amount), type, category, date, description || "", id]
      );
      return NextResponse.json({ success: true, id });
    } else {
      // Create new
      const newId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await query(
        `INSERT INTO transactions (id, title, amount, type, category, date, description) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newId, title, parseFloat(amount), type, category, date, description || ""]
      );
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error) {
    console.error("POST transactions error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/transactions
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 });
    }

    await query("DELETE FROM transactions WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE transaction error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

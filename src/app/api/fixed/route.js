import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/fixed
export async function GET() {
  try {
    const result = await query("SELECT * FROM fixed_spends ORDER BY created_at ASC");
    const formatted = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET fixed spends error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fixed
export async function POST(req) {
  try {
    const body = await req.json();
    const { id, title, amount } = body;

    if (!title || amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (id) {
      // Update existing
      await query(
        `UPDATE fixed_spends 
         SET title = $1, amount = $2 
         WHERE id = $3`,
        [title, parseFloat(amount), id]
      );
      return NextResponse.json({ success: true, id });
    } else {
      // Create new
      const newId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await query(
        `INSERT INTO fixed_spends (id, title, amount) 
         VALUES ($1, $2, $3)`,
        [newId, title, parseFloat(amount)]
      );
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error) {
    console.error("POST fixed spends error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/fixed
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing fixed spend ID" }, { status: 400 });
    }

    await query("DELETE FROM fixed_spends WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE fixed spend error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

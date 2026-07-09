import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/couple-notes — fetch all notes ordered newest first
export async function GET() {
  try {
    const result = await query(
      "SELECT id, category, title, detail, created_at FROM couple_notes ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET couple-notes error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/couple-notes — create or update a note
export async function POST(req) {
  try {
    const body = await req.json();
    const { id, category, title, detail } = body;

    if (!category || !title) {
      return NextResponse.json({ error: "Missing required fields: category, title" }, { status: 400 });
    }

    if (id) {
      // Update existing note
      await query(
        `UPDATE couple_notes SET category = $1, title = $2, detail = $3 WHERE id = $4`,
        [category, title, detail || "", id]
      );
      return NextResponse.json({ success: true, id });
    } else {
      // Insert new note
      const newId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await query(
        `INSERT INTO couple_notes (id, category, title, detail) VALUES ($1, $2, $3, $4)`,
        [newId, category, title, detail || ""]
      );
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (error) {
    console.error("POST couple-notes error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/couple-notes?id=xxx — delete a note by id
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id query parameter" }, { status: 400 });
    }

    await query("DELETE FROM couple_notes WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE couple-notes error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

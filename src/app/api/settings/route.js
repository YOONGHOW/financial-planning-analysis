import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/settings
export async function GET() {
  try {
    const result = await query("SELECT * FROM settings");
    const settingsObj = {};
    
    result.rows.forEach(row => {
      // Try to parse values (e.g. JSON allocations or numbers)
      try {
        settingsObj[row.key] = JSON.parse(row.value);
      } catch (e) {
        // Fallback to raw string value
        const num = parseFloat(row.value);
        settingsObj[row.key] = isNaN(num) ? row.value : num;
      }
    });

    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("GET settings error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/settings
export async function POST(req) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Convert value to string for storage in TEXT column
    const stringValue = typeof value === "object" ? JSON.stringify(value) : value.toString();

    await query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (key) 
       DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, stringValue]
    );

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("POST settings error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

export async function POST(request, { params }) {
  try {
    const year = parseInt(params.year);
    const id = params.id;
    
    // Parse unlock code from request body
    const body = await request.json();
    const { unlock_code } = body;

    // Validate parameters
    if (isNaN(year) || !id || !unlock_code) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    // Fetch wrapped data including unlock code and hydrated data
    const sql = `
      SELECT id, year, unlock_code, hydrated_data
      FROM wrapped_stats
      WHERE id = $1 AND year = $2
    `;

    const result = await pool.query(sql, [id, year]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Wrapped not found" },
        { status: 404 }
      );
    }

    const wrapped = result.rows[0];

    // Check if unlock code is set for this wrapped
    if (!wrapped.unlock_code) {
      return NextResponse.json(
        { error: "This wrapped does not have contact hydration available" },
        { status: 404 }
      );
    }

    // Verify unlock code (case-insensitive comparison)
    if (wrapped.unlock_code.toUpperCase() !== unlock_code.toUpperCase()) {
      return NextResponse.json(
        { error: "Invalid unlock code" },
        { status: 403 }
      );
    }

    // Return hydrated data if unlock code is correct
    return NextResponse.json({
      success: true,
      hydrated_data: wrapped.hydrated_data || {},
    });
  } catch (error) {
    console.error("Unlock error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


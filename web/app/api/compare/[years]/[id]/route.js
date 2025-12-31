import { NextResponse } from "next/server";
import { getComparison } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { years, id } = params;

    // Parse years from format "2024-2025"
    const yearMatch = years.match(/^(\d{4})-(\d{4})$/);
    if (!yearMatch) {
      return NextResponse.json(
        { error: "Invalid year format. Expected format: YYYY-YYYY" },
        { status: 400 },
      );
    }

    const year1 = parseInt(yearMatch[1]);
    const year2 = parseInt(yearMatch[2]);

    // Validate
    if (isNaN(year1) || isNaN(year2) || !id) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    if (year1 === year2) {
      return NextResponse.json(
        { error: "Cannot compare the same year" },
        { status: 400 },
      );
    }

    // Ensure we query with the correct order (earlier year first)
    const [earlierYear, laterYear] = year1 < year2 ? [year1, year2] : [year2, year1];

    // Fetch from database
    const comparison = await getComparison(earlierYear, laterYear, id);

    if (!comparison) {
      return NextResponse.json(
        { error: "Comparison not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(comparison);
  } catch (error) {
    console.error("Fetch comparison error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}


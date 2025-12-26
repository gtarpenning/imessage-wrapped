import { NextResponse } from "next/server";
import { getWrapped } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const year = parseInt(params.year);
    const id = params.id;

    // Validate
    if (isNaN(year) || !id) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    // Fetch from database
    const wrapped = await getWrapped(year, id);

    if (!wrapped) {
      return NextResponse.json({ error: "Wrapped not found" }, { status: 404 });
    }

    return NextResponse.json(wrapped);
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

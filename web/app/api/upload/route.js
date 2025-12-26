import { NextResponse } from "next/server";
import { createWrapped } from "@/lib/db";
import { sanitizeStatistics } from "@/lib/privacy";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("fly-client-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in an hour." },
        { status: 429 },
      );
    }

    // Parse request
    const body = await request.json();
    const { year, statistics } = body;

    // Validate input
    if (!year || !statistics) {
      return NextResponse.json(
        { error: "Missing year or statistics" },
        { status: 400 },
      );
    }

    if (year < 2020 || year > 2030) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    // Sanitize data - REMOVE ALL PII
    const cleanData = sanitizeStatistics(statistics);

    // Save to database
    const wrapped = await createWrapped(year, cleanData);

    // Generate shareable URL
    const baseUrl =
      process.env.BASE_URL ||
      request.headers.get("host") ||
      "http://localhost:3000";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${baseUrl.replace(/^https?:\/\//, "")}/${year}/${wrapped.id}`;

    return NextResponse.json({
      id: wrapped.id,
      url,
      year: wrapped.year,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

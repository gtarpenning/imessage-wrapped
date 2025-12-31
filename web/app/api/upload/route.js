import { NextResponse } from "next/server";
import { createWrapped, createComparison } from "@/lib/db";
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
    const { type = "single", year, statistics, user_name, metadata, hydrated_data, year1, year2, statistics1, statistics2 } = body;

    // Handle comparison upload
    if (type === "comparison") {
      return handleComparisonUpload(request, body);
    }

    // Handle single year upload (existing logic)
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

    // Save to database (user_name is not PII in this context - it's chosen by the user)
    // Pass hydrated_data and unlock_code from metadata for secure storage
    const unlock_code = metadata?.unlock_code || null;
    const wrapped = await createWrapped(year, cleanData, user_name, metadata, hydrated_data, unlock_code);

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

async function handleComparisonUpload(request, body) {
  const { year1, year2, statistics1, statistics2, user_name, metadata, hydrated_data1, hydrated_data2 } = body;

  // Validate input
  if (!year1 || !year2 || !statistics1 || !statistics2) {
    return NextResponse.json(
      { error: "Missing required comparison data" },
      { status: 400 },
    );
  }

  if (year1 < 2020 || year1 > 2030 || year2 < 2020 || year2 > 2030) {
    return NextResponse.json({ error: "Invalid years" }, { status: 400 });
  }

  if (year1 === year2) {
    return NextResponse.json(
      { error: "Cannot compare the same year" },
      { status: 400 },
    );
  }

  // Ensure year1 < year2 for consistency
  const [earlierYear, laterYear] = year1 < year2 ? [year1, year2] : [year2, year1];
  const [earlierStats, laterStats] = year1 < year2 ? [statistics1, statistics2] : [statistics2, statistics1];
  const [earlierHydrated, laterHydrated] = year1 < year2 ? [hydrated_data1, hydrated_data2] : [hydrated_data2, hydrated_data1];

  // Sanitize both datasets
  const cleanData1 = sanitizeStatistics(earlierStats);
  const cleanData2 = sanitizeStatistics(laterStats);

  // Get unlock code from metadata
  const unlock_code = metadata?.unlock_code || null;

  // Create both wrapped entries
  const wrapped1 = await createWrapped(earlierYear, cleanData1, user_name, metadata, earlierHydrated, unlock_code);
  const wrapped2 = await createWrapped(laterYear, cleanData2, user_name, metadata, laterHydrated, unlock_code);

  // Create comparison entry
  const comparison = await createComparison(
    wrapped1.id,
    wrapped2.id,
    earlierYear,
    laterYear
  );

  // Generate shareable URL
  const baseUrl =
    process.env.BASE_URL ||
    request.headers.get("host") ||
    "http://localhost:3000";
  const protocol = baseUrl.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${baseUrl.replace(/^https?:\/\//, "")}/compare/${earlierYear}-${laterYear}/${comparison.id}`;

  return NextResponse.json({
    id: comparison.id,
    url,
    year1: earlierYear,
    year2: laterYear,
    year1_id: wrapped1.id,
    year2_id: wrapped2.id,
  });
}

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

// Helper function to calculate percentile
function calculatePercentile(value, allValues, lowerIsBetter = false) {
  if (!value || allValues.length === 0) return null;
  
  // For "lower is better" stats (like response time), count values GREATER than current
  // For "higher is better" stats (like message count), count values LESS than current
  const count = lowerIsBetter
    ? allValues.filter((v) => v > value).length
    : allValues.filter((v) => v < value).length;
  
  return Math.round((count / allValues.length) * 100);
}

// Helper to extract stat from data JSON
function extractStat(data, path) {
  // Handle both data.raw.X and data.X structures
  let value = data?.raw || data;
  
  const keys = path.split(".");
  for (const key of keys) {
    if (value === null || value === undefined) return null;
    value = value[key];
  }
  return typeof value === "number" ? value : null;
}

export async function GET(request, { params }) {
  try {
    const year = parseInt(params.year);
    const id = params.id;

    if (isNaN(year) || !id) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    // Fetch all wraps for the year to calculate percentiles
    const result = await pool.query(
      "SELECT id, data FROM wrapped_stats WHERE year = $1",
      [year]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ percentiles: {} });
    }

    // Find current user's data
    const currentWrap = result.rows.find((row) => row.id === id);
    if (!currentWrap) {
      return NextResponse.json(
        { error: "Wrapped not found" },
        { status: 404 }
      );
    }

    // Define stats to track percentiles for
    const statsToTrack = [
      "volume.total_sent",
      "volume.total_received",
      "content.avg_message_length_sent",
      "content.avg_message_length_received",
      "content.avg_word_count_sent",
      "content.questions_percentage",
      "content.enthusiasm_percentage",
      "content.attachments_sent",
      "content.attachments_received",
      "conversations.total_conversations",
      "conversations.group_chats",
      "conversations.one_on_one_chats",
      "content.double_text_count",
      "content.quadruple_text_count",
      "response_times.avg_response_time_minutes",
      "response_times.median_response_time_you_seconds",
      "response_times.median_response_time_them_seconds",
      "tapbacks.total_tapbacks_given",
      "tapbacks.total_tapbacks_received",
      "streaks.longest_streak_days",
      "contacts.unique_contacts_messaged",
      "contacts.unique_contacts_received_from",
      "ghosts.people_you_left_hanging",
      "ghosts.people_who_left_you_hanging",
      "ghosts.ghost_ratio",
    ];
    
    // Stats where lower values are better (e.g., faster response time)
    const lowerIsBetterStats = new Set([
      "response_times.avg_response_time_minutes",
      "response_times.median_response_time_you_seconds",
      "response_times.median_response_time_them_seconds",
    ]);

    // Extract all values for each stat
    const statValues = {};
    statsToTrack.forEach((stat) => {
      statValues[stat] = [];
    });

    result.rows.forEach((row) => {
      statsToTrack.forEach((stat) => {
        const value = extractStat(row.data, stat);
        if (value !== null) {
          statValues[stat].push(value);
        }
      });
    });

    // Calculate percentiles for current user
    const percentiles = {};
    statsToTrack.forEach((stat) => {
      const currentValue = extractStat(currentWrap.data, stat);
      if (currentValue !== null && statValues[stat].length > 1) {
        percentiles[stat] = calculatePercentile(
          currentValue,
          statValues[stat],
          lowerIsBetterStats.has(stat)
        );
      }
    });

    return NextResponse.json({ 
      percentiles,
      total: result.rows.length 
    });
  } catch (error) {
    console.error("Percentile calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


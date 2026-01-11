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
  // Allow 0 as a valid value - only reject null/undefined
  if (value == null || allValues.length === 0) return null;
  
  // For "lower is better" stats (like response time), count values GREATER than current
  // For "higher is better" stats (like message count), count values LESS than current
  const count = lowerIsBetter
    ? allValues.filter((v) => v > value).length
    : allValues.filter((v) => v < value).length;
  
  return Math.round((count / allValues.length) * 100);
}

// Helper to extract stat from data JSON
function extractStat(data, path) {
  // Handle special computed metrics
  if (path === "tapbacks.like_to_dislike_ratio") {
    const tapbacks = data?.raw?.tapbacks || data?.tapbacks;
    if (!tapbacks?.tapback_distribution_given) return null;
    
    const likes = tapbacks.tapback_distribution_given.like || 0;
    const dislikes = tapbacks.tapback_distribution_given.dislike || 0;
    
    // Need both likes and dislikes to calculate ratio
    if (likes === 0 && dislikes === 0) return null;
    
    // Calculate normalized score: (likes - dislikes) / (likes + dislikes)
    // Range: -1 (all dislikes) to 1 (all likes)
    // This handles negative cases and works well for percentile comparisons
    const total = likes + dislikes;
    return (likes - dislikes) / total;
  }
  
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
      "tapbacks.like_to_dislike_ratio",
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

    // Calculate percentiles and ranks for current user
    const percentiles = {};
    const ranks = {};
    const metricCounts = {};
    
    statsToTrack.forEach((stat) => {
      const currentValue = extractStat(currentWrap.data, stat);
      const allValuesForStat = statValues[stat];
      
      // Store the actual count of non-null values for this metric
      metricCounts[stat] = allValuesForStat.length;
      
      if (currentValue !== null && allValuesForStat.length > 1) {
        percentiles[stat] = calculatePercentile(
          currentValue,
          allValuesForStat,
          lowerIsBetterStats.has(stat)
        );
        
        // Calculate actual rank (1-based)
        const sortedValues = [...allValuesForStat].sort((a, b) => {
          // For lower is better stats, sort ascending (smallest = rank 1)
          // For higher is better stats, sort descending (largest = rank 1)
          return lowerIsBetterStats.has(stat) ? a - b : b - a;
        });
        
        // Find rank - handle ties by giving them the same rank
        const rank = sortedValues.findIndex(v => v === currentValue) + 1;
        ranks[stat] = rank;
      }
    });

    // Calculate most unique emoji (TF-IDF style)
    const uniqueEmojiData = calculateMostUniqueEmoji(currentWrap, result.rows);

    return NextResponse.json({ 
      percentiles,
      ranks,
      metricCounts,
      total: result.rows.length,
      uniqueEmoji: uniqueEmojiData
    });
  } catch (error) {
    console.error("Percentile calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Calculate the most unique emoji for a user using TF-IDF scoring
function calculateMostUniqueEmoji(currentWrap, allWraps) {
  try {
    // Get current user's emoji usage
    const currentEmojis = currentWrap.data?.raw?.content?.most_used_emojis || 
                          currentWrap.data?.content?.most_used_emojis || [];
    
    if (currentEmojis.length === 0) {
      return null;
    }

    // Build emoji frequency maps for all users
    const userEmojiMaps = [];
    const globalEmojiDocCount = {}; // How many users use each emoji
    
    allWraps.forEach((wrap) => {
      const emojis = wrap.data?.raw?.content?.most_used_emojis || 
                     wrap.data?.content?.most_used_emojis || [];
      
      if (emojis.length > 0) {
        const emojiMap = {};
        emojis.forEach(({ emoji, count }) => {
          if (emoji && count > 0) {
            emojiMap[emoji] = count;
            globalEmojiDocCount[emoji] = (globalEmojiDocCount[emoji] || 0) + 1;
          }
        });
        userEmojiMaps.push(emojiMap);
      }
    });

    const totalUsers = userEmojiMaps.length;
    if (totalUsers === 0) return null;

    // Calculate TF-IDF score for each of current user's emojis
    const currentUserMap = {};
    let totalEmojisForUser = 0;
    
    currentEmojis.forEach(({ emoji, count }) => {
      if (emoji && count > 0) {
        currentUserMap[emoji] = count;
        totalEmojisForUser += count;
      }
    });

    if (totalEmojisForUser === 0) return null;

    // Calculate TF-IDF for each emoji
    const emojiScores = [];
    
    Object.entries(currentUserMap).forEach(([emoji, count]) => {
      // TF: frequency of emoji for this user (normalized)
      const tf = count / totalEmojisForUser;
      
      // IDF: log(total users / users who use this emoji)
      const usersWithEmoji = globalEmojiDocCount[emoji] || 1;
      const idf = Math.log(totalUsers / usersWithEmoji);
      
      // TF-IDF score
      const tfidf = tf * idf;
      
      // Calculate how much more this user uses this emoji compared to average
      const avgUseByOthers = userEmojiMaps.reduce((sum, userMap) => {
        const userTotal = Object.values(userMap).reduce((a, b) => a + b, 0);
        return sum + ((userMap[emoji] || 0) / (userTotal || 1));
      }, 0) / totalUsers;
      
      const uniquenessRatio = avgUseByOthers > 0 ? tf / avgUseByOthers : tf;
      
      emojiScores.push({
        emoji,
        count,
        tfidf,
        uniquenessRatio,
        percentOfUsers: Math.round((usersWithEmoji / totalUsers) * 100),
        percentOfYourEmojis: Math.round((count / totalEmojisForUser) * 100)
      });
    });

    // Sort by TF-IDF score and get the top one
    emojiScores.sort((a, b) => b.tfidf - a.tfidf);
    
    if (emojiScores.length > 0) {
      return emojiScores[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error calculating unique emoji:", error);
    return null;
  }
}

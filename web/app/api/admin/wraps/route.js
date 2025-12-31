import { NextResponse } from "next/server";
import { getAllWraps } from "@/lib/db";

// Helper function to safely extract nested values
function safeGet(obj, path, defaultValue = 0) {
  try {
    const value = path.split('.').reduce((acc, part) => acc?.[part], obj);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

// Get default aggregate structure
function getDefaultAggregates() {
  const defaultSummary = { min: 0, max: 0, avg: 0, median: 0, total: 0 };
  
  return {
    volume: {
      total_messages: defaultSummary,
      sent: defaultSummary,
      received: defaultSummary,
      total_imessages: defaultSummary,
      total_sms: defaultSummary,
      total_words: defaultSummary,
      total_chars: defaultSummary,
      busiest_days: [],
    },
    temporal: {
      hourly_distribution: Array(24).fill(0),
      daily_distribution: Array(7).fill(0),
      monthly_distribution: Array(12).fill(0),
      weekday_weekend: {
        avg_weekday: 0,
        avg_weekend: 0,
      },
    },
    contacts: {
      top_contact_message_counts: defaultSummary,
      total_contacts: defaultSummary,
      unique_contacts_messaged: defaultSummary,
      unique_contacts_received_from: defaultSummary,
      distribution_buckets: [],
    },
    content: {
      emoji_counts: defaultSummary,
      word_counts: defaultSummary,
      question_marks: defaultSummary,
      exclamation_marks: defaultSummary,
      total_emojis: defaultSummary,
      unique_emojis: defaultSummary,
      attachments_sent: defaultSummary,
      attachments_received: defaultSummary,
      double_texts: defaultSummary,
      top_emojis: [],
      sentiment: {
        overall_scores: defaultSummary,
        positive_percentages: defaultSummary,
        negative_percentages: defaultSummary,
        neutral_percentages: defaultSummary,
      },
      message_lengths: {
        avg_length: defaultSummary,
        // max_length, short/medium/long_messages not provided by Python analyzer
      },
      word_count_distribution: {
        buckets: [],
        labels: [],
      },
    },
    conversations: {
      total_conversations: defaultSummary,
      longest_conversation_lengths: defaultSummary,
      avg_messages_per_conversation: defaultSummary,
    },
    ghosts: {
      ghost_counts: defaultSummary,
      ghosted_counts: defaultSummary,
    },
    response_times: {
      avg_response_seconds: defaultSummary,
      median_response_seconds: defaultSummary,
    },
    tapbacks: {
      total_tapbacks: defaultSummary,
      given: defaultSummary,
      received: defaultSummary,
      distribution: {},
    },
    streaks: {
      longest_streak_days: defaultSummary,
      // current_streak_days not provided by Python analyzer
    },
  };
}

// Calculate aggregate statistics from all wraps
function calculateAggregates(wraps) {
  if (wraps.length === 0) {
    return {
      total_wraps: 0,
      total_views: 0,
      aggregates: getDefaultAggregates(),
    };
  }

  const aggregates = {
    volume: {
      total_messages: [],
      sent: [],
      received: [],
      total_imessages: [],
      total_sms: [],
      total_words: [],
      total_chars: [],
    },
    temporal: {
      hourly_distribution: Array(24).fill(0),
      daily_distribution: Array(7).fill(0),
      monthly_distribution: Array(12).fill(0),
      weekday_totals: [],
      weekend_totals: [],
    },
    contacts: {
      top_contact_message_counts: [],
      total_contacts: [],
      unique_contacts_messaged: [],
      unique_contacts_received_from: [],
      all_distributions: [],
    },
    content: {
      emoji_counts: [],
      word_counts: [],
      question_marks: [],
      exclamation_marks: [],
      total_emojis: [],
      unique_emojis: [],
      attachments_sent: [],
      attachments_received: [],
      double_texts: [],
      emoji_map: {},
      sentiment: {
        overall_scores: [],
        positive_percentages: [],
        negative_percentages: [],
        neutral_percentages: [],
      },
      message_lengths: {
        avg_length: [],
        // max_length, short/medium/long_messages not available from Python analyzer
      },
      word_count_histograms: [],
    },
    conversations: {
      total_conversations: [],
      longest_conversation_lengths: [],
      avg_messages_per_conversation: [],
    },
    ghosts: {
      ghost_counts: [],
      ghosted_counts: [],
    },
    response_times: {
      avg_response_seconds: [],
      median_response_seconds: [],
    },
    tapbacks: {
      total_tapbacks: [],
      given: [],
      received: [],
      distribution_map: {},
    },
    streaks: {
      longest_streak_days: [],
      // current_streak_days not available from Python analyzer
    },
    busiest_days_all: [],
  };

  let totalViews = 0;

  wraps.forEach(wrap => {
    const stats = wrap.statistics?.raw || wrap.statistics;
    totalViews += wrap.views || 0;

    // Volume stats
    if (stats.volume) {
      aggregates.volume.total_messages.push(safeGet(stats, 'volume.total_messages', 0));
      aggregates.volume.sent.push(safeGet(stats, 'volume.total_sent', 0));
      aggregates.volume.received.push(safeGet(stats, 'volume.total_received', 0));
      
      // Note: analyzer doesn't track iMessage vs SMS separately
      aggregates.volume.total_imessages.push(safeGet(stats, 'volume.total_messages', 0));
      aggregates.volume.total_sms.push(0);
      
      // Calculate words and chars from content stats
      const totalWords = (safeGet(stats, 'content.avg_word_count_sent', 0) * safeGet(stats, 'volume.total_sent', 0));
      const totalChars = (safeGet(stats, 'content.avg_message_length_sent', 0) * safeGet(stats, 'volume.total_sent', 0));
      aggregates.volume.total_words.push(Math.round(totalWords));
      aggregates.volume.total_chars.push(Math.round(totalChars));

      // Busiest day
      if (stats.volume.busiest_day) {
        aggregates.busiest_days_all.push({
          date: stats.volume.busiest_day.date,
          count: stats.volume.busiest_day.total || 0,
        });
      }
    }

    // Temporal stats
    if (stats.temporal) {
      const hourly = stats.temporal.hour_distribution || stats.temporal.hourly_distribution || {};
      const daily = stats.temporal.day_of_week_distribution || stats.temporal.daily_distribution || {};
      const monthly = stats.temporal.month_distribution || stats.temporal.monthly_distribution || {};
      
      // Debug: log first wrap's temporal data structure
      if (wraps.indexOf(wrap) === 0) {
        console.log('Sample temporal data from first wrap:', {
          hourly: Object.keys(hourly).length > 0 ? hourly : 'EMPTY',
          daily: Object.keys(daily).length > 0 ? daily : 'EMPTY',
          monthly: Object.keys(monthly).length > 0 ? monthly : 'EMPTY',
        });
      }
      
      // Process hourly
      for (let i = 0; i < 24; i++) {
        const count = hourly[i] || hourly[String(i)] || 0;
        aggregates.temporal.hourly_distribution[i] += count;
      }
      
      // Process daily (Python weekday: 0=Mon, 6=Sun; JS: 0=Sun, 6=Sat)
      // Map Python's weekday to JS convention: (pythonDay + 1) % 7
      for (let i = 0; i < 7; i++) {
        const count = daily[i] || daily[String(i)] || 0;
        const jsIndex = (i + 1) % 7; // Convert Mon=0 to Mon=1 (and Sun=6 to Sun=0)
        aggregates.temporal.daily_distribution[jsIndex] += count;
      }
      
      // Process monthly (month values are 1-12 from Python, need to map to 0-11 for array)
      for (let i = 1; i <= 12; i++) {
        const count = monthly[i] || monthly[String(i)] || 0;
        aggregates.temporal.monthly_distribution[i - 1] += count;
      }

      // Weekday/weekend calculation (Python weekday: 0=Mon, 6=Sun)
      // Weekdays: Mon-Fri (0-4), Weekend: Sat-Sun (5-6)
      const weekdayTotal = [0, 1, 2, 3, 4].reduce((sum, day) => {
        return sum + (daily[day] || daily[String(day)] || 0);
      }, 0);
      const weekendTotal = [5, 6].reduce((sum, day) => {
        return sum + (daily[day] || daily[String(day)] || 0);
      }, 0);
      
      if (weekdayTotal > 0) aggregates.temporal.weekday_totals.push(weekdayTotal);
      if (weekendTotal > 0) aggregates.temporal.weekend_totals.push(weekendTotal);
    }

    // Contacts stats
    if (stats.contacts) {
      // Use top_sent_to instead of top_contacts
      const topSentTo = stats.contacts.top_sent_to || [];
      const topReceivedFrom = stats.contacts.top_received_from || [];
      
      if (topSentTo.length > 0) {
        const topContact = topSentTo[0];
        aggregates.contacts.top_contact_message_counts.push(topContact.count || 0);
      } else if (topReceivedFrom.length > 0) {
        // Fallback to top received if no sent data
        const topContact = topReceivedFrom[0];
        aggregates.contacts.top_contact_message_counts.push(topContact.count || 0);
      } else {
        aggregates.contacts.top_contact_message_counts.push(0);
      }
      
      // Calculate total contacts - use the unique count as it's more accurate
      const uniqueMessaged = safeGet(stats, 'contacts.unique_contacts_messaged', 0);
      const uniqueReceived = safeGet(stats, 'contacts.unique_contacts_received_from', 0);
      const totalContacts = Math.max(
        topSentTo.length,
        topReceivedFrom.length,
        uniqueMessaged,
        uniqueReceived
      );
      aggregates.contacts.total_contacts.push(totalContacts);
      
      aggregates.contacts.unique_contacts_messaged.push(uniqueMessaged);
      aggregates.contacts.unique_contacts_received_from.push(uniqueReceived);

      // Store contact distributions for aggregation
      if (stats.contacts.message_distribution) {
        aggregates.contacts.all_distributions.push(stats.contacts.message_distribution);
      }
    }

    // Content stats
    if (stats.content) {
      // Note: most_used_emojis only contains top 10, so this is a partial count
      const mostUsedEmojis = stats.content.most_used_emojis;
      if (mostUsedEmojis && Array.isArray(mostUsedEmojis) && mostUsedEmojis.length > 0) {
        const topEmojisCount = mostUsedEmojis.reduce((sum, e) => sum + (e.count || 0), 0);
        aggregates.content.emoji_counts.push(topEmojisCount);
        aggregates.content.total_emojis.push(topEmojisCount);
        aggregates.content.unique_emojis.push(mostUsedEmojis.length);
      } else {
        // No emoji data available for this wrap
        aggregates.content.emoji_counts.push(0);
        aggregates.content.total_emojis.push(0);
        aggregates.content.unique_emojis.push(0);
      }
      
      // Calculate total words from avg_word_count and total sent messages
      const avgWordCount = safeGet(stats, 'content.avg_word_count_sent', 0);
      const totalSent = safeGet(stats, 'volume.total_sent', 0);
      const totalWords = avgWordCount > 0 && totalSent > 0 ? Math.round(avgWordCount * totalSent) : 0;
      aggregates.content.word_counts.push(totalWords);
      
      // Questions and exclamations - use correct field names
      aggregates.content.question_marks.push(safeGet(stats, 'content.questions_asked', 0));
      aggregates.content.exclamation_marks.push(safeGet(stats, 'content.exclamations_sent', 0));
      
      // Attachments and double texts
      aggregates.content.attachments_sent.push(safeGet(stats, 'content.attachments_sent', 0));
      aggregates.content.attachments_received.push(safeGet(stats, 'content.attachments_received', 0));
      aggregates.content.double_texts.push(safeGet(stats, 'content.double_text_count', 0));

      // Aggregate emojis
      if (stats.content.most_used_emojis) {
        stats.content.most_used_emojis.forEach(emojiData => {
          const emoji = emojiData.emoji;
          const count = emojiData.count || 0;
          if (emoji && count > 0) {
            aggregates.content.emoji_map[emoji] = (aggregates.content.emoji_map[emoji] || 0) + count;
          }
        });
      }

      // Word count histograms
      if (stats.content.word_count_histogram) {
        aggregates.content.word_count_histograms.push(stats.content.word_count_histogram);
      }

      // Sentiment
      if (stats.content.sentiment) {
        aggregates.content.sentiment.overall_scores.push(
          safeGet(stats, 'content.sentiment.overall_score', 0)
        );
        aggregates.content.sentiment.positive_percentages.push(
          safeGet(stats, 'content.sentiment.positive_percentage', 0)
        );
        aggregates.content.sentiment.negative_percentages.push(
          safeGet(stats, 'content.sentiment.negative_percentage', 0)
        );
        aggregates.content.sentiment.neutral_percentages.push(
          safeGet(stats, 'content.sentiment.neutral_percentage', 0)
        );
      }

      // Message lengths - Python analyzer provides avg_message_length_sent and _received
      const avgLengthSent = safeGet(stats, 'content.avg_message_length_sent', 0);
      const avgLengthReceived = safeGet(stats, 'content.avg_message_length_received', 0);
      // Use the average of sent and received as the overall average
      const avgLength = (avgLengthSent + avgLengthReceived) / 2;
      aggregates.content.message_lengths.avg_length.push(avgLength);
    }

    // Conversations stats
    if (stats.conversations) {
      const totalConvs = safeGet(stats, 'conversations.total_conversations', 0);
      aggregates.conversations.total_conversations.push(totalConvs);
      
      // Use most_active_thread.message_count as the longest conversation
      aggregates.conversations.longest_conversation_lengths.push(
        safeGet(stats, 'conversations.most_active_thread.message_count', 0)
      );
      
      // Calculate avg messages per conversation from total messages and total conversations
      const totalMessages = safeGet(stats, 'volume.total_messages', 0);
      const avgMsgsPerConv = totalConvs > 0 ? totalMessages / totalConvs : 0;
      aggregates.conversations.avg_messages_per_conversation.push(avgMsgsPerConv);
    }

    // Ghosts stats
    if (stats.ghosts) {
      aggregates.ghosts.ghost_counts.push(
        safeGet(stats, 'ghosts.people_you_left_hanging', 0)
      );
      aggregates.ghosts.ghosted_counts.push(
        safeGet(stats, 'ghosts.people_who_left_you_hanging', 0)
      );
    }

    // Response times stats
    if (stats.response_times) {
      // Analyzer only tracks median, not average - use median for both
      const medianYou = safeGet(stats, 'response_times.median_response_time_you_seconds', 0);
      aggregates.response_times.avg_response_seconds.push(medianYou);
      aggregates.response_times.median_response_seconds.push(medianYou);
    }

    // Tapbacks stats
    if (stats.tapbacks) {
      aggregates.tapbacks.total_tapbacks.push(
        safeGet(stats, 'tapbacks.total_tapbacks_given', 0) + 
        safeGet(stats, 'tapbacks.total_tapbacks_received', 0)
      );
      aggregates.tapbacks.given.push(
        safeGet(stats, 'tapbacks.total_tapbacks_given', 0)
      );
      aggregates.tapbacks.received.push(
        safeGet(stats, 'tapbacks.total_tapbacks_received', 0)
      );

      // Aggregate tapback distribution
      const distribution = stats.tapbacks.tapback_distribution_given || {};
      Object.keys(distribution).forEach(type => {
        const count = distribution[type] || 0;
        aggregates.tapbacks.distribution_map[type] = 
          (aggregates.tapbacks.distribution_map[type] || 0) + count;
      });
    }

    // Streaks stats - Python analyzer only provides longest_streak_days
    if (stats.streaks) {
      aggregates.streaks.longest_streak_days.push(
        safeGet(stats, 'streaks.longest_streak_days', 0)
      );
      // current_streak_days doesn't exist in Python analyzer - we'll remove from dashboard
    }
  });

  // Calculate summary statistics (min, max, avg, median) for each metric
  const summarize = (arr) => {
    if (!arr || arr.length === 0) return { min: 0, max: 0, avg: 0, median: 0, total: 0 };
    const validArr = arr.filter(val => val != null && !isNaN(val));
    if (validArr.length === 0) return { min: 0, max: 0, avg: 0, median: 0, total: 0 };
    
    const sorted = [...validArr].sort((a, b) => a - b);
    const sum = validArr.reduce((a, b) => a + b, 0);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / validArr.length,
      median: sorted[Math.floor(validArr.length / 2)],
      total: sum,
    };
  };

  // Process top emojis
  const topEmojis = Object.entries(aggregates.content.emoji_map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([emoji, count]) => ({ emoji, count }));

  // Process busiest days - aggregate by date to avoid duplicates
  const busiestDaysMap = {};
  aggregates.busiest_days_all.forEach(day => {
    if (!busiestDaysMap[day.date]) {
      busiestDaysMap[day.date] = 0;
    }
    busiestDaysMap[day.date] += day.count;
  });
  
  const busiestDays = Object.entries(busiestDaysMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Process contact distribution buckets
  const contactDistBuckets = [
    { label: "1-10", range: [1, 10], count: 0 },
    { label: "11-50", range: [11, 50], count: 0 },
    { label: "51-100", range: [51, 100], count: 0 },
    { label: "101-500", range: [101, 500], count: 0 },
    { label: "501-1000", range: [501, 1000], count: 0 },
    { label: "1000+", range: [1001, Infinity], count: 0 },
  ];

  aggregates.contacts.all_distributions.forEach(distribution => {
    if (!Array.isArray(distribution)) return;
    distribution.forEach(contact => {
      const count = contact.count || contact.message_count || 0;
      for (const bucket of contactDistBuckets) {
        if (count >= bucket.range[0] && count <= bucket.range[1]) {
          bucket.count++;
          break;
        }
      }
    });
  });

  // Process word count distribution (aggregate histograms)
  const wordCountBuckets = Array(60).fill(0);
  let wordCountOverflow = 0;
  
  aggregates.content.word_count_histograms.forEach(histogram => {
    Object.entries(histogram).forEach(([wordCount, count]) => {
      const wc = parseInt(wordCount, 10);
      const c = parseInt(count, 10);
      if (isNaN(wc) || isNaN(c)) return;
      if (wc >= 1 && wc <= 60) {
        wordCountBuckets[wc - 1] += c;
      } else if (wc > 60) {
        wordCountOverflow += c;
      }
    });
  });

  // Calculate weekday/weekend averages
  const avgWeekday = aggregates.temporal.weekday_totals.length > 0
    ? aggregates.temporal.weekday_totals.reduce((sum, val) => sum + val, 0) / (aggregates.temporal.weekday_totals.length * 5)
    : 0;
  
  const avgWeekend = aggregates.temporal.weekend_totals.length > 0
    ? aggregates.temporal.weekend_totals.reduce((sum, val) => sum + val, 0) / (aggregates.temporal.weekend_totals.length * 2)
    : 0;

  // Build processed aggregates
  const processedAggregates = {
    volume: {
      total_messages: summarize(aggregates.volume.total_messages),
      sent: summarize(aggregates.volume.sent),
      received: summarize(aggregates.volume.received),
      total_imessages: summarize(aggregates.volume.total_imessages),
      total_sms: summarize(aggregates.volume.total_sms),
      total_words: summarize(aggregates.volume.total_words),
      total_chars: summarize(aggregates.volume.total_chars),
      busiest_days: busiestDays,
    },
    temporal: {
      hourly_distribution: aggregates.temporal.hourly_distribution,
      daily_distribution: aggregates.temporal.daily_distribution,
      monthly_distribution: aggregates.temporal.monthly_distribution,
      weekday_weekend: {
        avg_weekday: Math.round(avgWeekday),
        avg_weekend: Math.round(avgWeekend),
      },
    },
    contacts: {
      top_contact_message_counts: summarize(aggregates.contacts.top_contact_message_counts),
      total_contacts: summarize(aggregates.contacts.total_contacts),
      unique_contacts_messaged: summarize(aggregates.contacts.unique_contacts_messaged),
      unique_contacts_received_from: summarize(aggregates.contacts.unique_contacts_received_from),
      distribution_buckets: contactDistBuckets,
    },
    content: {
      emoji_counts: summarize(aggregates.content.emoji_counts),
      word_counts: summarize(aggregates.content.word_counts),
      question_marks: summarize(aggregates.content.question_marks),
      exclamation_marks: summarize(aggregates.content.exclamation_marks),
      total_emojis: summarize(aggregates.content.total_emojis),
      unique_emojis: summarize(aggregates.content.unique_emojis),
      attachments_sent: summarize(aggregates.content.attachments_sent),
      attachments_received: summarize(aggregates.content.attachments_received),
      double_texts: summarize(aggregates.content.double_texts),
      top_emojis: topEmojis,
      sentiment: {
        overall_scores: summarize(aggregates.content.sentiment.overall_scores),
        positive_percentages: summarize(aggregates.content.sentiment.positive_percentages),
        negative_percentages: summarize(aggregates.content.sentiment.negative_percentages),
        neutral_percentages: summarize(aggregates.content.sentiment.neutral_percentages),
      },
      message_lengths: {
        avg_length: summarize(aggregates.content.message_lengths.avg_length),
        // max_length, short/medium/long_messages not available from Python analyzer
      },
      word_count_distribution: {
        buckets: wordCountBuckets.concat(wordCountOverflow > 0 ? [wordCountOverflow] : []),
        labels: Array.from({ length: 60 }, (_, i) => String(i + 1)).concat(wordCountOverflow > 0 ? ["60+"] : []),
      },
    },
    conversations: {
      total_conversations: summarize(aggregates.conversations.total_conversations),
      longest_conversation_lengths: summarize(aggregates.conversations.longest_conversation_lengths),
      avg_messages_per_conversation: summarize(aggregates.conversations.avg_messages_per_conversation),
    },
    ghosts: {
      ghost_counts: summarize(aggregates.ghosts.ghost_counts),
      ghosted_counts: summarize(aggregates.ghosts.ghosted_counts),
    },
    response_times: {
      avg_response_seconds: summarize(aggregates.response_times.avg_response_seconds),
      median_response_seconds: summarize(aggregates.response_times.median_response_seconds),
    },
    tapbacks: {
      total_tapbacks: summarize(aggregates.tapbacks.total_tapbacks),
      given: summarize(aggregates.tapbacks.given),
      received: summarize(aggregates.tapbacks.received),
      distribution: aggregates.tapbacks.distribution_map,
    },
    streaks: {
      longest_streak_days: summarize(aggregates.streaks.longest_streak_days),
      // current_streak_days not available from Python analyzer
    },
  };

  return {
    total_wraps: wraps.length,
    total_views: totalViews,
    aggregates: processedAggregates,
  };
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_KEY;
    
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const wraps = await getAllWraps();
    
    if (!Array.isArray(wraps)) {
      throw new Error("Invalid wraps data");
    }
    
    const aggregates = calculateAggregates(wraps);
    
    // Debug: log aggregated temporal totals
    console.log('Aggregated temporal totals:', {
      hourly_sum: aggregates.aggregates.temporal.hourly_distribution.reduce((a, b) => a + b, 0),
      daily_sum: aggregates.aggregates.temporal.daily_distribution.reduce((a, b) => a + b, 0),
      monthly_sum: aggregates.aggregates.temporal.monthly_distribution.reduce((a, b) => a + b, 0),
    });

    return NextResponse.json({
      wraps: wraps.map(w => {
        const stats = w.statistics?.raw || w.statistics;
        return {
          id: w?.id || 'unknown',
          year: w?.year || 0,
          created_at: w?.created_at || new Date(),
          views: w?.views || 0,
          total_sent: safeGet(stats, 'volume.total_sent', 0),
          total_received: safeGet(stats, 'volume.total_received', 0),
          total_messages: safeGet(stats, 'volume.total_messages', 0),
          user_name: w.statistics?.user_name || null,
        };
      }),
      ...aggregates,
    });
  } catch (error) {
    console.error("Admin fetch error:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

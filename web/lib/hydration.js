/**
 * Apply hydrated contact data to sanitized statistics
 * This reconstructs the full contact names from the hydrated data
 * 
 * @param {Object} statistics - The sanitized statistics object
 * @param {Object} hydratedData - The hydrated contact data
 * @returns {Object} - Statistics with contact names restored
 */
export function applyHydratedData(statistics, hydratedData) {
  if (!hydratedData || Object.keys(hydratedData).length === 0) {
    return statistics;
  }

  // Deep clone statistics to avoid mutating the original
  const hydrated = JSON.parse(JSON.stringify(statistics));

  // Apply each hydrated field based on its path
  for (const [path, value] of Object.entries(hydratedData)) {
    applyValueAtPath(hydrated, path, value);
  }

  return hydrated;
}

/**
 * Apply a value at a specific path in an object
 * Path format: "key1.key2.key3" or "key1[0].key2"
 */
function applyValueAtPath(obj, path, value) {
  // Remove leading dot if present
  const cleanPath = path.startsWith('.') ? path.substring(1) : path;
  
  const parts = parsePath(cleanPath);
  let current = obj;

  // Navigate to the parent of the target
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part.type === 'property') {
      if (!current[part.key]) {
        current[part.key] = {};
      }
      current = current[part.key];
    } else if (part.type === 'array') {
      if (!Array.isArray(current)) {
        return; // Can't apply to non-array
      }
      if (!current[part.index]) {
        return; // Index doesn't exist
      }
      current = current[part.index];
    }
  }

  // Apply the value at the final key
  const lastPart = parts[parts.length - 1];
  if (lastPart.type === 'property') {
    // Handle special cases for different field types
    if (lastPart.key === 'top_sent_to' || lastPart.key === 'top_received_from') {
      // Replace the entire array
      current[lastPart.key] = value;
    } else if (lastPart.key === 'message_distribution') {
      // Merge contact names back into distribution array
      if (Array.isArray(value) && Array.isArray(current[lastPart.key])) {
        for (const item of value) {
          const index = item.index;
          if (current[lastPart.key][index]) {
            if (item.contact_name) {
              current[lastPart.key][index].contact_name = item.contact_name;
            }
            if (item.contact_id) {
              current[lastPart.key][index].contact_id = item.contact_id;
            }
          }
        }
      }
    } else if (lastPart.key === 'examples' || lastPart.key === 'examples_them') {
      // Cliffhanger examples - replace entire array
      current[lastPart.key] = value;
    } else if (lastPart.key === 'weekday_mvp' || lastPart.key === 'weekend_mvp') {
      // Temporal MVP - replace object
      current[lastPart.key] = value;
    } else if (lastPart.key === 'longest_streak_contact') {
      // Streak contact name
      current[lastPart.key] = value;
    } else if (lastPart.key === 'top_left_unread' || lastPart.key === 'top_left_you_hanging') {
      // Ghost stats - replace array
      current[lastPart.key] = value;
    } else {
      // Default: replace value
      current[lastPart.key] = value;
    }
  }
}

/**
 * Parse a path string into an array of path parts
 * Example: "raw.contacts.top_sent_to" -> [{type: 'property', key: 'raw'}, ...]
 * Example: "items[0].name" -> [{type: 'property', key: 'items'}, {type: 'array', index: 0}, ...]
 */
function parsePath(path) {
  const parts = [];
  let current = '';
  let i = 0;

  while (i < path.length) {
    const char = path[i];

    if (char === '.') {
      if (current) {
        parts.push({ type: 'property', key: current });
        current = '';
      }
      i++;
    } else if (char === '[') {
      if (current) {
        parts.push({ type: 'property', key: current });
        current = '';
      }
      // Find closing bracket
      let j = i + 1;
      while (j < path.length && path[j] !== ']') {
        j++;
      }
      const index = parseInt(path.substring(i + 1, j));
      parts.push({ type: 'array', index });
      i = j + 1;
    } else {
      current += char;
      i++;
    }
  }

  if (current) {
    parts.push({ type: 'property', key: current });
  }

  return parts;
}


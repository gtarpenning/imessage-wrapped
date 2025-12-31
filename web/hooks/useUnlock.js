import { useState, useCallback } from "react";

/**
 * Hook to manage contact data unlocking
 * @param {number} year - The year of the wrapped
 * @param {string} id - The wrapped ID
 * @returns {Object} - Unlock state and functions
 */
export function useUnlock(year, id) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hydratedData, setHydratedData] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState(null);

  const unlock = useCallback(
    async (unlockCode) => {
      if (!unlockCode || unlockCode.trim().length === 0) {
        setError("Please enter an unlock code");
        return false;
      }

      setIsUnlocking(true);
      setError(null);

      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
        const endpoint = `${baseUrl}/api/unlock/${year}/${id}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ unlock_code: unlockCode.trim() }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to unlock");
        }

        const data = await response.json();

        if (data.success && data.hydrated_data) {
          setHydratedData(data.hydrated_data);
          setIsUnlocked(true);
          
          // Store unlock status in sessionStorage so it persists on page refresh
          try {
            sessionStorage.setItem(`unlocked_${year}_${id}`, JSON.stringify({
              timestamp: Date.now(),
              hydratedData: data.hydrated_data,
            }));
          } catch (e) {
            console.warn("Could not store unlock status in sessionStorage:", e);
          }
          
          return true;
        } else {
          throw new Error("Invalid response from server");
        }
      } catch (err) {
        console.error("Unlock error:", err);
        setError(err.message || "Failed to unlock. Please check your code and try again.");
        return false;
      } finally {
        setIsUnlocking(false);
      }
    },
    [year, id]
  );

  const reset = useCallback(() => {
    setIsUnlocked(false);
    setHydratedData(null);
    setError(null);
    
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem(`unlocked_${year}_${id}`);
    } catch (e) {
      console.warn("Could not clear unlock status from sessionStorage:", e);
    }
  }, [year, id]);

  // Check sessionStorage on mount
  const checkStoredUnlock = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(`unlocked_${year}_${id}`);
      if (stored) {
        const { timestamp, hydratedData: storedData } = JSON.parse(stored);
        // Check if stored data is less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          setHydratedData(storedData);
          setIsUnlocked(true);
          return true;
        } else {
          // Clear expired data
          sessionStorage.removeItem(`unlocked_${year}_${id}`);
        }
      }
    } catch (e) {
      console.warn("Could not check stored unlock status:", e);
    }
    return false;
  }, [year, id]);

  return {
    isUnlocked,
    hydratedData,
    isUnlocking,
    error,
    unlock,
    reset,
    checkStoredUnlock,
  };
}


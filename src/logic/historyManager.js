import { DEFAULT_TAG } from './tags.js';

export const HISTORY_STORAGE_KEY = 'vibetimer_history';

/**
 * Returns the logical date (YYYY-MM-DD) shifted by -4 hours for Asia/Kolkata timezone.
 * A workday spans from 4:00 AM to 3:59 AM the next calendar day.
 */
export function getLogicalDateStr(inputDate = new Date()) {
  const d = inputDate instanceof Date ? new Date(inputDate.getTime()) : new Date(inputDate);
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(shifted);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return year + '-' + month + '-' + day;
}

/**
 * Returns the logical date string N days ago from a reference date.
 */
export function getLogicalDateOffset(daysAgo = 0, baseDate = new Date()) {
  const base = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  const target = new Date(base.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return getLogicalDateStr(target);
}

/**
 * Safely format a logical date string (YYYY-MM-DD) to a display string
 * avoiding any UTC/local timezone shifts by fixing to midday.
 */
export function formatLogicalDateDisplay(dateStr, options = { month: 'short', day: 'numeric' }) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return d.toLocaleDateString('en-US', options);
}

/**
 * Retrieve raw history map from localStorage: Record<string, { date, totalMs, laps, tags }>
 */
export function getStoredHistory() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  
  let history = {};
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      history = JSON.parse(raw) || {};
    }
  } catch (e) {
    console.warn('[VibeTimer] Error parsing history storage:', e);
    history = {};
  }

  // Also verify if current timer state has data not yet saved to history
  try {
    const activeStateRaw = window.localStorage.getItem('focusTimerState');
    if (activeStateRaw) {
      const active = JSON.parse(activeStateRaw);
      const activeDate = active.currentDate || getLogicalDateStr();
      const activeTotal = active.dailyTotal || 0;
      if (activeTotal > 0) {
        const existing = history[activeDate];
        if (!existing || activeTotal > existing.totalMs) {
          history[activeDate] = {
            date: activeDate,
            totalMs: Math.max(existing?.totalMs || 0, activeTotal),
            laps: (active.laps && active.laps.length >= (existing?.laps?.length || 0)) ? active.laps : (existing?.laps || []),
            tags: { ...(existing?.tags || {}), ...(active.tags || {}) }
          };
        }
      }
    }
  } catch (e) {
    // Ignore active state parse errors
  }

  return history;
}

/**
 * Persist history map to localStorage
 */
export function saveStoredHistory(historyMap) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyMap));
  } catch (e) {
    console.error('[VibeTimer] Failed to save history storage:', e);
  }
}

/**
 * Record or update a single session/day into persistent local history
 */
export function recordSession({ date, totalMs = 0, laps = [], tags = {} }) {
  if (!date || totalMs < 0) return;
  const history = getStoredHistory();
  const existing = history[date] || { date, totalMs: 0, laps: [], tags: {} };

  const mergedTags = { ...(existing.tags || {}) };
  if (tags && typeof tags === 'object') {
    for (const [tag, duration] of Object.entries(tags)) {
      mergedTags[tag] = Math.max(mergedTags[tag] || 0, Number(duration) || 0);
    }
  }

  const mergedLaps = (Array.isArray(laps) && laps.length >= (existing.laps?.length || 0))
    ? laps
    : (existing.laps || []);

  history[date] = {
    date,
    totalMs: Math.max(existing.totalMs || 0, Number(totalMs) || 0),
    laps: mergedLaps,
    tags: mergedTags
  };

  saveStoredHistory(history);
  return history[date];
}

/**
 * Merge remote Convex records with local storage and active in-memory timer
 * Returns sorted array of entries (newest date first).
 */
export function getMergedHistory(remoteData = null, activeTimerState = null) {
  const mergedMap = getStoredHistory();

  // Incorporate active timer state if provided
  if (activeTimerState && activeTimerState.dailyTotal > 0) {
    const activeDate = activeTimerState.currentDate || getLogicalDateStr();
    const existing = mergedMap[activeDate];
    mergedMap[activeDate] = {
      date: activeDate,
      totalMs: Math.max(existing?.totalMs || 0, activeTimerState.dailyTotal),
      laps: (activeTimerState.laps && activeTimerState.laps.length >= (existing?.laps?.length || 0))
        ? activeTimerState.laps
        : (existing?.laps || []),
      tags: { ...(existing?.tags || {}), ...(activeTimerState.tags || {}) }
    };
  }

  // Merge remote Convex data if available
  if (Array.isArray(remoteData) && remoteData.length > 0) {
    for (const item of remoteData) {
      if (!item || !item.date) continue;
      const existing = mergedMap[item.date];
      const mergedTags = { ...(existing?.tags || {}) };
      if (item.tags && typeof item.tags === 'object') {
        for (const [tag, dur] of Object.entries(item.tags)) {
          mergedTags[tag] = Math.max(mergedTags[tag] || 0, Number(dur) || 0);
        }
      }
      mergedMap[item.date] = {
        date: item.date,
        totalMs: Math.max(existing?.totalMs || 0, Number(item.totalMs) || 0),
        laps: (Array.isArray(item.laps) && item.laps.length >= (existing?.laps?.length || 0))
          ? item.laps
          : (existing?.laps || []),
        tags: mergedTags
      };
    }
  }

  const result = Object.values(mergedMap);
  const todayStr = getLogicalDateStr();

  if (result.length === 0) {
    result.push({
      date: todayStr,
      totalMs: 0,
      tags: {},
      laps: []
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Calculate streak days from history records.
 * Streak requirement: >= 30 minutes (1,800,000 ms) in a day.
 */
export function calculateStreak(historyData) {
  if (!Array.isArray(historyData) || historyData.length === 0) return 0;
  
  const dataMap = {};
  for (const item of historyData) {
    if (item && item.date) {
      dataMap[item.date] = Math.max(dataMap[item.date] || 0, item.totalMs || 0);
    }
  }

  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const expectedDate = getLogicalDateOffset(i);
    const ms = dataMap[expectedDate] || 0;

    if (i === 0 && ms < 1800000) {
      // Today hasn't reached 30 min yet; streak isn't broken if yesterday was completed
      continue;
    }

    if (ms >= 1800000) {
      streak++;
    } else if (i > 0) {
      break; // Streak broken on a past day
    }
  }

  return streak;
}
import React, { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getMergedHistory, calculateStreak } from '../logic/historyManager';

export default function StreakBadge({ user }) {
  const streakData = useQuery(api.stats.getStreakStats, user ? undefined : 'skip');

  const streak = useMemo(() => {
    const history = getMergedHistory(streakData);
    return calculateStreak(history);
  }, [streakData]);

  return (
    <div className="relative group" title={`${streak} day streak! Focus 30+ min daily to keep it going.`}>
      <div className={`glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-white/20 shadow-lg transition-all ${
        streak >= 7 ? 'border-primary/30' : ''
      }`}>
        <span className={`text-sm ${streak >= 7 ? 'animate-pulse' : ''}`}>🔥</span>
        <span className={`text-sm font-bold tabular-nums ${
          streak > 0 ? 'text-primary' : 'text-primary/30'
        }`}>{streak}</span>
      </div>
      
      {/* Tooltip */}
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 glass-panel rounded-lg px-3 py-2 border border-white/20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        <p className="text-[11px] text-primary">
          {streak > 0 
            ? `${streak} day streak! Keep going! 💪`
            : 'Focus 30+ min today to start a streak'
          }
        </p>
      </div>
    </div>
  );
}

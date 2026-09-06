import React, { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getLogicalDateStr } from '../logic/Timer';

export default function StreakBadge({ user }) {
  const streakData = useQuery(api.stats.getStreakStats, user ? undefined : 'skip');

  const streak = useMemo(() => {
    if (!streakData || streakData.length === 0) return 0;
    
    // Sort by date descending
    const sorted = [...streakData].sort((a, b) => b.date.localeCompare(a.date));
    const today = getLogicalDateStr();
    let count = 0;
    
    // Generate expected dates going backwards from today
    const getDateStr = (daysAgo) => {
      const d = new Date();
      d.setTime(d.getTime() - 4 * 60 * 60 * 1000); // 4 AM IST offset
      d.setDate(d.getDate() - daysAgo);
      const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
      const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(d);
      return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
    };

    for (let i = 0; i < 90; i++) {
      const expectedDate = getDateStr(i);
      const stat = sorted.find(s => s.date === expectedDate);
      
      if (i === 0 && (!stat || stat.totalMs < 1800000)) {
        // Today hasn't hit threshold yet - check from yesterday
        continue;
      }
      
      if (stat && stat.totalMs >= 1800000) {
        count++;
      } else if (i > 0) {
        break; // Streak broken
      }
    }
    
    return count;
  }, [streakData]);

  if (!user) {
    return null; // Don't show if not logged in
  }

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

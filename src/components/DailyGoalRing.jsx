import React, { useState, useEffect } from 'react';

export default function DailyGoalRing({ dailyTotal, formatTime }) {
  const [goalMs, setGoalMs] = useState(() => {
    return parseInt(localStorage.getItem('flocus-daily-goal-ms')) || 21600000; // 6 hours default
  });
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalReached, setGoalReached] = useState(false);

  useEffect(() => {
    localStorage.setItem('flocus-daily-goal-ms', goalMs.toString());
  }, [goalMs]);

  useEffect(() => {
    if (dailyTotal >= goalMs && !goalReached) {
      setGoalReached(true);
    } else if (dailyTotal < goalMs) {
      setGoalReached(false);
    }
  }, [dailyTotal, goalMs, goalReached]);

  const progress = Math.min(dailyTotal / goalMs, 1);
  const circumference = 2 * Math.PI * 34; // radius = 34
  const strokeDashoffset = circumference - (progress * circumference);
  
  const goalHours = goalMs / 3600000;
  const currentHours = (dailyTotal / 3600000).toFixed(1);

  const presets = [
    { label: '2h', ms: 7200000 },
    { label: '4h', ms: 14400000 },
    { label: '6h', ms: 21600000 },
    { label: '8h', ms: 28800000 },
    { label: '10h', ms: 36000000 },
  ];

  return (
    <div className="relative flex flex-col items-center">
      <button 
        onClick={() => setShowGoalPicker(!showGoalPicker)}
        className="relative group"
        title="Click to change daily goal"
      >
        <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
          {/* Background ring */}
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          {/* Progress ring */}
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke={goalReached ? '#FFEE00' : `rgba(255, 238, 0, ${0.3 + progress * 0.7})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {goalReached ? (
            <span className="text-lg" style={{ animation: 'pulse 2s ease-in-out infinite' }}>🎉</span>
          ) : (
            <span className="text-sm font-bold text-primary tabular-nums">{Math.round(progress * 100)}%</span>
          )}
        </div>
        {goalReached && (
          <div className="absolute inset-0 rounded-full" style={{
            boxShadow: '0 0 20px rgba(255, 238, 0, 0.4), 0 0 40px rgba(255, 238, 0, 0.2)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
        )}
      </button>
      <p className="text-[10px] text-on-surface-variant mt-1 text-center tabular-nums">
        {goalReached ? 'Goal reached!' : `${currentHours} / ${goalHours}h`}
      </p>

      {showGoalPicker && (
        <div className="absolute top-full mt-2 glass-panel rounded-xl p-3 shadow-2xl border border-white/20 z-50 animate-fade-in">
          <p className="text-[10px] text-on-surface-variant mb-2 font-label-caps text-label-caps">Daily Goal</p>
          <div className="flex gap-1">
            {presets.map(p => (
              <button
                key={p.ms}
                onClick={() => { setGoalMs(p.ms); setShowGoalPicker(false); }}
                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                  goalMs === p.ms 
                    ? 'bg-primary text-on-primary font-bold' 
                    : 'bg-white/10 text-primary hover:bg-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

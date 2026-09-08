import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getLogicalDateStr } from '../logic/Timer';

export default function StatsWidget({ onClose, user }) {
  const fetchedData = useQuery(api.stats.getStats, user ? undefined : "skip");
  
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' or 'graph'

  const effectiveData = useMemo(() => {
    if (fetchedData && Array.isArray(fetchedData) && fetchedData.length > 0) {
      return fetchedData;
    }

    const localEntries = [];
    const todayStr = getLogicalDateStr();

    try {
      const savedTimerState = localStorage.getItem('focusTimerState');
      if (savedTimerState) {
        const parsed = JSON.parse(savedTimerState);
        const dateStr = parsed.currentDate || todayStr;
        localEntries.push({
          date: dateStr,
          totalMs: parsed.dailyTotal || 0,
          tags: parsed.tags || {},
          laps: parsed.laps || []
        });
      }
    } catch (e) {
      console.warn("Failed to parse local timer state", e);
    }

    if (localEntries.length === 0) {
      localEntries.push({
        date: todayStr,
        totalMs: 0,
        tags: {},
        laps: []
      });
    }

    return localEntries;
  }, [fetchedData]);

  const stats = useMemo(() => {
    const dataMap = {};
    const tagSum = {};
    effectiveData.forEach(d => {
      dataMap[d.date] = d.totalMs;
      if (d.tags) {
        for (const [tag, duration] of Object.entries(d.tags)) {
          tagSum[tag] = (tagSum[tag] || 0) + duration;
        }
      }
    });

    const dRef = new Date();
    dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000); // shift 4 hours for logical day

    let thisWeekMs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      thisWeekMs += dataMap[dateStr] || 0;
    }

    let lastWeekMs = 0;
    for (let i = 7; i < 14; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      lastWeekMs += dataMap[dateStr] || 0;
    }

    const thisWeekHours = (thisWeekMs / 3600000).toFixed(1);
    const lastWeekHours = (lastWeekMs / 3600000).toFixed(1);

    let percentChange = 0;
    if (lastWeekMs > 0) {
      percentChange = Math.round(((thisWeekMs - lastWeekMs) / lastWeekMs) * 100);
    } else if (thisWeekMs > 0) {
      percentChange = 100;
    }

    const heatmapDays = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      heatmapDays.push({
        date: dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalMs: dataMap[dateStr] || 0
      });
    }

    const barChartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const ms = dataMap[dateStr] || 0;
      barChartData.push({
        dateStr,
        displayDate: d.toLocaleDateString('en-US', { weekday: 'short' }),
        hours: parseFloat((ms / 3600000).toFixed(2))
      });
    }

    const pieChartData = Object.keys(tagSum).map(tag => ({
      name: tag,
      value: parseFloat((tagSum[tag] / 3600000).toFixed(2))
    })).filter(d => d.value > 0);

    return {
      thisWeekHours,
      lastWeekHours,
      percentChange,
      heatmapDays,
      barChartData,
      pieChartData
    };
  }, [fetchedData]);

  const getIntensityClass = (totalMs) => {
    if (totalMs === 0) return 'bg-white/10';
    if (totalMs < 3600000) return 'bg-primary/30'; // < 1h
    if (totalMs < 10800000) return 'bg-primary/60'; // < 3h
    return 'bg-primary'; // >= 3h
  };

  const formatTime = (ms) => {
    const totalMins = Math.round(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const PIE_COLORS = ['rgba(255, 238, 0, 0.8)', 'rgba(0, 255, 170, 0.8)', 'rgba(255, 100, 150, 0.8)', 'rgba(100, 150, 255, 0.8)', 'rgba(255, 150, 50, 0.8)'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-2 rounded text-xs border border-white/10 shadow-xl">
          <p className="text-on-surface-variant mb-1">{label}</p>
          <p className="text-primary font-bold">{payload[0].value}h</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-h-[80vh] overflow-y-auto no-scrollbar glass-panel rounded-2xl p-6 shadow-2xl animate-fade-in border border-white/20 z-[100] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h2 text-lg text-primary">Focus Stats</h3>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container-highest/50 rounded-full p-1 border border-white/5">
            <button 
              onClick={() => setViewMode('heatmap')} 
              className={`px-3 py-1 text-xs rounded-full transition-colors ${viewMode === 'heatmap' ? 'bg-white/20 text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Heatmap
            </button>
            <button 
              onClick={() => setViewMode('graph')} 
              className={`px-3 py-1 text-xs rounded-full transition-colors ${viewMode === 'graph' ? 'bg-white/20 text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Graph
            </button>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      
      {!user ? (
        <div className="flex-grow flex items-center justify-center text-on-surface-variant text-sm py-10">
          Please login to view your focus statistics.
        </div>
      ) : loading || !stats ? (
        <div className="flex-grow flex items-center justify-center text-primary py-10">
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface/50 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
              <div className="text-on-surface-variant text-xs mb-1 uppercase tracking-wider font-semibold">This Week</div>
              <div className="text-3xl font-bold text-on-surface">{stats.thisWeekHours}h</div>
              <div className={`text-xs mt-1 font-medium ${stats.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange}% {stats.percentChange >= 0 ? '📈' : '📉'}
              </div>
            </div>
            <div className="bg-surface/50 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
              <div className="text-on-surface-variant text-xs mb-1 uppercase tracking-wider font-semibold">Last Week</div>
              <div className="text-3xl font-bold text-on-surface">{stats.lastWeekHours}h</div>
            </div>
          </div>

          {viewMode === 'heatmap' ? (
            <div>
              <div className="text-on-surface-variant text-xs mb-3 uppercase tracking-wider font-semibold">Last 90 Days</div>
              <div className="flex justify-center">
                <div className="grid grid-rows-7 grid-flow-col gap-1.5 pb-2">
                  {stats.heatmapDays.map((day) => (
                    <div 
                      key={day.date} 
                      className={`w-3 h-3 rounded-sm ${getIntensityClass(day.totalMs)} group relative cursor-pointer hover:ring-2 hover:ring-white/50 transition-all`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface text-on-surface text-xs rounded border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        {day.displayDate}: {formatTime(day.totalMs)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <div className="text-on-surface-variant text-xs mb-3 uppercase tracking-wider font-semibold">Last 7 Days</div>
                <div className="h-40 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="displayDate" stroke="rgba(255,255,255,0.3)" fontSize={11} tickMargin={8} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="hours" fill="rgba(255, 238, 0, 0.7)" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {stats.pieChartData.length > 0 && (
                <div>
                  <div className="text-on-surface-variant text-xs mb-3 uppercase tracking-wider font-semibold">Time by Tag</div>
                  <div className="h-40 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {stats.pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 ml-4">
                      {stats.pieChartData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2 text-xs">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                          <span className="text-on-surface-variant w-12 truncate">{entry.name}</span>
                          <span className="text-primary font-mono">{entry.value}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

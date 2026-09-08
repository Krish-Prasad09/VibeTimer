import { useUser, SignInButton } from '@clerk/clerk-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useNavigate } from 'react-router-dom';
import './StatsPage.css';
import { useState, useMemo, useRef, useEffect } from 'react';
import { generateFocusReport } from '../logic/generateFocusReport';
import { TAG_COLORS } from '../logic/tags';
import { getLogicalDateStr } from '../logic/Timer';

export default function StatsPage() {
  const navigate = useNavigate();
  const heatmapScrollRef = useRef(null); 
  const { user, isLoaded } = useUser();
  const fetchedData = useQuery(api.stats.getStats, user ? undefined : "skip");

  // Fallback to local timer data if user is not signed in or fetchedData is unavailable
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

  const [comparePeriod, setComparePeriod] = useState('weekly');
  const [compareOffset, setCompareOffset] = useState(1);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const generateSuggestion = useAction(api.suggestions.generateSuggestion);

  const handleExport = (period) => {
    generateFocusReport(period, effectiveData, user?.fullName || user?.firstName || 'User');
    setIsExportMenuOpen(false);
  };

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
    dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000); 

    let thisPeriodMs = 0;
    let lastPeriodMs = 0;

    if (comparePeriod === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        thisPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
      for (let i = 7; i < 14; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        lastPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
    } else if (comparePeriod === 'monthly') {
      for (let i = 0; i < 28; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        thisPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
      for (let i = 28; i < 56; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        lastPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
    } else {
      // allTime: compare last 365 days vs prior 365 days
      for (let i = 0; i < 365; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        thisPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
      for (let i = 365; i < 730; i++) {
        const d = new Date(dRef);
        d.setDate(d.getDate() - i);
        lastPeriodMs += dataMap[d.toISOString().split('T')[0]] || 0;
      }
    }

    const thisWeekHours = (thisPeriodMs / 3600000).toFixed(1);
    const lastWeekHours = (lastPeriodMs / 3600000).toFixed(1);
    const dailyAverage = (thisPeriodMs / 3600000 / (comparePeriod === 'weekly' ? 7 : comparePeriod === 'monthly' ? 28 : Math.max(1, Object.keys(dataMap).length || 1))).toFixed(1);

    let percentChange = 0;
    if (lastPeriodMs > 0) {
      percentChange = Math.round(((thisPeriodMs - lastPeriodMs) / lastPeriodMs) * 100);
    } else if (thisPeriodMs > 0) {
      percentChange = 100;
    }

    let bestDayMs = 0;
    let bestDayStr = "None";
    let totalAllTimeMs = 0;
    Object.entries(dataMap).forEach(([date, ms]) => {
      totalAllTimeMs += ms;
      if (ms > bestDayMs) {
        bestDayMs = ms;
        bestDayStr = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    });
    const totalAllTimeHours = (totalAllTimeMs / 3600000).toFixed(1);

    const heatmapDays = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      heatmapDays.push({
        date: d.toISOString().split('T')[0],
        totalMs: dataMap[d.toISOString().split('T')[0]] || 0
      });
    }

    const barChartData = [];
    let maxChartMs = 1;
    if (comparePeriod === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const d1 = new Date(dRef);
        d1.setDate(d1.getDate() - i);
        const currMs = dataMap[d1.toISOString().split('T')[0]] || 0;
        
        const d2 = new Date(dRef);
        d2.setDate(d2.getDate() - i - (compareOffset * 7));
        const prevMs = dataMap[d2.toISOString().split('T')[0]] || 0;
        
        maxChartMs = Math.max(maxChartMs, currMs, prevMs);
        barChartData.push({ label: d1.toLocaleDateString('en-US', { weekday: 'short' }), currMs, prevMs });
      }
    } else if (comparePeriod === 'monthly') {
      for (let i = 3; i >= 0; i--) {
        let currMs = 0; let prevMs = 0;
        for (let j = 0; j < 7; j++) {
           const d1 = new Date(dRef); d1.setDate(d1.getDate() - (i * 7 + j));
           currMs += dataMap[d1.toISOString().split('T')[0]] || 0;
           const d2 = new Date(dRef); d2.setDate(d2.getDate() - (i * 7 + j) - (compareOffset * 28));
           prevMs += dataMap[d2.toISOString().split('T')[0]] || 0;
        }
        maxChartMs = Math.max(maxChartMs, currMs, prevMs);
        barChartData.push({ label: `W${4 - i}`, currMs, prevMs });
      }
    } else {
      // All Time: show last 6 months
      for (let i = 5; i >= 0; i--) {
        const d1 = new Date(dRef.getFullYear(), dRef.getMonth() - i, 1);
        const monthLabel = d1.toLocaleDateString('en-US', { month: 'short' });
        let currMs = 0; let prevMs = 0;
        const year = d1.getFullYear();
        const month = d1.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = new Date(year, month, d).toISOString().split('T')[0];
          currMs += dataMap[dateStr] || 0;
          const prevDateStr = new Date(year - compareOffset, month, d).toISOString().split('T')[0];
          prevMs += dataMap[prevDateStr] || 0;
        }
        maxChartMs = Math.max(maxChartMs, currMs, prevMs);
        barChartData.push({ label: monthLabel, currMs, prevMs });
      }
    }

    // Compute period-scoped tag distribution
    const periodTagSum = {};
    const periodDays = comparePeriod === 'weekly' ? 7 : comparePeriod === 'monthly' ? 28 : 365;
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayData = effectiveData.find(fd => fd.date === dateStr);
      if (dayData && dayData.tags) {
        for (const [tag, duration] of Object.entries(dayData.tags)) {
          periodTagSum[tag] = (periodTagSum[tag] || 0) + duration;
        }
      }
    }
    const periodTagTotal = Object.values(periodTagSum).reduce((a, b) => a + b, 0);
    const sortedTags = Object.entries(periodTagSum).sort((a,b) => b[1] - a[1]);
    const topTags = sortedTags.slice(0, 5).map(([name, ms]) => ({
      name, percent: Math.round((ms / Math.max(1, periodTagTotal)) * 100),
      color: TAG_COLORS[name] || '#c8c6c5'
    }));

    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const ms = dataMap[dateStr] || 0;
      if (i === 0 && ms < 1800000) continue;
      if (ms >= 1800000) currentStreak++;
      else if (i > 0) break;
    }

    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 364; i >= 0; i--) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const ms = dataMap[dateStr] || 0;
      if (ms >= 1800000) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    let activeDaysLast30 = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if ((dataMap[dateStr] || 0) > 0) activeDaysLast30++;
    }
    const consistency = Math.round((activeDaysLast30 / 30) * 100);

    let actualThisWeekMs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      actualThisWeekMs += dataMap[d.toISOString().split('T')[0]] || 0;
    }
    const actualThisWeekHours = Number((actualThisWeekMs / 3600000).toFixed(1));
    const weeklyProgressPercent = Math.min(100, Math.round((actualThisWeekHours / 72) * 100));

    return { thisWeekHours, lastWeekHours, dailyAverage, percentChange, totalAllTimeHours, bestDayStr, bestDayHours: (bestDayMs / 3600000).toFixed(1), heatmapDays, barChartData, maxChartMs, topTags, currentStreak, longestStreak, consistency, actualThisWeekHours, weeklyProgressPercent };
  }, [effectiveData, comparePeriod, compareOffset]);

  const getHeatmapClass = (ms) => {
    if (ms >= 10800000) return "bg-primary-fixed box-glow";
    if (ms >= 3600000) return "bg-primary-fixed/60 border border-primary-fixed/80";
    if (ms > 0) return "bg-primary-fixed/30 border border-primary-fixed/50";
    return "bg-surface-container-high border border-outline-variant";
  };

  useEffect(() => {
    if (heatmapScrollRef.current) {
      // Set the scroll position to the maximum possible width
      heatmapScrollRef.current.scrollLeft = heatmapScrollRef.current.scrollWidth;
    }
  }, [stats]); // Runs whenever the stats object finishes loading

  // Fetch AI suggestion when stats are ready, using localStorage to cache it per day
  useEffect(() => {
    if (!user || !stats || aiSuggestions[comparePeriod] || suggestionLoading) return;

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `aiSuggestionCache_${comparePeriod}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.date === today) {
          setAiSuggestions(prev => ({ ...prev, [comparePeriod]: parsed.suggestion }));
          return;
        }
      } catch {
        // Ignore parsing errors and fetch new
      }
    }

    setSuggestionLoading(true);
    const summary = [
      `Period: ${comparePeriod}`,
      `This period: ${stats.thisWeekHours}h, Last period: ${stats.lastWeekHours}h (${stats.percentChange >= 0 ? '+' : ''}${stats.percentChange}%)`,
      `Daily average: ${stats.dailyAverage}h`,
      `Current streak: ${stats.currentStreak} days, Longest: ${stats.longestStreak} days`,
      `Consistency (30-day): ${stats.consistency}%`,
      `Best day: ${stats.bestDayStr} (${stats.bestDayHours}h)`,
      `Tag distribution: ${stats.topTags.map(t => `${t.name} ${t.percent}%`).join(', ') || 'No tags'}`,
      `Total all-time: ${stats.totalAllTimeHours}h`,
      `Weekly goal progress: ${stats.actualThisWeekHours}h / 72h`
    ].join('\n');

    generateSuggestion({ statsSummary: summary })
      .then(result => {
        setAiSuggestions(prev => ({ ...prev, [comparePeriod]: result.suggestion }));
        localStorage.setItem(cacheKey, JSON.stringify({
          date: today,
          suggestion: result.suggestion
        }));
      })
      .catch(() => {
        setAiSuggestions(prev => ({ ...prev, [comparePeriod]: 'Keep pushing! Consistency beats intensity every time.' }));
      })
      .finally(() => setSuggestionLoading(false));
  }, [stats, user, comparePeriod, aiSuggestions, suggestionLoading, generateSuggestion]);

  if (!isLoaded && !stats) {
    return (
      <div className="fixed inset-0 bg-background text-primary flex flex-col items-center justify-center z-[100]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-on-surface-variant text-sm">Loading Analytics...</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 rounded-full border border-white/20 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          Back to Timer
        </button>
      </div>
    );
  }


  // Helper function to generate dynamic classes for the heatmap
  

  return (
    <div className="stats-page-container fixed inset-0 overflow-y-auto z-[100] bg-background text-on-surface font-s-body-md pb-8">
      
      <div className="ambient-bg fixed inset-0 pointer-events-none z-[-1]">
        <div className="blur-orb orb-yellow"></div>
        <div className="blur-orb orb-purple"></div>
      </div>

      {/* HEADER */}
      {/* <header className="bg-background/80 backdrop-blur-xl border-b border-outline-variant shadow-[0_0_15px_rgba(216,202,0,0.1)] fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-8 h-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-on-surface-variant hover:text-primary-fixed-dim transition-colors active:scale-95 duration-100 p-2">
            <span className="material-symbols-outlined" data-icon="arrow_back">arrow_back</span>
          </button>
          <h1 className="font-s-headline-lg text-s-headline-lg-mobile text-primary-fixed uppercase tracking-tighter md:hidden">VibeTimer</h1>
        </div>
        
        <nav className="hidden md:flex gap-8 font-s-headline-lg text-s-headline-lg">
          <Link className="text-primary-fixed border-b-2 border-primary-fixed pb-1" to="/analytics">Analytics</Link>
        </nav>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-on-surface-variant">
            <button aria-label="Notifications" className="hover:text-primary-fixed-dim transition-colors active:scale-95 duration-100 p-2"></button>
            <button aria-label="Messages" className="hover:text-primary-fixed-dim transition-colors active:scale-95 duration-100 p-2"></button>
          </div>
          <div className="w-10 h-10 rounded-full border border-primary-fixed overflow-hidden flex-shrink-0">
            <img className="w-full h-full object-cover" alt="User avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAK6_Us-XMLTKE9Fw3aEp_8VOdYCRqtysCOJxq8oWJlQ7T_97wp2yo-rNmBhSY_UDgs3CQYf2UBZ2vqjzE4jKL0kOgYku4fy27A3nU83bIl3K3wG2XHvzZW3FIkMw8o7GTjHZYlU1q6lougXB9zlSYivSalvZSstLqj5Yq6gjJr3IeSnliBIyvdm2KyCGJHk81Dz-YDp9VlW__DEQIYb79YCmK6F4MOWyVRdjkfIh64Amn_twVGp_OiqipSgAFaJC2Cook4nVyVgROL" />
          </div>
        </div>
      </header> */}

      {/* SIDEBAR */}
      {/* <aside className="bg-surface-container-lowest/90 backdrop-blur-md border-r border-outline-variant shadow-xl fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col pt-28 pb-8">
        <div className="px-6 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border border-outline overflow-hidden flex-shrink-0">
            <img className="w-full h-full object-cover" alt="System Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlllCMHlusCYczyRmhpvD2AJXe9YdFTe2JtlUdk_MmOhyQLpbm3JUnsdtL-T3RKyM-hiOwTYAri08H7CKxS_BwLe8nOzPMh6zjJ3J8Dfman1n4m4yJk7eMNUecS-4ATHsM0Lq5BbAP9ATO1FtafcPgzeCiX3cWSyHy8d2LjvFaJGDAswuTARetQFiPVgVQoPRGERYJNdrCBdasQD3aF3AqSyTIFlKs1CHQqHfbPisSqWrISZ1t4ZOrop3b0I4wAGgextJGqvOZjf6T" />
          </div>
          <div>
            <div className="font-s-headline-lg text-s-headline-lg text-primary-fixed text-lg">VibeTimer</div>
            <div className="font-s-label-sm text-s-label-sm text-on-surface-variant">System Active</div>
          </div>
        </div>
        <nav className="flex flex-col gap-2 flex-1 font-s-label-sm text-s-label-sm">
          <Link className="text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-high transition-all mx-4 my-1 p-3 rounded-lg flex items-center gap-3 active:translate-x-1" to="/home"><span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>Home</Link>
          <Link className="bg-primary-container text-on-primary-fixed rounded-lg mx-4 my-1 p-3 flex items-center gap-3 active:translate-x-1" to="/trends"><span className="material-symbols-outlined" data-icon="insights">insights</span>Trends</Link>
          <Link className="text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-high transition-all mx-4 my-1 p-3 rounded-lg flex items-center gap-3 active:translate-x-1" to="/tags"><span className="material-symbols-outlined" data-icon="sell">sell</span>Tags</Link>
          <Link className="text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-high transition-all mx-4 my-1 p-3 rounded-lg flex items-center gap-3 active:translate-x-1" to="/goals"><span className="material-symbols-outlined" data-icon="flag">flag</span>Goals</Link>
          <Link className="text-on-surface-variant hover:text-primary-fixed hover:bg-surface-container-high transition-all mx-4 my-1 p-3 rounded-lg flex items-center gap-3 active:translate-x-1" to="/settings"><span className="material-symbols-outlined" data-icon="settings">settings</span>Settings</Link>
        </nav>
        <div className="px-6 mt-auto">
          <button className="w-full bg-transparent border border-outline text-on-surface py-3 rounded-md font-s-label-sm text-s-label-sm hover:border-primary-fixed hover:text-primary-fixed transition-colors">Export Report</button>
        </div>
      </aside> */}

      {/* MAIN CONTENT (Added larger padding and gaps for breathing room) */}
      <main className="pt-5 px-6 md:px-8 w-full max-w-[1100px] mx-auto flex flex-col gap-5 pb-8">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 fade-in-stagger delay-1 relative z-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="p-2.5 rounded-full border border-white/10 hover:border-primary/50 text-on-surface-variant hover:text-primary transition-all flex items-center justify-center bg-surface-container-high/60 cursor-pointer shadow-md active:scale-95"
              title="Back to Timer"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <h2 className="font-s-headline-lg text-s-headline-lg-mobile md:text-s-headline-lg text-primary text-glow">Analytics Engine</h2>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="flex bg-surface-container-high rounded-full p-1 border border-outline-variant font-s-label-sm text-s-label-sm">
              <button onClick={() => { setComparePeriod('weekly'); setCompareOffset(1); }} className={`px-5 py-2 rounded-full transition-all cursor-pointer ${comparePeriod === 'weekly' ? 'bg-primary-fixed text-on-primary-fixed font-bold shadow-md' : 'text-on-surface-variant hover:text-primary-fixed'}`}>Weekly</button>
              <button onClick={() => { setComparePeriod('monthly'); setCompareOffset(1); }} className={`px-5 py-2 rounded-full transition-all cursor-pointer ${comparePeriod === 'monthly' ? 'bg-primary-fixed text-on-primary-fixed font-bold shadow-md' : 'text-on-surface-variant hover:text-primary-fixed'}`}>Monthly</button>
              <button onClick={() => { setComparePeriod('allTime'); setCompareOffset(1); }} className={`px-5 py-2 rounded-full transition-all cursor-pointer ${comparePeriod === 'allTime' ? 'bg-primary-fixed text-on-primary-fixed font-bold shadow-md' : 'text-on-surface-variant hover:text-primary-fixed'}`}>All Time</button>
            </div>
            
            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface px-4 py-2 rounded-full transition-all font-s-label-sm text-sm cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export
              </button>
              {isExportMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-surface-container-highest border border-outline-variant rounded-xl shadow-xl overflow-hidden z-[200] flex flex-col font-s-label-sm text-sm">
                  <button onClick={() => handleExport('weekly')} className="px-4 py-3 text-left hover:bg-white/5 text-on-surface transition-colors cursor-pointer">Current Week</button>
                  <button onClick={() => handleExport('monthly')} className="px-4 py-3 text-left hover:bg-white/5 text-on-surface transition-colors border-t border-outline-variant/30 cursor-pointer">Current Month</button>
                  <button onClick={() => handleExport('allTime')} className="px-4 py-3 text-left hover:bg-white/5 text-on-surface transition-colors border-t border-outline-variant/30 cursor-pointer">All Time</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!user && (
          <div className="glass-panel rounded-2xl p-4 border border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm fade-in-stagger delay-1 bg-surface-container-high/30">
            <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <span className="text-on-surface-variant text-xs sm:text-sm">
                Viewing <strong>Local Session Analytics</strong>. Sign in with Clerk to back up daily focus time and sync across devices.
              </span>
            </div>
            <SignInButton mode="modal">
              <button className="px-4 py-1.5 rounded-full bg-primary text-black font-semibold text-xs hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer">
                Sign In / Sync
              </button>
            </SignInButton>
          </div>
        )}

        {/* TOP STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div className="stats-glass-panel rounded-[24px] p-5 md:p-6 relative overflow-hidden fade-in-stagger delay-1 flex flex-col justify-between min-h-[150px]">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary-fixed opacity-50"></div>
            <div className="font-s-label-sm text-[11px] text-on-surface-variant mb-2">Total Focus Hours</div>
            <div className="font-s-display-lg text-3xl md:text-4xl text-primary-fixed tabular-nums number-counter my-auto">{stats.totalAllTimeHours}</div>
            <div className="mt-4 font-s-label-sm text-[11px] text-outline flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-fixed box-glow inline-block"></span> Active Cycle
            </div>
          </div>

          <div className="stats-glass-panel rounded-[24px] p-5 md:p-6 relative overflow-hidden fade-in-stagger delay-2 flex flex-col justify-between min-h-[150px]">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary-fixed opacity-50"></div>
            <div className="font-s-label-sm text-[11px] text-on-surface-variant mb-2">Daily Average</div>
            <div className="font-s-display-lg text-3xl md:text-4xl text-primary tabular-nums my-auto"><span className="number-counter">{stats.dailyAverage}</span>h</div>
            <div className="mt-4 font-s-label-sm text-[11px] text-outline">Target: 3.0h</div>
          </div>

          <div className="stats-glass-panel rounded-[24px] p-5 md:p-6 relative overflow-hidden fade-in-stagger delay-3 flex flex-col justify-between min-h-[150px]">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary-fixed opacity-50"></div>
            <div className="font-s-label-sm text-[11px] text-on-surface-variant mb-2">vs Last Period</div>
            <div className="font-s-display-lg text-3xl md:text-4xl text-primary tabular-nums flex items-center my-auto">
              <span className={`material-symbols-outlined ${stats.percentChange >= 0 ? "text-primary-fixed" : "text-red-400"} mr-1 text-2xl`} data-icon={stats.percentChange >= 0 ? "trending_up" : "trending_down"}>{stats.percentChange >= 0 ? "trending_up" : "trending_down"}</span>
              {stats.percentChange >= 0 ? "+" : ""}<span className="number-counter">{stats.percentChange}</span>%
            </div>
            <div className="mt-4 font-s-label-sm text-[11px] text-outline">Trajectory Positive</div>
          </div>

          <div className="stats-glass-panel rounded-[24px] p-5 md:p-6 relative overflow-hidden fade-in-stagger delay-4 flex flex-col justify-between min-h-[150px]">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary-fixed opacity-50"></div>
            <div className="font-s-label-sm text-[11px] text-on-surface-variant mb-2">Peak Performance</div>
            <div className="font-s-headline-lg text-2xl md:text-3xl text-primary my-auto">{stats.bestDayStr}</div>
            <div className="mt-4 font-s-body-md text-xs tabular-nums text-primary-fixed">{stats.bestDayHours}h logged</div>
          </div>
        </div>

        {/* FOCUS DISTRIBUTION CHART */}
        <div className="stats-glass-panel rounded-[24px] p-8 flex flex-col gap-8 fade-in-stagger delay-2">
          
          <div className="flex justify-between items-center w-full">
            <h3 className="font-s-headline-lg text-2xl text-primary">Focus Distribution</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1 text-sm text-on-surface-variant border border-outline-variant">
                <select className="bg-transparent outline-none cursor-pointer text-on-surface appearance-none" value={comparePeriod} onChange={e => { setComparePeriod(e.target.value); setCompareOffset(1); }}>
                  <option className="bg-surface" value="weekly">Weekly</option>
                  <option className="bg-surface" value="monthly">Monthly</option>
                  <option className="bg-surface" value="allTime">All Time</option>
                </select>
                <div className="flex items-center gap-2 border-l border-outline-variant pl-3 ml-1">
                  <button onClick={() => setCompareOffset(o => o + 1)} className="hover:text-primary transition-colors flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                  <span className="text-xs w-20 text-center font-mono">{compareOffset} {comparePeriod === 'weekly' ? 'wk' : comparePeriod === 'monthly' ? 'mo' : 'yr'} ago</span>
                  <button onClick={() => setCompareOffset(o => Math.max(1, o - 1))} disabled={compareOffset <= 1} className="hover:text-primary transition-colors disabled:opacity-30 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                </div>
              </div>
              <div className="font-s-label-sm text-s-label-sm flex gap-6 text-on-surface-variant hidden md:flex">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-primary-fixed inline-block box-glow"></span> Current</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-surface-container-high border border-outline-variant inline-block"></span> Previous</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full flex items-end justify-between pt-8 pb-4 relative border-b border-outline-variant">
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-outline font-s-label-sm text-sm pb-8">
              <span>{Math.round(stats.maxChartMs / 3600000)}h</span>
              <span>{Math.round(stats.maxChartMs * 0.75 / 3600000)}h</span>
              <span>{Math.round(stats.maxChartMs * 0.5 / 3600000)}h</span>
              <span>{Math.round(stats.maxChartMs * 0.25 / 3600000)}h</span>
              <span>0h</span>
            </div>
            <div className="ml-12 w-full h-full flex items-end justify-around">
              {stats.barChartData.map((data, i) => {
                const prevHeight = Math.max(2, Math.round((data.prevMs / stats.maxChartMs) * 100) || 0);
                const currHeight = Math.max(2, Math.round((data.currMs / stats.maxChartMs) * 100) || 0);
                return (
                  <div key={i} className="flex flex-col items-center gap-3 w-16 group relative">
                    <div className="w-full flex items-end justify-center gap-2 h-[260px]">
                      <div className="w-4 bg-surface-container-high border border-outline-variant rounded-t-sm transition-all" style={{height: `${prevHeight}%`}}></div>
                      <div className="w-4 bg-primary-fixed rounded-t-sm box-glow bar-grow" style={{ height: `${currHeight}%`, animationDelay: `0.${i + 1}s` }}></div>
                    </div>
                    <span className="font-s-label-sm text-sm text-outline group-hover:text-primary-fixed transition-colors">{data.label}</span>
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-highest border border-outline-variant px-3 py-2 rounded text-xs whitespace-nowrap z-10 shadow-xl pointer-events-none text-on-surface">
                      <div className="flex gap-4"><span className="text-primary-fixed">Current:</span> <span>{(data.currMs / 3600000).toFixed(1)}h</span></div>
                      <div className="flex gap-4"><span className="text-on-surface-variant">Previous:</span> <span>{(data.prevMs / 3600000).toFixed(1)}h</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MIDDLE TWO PANELS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 fade-in-stagger delay-3">
          
          {/* STREAKS */}
          <div className="stats-glass-panel rounded-[24px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col gap-6 w-full">
              <div className="flex items-center justify-between p-5 border border-outline-variant rounded-xl bg-surface-container-highest/30">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary-fixed bg-primary-fixed/10 p-3 rounded-full text-2xl" data-icon="local_fire_department">local_fire_department</span>
                  <div>
                    <div className="font-s-label-sm text-sm text-on-surface-variant mb-1">Current Streak</div>
                    <div className="font-s-headline-lg text-2xl text-primary tabular-nums">{stats.currentStreak} {stats.currentStreak === 1 ? 'Day' : 'Days'}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 border border-outline-variant rounded-xl bg-surface-container-highest/30">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-tertiary-fixed bg-tertiary-fixed/10 p-3 rounded-full text-2xl" data-icon="emoji_events">emoji_events</span>
                  <div>
                    <div className="font-s-label-sm text-sm text-on-surface-variant mb-1">Longest Streak</div>
                    <div className="font-s-headline-lg text-2xl text-primary tabular-nums">{stats.longestStreak} {stats.longestStreak === 1 ? 'Day' : 'Days'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative w-[140px] h-[140px] flex-shrink-0 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
                <circle cx="70" cy="70" fill="none" r="62" stroke="#333333" strokeWidth="10"></circle>
                <circle className="box-glow" cx="70" cy="70" fill="none" r="62" stroke="#FFEE00" strokeDasharray="389.5" strokeDashoffset={389.5 * (1 - (stats.consistency || 0) / 100)} strokeLinecap="round" strokeWidth="10" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}></circle>
              </svg>
              <div className="text-center z-10">
                <div className="font-s-headline-lg text-2xl text-primary-fixed tabular-nums">{stats.consistency}%</div>
                <div className="font-s-label-sm text-xs text-on-surface-variant mt-1">Consistency</div>
              </div>
            </div>
          </div>

          {/* TAG DISTRIBUTION & SUGGESTION */}
          <div className="flex flex-col gap-6">
            <div className="stats-glass-panel rounded-[24px] p-8 flex-1 flex items-center justify-between">
              <div>
                <h3 className="font-s-headline-lg text-xl text-primary mb-5">Tag Distribution</h3>
                <ul className="font-s-label-sm text-sm text-outline space-y-3">
                  {stats.topTags.map((tag, i) => (
                    <li key={tag.name} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-3"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: tag.color, boxShadow: i === 0 ? `0 0 8px ${tag.color}` : 'none' }}></span> {tag.name}</span>
                      <span className="tabular-nums text-on-surface">{tag.percent}%</span>
                    </li>
                  ))}
                  {stats.topTags.length === 0 && <li className="text-on-surface-variant">No tags used yet</li>}
                </ul>
              </div>
              <div className="w-28 h-28 rounded-full border-[6px] border-surface-container-high relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ background: (() => {
                  if (stats.topTags.length === 0) return '#333333';
                  let gradientParts = [];
                  let cumulative = 0;
                  stats.topTags.forEach(tag => {
                    const start = cumulative;
                    cumulative += tag.percent;
                    gradientParts.push(`${tag.color} ${start}% ${cumulative}%`);
                  });
                  if (cumulative < 100) {
                    gradientParts.push(`#333333 ${cumulative}% 100%`);
                  }
                  return `conic-gradient(${gradientParts.join(', ')})`;
                })() }}></div>
                <div className="absolute inset-2 bg-[#1A1A1A] rounded-full"></div>
              </div>
            </div>

            <div className="stats-glass-panel rounded-xl p-5 border-l-4 border-l-primary-fixed flex items-start gap-4 bg-primary-fixed/5">
              <span className="material-symbols-outlined text-primary-fixed mt-1 text-2xl" data-icon={suggestionLoading ? 'hourglass_top' : 'tips_and_updates'}>{suggestionLoading ? 'hourglass_top' : 'tips_and_updates'}</span>
              <div>
                <div className="font-s-label-sm text-sm text-primary-fixed mb-2 flex items-center gap-2">
                  AI Suggestion
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-fixed/10 border border-primary-fixed/30 text-primary-fixed/70 font-normal">Gemini</span>
                </div>
                <p className="font-s-body-md text-sm text-on-surface-variant leading-relaxed">
                  {suggestionLoading ? 'Analyzing your focus patterns...' : (aiSuggestions[comparePeriod] || 'Consistency beats intensity every time. Keep focusing and build up your streak!')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* HEATMAP */}
        {/* 1. Removed 'overflow-x-auto' from the main panel wrapper */}
        <div className="stats-glass-panel rounded-[24px] p-8 fade-in-stagger delay-4">
          
          {/* 2. Changed 'min-w-[700px]' to 'w-full' so it stays fixed to the panel width */}
          <div className="flex justify-between items-center mb-8 w-full" >
            <h3 className="font-s-headline-lg text-xl text-primary">Activity Intensity</h3>
            <div className="font-s-label-sm text-sm flex gap-3 items-center text-on-surface-variant">
              Less
              <div className="w-4 h-4 rounded-sm bg-surface-container-high border border-outline-variant"></div>
              <div className="w-4 h-4 rounded-sm bg-primary-fixed/30 border border-primary-fixed/50"></div>
              <div className="w-4 h-4 rounded-sm bg-primary-fixed/60 border border-primary-fixed/80"></div>
              <div className="w-4 h-4 rounded-sm bg-primary-fixed box-glow"></div>
              More
            </div>
          </div>

          {/* 3. Added a dedicated scrollable wrapper just for the grid */}
          <div className="w-full overflow-x-auto pb-4 custom-scrollbar" ref={heatmapScrollRef}>
            <div className="grid grid-rows-7 gap-2 min-w-[700px] grid-flow-col" id="heatmap-container" >
              {stats.heatmapDays.map((day) => (
                <div 
                  key={day.date} 
                  className={`w-5 h-5 rounded-sm transition-colors duration-300 ${getHeatmapClass(day.totalMs)} group relative cursor-pointer`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-container-highest text-on-surface text-xs rounded border border-outline-variant whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {(day.totalMs / 3600000).toFixed(1)}h
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT SIDE THERMOMETER GOAL */}
      <div className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 h-[300px] md:h-[400px] flex flex-col items-center justify-between z-50 bg-background/80 backdrop-blur-xl p-2 md:p-3 rounded-full border border-outline-variant/50 shadow-[0_0_20px_rgba(216,202,0,0.1)] group transition-all">
        <div className="font-s-label-sm text-[10px] font-bold text-on-surface-variant uppercase">72h</div>
        
        <div className="w-1.5 md:w-2.5 h-full my-3 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant/30 relative flex flex-col justify-end">
          <div className="w-full bg-primary-fixed rounded-full box-glow relative transition-all duration-1000" style={{ height: `${Math.min(100, stats.weeklyProgressPercent)}%` }}>
            <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ animation: 'pulse 2s infinite' }}></div>
          </div>
        </div>
        
        <div className="font-s-label-sm text-[10px] md:text-xs font-bold text-primary-fixed tabular-nums">{Math.round(stats.actualThisWeekHours)}h</div>
        
        {/* Tooltip on hover */}
        <div className="absolute right-[120%] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-surface-container-highest border border-outline-variant px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl flex flex-col items-end gap-1">
          <span className="text-on-surface font-medium font-s-label-sm">Weekly Goal</span>
          <span className="text-primary-fixed tabular-nums font-mono">{stats.actualThisWeekHours}h / 72h</span>
          <span className="text-on-surface-variant tabular-nums font-mono">{stats.weeklyProgressPercent}%</span>
        </div>
      </div>
    </div>
  );
}
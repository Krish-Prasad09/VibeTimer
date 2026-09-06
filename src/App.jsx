import React, { useState, useEffect, useRef } from 'react';
import { TAGS } from './logic/tags';
import { useTimer } from './hooks/useTimer';
import { getLogicalDateStr } from './logic/Timer';
import TodoWidget from './components/TodoWidget';
import NotesWidget from './components/NotesWidget';
import SpotifyWidget from './components/SpotifyWidget';
import StatsWidget from './components/StatsWidget';
import AmbientSoundWidget from './components/AmbientSoundWidget';
import DailyGoalRing from './components/DailyGoalRing';
import StreakBadge from './components/StreakBadge';
import BackgroundLayer from './components/BackgroundLayer';
import StatsPage from './pages/StatsPage';
import './index.css';

// Clerk & Convex
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';

function App() {
  const { mode, isRunning, wasAutoPaused, timeRemaining, timeElapsed, dailyTotal, laps, tags, currentTag, start, pause, reset, lap, setMode, setTag, setDuration, adjustTime, dismissAutoPause, formatTime, syncFromDb, showShortcuts, setShowShortcuts, autoChain, setAutoChain, focusMode, setFocusMode } = useTimer();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showAdjustTime, setShowAdjustTime] = useState(false);
  const [adjustCustomMinutes, setAdjustCustomMinutes] = useState("");

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [activeWidget, setActiveWidget] = useState(null); // 'tasks' | 'music' | 'notes' | 'ambient' | null
  const [showStats, setShowStats] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('flocus-theme') || 'default');
  const [customColor, setCustomColor] = useState(() => localStorage.getItem('flocus-custom-color') || '#FFEE00');
  const [backgroundType, setBackgroundType] = useState(() => localStorage.getItem('flocus-background') || 'breathe');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const modeRef = useRef(mode);
  const pathRef = useRef(null);
  const isStatsPage = location.pathname.startsWith('/stats');

  // Sync Mode to URL (When timer auto-chains or mode changes internally)
  useEffect(() => {
    if (mode !== modeRef.current) {
      modeRef.current = mode;
      if (mode === 'home' && location.pathname !== '/') navigate('/');
      if (mode === 'stopwatch' && location.pathname !== '/stopwatch') navigate('/stopwatch');
      if (mode === 'pomodoro' && location.pathname !== '/timer') navigate('/timer');
      if ((mode === 'break' || mode === 'shortBreak' || mode === 'longBreak') && location.pathname !== '/break') navigate('/break');
    }
  }, [mode, navigate, location.pathname]);

  // Sync URL to Mode (When user navigates via browser or links)
  useEffect(() => {
    if (location.pathname !== pathRef.current) {
      pathRef.current = location.pathname;
      if (location.pathname === '/' && mode !== 'home') setMode('home');
      if (location.pathname === '/stopwatch' && mode !== 'stopwatch') setMode('stopwatch');
      if (location.pathname === '/timer' && mode !== 'pomodoro') setMode('pomodoro');
      if (location.pathname === '/break' && mode !== 'break' && mode !== 'shortBreak' && mode !== 'longBreak') setMode('shortBreak');
    }
  }, [location.pathname, mode, setMode]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('theme-ocean', 'theme-ember');
    document.documentElement.style.removeProperty('--color-primary');

    if (theme === 'ocean') document.documentElement.classList.add('theme-ocean');
    else if (theme === 'ember') document.documentElement.classList.add('theme-ember');
    else if (theme === 'custom') {
      const hex = customColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--color-primary', `${r}, ${g}, ${b}`);
    }

    localStorage.setItem('flocus-theme', theme);
    localStorage.setItem('flocus-custom-color', customColor);
  }, [theme, customColor]);

  useEffect(() => {
    localStorage.setItem('flocus-background', backgroundType);
  }, [backgroundType]);

  // Quotes system
  const QUOTES = [
    "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.",
    "Do what you can, with what you have, where you are.",
    "It's not about having time, it's about making time.",
    "Small daily improvements lead to stunning results.",
    "Your focus determines your reality.",
    "Deep work is the superpower of the 21st century.",
    "The only way to do great work is to love what you do.",
    "Discipline is choosing between what you want now and what you want most.",
    "Don't count the days, make the days count.",
    "Success is the sum of small efforts repeated day in and day out.",
    "You don't have to be great to start, but you have to start to be great.",
    "The mind is everything. What you think, you become.",
    "Action is the foundational key to all success.",
    "Starve your distractions, feed your focus.",
    "Be so good they can't ignore you.",
    "Progress, not perfection.",
    "One hour of focused work beats three hours of distracted effort.",
    "The best time to plant a tree was 20 years ago. The second best time is now.",
    "You are what you repeatedly do. Excellence is not an act, but a habit."
  ];
  const [currentQuote, setCurrentQuote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    if (mode !== 'home') return;
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setCurrentQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
        setQuoteVisible(true);
      }, 700);
    }, 30000);
    return () => clearInterval(interval);
  }, [mode]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  };

  // Auth State
  const { user } = useUser();
  const syncStats = useMutation(api.stats.syncDailyTotal);
  const dbStats = useQuery(api.stats.getStats);

  // Sync dailyTotal from Convex down to local state
  useEffect(() => {
    if (user && dbStats) {
      const today = getLogicalDateStr();
      const todayStat = dbStats.find(s => s.date === today);
      if (todayStat) {
        syncFromDb(todayStat.totalMs || 0, todayStat.laps || [], todayStat.tags || {});
      }
    }
  }, [user, dbStats, syncFromDb]);

  // Track latest stats for periodic syncing
  const latestStats = useRef({ dailyTotal, laps, tags });
  useEffect(() => {
    latestStats.current = { dailyTotal, laps, tags };
  }, [dailyTotal, laps, tags]);

  // Periodic sync to Convex every 10 seconds while running
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      const { dailyTotal: currentTotal, laps: currentLaps, tags: currentTags } = latestStats.current;
      if (isRunning && currentTotal > 0) {
        const today = getLogicalDateStr();
        syncStats({
          date: today,
          totalMs: currentTotal,
          laps: currentLaps,
          tags: currentTags
        }).catch(err => console.error("Periodic sync failed:", err));
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [user, isRunning, syncStats]);

  // Sync dailyTotal to Convex when timer pauses/stops
  useEffect(() => {
    if (user && !isRunning && dailyTotal > 0) {
      const syncData = async () => {
        try {
          const today = getLogicalDateStr(); // YYYY-MM-DD based on 4 AM IST
          await syncStats({
            date: today,
            totalMs: dailyTotal,
            laps: laps, // Send laps array to Convex
            tags: tags  // Send tags object to Convex
          });
        } catch (err) {
          console.error("Failed to sync stats to Convex:", err);
        }
      };
      syncData();
    }
  }, [isRunning, user, dailyTotal, laps]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('error')) {
      setActiveWidget('music');
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const formatClock = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}`;
  };

  const getDisplayTime = () => {
    if (mode === 'home') return formatClock(currentTime);
    if (mode === 'pomodoro' || mode === 'break') return formatTime(timeRemaining);
    if (mode === 'stopwatch') return formatTime(timeElapsed);
    return '00:00';
  };

  const handlePresetClick = (minutes) => {
    setDuration(minutes * 60);
    setShowCustomInput(false);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const mins = parseInt(customMinutes, 10);
    if (!isNaN(mins) && mins > 0) {
      setDuration(mins * 60);
      setShowCustomInput(false);
      setCustomMinutes("");
    }
  };

  const handleAdjustMinutes = (mins) => {
    adjustTime(mins);
    if (user) {
      const today = getLogicalDateStr();
      const updatedTotal = Math.max(0, dailyTotal + mins * 60 * 1000);
      const updatedTags = { ...tags };
      if (updatedTags[currentTag] !== undefined) {
        updatedTags[currentTag] = Math.max(0, (updatedTags[currentTag] || 0) + mins * 60 * 1000);
      }
      syncStats({
        date: today,
        totalMs: updatedTotal,
        laps,
        tags: updatedTags
      }).catch(err => console.error("Failed to sync adjusted stats:", err));
    }
  };

  const handleCustomAdjustSubmit = (e, isDeduct = true) => {
    e.preventDefault();
    const mins = parseInt(adjustCustomMinutes, 10);
    if (!isNaN(mins) && mins > 0) {
      handleAdjustMinutes(isDeduct ? -mins : mins);
      setAdjustCustomMinutes("");
      setShowAdjustTime(false);
    }
  };

  const timerWidgetUi = (
    <div className="flex flex-col items-center mt-stack-md glass-panel p-glass-padding rounded-lg max-w-md w-full">
      
      {(mode === 'pomodoro' || mode === 'break') && (
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {mode === 'pomodoro' && (
            <>
              <button onClick={() => handlePresetClick(25)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">25m</button>
              <button onClick={() => handlePresetClick(60)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">1h</button>
              <button onClick={() => handlePresetClick(180)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">3h</button>
            </>
          )}
          {mode === 'break' && (
            <>
              <button onClick={() => handlePresetClick(10)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">10m</button>
              <button onClick={() => handlePresetClick(15)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">15m</button>
              <button onClick={() => handlePresetClick(30)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">30m</button>
            </>
          )}
          <button onClick={() => setShowCustomInput(!showCustomInput)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">Custom</button>
        </div>
      )}

      {showCustomInput && (mode === 'pomodoro' || mode === 'break') && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2 mb-6">
          <input 
            type="number" 
            min="1"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Minutes" 
            className="bg-black/30 border border-white/20 rounded-md px-3 py-1 text-primary w-24 text-center focus:outline-none"
          />
          <button type="submit" className="px-3 py-1 bg-white/20 text-primary rounded-md hover:bg-white/30">Set</button>
        </form>
      )}

      <div className="flex items-center gap-stack-md">
        <button onClick={isRunning ? pause : start} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors w-12 h-12 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">{isRunning ? 'pause' : 'play_arrow'}</span>
        </button>
        {mode === 'stopwatch' && (
          <button onClick={lap} className="px-6 py-2 rounded-full border border-white/30 text-primary hover:bg-white/10 transition-colors">Lap</button>
        )}
        {(mode === 'pomodoro' || mode === 'break') && (
          <button onClick={reset} className="px-6 py-2 rounded-full border border-white/30 text-primary hover:bg-white/10 transition-colors">Reset</button>
        )}
      </div>
      
      <div className="mt-stack-sm flex items-center gap-2 flex-wrap justify-center">
        <p className="font-label-caps text-label-caps text-primary/60">
          Total Daily Focus Time: {formatTime(dailyTotal)}
        </p>
        <button 
          onClick={() => setShowAdjustTime(!showAdjustTime)} 
          className="text-primary/70 hover:text-primary transition-colors text-xs flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-white/15 hover:bg-white/10 active:scale-95"
          title="Adjust or reduce focus time"
        >
          <span className="material-symbols-outlined text-[13px]">tune</span>
          <span>Adjust</span>
        </button>
      </div>

      {showAdjustTime && (
        <div className="mt-3 p-4 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 shadow-2xl animate-fade-in flex flex-col gap-2.5 w-full text-left">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-yellow-300">history</span>
              Adjust Focus Time
            </span>
            <button onClick={() => setShowAdjustTime(false)} className="text-on-surface-variant hover:text-primary p-0.5 rounded transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant">Deduct study time if you were away or forgot to turn off the timer:</p>
          <div className="grid grid-cols-4 gap-1.5">
            <button onClick={() => handleAdjustMinutes(-5)} className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 hover:border-red-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">−5m</button>
            <button onClick={() => handleAdjustMinutes(-10)} className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 hover:border-red-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">−10m</button>
            <button onClick={() => handleAdjustMinutes(-15)} className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 hover:border-red-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">−15m</button>
            <button onClick={() => handleAdjustMinutes(-30)} className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 hover:border-red-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">−30m</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => handleAdjustMinutes(-60)} className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 hover:border-red-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">−1 hour</button>
            <button onClick={() => handleAdjustMinutes(5)} className="px-2 py-1.5 bg-white/10 hover:bg-green-500/30 hover:border-green-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">+5m</button>
            <button onClick={() => handleAdjustMinutes(15)} className="px-2 py-1.5 bg-white/10 hover:bg-green-500/30 hover:border-green-500/50 border border-white/10 rounded text-xs text-primary font-mono transition-colors">+15m</button>
          </div>
          <div className="flex gap-2 pt-2 border-t border-white/10 items-center">
            <input 
              type="number"
              min="1"
              value={adjustCustomMinutes}
              onChange={(e) => setAdjustCustomMinutes(e.target.value)}
              placeholder="Mins"
              className="bg-black/40 border border-white/20 rounded px-2.5 py-1 text-xs text-primary w-20 text-center focus:outline-none"
            />
            <button 
              type="button" 
              onClick={(e) => handleCustomAdjustSubmit(e, true)}
              className="flex-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs rounded font-medium transition-colors"
            >
              − Deduct
            </button>
            <button 
              type="button" 
              onClick={(e) => handleCustomAdjustSubmit(e, false)}
              className="flex-1 px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-200 text-xs rounded font-medium transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <BackgroundLayer backgroundType={backgroundType} />
      {/* Focus Mode Dimmer */}
      <div 
        className={`fixed inset-0 pointer-events-none transition-all duration-1000 z-0 ${focusMode && isRunning ? 'opacity-100 bg-black/60' : 'opacity-0 bg-transparent'}`} 
        style={{ boxShadow: focusMode && isRunning ? 'inset 0 0 200px rgba(0,0,0,0.8)' : 'none' }}
      />

      {/* Top Left - Lap Report */}
      {!isFullscreen && !isStatsPage && (
        <div className={`absolute top-4 left-4 md:top-6 md:left-6 z-50 flex flex-col gap-2 max-w-[80vw] md:max-w-none transition-opacity duration-1000 ${focusMode && isRunning ? 'opacity-0 pointer-events-none [&>*]:pointer-events-none' : 'pointer-events-none [&>*]:pointer-events-auto'}`}>
          {mode === 'stopwatch' && (
            <div className="glass-panel p-3 md:p-4 rounded-xl min-w-[150px] md:min-w-[200px] max-h-[250px] overflow-y-auto no-scrollbar border border-white/10 shadow-lg animate-fade-in">
              <h3 className="text-primary font-label-caps text-label-caps mb-2 opacity-80">Lap Report</h3>
              {!laps || laps.length === 0 ? (
                <p className="text-on-surface-variant text-sm italic">No laps yet.</p>
              ) : (
                <ul className="space-y-2">
                  {laps.map((lapTime, index) => (
                    <li key={index} className="flex justify-between text-sm text-primary gap-4">
                      <span className="opacity-80">Lap {index + 1}</span>
                      <span className="tabular-nums font-mono opacity-90">{formatTime(lapTime)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Right - Daily Goal + Streak */}
      {!isFullscreen && !isStatsPage && (
        <div className={`absolute top-4 right-4 md:top-6 md:right-6 z-50 flex items-start gap-3 transition-opacity duration-1000 ${focusMode && isRunning ? 'opacity-0 pointer-events-none [&>*]:pointer-events-none' : 'pointer-events-none [&>*]:pointer-events-auto'}`}>
          <DailyGoalRing dailyTotal={dailyTotal} formatTime={formatTime} />
          <StreakBadge user={user} />
        </div>
      )}

      <main className="flex-grow flex flex-col items-center justify-center z-10 text-center relative w-full h-full transition-opacity duration-300 px-4">
        {wasAutoPaused && (
          <div className="mb-4 glass-panel bg-amber-500/15 border border-amber-400/40 text-amber-200 px-4 py-2.5 rounded-full flex items-center gap-3 shadow-2xl animate-fade-in text-xs md:text-sm max-w-lg mx-auto backdrop-blur-md">
            <span className="material-symbols-outlined text-amber-300 text-lg">bedtime</span>
            <span className="text-on-surface font-medium">Laptop sleep detected — timer automatically paused.</span>
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button 
                onClick={() => { dismissAutoPause(); start(); }} 
                className="px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary font-semibold rounded-full text-xs transition-colors"
              >
                Resume
              </button>
              <button 
                onClick={() => { setShowAdjustTime(true); dismissAutoPause(); }} 
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full text-xs transition-colors"
              >
                Adjust
              </button>
              <button 
                onClick={dismissAutoPause} 
                className="p-1 text-on-surface-variant hover:text-primary transition-colors" 
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          </div>
        )}

        <h1 className="font-display-clock text-display-clock-mobile md:text-display-clock drop-shadow-2xl text-primary font-bold tracking-tighter tabular-nums" id="main-clock">
          {getDisplayTime()}
        </h1>
        
        <Routes>
          <Route path="/" element={
            <div className="mt-stack-md flex flex-col items-center gap-3 animate-fade-in">
              <p className="font-h2 text-h2 text-primary font-medium tracking-wide">
                {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ''}
              </p>
              <p className="font-body-lg text-body-lg text-primary/60 font-light tracking-wide italic max-w-md transition-opacity duration-700" style={{opacity: quoteVisible ? 1 : 0}}>
                "{currentQuote}"
              </p>
            </div>
          } />
          <Route path="/stopwatch" element={timerWidgetUi} />
          <Route path="/timer" element={timerWidgetUi} />
          <Route path="/break" element={timerWidgetUi} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Left panel widgets */}
      {!isStatsPage && (
        <div className={`absolute bottom-4 left-4 md:bottom-6 md:left-6 z-50 flex flex-col gap-4 transition-opacity duration-1000 ${focusMode && isRunning ? 'opacity-0 pointer-events-none [&>*]:pointer-events-none' : 'pointer-events-none [&>*]:pointer-events-auto'}`}>
          
          {/* Active Widget Render */}
          <div className="relative">
            {activeWidget === 'tasks' && <TodoWidget onClose={() => setActiveWidget(null)} />}
            {activeWidget === 'notes' && <NotesWidget onClose={() => setActiveWidget(null)} />}
            <SpotifyWidget isOpen={activeWidget === 'music'} onClose={() => setActiveWidget(null)} />
            <AmbientSoundWidget isOpen={activeWidget === 'ambient'} onClose={() => setActiveWidget(null)} />
          </div>

          <div className="group flex items-center">
            <div className="glass-panel rounded-full flex shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 max-w-[50px] group-hover:max-w-[500px] h-[50px]">
              {/* Collapsed Icon */}
              <div className="flex items-center justify-center w-[50px] h-[50px] shrink-0 text-on-surface-variant group-hover:text-primary transition-colors cursor-default">
                 <span className="material-symbols-outlined text-[24px]">widgets</span>
              </div>
              
              {/* Expanded Content */}
              <div className="flex gap-1 md:gap-2 pr-3 md:pr-4 py-1 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 min-w-max">
                <button onClick={() => setActiveWidget(activeWidget === 'tasks' ? null : 'tasks')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group/btn ${activeWidget === 'tasks' ? 'bg-white/20 text-primary' : ''}`}>
                  <span className="material-symbols-outlined group-hover/btn:text-primary transition-colors text-[20px]">check_circle</span>
                </button>
                <button onClick={() => setActiveWidget(activeWidget === 'music' ? null : 'music')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group/btn ${activeWidget === 'music' ? 'bg-white/20 text-primary' : ''}`}>
                  <span className="material-symbols-outlined group-hover/btn:text-primary transition-colors text-[20px]">music_note</span>
                </button>
                <button onClick={() => setActiveWidget(activeWidget === 'notes' ? null : 'notes')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group/btn ${activeWidget === 'notes' ? 'bg-white/20 text-primary' : ''}`}>
                  <span className="material-symbols-outlined group-hover/btn:text-primary transition-colors text-[20px]">edit_note</span>
                </button>
                <button onClick={() => setActiveWidget(activeWidget === 'ambient' ? null : 'ambient')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group/btn ${activeWidget === 'ambient' ? 'bg-white/20 text-primary' : ''}`}>
                  <span className="material-symbols-outlined group-hover/btn:text-primary transition-colors text-[20px]">spa</span>
                </button>
                
                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                
                <div className="relative group/tag flex items-center">
                  <select 
                    value={currentTag} 
                    onChange={(e) => setTag(e.target.value)} 
                    className="appearance-none bg-transparent hover:bg-white/10 transition-all py-2 pl-8 pr-3 rounded-full text-on-surface-variant group-hover/tag:text-primary focus:outline-none cursor-pointer text-sm font-medium h-[36px] leading-tight"
                  >
                    {TAGS.map(tag => (
                      <option key={tag} className="bg-surface text-primary" value={tag}>{tag}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-on-surface-variant group-hover/tag:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">sell</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right panel options */}
      <div className={`absolute bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2 transition-opacity duration-1000 ${focusMode && isRunning ? 'opacity-0 pointer-events-none [&>*]:pointer-events-none' : 'pointer-events-none [&>*]:pointer-events-auto'}`}>
        
        <div className="relative w-full">
          {showStats && <StatsWidget user={user} onClose={() => setShowStats(false)} />}
        </div>

        {rightPanelOpen && (
          <div className="glass-panel rounded-[2rem] p-3 flex flex-col gap-3 shadow-2xl border border-white/20 animate-fade-in origin-bottom-right">
            
            {user ? (
              <div className="flex items-center justify-center p-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Login with Clerk">
                  <span className="material-symbols-outlined text-[20px]">login</span>
                </button>
              </SignInButton>
            )}

            <NavLink to="/" className={({isActive}) => `${isActive ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Home">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'home' ? "'FILL' 1" : "'FILL' 0"}}>home</span>
            </NavLink>
            
            <NavLink to="/stopwatch" className={({isActive}) => `${isActive ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Stopwatch">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'stopwatch' ? "'FILL' 1" : "'FILL' 0"}}>timer</span>
            </NavLink>

            <NavLink to="/timer" className={({isActive}) => `${isActive ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Timer">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'pomodoro' ? "'FILL' 1" : "'FILL' 0"}}>hourglass_empty</span>
            </NavLink>

            <NavLink to="/break" className={({isActive}) => `${isActive ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Break">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'break' ? "'FILL' 1" : "'FILL' 0"}}>coffee</span>
            </NavLink>

            <button onClick={() => { navigate('/stats'); setRightPanelOpen(false); }} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center`} title="Stats">
              <span className="material-symbols-outlined text-[20px]">leaderboard</span>
            </button>

            <button onClick={() => { setSidebarOpen(true); setRightPanelOpen(false); }} className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Settings">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>

            <button onClick={toggleFullscreen} className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Fullscreen">
              <span className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
          </div>
        )}

        <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="glass-panel rounded-full p-4 hover:bg-white/10 transition-all border border-white/20 shadow-2xl bg-surface/50 text-primary">
          <span className="material-symbols-outlined">{rightPanelOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {sidebarOpen && (
        <div className="absolute inset-0 bg-black/50 z-[55] backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)}></div>
      )}

      <aside className={`fixed left-0 top-0 h-full w-full max-w-[400px] bg-surface/90 md:bg-surface/80 backdrop-blur-[40px] border-r border-white/10 shadow-[40px_0_80px_rgba(0,0,0,0.3)] z-[60] py-container-padding flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 flex justify-between items-center mb-8">
          <div>
            <h1 className="font-h1 text-h1 font-bold text-primary">VibeTimer</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Stay in flow</p>
          </div>
          <button className="text-primary p-2 hover:bg-white/10 rounded-full transition-colors border border-white/5" onClick={() => setSidebarOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="px-6 space-y-8 flex-grow overflow-y-auto">
            <section>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-stack-sm ml-1">Timer Mode</label>
              <div className="relative">
                <select 
                  value={mode === 'home' ? 'pomodoro' : mode} 
                  onChange={(e) => setMode(e.target.value)} 
                  className="w-full appearance-none bg-surface-container-high/50 border border-white/10 rounded-xl py-4 px-5 font-body-lg text-body-lg text-primary focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 backdrop-blur-md cursor-pointer transition-colors"
                >
                  <option className="bg-surface-container-highest text-primary" value="pomodoro">Pomodoro (Focus)</option>
                  <option className="bg-surface-container-highest text-primary" value="break">Break</option>
                  <option className="bg-surface-container-highest text-primary" value="stopwatch">Stopwatch</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-on-surface-variant">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </section>

            <section>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-stack-sm ml-1">Preferences</label>
              <div className="bg-surface-container-high/30 rounded-2xl p-glass-padding border border-white/5 flex flex-col gap-6">
                <div className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">linear_scale</span>
                    <span className="font-body-lg text-body-lg text-primary">Show timer progress bar</span>
                  </div>
                  <button aria-checked="true" className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-secondary" role="switch" type="button">
                    <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-on-secondary shadow ring-0 transition duration-200 ease-in-out translate-x-5"></span>
                  </button>
                </div>
                
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setAutoChain(!autoChain)}>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">autorenew</span>
                    <span className="font-body-lg text-body-lg text-primary">Auto-chain timers</span>
                  </div>
                  <button aria-checked={autoChain} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoChain ? 'bg-secondary' : 'bg-surface-container-highest'}`} role="switch" type="button">
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${autoChain ? 'translate-x-5 bg-on-secondary' : 'translate-x-0 bg-on-surface-variant'}`}></span>
                  </button>
                </div>

                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setFocusMode(!focusMode)}>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">visibility_off</span>
                    <span className="font-body-lg text-body-lg text-primary">Focus mode overlay</span>
                  </div>
                  <button aria-checked={focusMode} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${focusMode ? 'bg-secondary' : 'bg-surface-container-highest'}`} role="switch" type="button">
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${focusMode ? 'translate-x-5 bg-on-secondary' : 'translate-x-0 bg-on-surface-variant'}`}></span>
                  </button>
                </div>

                {deferredPrompt && (
                  <div className="flex items-center justify-between group cursor-pointer" onClick={() => deferredPrompt.prompt()}>
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">install_mobile</span>
                      <span className="font-body-lg text-body-lg text-primary">Install App</span>
                    </div>
                    <button className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-primary rounded-xl transition-colors text-sm font-medium border border-white/10">Install</button>
                  </div>
                )}
              </div>
            </section>
            <section>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-stack-sm ml-1">Appearance</label>
              <div className="bg-surface-container-high/30 rounded-2xl p-glass-padding border border-white/5 flex flex-col gap-6">
                
                <div className="flex flex-col gap-2">
                  <span className="font-body-lg text-body-lg text-primary">Theme / Accent Color</span>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select 
                        value={theme} 
                        onChange={(e) => setTheme(e.target.value)} 
                        className="w-full appearance-none bg-surface-container-highest/50 border border-white/10 rounded-xl py-3 px-4 font-body-md text-body-md text-primary focus:outline-none focus:border-white/30 backdrop-blur-md cursor-pointer transition-colors"
                      >
                        <option className="bg-surface-container-highest text-primary" value="default">Default Dark</option>
                        <option className="bg-surface-container-highest text-primary" value="ocean">Deep Ocean</option>
                        <option className="bg-surface-container-highest text-primary" value="ember">Warm Ember</option>
                        <option className="bg-surface-container-highest text-primary" value="custom">Custom Color...</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                      </div>
                    </div>
                    {theme === 'custom' && (
                      <input 
                        type="color" 
                        value={customColor} 
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="h-12 w-12 p-1 rounded-xl bg-surface-container-highest/50 border border-white/10 cursor-pointer"
                        title="Choose custom color"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-body-lg text-body-lg text-primary">Background Scene</span>
                  <div className="relative">
                    <select 
                      value={backgroundType} 
                      onChange={(e) => setBackgroundType(e.target.value)} 
                      className="w-full appearance-none bg-surface-container-highest/50 border border-white/10 rounded-xl py-3 px-4 font-body-md text-body-md text-primary focus:outline-none focus:border-white/30 backdrop-blur-md cursor-pointer transition-colors"
                    >
                      <option className="bg-surface-container-highest text-primary" value="none">None</option>
                      <option className="bg-surface-container-highest text-primary" value="aurora">Aurora Flow</option>
                      <option className="bg-surface-container-highest text-primary" value="matrix">Digital Grid</option>
                      <option className="bg-surface-container-highest text-primary" value="breathe">Pulsing Breathe</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>
        </div>
      </aside>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="glass-panel rounded-2xl p-6 shadow-2xl border border-white/20 animate-fade-in max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-h2 text-h2 text-primary">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['Space', 'Play / Pause'],
                ['R', 'Reset timer'],
                ['F', 'Toggle fullscreen'],
                ['1', 'Focus mode'],
                ['2', 'Break mode'],
                ['3', 'Stopwatch mode'],
                ['0', 'Home'],
                ['?', 'Show shortcuts'],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">{desc}</span>
                  <kbd className="px-2.5 py-1 rounded-lg bg-white/10 text-primary text-xs font-mono border border-white/20 min-w-[36px] text-center">{key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-4 text-center opacity-60">Press ? to toggle this overlay</p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

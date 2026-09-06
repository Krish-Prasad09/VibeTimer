import { useState, useEffect, useRef, useCallback } from 'react';
import { FocusTimer, getLogicalDateStr } from '../logic/Timer';
import { DEFAULT_TAG } from '../logic/tags';

export function useTimer() {
    const getInitialState = () => {
        const defaultState = {
            mode: 'stopwatch',
            isRunning: false,
            timeRemaining: 25 * 60 * 1000,
            timeElapsed: 0,
            dailyTotal: 0,
            laps: [],
            tags: {},
            currentTag: DEFAULT_TAG
        };
        const saved = localStorage.getItem('focusTimerState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.currentDate === getLogicalDateStr()) {
                    return { ...defaultState, ...parsed, isRunning: false };
                }
                return { ...defaultState, mode: parsed.mode || 'stopwatch' };
            } catch(e) {}
        }
        return defaultState;
    };

    const [timerState, setTimerState] = useState(getInitialState);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const [autoChain, setAutoChain] = useState(() => {
        const saved = localStorage.getItem('focusAutoChain');
        return saved ? JSON.parse(saved) : false;
    });
    useEffect(() => {
        localStorage.setItem('focusAutoChain', JSON.stringify(autoChain));
    }, [autoChain]);
    const autoChainRef = useRef(autoChain);
    useEffect(() => {
        autoChainRef.current = autoChain;
    }, [autoChain]);

    const [focusMode, setFocusMode] = useState(() => {
        const saved = localStorage.getItem('focusModeSetting');
        return saved ? JSON.parse(saved) : false;
    });
    useEffect(() => {
        localStorage.setItem('focusModeSetting', JSON.stringify(focusMode));
    }, [focusMode]);

    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = new FocusTimer(
            (newState) => {
                setTimerState(prevState => ({ ...prevState, ...newState }));
            },
            () => {
                // Play chime sound
                FocusTimer.playChime();
                
                // Send desktop notification
                const currentMode = timerRef.current?.mode;
                if ('Notification' in window && Notification.permission === 'granted') {
                    const title = currentMode === 'break' ? 'Break Over!' : 'Focus Complete!';
                    const body = currentMode === 'break' 
                        ? "Break's over! Ready to focus? 💪" 
                        : 'Focus session complete! Time for a break 🎉';
                    new Notification(title, { body, icon: '/favicon.png' });
                }

                if (autoChainRef.current) {
                    if (currentMode === 'pomodoro') {
                        timerRef.current?.setMode('break');
                        timerRef.current?.start();
                    } else if (currentMode === 'break') {
                        timerRef.current?.setMode('pomodoro');
                        timerRef.current?.start();
                    }
                }
            }
        );

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            if (timerRef.current) {
                timerRef.current.pause();
            }
        };
    }, []);

    // Tab title updates
    useEffect(() => {
        const { mode, isRunning, timeRemaining, timeElapsed } = timerState;
        
        if (mode === 'home' || (!isRunning && mode === 'stopwatch' && timeElapsed === 0)) {
            document.title = 'Focus10010';
            return;
        }
        
        if (!isRunning) {
            document.title = '⏸ Paused — Focus10010';
            return;
        }
        
        const ms = (mode === 'stopwatch') ? timeElapsed : timeRemaining;
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const pad = (n) => n.toString().padStart(2, '0');
        document.title = `⏱ ${pad(m)}:${pad(s)} — Focus10010`;
    }, [timerState]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts when typing in inputs
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (timerState.mode !== 'home') {
                        timerState.isRunning ? timerRef.current?.pause() : timerRef.current?.start();
                    }
                    break;
                case 'r':
                case 'R':
                    if (timerState.mode === 'pomodoro' || timerState.mode === 'break') {
                        timerRef.current?.reset();
                    }
                    break;
                case 'f':
                case 'F':
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                        document.exitFullscreen?.();
                    }
                    break;
                case '1':
                    timerRef.current?.setMode('pomodoro');
                    break;
                case '2':
                    timerRef.current?.setMode('break');
                    break;
                case '3':
                    timerRef.current?.setMode('stopwatch');
                    break;
                case '0':
                    timerRef.current?.setMode('home');
                    break;
                case '?':
                    setShowShortcuts(prev => !prev);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [timerState.mode, timerState.isRunning]);

    const start = () => timerRef.current?.start();
    const pause = () => timerRef.current?.pause();
    const reset = () => timerRef.current?.reset();
    const lap = () => timerRef.current?.lap();
    const setMode = (mode) => timerRef.current?.setMode(mode);
    const setTag = (tag) => timerRef.current?.setTag(tag);
    const setDuration = (seconds) => timerRef.current?.setDuration(seconds);

    // Format MS into MM:SS.d (tenths) or H:MM:SS.d
    const formatTime = (totalMs) => {
        const totalSeconds = Math.floor(totalMs / 1000);
        const tenths = Math.floor((totalMs % 1000) / 100);
        
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        const pad = (num) => num.toString().padStart(2, '0');

        if (h > 0) {
            return `${h}:${pad(m)}:${pad(s)}.${tenths}`;
        }
        return `${pad(m)}:${pad(s)}.${tenths}`;
    };

    const syncFromDb = (dbDailyTotal, dbLaps, dbTags) => timerRef.current?.syncFromDb(dbDailyTotal, dbLaps, dbTags);

    return {
        ...timerState,
        start,
        pause,
        reset,
        lap,
        setMode,
        setTag,
        setDuration,
        formatTime,
        syncFromDb,
        showShortcuts,
        setShowShortcuts,
        autoChain,
        setAutoChain,
        focusMode,
        setFocusMode
    };
}

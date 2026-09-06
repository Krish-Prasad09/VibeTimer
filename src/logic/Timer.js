import { DEFAULT_TAG } from './tags.js';

export function getLogicalDateStr() {
    const now = new Date();
    // Shift back by 4 hours
    const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    // Convert to IST string (Asia/Kolkata is UTC+5:30)
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(shifted);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    return `${year}-${month}-${day}`;
}

export class FocusTimer {
    constructor(onTickCallback, onCompleteCallback) {
        this.mode = 'stopwatch'; // 'pomodoro' | 'stopwatch' | 'break'
        this.timeRemaining = 25 * 60 * 1000; // in ms
        this.timeElapsed = 0; // in ms
        this.dailyTotal = 0; // in ms (Focus + Stopwatch)
        this.laps = []; // Array to store lap times
        this.tags = {}; // Record to store duration per tag
        this.currentTag = DEFAULT_TAG; // Default tag
        this.isRunning = false;

        this.currentDate = getLogicalDateStr();

        const savedState = localStorage.getItem('focusTimerState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                this.mode = parsed.mode || this.mode;
                
                if (parsed.currentDate === this.currentDate) {
                    this.timeRemaining = parsed.timeRemaining !== undefined ? parsed.timeRemaining : this.timeRemaining;
                    this.timeElapsed = parsed.timeElapsed || 0;
                    this.dailyTotal = parsed.dailyTotal || 0;
                    this.laps = parsed.laps || [];
                    this.tags = parsed.tags || {};
                    this.currentTag = parsed.currentTag || DEFAULT_TAG;

                    // Self-healing: if dailyTotal is 0, it's impossible to have legitimate laps or tags for today.
                    // This clears poisoned data from the old date rollover bug.
                    if (this.dailyTotal === 0) {
                        this.laps = [];
                        this.tags = {};
                        this.timeElapsed = 0;
                    }

                    // If it was running when closed, catch up
                    if (parsed.isRunning && parsed.lastTickTime) {
                        const now = Date.now();
                        const delta = now - parsed.lastTickTime;
                        
                        if (this.mode === 'stopwatch') {
                            this.timeElapsed += delta;
                            this.dailyTotal += delta;
                        } else if (this.mode === 'pomodoro' || this.mode === 'break') {
                            this.timeRemaining -= delta;
                            if (this.mode === 'pomodoro') {
                                this.dailyTotal += delta;
                                this.tags[this.currentTag] = (this.tags[this.currentTag] || 0) + delta;
                            }
                            if (this.timeRemaining <= 0) {
                                this.timeRemaining = 0;
                            }
                        }
                    }
                } else {
                    // It's a new day! Reset everything to 0 or defaults.
                    this.dailyTotal = 0;
                    this.laps = [];
                    this.tags = {};
                    this.timeElapsed = 0;
                    if (this.mode === 'pomodoro') this.timeRemaining = 25 * 60 * 1000;
                    else if (this.mode === 'break') this.timeRemaining = 10 * 60 * 1000;
                }
            } catch (e) {
                console.error("Failed to parse timer state", e);
            }
        }
        
        this.interval = null;
        this.lastTickTime = null;
        this.lastSavedTime = 0;

        this.onTick = onTickCallback || (() => {});
        this.onComplete = onCompleteCallback || (() => {});
        
        if (this.timeRemaining <= 0 && this.mode !== 'stopwatch') {
            setTimeout(() => this.onComplete(), 0);
        }

        // Periodically check for date rollover (4 AM IST)
        setInterval(() => this.checkDate(), 1000);
        
        // Setup cross-tab sync
        this.channel = new BroadcastChannel('vibetimer_sync');
        this.channel.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'REQUEST_STATE') {
                if (this.isRunning) {
                    this.broadcastAction('SYNC_STATE');
                }
            } else {
                this.applyBroadcastAction(type, payload);
            }
        };
        // Request state from other tabs on boot
        this.channel.postMessage({ type: 'REQUEST_STATE' });

        // Ensure UI is updated immediately on load
        setTimeout(() => this.onTick(this.getState()), 0);
    }

    broadcastAction(type) {
        if (!this.channel) return;
        this.channel.postMessage({
            type,
            payload: {
                mode: this.mode,
                timeRemaining: this.timeRemaining,
                timeElapsed: this.timeElapsed,
                dailyTotal: this.dailyTotal,
                laps: this.laps,
                tags: this.tags,
                currentTag: this.currentTag,
                isRunning: this.isRunning,
                currentDate: this.currentDate,
                lastTickTime: this.lastTickTime
            }
        });
    }

    applyBroadcastAction(type, payload) {
        this.mode = payload.mode;
        this.timeRemaining = payload.timeRemaining;
        this.timeElapsed = payload.timeElapsed;
        this.dailyTotal = payload.dailyTotal;
        this.laps = payload.laps;
        this.tags = payload.tags;
        this.currentTag = payload.currentTag;
        this.currentDate = payload.currentDate;
        this.lastTickTime = payload.lastTickTime;
        
        if (payload.isRunning) {
            this.isRunning = true;
            this._startInterval();
        } else {
            this.isRunning = false;
            this._stopInterval();
        }

        this.saveState();
        this.onTick(this.getState());
    }

    _startInterval() {
        if (this.interval) return;
        this.interval = setInterval(() => {
            this.checkDate(); // Ensure stats reset if midnight passes while running

            const now = Date.now();
            const delta = now - this.lastTickTime;
            this.lastTickTime = now;

            if (this.mode === 'stopwatch') {
                this.timeElapsed += delta;
                this.dailyTotal += delta;
                this.tags[this.currentTag] = (this.tags[this.currentTag] || 0) + delta;
                this.onTick(this.getState());
            } else if (this.mode === 'pomodoro') {
                if (this.timeRemaining > 0) {
                    this.timeRemaining -= delta;
                    this.dailyTotal += delta; // Pomodoro counts as focus time
                    this.tags[this.currentTag] = (this.tags[this.currentTag] || 0) + delta;
                    if (this.timeRemaining <= 0) {
                        this.timeRemaining = 0;
                        this.pause();
                        this.onComplete();
                    }
                    this.onTick(this.getState());
                }
            } else if (this.mode === 'break') {
                if (this.timeRemaining > 0) {
                    this.timeRemaining -= delta;
                    if (this.timeRemaining <= 0) {
                        this.timeRemaining = 0;
                        this.pause();
                        this.onComplete();
                    }
                    this.onTick(this.getState());
                }
            }
            
            if (now - this.lastSavedTime > 1000) {
                this.saveState();
                this.lastSavedTime = now;
            }
        }, 30); // roughly 30 FPS for smooth centiseconds
    }

    _stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    checkDate() {
        const today = getLogicalDateStr();
        if (this.currentDate !== today) {
            this.dailyTotal = 0;
            this.laps = [];
            this.tags = {};
            this.timeElapsed = 0;
            this.currentDate = today;
            this.reset(); // This resets timeRemaining based on mode, pauses the timer, saves state, and calls onTick
        }
    }

    saveState() {
        localStorage.setItem('focusTimerState', JSON.stringify({
            mode: this.mode,
            timeRemaining: this.timeRemaining,
            timeElapsed: this.timeElapsed,
            dailyTotal: this.dailyTotal,
            laps: this.laps,
            tags: this.tags,
            currentTag: this.currentTag,
            isRunning: this.isRunning,
            currentDate: this.currentDate,
            lastTickTime: this.lastTickTime || Date.now()
        }));
    }

    start(broadcast = true) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTickTime = Date.now();
        this.saveState();
        this._startInterval();
        
        if (broadcast) this.broadcastAction('START');
    }

    pause(broadcast = true) {
        this.isRunning = false;
        this._stopInterval();
        this.saveState();
        this.onTick(this.getState());
        
        if (broadcast) this.broadcastAction('PAUSE');
    }

    lap(broadcast = true) {
        if (this.mode === 'stopwatch') {
            this.laps.push(this.timeElapsed);
            this.timeElapsed = 0; // Resets session, total keeps going
            this.saveState();
            this.onTick(this.getState());
            
            if (broadcast) this.broadcastAction('LAP');
        }
    }

    reset(broadcast = true) {
        this.pause(false);
        if (this.mode === 'pomodoro') {
            this.timeRemaining = 25 * 60 * 1000; 
        } else if (this.mode === 'break') {
            this.timeRemaining = 10 * 60 * 1000; 
        } else if (this.mode === 'stopwatch') {
            this.timeElapsed = 0;
            this.laps = [];
        }
        this.saveState();
        this.onTick(this.getState());
        
        if (broadcast) this.broadcastAction('RESET');
    }

    setMode(newMode, broadcast = true) {
        this.pause(false);
        this.mode = newMode;
        if (this.mode === 'pomodoro') {
            this.timeRemaining = 25 * 60 * 1000;
        } else if (this.mode === 'break') {
            this.timeRemaining = 10 * 60 * 1000;
        }
        this.saveState();
        this.onTick(this.getState());
        
        if (broadcast) this.broadcastAction('SET_MODE');
    }

    setTag(newTag, broadcast = true) {
        this.currentTag = newTag;
        this.saveState();
        this.onTick(this.getState());
        
        if (broadcast) this.broadcastAction('SET_TAG');
    }

    setDuration(seconds, broadcast = true) {
        this.pause(false);
        this.timeRemaining = seconds * 1000;
        this.saveState();
        this.onTick(this.getState());
        
        if (broadcast) this.broadcastAction('SET_DURATION');
    }

    static playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            // Create two oscillators for a bell-like tone
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(440, now + 0.5);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1320, now);
            osc2.frequency.exponentialRampToValueAtTime(660, now + 0.5);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 1.0);
            osc2.stop(now + 1.0);
            
            setTimeout(() => ctx.close(), 1500);
        } catch (e) {
            console.warn('Could not play chime:', e);
        }
    }

    getState() {
        return {
            mode: this.mode,
            isRunning: this.isRunning,
            timeRemaining: this.timeRemaining,
            timeElapsed: this.timeElapsed,
            dailyTotal: this.dailyTotal,
            laps: this.laps,
            tags: this.tags,
            currentTag: this.currentTag
        };
    }

    syncFromDb(dbDailyTotal, dbLaps, dbTags) {
        let updated = false;
        if (dbDailyTotal > this.dailyTotal) {
            this.dailyTotal = dbDailyTotal;
            updated = true;
        }
        if (dbLaps && dbLaps.length > this.laps.length) {
            this.laps = dbLaps;
            updated = true;
        }
        if (dbTags) {
            // merge tags taking max of each
            let tagsUpdated = false;
            for (const [tag, duration] of Object.entries(dbTags)) {
                if ((this.tags[tag] || 0) < duration) {
                    this.tags[tag] = duration;
                    tagsUpdated = true;
                }
            }
            if (tagsUpdated) updated = true;
        }
        if (updated) {
            this.saveState();
            this.onTick(this.getState());
        }
    }
}

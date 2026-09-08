# Focus10010 - Current Features List

## 1. Core Timer Capabilities
* **Pomodoro / Focus Mode**: Count-down timer designed for deep work. Includes quick presets (25m, 1h, 3h) and customizable durations.
* **Break Mode**: Count-down timer for resting. Includes quick presets (10m, 15m, 30m) and customizable durations.
* **Stopwatch Mode**: Infinite count-up timer tailored for continuous, unstructured work.
* **Lap Tracking**: Record individual laps exclusively in Stopwatch mode, maintaining a session history without interrupting the overall timer.

## 2. Cloud Synchronization & Database (Convex)
* **Continuous Background Sync**: Progress is securely backed up to the cloud every 10 seconds while running. You can safely close the window or experience a crash without losing your daily focus total.
* **Cross-Device Handoff**: Start the timer on your computer, pause, and pick it right back up on your phone. The app smartly pulls the latest database stats upon load to guarantee you're always looking at the most up-to-date total.
* **4:00 AM IST Rollover**: Time and daily totals logically reset to `0` exactly at 4:00 AM Indian Standard Time (instead of midnight) to cater to late-night productivity schedules.
* **Historical Stats Tracking**: Logs your total focus duration and detailed laps array per logical day.
* **Stats Leaderboard/History View**: View up to the last 7 days of focus history directly from the UI.

## 3. Immersive User Interface
* **Glassmorphic Aesthetics**: Modern design utilizing frosted glass panels, translucent dark backgrounds, and subtle glowing borders.
* **True Fullscreen Mode**: Expand the web app to fill the entire monitor, hiding the browser address bar and tabs while retaining full access to all your widgets and buttons. The fullscreen icon dynamically toggles to reflect the state.
* **Floating Mini Timer (Picture-in-Picture)**: Pop out an always-on-top floating mini timer with live Start/Pause, Mode switching, and Lap/Reset controls that float over any window or desktop app (press `P` or click the PiP button).
* **Mobile Responsiveness**: UI adapts beautifully to narrow phone screens. It leverages Dynamic Viewport Heights (`100dvh`) to prevent address bars from cutting off the screen, and neatly wraps and scales padding to avoid widget overlapping.
* **Custom Dynamic Font Scaling**: The giant timer uses huge display typography on desktop while scaling cleanly on mobile devices.

## 4. Productivity Widgets (Bottom Left Tray)
* **Todo / Tasks Widget**: Track your session's goals.
* **Ambient Sounds Widget**: Immerse in soothing sounds (Rain, Waves, Fire, White Noise).
* **Notes Widget**: Jot down quick thoughts without leaving your focus page.

## 5. Security & Account Management
* **Clerk Authentication**: Seamless, secure user login (supporting social sign-in providers).
* **Graceful Degradation**: Users who are not logged in can still use the local timer functionality via `localStorage` without hitting server walls.

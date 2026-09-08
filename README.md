# <div align="center">⏱️ VibeTimer</div>

<div align="center">
  <p><strong>Your Aesthetic, Flow-State Focus & Productivity Companion</strong></p>
  <p><em>Distraction-free Pomodoro, Ambient Lo-Fi Soundscapes, Picture-in-Picture Floating Mini Timer & Deep Focus Analytics.</em></p>

  <p>
    <a href="https://kpvibetimer.vercel.app/" target="_blank">
      <img src="https://img.shields.io/badge/🚀_Live_App-kpvibetimer.vercel.app-7928CA?style=for-the-badge&logo=vercel&logoColor=white" alt="Live App" />
    </a>
    &nbsp;
    <a href="https://github.com/Krish-Prasad09/VibeTimer/stargazers">
      <img src="https://img.shields.io/github/stars/Krish-Prasad09/VibeTimer?style=for-the-badge&color=ffd700&logo=github" alt="GitHub Stars" />
    </a>
    &nbsp;
    <a href="https://github.com/Krish-Prasad09/VibeTimer/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" />
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/PWA-Installable-FFA500?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
    <img src="https://img.shields.io/badge/Convex-Fullstack_Sync-FF6B6B?style=flat-square&logo=databricks&logoColor=white" alt="Convex Backend" />
  </p>
</div>

---

## ⚡ Quick Links

- 🌐 **Live Website**: [kpvibetimer.vercel.app](https://kpvibetimer.vercel.app/)
- 💻 **Source Repository**: [github.com/Krish-Prasad09/VibeTimer](https://github.com/Krish-Prasad09/VibeTimer)
- 🐛 **Report a Bug / Request a Feature**: [GitHub Issues](https://github.com/Krish-Prasad09/VibeTimer/issues)

---

## 🌟 Highlights & Features

| Feature | Description |
| :--- | :--- |
| ⏳ **Multi-Mode Focus Engine** | Classic 25/5 Pomodoro, configurable Short/Long breaks, and unbounded Stopwatch counting. |
| 📌 **Floating Mini Timer (PiP)** | Pin a live timer window always-on-top above IDEs, spreadsheets, and browsers with play/pause controls. |
| 🎧 **Ambient Lo-Fi Soundscapes** | Curated background audio including Rain, Campfire, Ocean Waves, Cafe, Night Forest, and Binaural Beats. |
| 📊 **Deep Analytics & Streaks** | Track daily focus sessions, weekly hours, visual heatmaps, and export your session history to JSON/CSV. |
| 📝 **Flow Scratchpad & Tasks** | Rapid-capture notes, checklists, and daily priorities right next to your active countdown. |
| 🎨 **Aesthetic Themes & Zen Mode** | Switch between Midnight Dark, Minimal Sand, Cyber Neon, and Zen Fullscreen mode. |
| ☁️ **Hybrid Local & Cloud Storage** | Works 100% offline with zero login required; optionally syncs to Convex backend when signed in. |

---

## ⌨️ Interactive Keyboard Shortcuts Cheatsheet

Control your entire workflow hands-free without breaking your focus:

| Action | Shortcut | Description |
| :--- | :---: | :--- |
| **Play / Pause** | <kbd>Space</kbd> | Starts or pauses current timer or stopwatch |
| **Floating Mini Timer** | <kbd>P</kbd> | Toggles always-on-top Picture-in-Picture window |
| **Zen Fullscreen** | <kbd>F</kbd> | Enters distraction-free full-screen mode |
| **Reset Timer** | <kbd>R</kbd> | Resets active mode back to starting duration |
| **Focus Mode** | <kbd>1</kbd> | Switches directly to Pomodoro focus session |
| **Short Break** | <kbd>2</kbd> | Switches to short recovery break |
| **Long Break** | <kbd>3</kbd> | Switches to restorative long break |
| **Stopwatch Mode** | <kbd>0</kbd> | Switches to open-ended count-up timer |

---

## 📌 Floating Mini Timer (Picture-in-Picture)

<details>
<summary><b>🔍 How the Floating Mini Timer works (Click to expand)</b></summary>
<br />

VibeTimer features a dual-layer Picture-in-Picture engine designed to work seamlessly across modern desktop browsers:

1. **Document Picture-in-Picture API** *(Chrome, Edge, Opera)*:
   - Spawns a floating, resizable mini-window above all other OS applications.
   - Contains live interactive buttons for **Play / Pause**, **Skip Session**, and live mode indicators.
2. **Canvas Stream Fallback** *(Firefox, Safari, Mobile)*:
   - Renders a 60 FPS graphical HUD on an offscreen HTML5 canvas streamed to a native video PiP element.
   - Updates countdown time, progress rings, and current mode in real time.

> **Shortcut Tip**: Press <kbd>P</kbd> anywhere on the page to immediately launch or close the mini timer!
</details>

---

## 📊 Analytics & Privacy-First Tracking

<details>
<summary><b>📈 Inspect your session stats (Click to expand)</b></summary>
<br />

- **Zero-Friction Guest Mode**: If you are not logged in, all session durations, completions, streaks, and timestamps are saved directly to your browser's `localStorage`.
- **Cloud Synchronization**: Connect your account via Convex to keep historical analytics synced across laptops, tablets, and mobile devices.
- **Export Capabilities**: Download full session logs in CSV or JSON format for your personal time-tracking records.
</details>

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite 6](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with modern CSS variables
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Convex](https://convex.dev/) (real-time serverless database & subscriptions)
- **Deployment**: [Vercel](https://vercel.com/) with SPA rewrite routing
- **PWA**: Configured with Web App Manifest and mobile viewport optimizations

---

## 🚀 Local Development Setup

Clone the repository and run the development server locally:

```bash
# 1. Clone the repository
git clone https://github.com/Krish-Prasad09/VibeTimer.git

# 2. Enter the project directory
cd VibeTimer

# 3. Install dependencies
npm install

# 4. (Optional) Set up Environment Variables
# Copy the template file and configure keys if using Convex backend or Clerk authentication:
cp .env.example .env.local

# 5. Start the Vite local server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to start your first session.

---

## ☁️ Deployment

### Deploy to Vercel in 1 Click

1. Fork or push this repository to your GitHub account.
2. Import the project in [Vercel Dashboard](https://vercel.com/new).
3. Set the build settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Deploy! The included `vercel.json` ensures client-side routing works smoothly across all routes like `/stats`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Built for high-performers, deep workers, and students worldwide.

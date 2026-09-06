export function generateFocusReport(period, fetchedData, userName) {
  if (!fetchedData) return;

  // ─── 1. Build lookup maps ──────────────────────────────────────────
  const dataMap = {};        // date → totalMs
  const tagMapByDate = {};   // date → { tagName → ms }

  fetchedData.forEach(d => {
    dataMap[d.date] = d.totalMs;
    if (d.tags) tagMapByDate[d.date] = d.tags;
  });

  // Reference date (shifted -4 h to align with the app's "day boundary")
  const dRef = new Date();
  dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000);

  // ─── 2. Determine date range ───────────────────────────────────────
  let periodDays, periodLabel, comparisonLabel;
  if (period === 'weekly') {
    periodDays = 7;
    periodLabel = 'Weekly';
    comparisonLabel = 'Last Week';
  } else if (period === 'monthly') {
    periodDays = 28;
    periodLabel = 'Monthly';
    comparisonLabel = 'Last Month';
  } else {
    periodDays = 365;
    periodLabel = 'All Time';
    comparisonLabel = 'Last Year';
  }

  const endDate = new Date(dRef);
  const startDate = new Date(dRef);
  startDate.setDate(startDate.getDate() - (periodDays - 1));
  const fmtDate = d => d.toISOString().split('T')[0];
  const formatShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatMedium = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ─── 3. Compute aggregate metrics ─────────────────────────────────
  let thisPeriodMs = 0;
  let lastPeriodMs = 0;
  const dailyRows = [];

  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const dateStr = fmtDate(d);
    const ms = dataMap[dateStr] || 0;
    thisPeriodMs += ms;

    dailyRows.push({
      date: dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      monthDay: formatShort(d),
      hours: Number((ms / 3600000).toFixed(2)),
      minutes: Math.round(ms / 60000),
      tags: tagMapByDate[dateStr] || {},
    });
  }

  for (let i = periodDays; i < periodDays * 2; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    lastPeriodMs += dataMap[fmtDate(d)] || 0;
  }

  const thisPeriodHours = Number((thisPeriodMs / 3600000).toFixed(2));
  const lastPeriodHours = Number((lastPeriodMs / 3600000).toFixed(2));
  const dailyAvgHours = Number((thisPeriodHours / periodDays).toFixed(2));
  let percentChange = 0;
  if (lastPeriodMs > 0) {
    percentChange = Math.round(((thisPeriodMs - lastPeriodMs) / lastPeriodMs) * 100);
  } else if (thisPeriodMs > 0) {
    percentChange = 100;
  }

  // Peak day
  let peakMs = 0, peakDate = 'None', peakHours = 0, peakDayName = '';
  dailyRows.forEach(r => {
    if (r.hours * 3600000 > peakMs) {
      peakMs = r.hours * 3600000;
      peakDate = r.monthDay;
      peakDayName = r.dayName;
      peakHours = r.hours;
    }
  });

  // Streaks
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const ms = dataMap[fmtDate(d)] || 0;
    if (i === 0 && ms < 1800000) continue;
    if (ms >= 1800000) currentStreak++;
    else if (i > 0) break;
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 364; i >= 0; i--) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    const ms = dataMap[fmtDate(d)] || 0;
    if (ms >= 1800000) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  // Consistency (last 30 days)
  let activeDays30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(dRef);
    d.setDate(d.getDate() - i);
    if ((dataMap[fmtDate(d)] || 0) > 0) activeDays30++;
  }
  const consistency = Math.round((activeDays30 / 30) * 100);

  // ─── 4. Build HTML ────────────────────────────────────────────────
  
  // Trend Colors
  const trendColorClass = percentChange >= 0 ? 'text-[#00FF00]' : 'text-[#FF0000]';
  const trendIcon = percentChange >= 0 ? 'trending_up' : 'trending_down';
  const trendSign = percentChange >= 0 ? '+' : '';

  // Generate Table Rows (Weekly/Monthly)
  const tableRowsHtml = dailyRows.map((r, i) => {
    const isEven = i % 2 !== 0; // matching 1st row (i=0) to odd bg
    const bgClass = isEven ? 'bg-theme-row-even' : 'bg-theme-row-odd';
    const isPeak = r.hours === peakHours && r.hours > 0;
    
    const dayNameClass = isPeak ? 'text-primary font-bold' : 'text-primary';
    const hoursClass = isPeak ? 'text-theme-cyan text-right font-bold' : (r.hours > 0 ? 'text-theme-neon-yellow text-right' : 'text-primary text-right');
    
    // Sort and format tags
    const sortedTags = Object.entries(r.tags).sort((a, b) => b[1] - a[1]);
    const tagsHtml = sortedTags.map(([t, ms], idx) => {
      const tagHours = Number((ms / 3600000).toFixed(2));
      const tagStr = `${t}: ${tagHours}h`;
      
      if (isPeak && idx === 0) {
        return `<span class="inline-block border border-theme-cyan text-theme-cyan px-2 py-0.5 mr-2 text-[12px] bg-theme-cyan/10">${tagStr}</span>`;
      }
      const margin = idx < sortedTags.length - 1 ? 'mr-2' : '';
      return `<span class="inline-block border border-outline-variant px-2 py-0.5 ${margin} text-[12px]">${tagStr}</span>`;
    }).join('');

    return `
      <tr class="${bgClass} border-b border-[#222222] hover:bg-theme-row-hover transition-colors">
        <td class="py-3 px-4 text-on-surface-variant">${r.monthDay}</td>
        <td class="py-3 px-4 ${dayNameClass}">${r.dayName}</td>
        <td class="py-3 px-4 ${hoursClass}">${r.hours}h</td>
        <td class="py-3 px-4 text-on-surface-variant">${tagsHtml || '-'}</td>
      </tr>
    `;
  }).join('');

  let htmlContent = '';

  if (period === 'allTime') {
    // ── ALL TIME CALCULATIONS ──
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthlyData = {}; // 'YYYY-MM' -> { ms, tags, days }
    for (let i = 0; i < 365; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[mStr]) monthlyData[mStr] = { ms: 0, tags: {}, days: 0, month: monthNames[d.getMonth()], year: d.getFullYear() };
      
      const dateStr = fmtDate(d);
      const ms = dataMap[dateStr] || 0;
      monthlyData[mStr].ms += ms;
      monthlyData[mStr].days += 1;
      
      const dayTags = tagMapByDate[dateStr] || {};
      for (const [t, tms] of Object.entries(dayTags)) {
         monthlyData[mStr].tags[t] = (monthlyData[mStr].tags[t] || 0) + tms;
      }
    }
    
    const monthlyArr = Object.entries(monthlyData).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 6);
    const ledgerHtml = monthlyArr.map(([mStr, data], idx) => {
       const hours = Number((data.ms / 3600000).toFixed(1));
       const avg = Number((hours / data.days).toFixed(1));
       const topTag = Object.entries(data.tags).sort((a,b) => b[1]-a[1])[0];
       const topTagName = topTag ? topTag[0] : 'None';
       const textClass = idx === 0 ? 'text-neon' : 'text-secondary';
       
       return `
        <tr class="hover:bg-surface-container-low transition-colors">
          <td class="py-4 px-6 font-medium">${data.month} ${data.year}</td>
          <td class="py-4 px-6 text-right font-mono ${textClass}">${hours}</td>
          <td class="py-4 px-6 text-right font-mono">${avg}h</td>
          <td class="py-4 px-6"><span class="px-2 py-1 bg-surface-container-high rounded text-xs border border-outline-variant/50">${topTagName}</span></td>
        </tr>
       `;
    }).join('');

    // Distribution — scoped to the report's period
    const periodTagSum = {};
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const tags = tagMapByDate[fmtDate(d)] || {};
      for (const [tag, ms] of Object.entries(tags)) {
        periodTagSum[tag] = (periodTagSum[tag] || 0) + ms;
      }
    }
    const periodTagTotal = Object.values(periodTagSum).reduce((a, b) => a + b, 0);
    const allSortedTags = Object.entries(periodTagSum).sort((a, b) => b[1] - a[1]);
    const top4Tags = allSortedTags.slice(0, 4);
    const colors = ['bg-neon', 'bg-[#D4AF37]', 'bg-outline-variant', 'bg-outline-variant'];
    const textColors = ['text-neon', 'text-gold', 'text-on-surface-variant', 'text-on-surface-variant'];
    const tagDistributionHtml = top4Tags.map(([t, ms], idx) => {
      const pct = periodTagTotal > 0 ? Math.round((ms / periodTagTotal) * 100) : 0;
      const color = colors[idx];
      const textColor = textColors[idx];
      const shadow = idx === 0 ? 'shadow-[0_0_8px_rgba(255,238,0,0.5)]' : '';
      return `
        <li class="flex flex-col gap-2">
          <div class="flex justify-between items-end">
            <span class="font-label-caps text-label-caps text-primary tracking-widest uppercase">${t}</span>
            <span class="font-mono ${textColor} font-bold text-sm">${pct}%</span>
          </div>
          <div class="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div class="h-full ${color} ${shadow}" style="width: ${pct}%"></div>
          </div>
        </li>
      `;
    }).join('');

    // Best Records
    let bestWeekMs = 0;
    for (let i=0; i <= 365 - 7; i++) {
       let wMs = 0;
       for (let j=0; j<7; j++) {
         const d = new Date(dRef);
         d.setDate(d.getDate() - (i + j));
         wMs += dataMap[fmtDate(d)] || 0;
       }
       bestWeekMs = Math.max(bestWeekMs, wMs);
    }
    const bestWeekHours = Number((bestWeekMs / 3600000).toFixed(1));

    let bestMonthMs = 0;
    for (let i=0; i <= 365 - 30; i++) {
       let mMs = 0;
       for (let j=0; j<30; j++) {
         const d = new Date(dRef);
         d.setDate(d.getDate() - (i + j));
         mMs += dataMap[fmtDate(d)] || 0;
       }
       bestMonthMs = Math.max(bestMonthMs, mMs);
    }
    const bestMonthHours = Math.round(bestMonthMs / 3600000);

    htmlContent = `<!DOCTYPE html><html class="dark" lang="en" style=""><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>VibeTimer Lifetime Analytics Report</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com" rel="preconnect">
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&amp;family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&amp;family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "primary-fixed-dim": "#d8ca00",
                      "on-error": "#690005",
                      "on-surface-variant": "#ccc7aa",
                      "surface-bright": "#393939",
                      "outline": "#969177",
                      "surface-container-low": "#1b1c1c",
                      "on-tertiary": "#003737",
                      "surface-container": "#1f2020",
                      "on-primary-fixed-variant": "#4e4800",
                      "inverse-primary": "#676000",
                      "tertiary-fixed": "#6cf7f7",
                      "surface-variant": "#353535",
                      "on-primary-fixed": "#1f1c00",
                      "on-secondary-fixed": "#241a00",
                      "primary-container": "#f7e600",
                      "on-tertiary-fixed-variant": "#004f50",
                      "surface-container-lowest": "#0e0e0e",
                      "on-secondary-fixed-variant": "#574500",
                      "tertiary": "#ffffff",
                      "surface-tint": "#d8ca00",
                      "background": "#131313",
                      "surface-container-highest": "#353535",
                      "primary": "#ffffff",
                      "on-background": "#e4e2e1",
                      "outline-variant": "#4a4731",
                      "error": "#ffb4ab",
                      "on-secondary-container": "#342800",
                      "on-surface": "#e4e2e1",
                      "on-secondary": "#3c2f00",
                      "on-tertiary-fixed": "#002020",
                      "tertiary-fixed-dim": "#49dada",
                      "on-error-container": "#ffdad6",
                      "on-primary-container": "#6e6600",
                      "tertiary-container": "#6cf7f7",
                      "surface-container-high": "#2a2a2a",
                      "secondary": "#e9c349",
                      "secondary-fixed-dim": "#e9c349",
                      "surface": "#131313",
                      "surface-dim": "#131313",
                      "secondary-container": "#af8d11",
                      "secondary-fixed": "#ffe088",
                      "inverse-on-surface": "#303030",
                      "inverse-surface": "#e4e2e1",
                      "primary-fixed": "#f7e600",
                      "error-container": "#93000a",
                      "on-primary": "#353100",
                      "on-tertiary-container": "#007070"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "spacing": {
                      "container-max": "1140px",
                      "section-gap": "80px",
                      "unit": "8px",
                      "gutter": "24px",
                      "margin-mobile": "16px"
              },
              "fontFamily": {
                      "headline-md": [
                              "Hanken Grotesk"
                      ],
                      "label-caps": [
                              "Geist"
                      ],
                      "display-lg": [
                              "Hanken Grotesk"
                      ],
                      "body-lg": [
                              "Inter"
                      ],
                      "metric-xl": [
                              "Geist"
                      ],
                      "display-lg-mobile": [
                              "Hanken Grotesk"
                      ],
                      "body-md": [
                              "Inter"
                      ]
              },
              "fontSize": {
                      "headline-md": [
                              "32px",
                              {
                                      "lineHeight": "40px",
                                      "letterSpacing": "-0.02em",
                                      "fontWeight": "600"
                              }
                      ],
                      "label-caps": [
                              "12px",
                              {
                                      "lineHeight": "16px",
                                      "letterSpacing": "0.1em",
                                      "fontWeight": "600"
                              }
                      ],
                      "display-lg": [
                              "72px",
                              {
                                      "lineHeight": "80px",
                                      "letterSpacing": "-0.04em",
                                      "fontWeight": "800"
                              }
                      ],
                      "body-lg": [
                              "18px",
                              {
                                      "lineHeight": "28px",
                                      "fontWeight": "400"
                              }
                      ],
                      "metric-xl": [
                              "48px",
                              {
                                      "lineHeight": "48px",
                                      "letterSpacing": "-0.05em",
                                      "fontWeight": "700"
                              }
                      ],
                      "display-lg-mobile": [
                              "40px",
                              {
                                      "lineHeight": "44px",
                                      "letterSpacing": "-0.02em",
                                      "fontWeight": "800"
                              }
                      ],
                      "body-md": [
                              "16px",
                              {
                                      "lineHeight": "24px",
                                      "fontWeight": "400"
                              }
                      ]
              }
            },
          },
        }
    </script>
<style>
        body {
            background-color: #121212; /* Fallback */
        }
        .glow-accent {
            box-shadow: 0 0 40px rgba(212, 175, 55, 0.05);
        }
        .bg-obsidian {
            background-color: #1a1a1a;
        }
        .border-gold {
            border-color: #D4AF37;
        }
        .text-gold {
            color: #D4AF37;
        }
        .text-neon {
            color: #FFEE00;
        }
        .bg-neon {
            background-color: #FFEE00;
        }
        
        /* Thin table borders for ledger look */
        .ledger-table th, .ledger-table td {
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .ledger-table tr:last-child td {
            border-bottom: none;
        }
        
        .a4-container {
            width: 100%;
            max-width: 794px;
            margin: 0 auto;
            background-color: #131313;
            min-height: 1123px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
        }

        @page { size: A4 portrait; margin: 0; }
        @media print {
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #131313; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .a4-container { width: 100% !important; max-width: none !important; min-height: 100vh !important; box-shadow: none !important; margin: 0 !important; }
        }
    </style>
</head>
<body class="antialiased py-8 bg-[#0a0a0a]">

<!-- Action Bar (No Print) -->
<div class="no-print fixed top-4 right-4 z-[999] flex gap-2">
    <button onclick="window.print()" class="bg-neon text-black px-4 py-2 rounded font-bold text-sm hover:opacity-90 flex items-center gap-2 shadow-lg">
        <span class="material-symbols-outlined text-[18px]">print</span> Print / Save PDF
    </button>
</div>

<div class="a4-container relative bg-background text-on-background font-body-md">

<!-- TopNavBar -->
<header class="bg-background w-full border-b border-outline-variant flat no shadows z-50">
<div class="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
<div class="font-headline-md text-headline-md font-bold text-primary-fixed-dim tracking-tight">
                VibeTimer AllTime Report
            </div>
<!-- Context: This is a standalone report, global nav hidden as per semantic shell mandate, but trailing actions kept as they are profile/settings -->
<div class="flex items-center gap-6">
<button aria-label="Account" class="text-on-surface-variant hover:text-primary-fixed-dim transition-colors opacity-80 transition-all flex items-center justify-center p-2 rounded-full hover:bg-surface-container-low">

</button>
<button aria-label="Settings" class="text-on-surface-variant hover:text-primary-fixed-dim transition-colors opacity-80 transition-all flex items-center justify-center p-2 rounded-full hover:bg-surface-container-low">

</button>
</div>
</div>
</header>
<!-- Main Content Canvas -->
<main class="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-12 md:py-20 flex flex-col gap-section-gap">
<!-- Header Section -->
<header class="flex flex-col gap-unit items-center text-center">
<p class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.1em]">Account Lifetime Summary</p>
<h1 class="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-primary mb-2">VibeTimer Lifetime Report</h1>
<p class="font-body-lg text-body-lg text-secondary flex items-center gap-2">
<span class="material-symbols-outlined text-sm">person</span>
                ${userName || 'Unknown'}
            </p>
</header>
<!-- Section 1 - Lifetime Milestones -->
<section class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
<div class="bg-obsidian border-l-2 border-gold rounded-DEFAULT p-8 md:p-12 flex flex-col justify-center items-start glow-accent relative overflow-hidden group">
<div class="absolute -right-10 -bottom-10 opacity-5 pointer-events-none transition-transform group-hover:scale-110 duration-700">
<span class="material-symbols-outlined text-[200px]" style="font-variation-settings: &quot;FILL&quot; 1;">timer</span>
</div>
<h2 class="font-label-caps text-label-caps text-on-surface-variant mb-4 uppercase tracking-wider">Total Lifetime Focus Hours</h2>
<div class="font-metric-xl text-metric-xl text-gold flex items-baseline gap-2">
                    ${thisPeriodHours.toLocaleString()} <span class="font-body-lg text-body-lg text-on-surface-variant font-normal tracking-normal">Hours</span>
</div>
</div>
<div class="bg-obsidian border-l-2 border-primary-fixed-dim rounded-DEFAULT p-8 md:p-12 flex flex-col justify-center items-start relative overflow-hidden group">
<div class="absolute -right-10 -bottom-10 opacity-5 pointer-events-none transition-transform group-hover:scale-110 duration-700">
<span class="material-symbols-outlined text-[200px]" style="font-variation-settings: &quot;FILL&quot; 1;">local_fire_department</span>
</div>
<h2 class="font-label-caps text-label-caps text-on-surface-variant mb-4 uppercase tracking-wider">All-Time Longest Streak</h2>
<div class="font-metric-xl text-metric-xl text-neon flex items-baseline gap-2">
                    ${longestStreak} <span class="font-body-lg text-body-lg text-on-surface-variant font-normal tracking-normal">Days</span>
</div>
</div>
</section>
<!-- Section 2 - Monthly Averages -->
<section class="flex flex-col gap-6">
<header class="flex items-center gap-4">
<h3 class="font-headline-md text-headline-md text-primary">Monthly Ledger</h3>
<div class="h-px bg-outline-variant flex-grow"></div>
<span class="font-label-caps text-label-caps text-on-surface-variant">LAST 6 MONTHS</span>
</header>
<div class="bg-obsidian rounded-DEFAULT overflow-x-auto p-1 border border-outline-variant/30">
<table class="w-full text-left ledger-table whitespace-nowrap">
<thead>
<tr>
<th class="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold">Month/Year</th>
<th class="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold text-right">Total Hours</th>
<th class="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold text-right">Daily Avg</th>
<th class="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold">Top Tag</th>
</tr>
</thead>
<tbody class="font-body-md text-body-md text-on-surface">
${ledgerHtml}
</tbody>
</table>
</div>
</section>
<!-- Section 3 - The Focus Profile -->
<section class="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
<!-- Column A: Tag Distribution -->
<div class="flex flex-col gap-6">
<header class="flex items-center gap-4">
<h3 class="font-headline-md text-headline-md text-primary">Distribution</h3>
<div class="h-px bg-outline-variant flex-grow"></div>
</header>
<div class="bg-obsidian rounded-DEFAULT p-8 border border-outline-variant/20 h-full flex flex-col justify-center">
<ul class="flex flex-col gap-6 w-full">
${tagDistributionHtml}
</ul>
</div>
</div>
<!-- Column B: Personal Records -->
<div class="flex flex-col gap-6">
<header class="flex items-center gap-4">
<h3 class="font-headline-md text-headline-md text-primary">Personal Records</h3>
<div class="h-px bg-outline-variant flex-grow"></div>
</header>
<div class="grid grid-cols-1 gap-4 h-full">
<div class="bg-obsidian border-l-2 border-gold/50 rounded-DEFAULT p-6 flex justify-between items-center transition-all hover:bg-surface-container-high hover:border-gold">
<div class="flex flex-col">
<span class="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Best Day</span>
<span class="font-body-md text-body-md text-on-surface">Peak Daily Output</span>
</div>
<div class="font-metric-xl text-metric-xl text-primary flex items-baseline gap-1">
                            ${peakHours}<span class="font-body-md text-body-md text-on-surface-variant font-normal">h</span>
</div>
</div>
<div class="bg-obsidian border-l-2 border-gold/70 rounded-DEFAULT p-6 flex justify-between items-center transition-all hover:bg-surface-container-high hover:border-gold">
<div class="flex flex-col">
<span class="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Best Week</span>
<span class="font-body-md text-body-md text-on-surface">Peak Weekly Output</span>
</div>
<div class="font-metric-xl text-metric-xl text-primary flex items-baseline gap-1">
                            ${bestWeekHours}<span class="font-body-md text-body-md text-on-surface-variant font-normal">h</span>
</div>
</div>
<div class="bg-obsidian border-l-2 border-gold rounded-DEFAULT p-6 flex justify-between items-center transition-all hover:bg-surface-container-high relative overflow-hidden glow-accent">
<div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
<div class="flex flex-col relative z-10">
<span class="font-label-caps text-label-caps text-gold mb-1 uppercase tracking-wider">Best Month</span>
<span class="font-body-md text-body-md text-primary">Peak Monthly Output</span>
</div>
<div class="font-metric-xl text-metric-xl text-gold flex items-baseline gap-1 relative z-10">
                            ${bestMonthHours}<span class="font-body-md text-body-md text-gold/70 font-normal">h</span>
</div>
</div>
</div>
</div>
</section>
</main>
<!-- Footer -->
<footer class="bg-surface-container-lowest full-width border-t border-outline-variant flat no shadows mt-auto">
<div class="flex flex-col md:flex-row justify-between items-center w-full px-gutter py-unit max-w-container-max mx-auto gap-4 py-8">

<nav class="flex flex-wrap justify-center gap-6">



</nav>
<div class="font-label-caps text-label-caps text-on-surface-variant opacity-50 text-center md:text-right">Generated by VibeTimer • <span id="timestamp">Jul 6, 2026, 07:36 PM GMT+5:30</span></div>
</div>
</footer>
<script>
        // Set timestamp for footer
        const now = new Date();
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
        document.getElementById('timestamp').textContent = now.toLocaleDateString('en-US', options);
    </script>
</div>
</body></html>`;

  } else if (period === 'monthly') {
    // ── MONTHLY TEMPLATE ──
    let weeklyAggregatesHtml = '';
    for (let w = 0; w < 4; w++) {
      let wMs = 0;
      const startDay = dailyRows[w * 7];
      const endDay = dailyRows[w * 7 + 6];
      for (let d = 0; d < 7; d++) {
         const dateStr = dailyRows[w * 7 + d].date;
         wMs += dataMap[dateStr] || 0;
      }
      const wHours = Number((wMs / 3600000).toFixed(1));
      const wAvg = Number((wHours / 7).toFixed(1));
      const dateRange = `${startDay.monthDay} - ${endDay.monthDay}`;
      const bgClass = w % 2 === 0 ? 'bg-[#0F0F0F]' : 'bg-[#161616]';
      weeklyAggregatesHtml += `
<tr class="${bgClass} border-b border-[#222222]">
<td class="py-3 px-4">${dateRange} (Week ${w + 1})</td>
<td class="py-3 px-4 text-right">${wHours}h</td>
<td class="py-3 px-4 text-right">${wAvg}h</td>
</tr>`;
    }

    const monthlyTagSum = {};
    for (let i = 0; i < 28; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const tags = tagMapByDate[fmtDate(d)] || {};
      for (const [tag, ms] of Object.entries(tags)) {
        monthlyTagSum[tag] = (monthlyTagSum[tag] || 0) + ms;
      }
    }
    const monthlyTagTotal = Object.values(monthlyTagSum).reduce((a, b) => a + b, 0);
    const sortedMonthlyTags = Object.entries(monthlyTagSum).sort((a,b) => b[1] - a[1]);
    const top3Tags = sortedMonthlyTags.slice(0, 3);
    const mColors = ['bg-primary-container', 'bg-tertiary-container', 'bg-surface-variant'];
    const mTagHtml = top3Tags.map(([t, ms], idx) => {
      const pct = monthlyTagTotal > 0 ? Math.round((ms / monthlyTagTotal) * 100) : 0;
      return `
<div class="w-full">
<div class="flex justify-between font-data-mono text-data-mono text-primary mb-2">
<span class="">${t}</span>
<span class="">${pct}%</span>
</div>
<div class="w-full bg-[#0F0F0F] h-2 rounded-full overflow-hidden">
<div class="${mColors[idx]} h-full" style="width: ${pct}%"></div>
</div>
</div>`;
    }).join('');

    const momColor = percentChange >= 0 ? 'primary-container' : 'error';
    const consistencyBadge = consistency >= 80 ? 'High' : consistency >= 50 ? 'Med' : 'Low';

    htmlContent = `<!DOCTYPE html><html class="dark" lang="en" style=""><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>VibeTimer Monthly Report</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;family=JetBrains+Mono:wght@500&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-error-container": "#ffdad6",
                        "on-tertiary-fixed-variant": "#004f50",
                        "on-secondary-fixed-variant": "#004f54",
                        "error-container": "#93000a",
                        "surface-variant": "#373527",
                        "surface-container-highest": "#373527",
                        "secondary-fixed": "#7df4ff",
                        "tertiary-fixed-dim": "#49dada",
                        "surface-container-high": "#2c2a1d",
                        "on-tertiary-fixed": "#002020",
                        "inverse-surface": "#e8e3ce",
                        "on-secondary-container": "#00686f",
                        "on-primary": "#353100",
                        "error": "#ffb4ab",
                        "on-surface": "#e8e3ce",
                        "on-error": "#690005",
                        "surface-bright": "#3c3a2b",
                        "surface-container-low": "#1d1c10",
                        "tertiary-fixed": "#6cf7f7",
                        "outline-variant": "#4a4731",
                        "surface-container": "#212013",
                        "on-tertiary": "#003737",
                        "on-surface-variant": "#ccc7aa",
                        "surface": "#151408",
                        "tertiary": "#ffffff",
                        "primary-fixed-dim": "#d8ca00",
                        "surface-dim": "#151408",
                        "on-primary-fixed-variant": "#4e4800",
                        "surface-tint": "#d8ca00",
                        "on-primary-fixed": "#1f1c00",
                        "secondary-container": "#00eefc",
                        "surface-container-lowest": "#100e04",
                        "tertiary-container": "#6cf7f7",
                        "primary": "#ffffff",
                        "on-secondary": "#00363a",
                        "primary-fixed": "#f7e600",
                        "on-primary-container": "#6e6600",
                        "primary-container": "#f7e600",
                        "on-secondary-fixed": "#002022",
                        "inverse-on-surface": "#333123",
                        "inverse-primary": "#676000",
                        "secondary": "#d3fbff",
                        "on-background": "#e8e3ce",
                        "secondary-fixed-dim": "#00dbe9",
                        "outline": "#969177",
                        "background": "#151408",
                        "on-tertiary-container": "#007070"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "page-margin": "48px",
                        "section-gap": "32px",
                        "table-row-height": "40px",
                        "element-gap": "16px",
                        "grid-gutter": "12px"
                    },
                    "fontFamily": {
                        "report-title": ["Inter"],
                        "label-caps": ["Inter"],
                        "headline-md": ["Inter"],
                        "headline-lg": ["Inter"],
                        "body-lg": ["Inter"],
                        "data-mono": ["JetBrains Mono"],
                        "body-md": ["Inter"]
                    },
                    "fontSize": {
                        "report-title": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
                        "label-caps": ["11px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }],
                        "headline-md": ["18px", { "lineHeight": "24px", "fontWeight": "600" }],
                        "headline-lg": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
                        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                        "data-mono": ["14px", { "lineHeight": "20px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                        "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }]
                    }
                }
            }
        }
    </script>
<style>
        body {
            background-color: #0F0F0F;
            color: #e8e3ce;
        }
        .a4-container {
            width: 100%;
            max-width: 794px; /* A4 width at 96 DPI approx */
            margin: 0 auto;
            background-color: #0F0F0F;
            min-height: 1123px; /* A4 height */
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
        }
        .glow-border {
            border: 1px solid rgba(247, 230, 0, 0.3);
            box-shadow: 0 0 10px rgba(247, 230, 0, 0.1);
        }
        .glow-border-cyan {
            border: 1px solid rgba(108, 247, 247, 0.3);
            box-shadow: 0 0 10px rgba(108, 247, 247, 0.1);
        }
        @page { size: A4 portrait; margin: 0; }
        @media print {
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #0F0F0F; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .a4-container { width: 100% !important; max-width: none !important; min-height: 100vh !important; box-shadow: none !important; margin: 0 !important; }
        }
    </style>
</head>
<body class="antialiased py-8">

<!-- Action Bar (No Print) -->
<div class="no-print absolute top-4 right-4 z-50 flex gap-2">
    <button onclick="window.print()" class="bg-primary-container text-black px-4 py-2 rounded font-bold text-sm hover:opacity-90 flex items-center gap-2">
        <span class="material-symbols-outlined text-[18px]">print</span> Print / Save PDF
    </button>
</div>

<div class="a4-container relative">
<!-- TopNavBar (Adapted for Monthly) -->
<header class="flex justify-between items-center w-full px-page-margin py-6 max-w-A4 mx-auto border-b border-outline-variant bg-background">
<div>
<h1 class="font-report-title text-report-title text-primary tracking-tighter">VibeTimer</h1>
<p class="font-label-caps text-label-caps text-on-surface-variant mt-1 uppercase">Monthly Report (28 Days)</p>
</div>
<div class="flex items-center gap-element-gap text-on-surface-variant font-data-mono text-data-mono">
<div class="flex flex-col text-right">
<span class="text-primary font-bold">${userName || 'Unknown'}</span>
<span class="text-xs">${formatShort(startDate)} - ${formatShort(endDate)}</span>
</div>
<div class="flex gap-4">
<span class="material-symbols-outlined cursor-pointer hover:text-secondary-fixed transition-colors">calendar_today</span>
<span class="material-symbols-outlined cursor-pointer hover:text-secondary-fixed transition-colors">account_circle</span>
</div>
</div>
</header>
<main class="flex-grow px-page-margin py-section-gap flex flex-col gap-section-gap">
<!-- Section 1: Monthly Overview -->
<section class="grid grid-cols-12 gap-grid-gutter">
<div class="col-span-8 bg-[#1A1A1A] border-t border-primary-container p-6 rounded flex flex-col justify-between">
<h2 class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4">Total Monthly Hours</h2>
<div class="flex items-end gap-4">
<span class="font-report-title text-[64px] leading-none text-primary tracking-tighter">${thisPeriodHours}<span class="text-primary-container">h</span></span>
</div>
</div>
<div class="col-span-4 bg-[#1A1A1A] border-t border-${momColor} p-6 rounded flex flex-col justify-between">
<h2 class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4">MoM Change</h2>
<div class="flex items-end gap-2">
<span class="material-symbols-outlined text-${momColor} text-3xl">${trendIcon}</span>
<span class="font-headline-lg text-headline-lg text-${momColor}">${trendSign}${percentChange}%</span>
</div>
</div>
</section>
<!-- Section 2: Weekly Aggregates -->
<section>
<h2 class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-4 pl-2 border-l-2 border-primary-container">Weekly Aggregates</h2>
<div class="bg-[#1A1A1A] rounded overflow-hidden">
<table class="w-full text-left">
<thead>
<tr class="bg-[#1A1A1A] border-b border-[#222222]">
<th class="font-label-caps text-label-caps text-primary py-3 px-4 uppercase">Date Range</th>
<th class="font-label-caps text-label-caps text-primary py-3 px-4 uppercase text-right">Total Hours</th>
<th class="font-label-caps text-label-caps text-primary py-3 px-4 uppercase text-right">Daily Average</th>
</tr>
</thead>
<tbody class="font-data-mono text-data-mono text-on-surface">
${weeklyAggregatesHtml}
</tbody>
</table>
</div>
</section>
<!-- Two Column Layout for Tags & Consistency -->
<section class="grid grid-cols-12 gap-grid-gutter">
<!-- Section 3: Tag Distribution -->
<div class="col-span-7 flex flex-col gap-4">
<h2 class="font-label-caps text-label-caps text-on-surface-variant uppercase pl-2 border-l-2 border-tertiary-container">Tag Distribution</h2>
<div class="bg-[#1A1A1A] p-6 rounded flex flex-col gap-6 glow-border-cyan h-full justify-center">
${mTagHtml || '<span class="text-on-surface-variant">No tags used</span>'}
</div>
</div>
<!-- Section 4: Consistency -->
<div class="col-span-5 flex flex-col gap-4">
<h2 class="font-label-caps text-label-caps text-on-surface-variant uppercase pl-2 border-l-2 border-primary-container">Consistency</h2>
<div class="bg-[#1A1A1A] p-6 rounded h-full flex flex-col justify-center gap-8 glow-border">
<div>
<div class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">30-Day Consistency</div>
<div class="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
                            ${consistency}% <span class="text-xs text-primary-container bg-primary-container/10 px-2 py-1 rounded">${consistencyBadge}</span>
</div>
</div>
<div>
<div class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Longest Streak</div>
<div class="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
                            ${longestStreak} Days <span class="material-symbols-outlined text-primary-container text-lg">local_fire_department</span>
</div>
</div>
</div>
</div>
</section>
</main>
<!-- Footer -->
<footer class="flex justify-between items-center w-full px-page-margin py-8 border-t border-outline-variant bg-background mt-auto">
<div class="font-label-caps text-label-caps text-on-surface-variant uppercase">Generated by VibeTimer • ${formatMedium(new Date())}</div>
<div class="flex gap-6 font-body-md text-body-md text-on-surface-variant">

</div>
</footer>
</div>

</body></html>`;

  } else {
    // ── WEEKLY TEMPLATE ──
    htmlContent = `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>VibeTimer ${periodLabel} Report</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@500&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "primary": "#ffffff",
                        "on-surface-variant": "#ccc7aa",
                        "outline-variant": "#4a4731",
                        "secondary-fixed": "#7df4ff",
                        "theme-bg": "#0F0F0F",
                        "theme-card": "#1A1A1A",
                        "theme-row-even": "#222222",
                        "theme-row-odd": "#0F0F0F",
                        "theme-row-hover": "#161616",
                        "theme-neon-yellow": "#FFEE00",
                        "theme-cyan": "#00eefc"
                    },
                    "spacing": {
                        "element-gap": "16px",
                        "page-margin": "48px",
                        "section-gap": "32px",
                        "A4-width": "210mm",
                        "A4-height": "297mm"
                    },
                    "fontFamily": {
                        "report-title": ["Inter"],
                        "data-mono": ["JetBrains Mono"],
                        "body-lg": ["Inter"],
                        "headline-md": ["Inter"],
                        "headline-lg": ["Inter"],
                        "label-caps": ["Inter"],
                        "body-md": ["Inter"]
                    },
                    "fontSize": {
                        "report-title": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
                        "data-mono": ["14px", { "lineHeight": "20px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                        "headline-md": ["18px", { "lineHeight": "24px", "fontWeight": "600" }],
                        "headline-lg": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
                        "label-caps": ["11px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }],
                        "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }]
                    }
                }
            }
        }
    </script>
    <style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #0F0F0F;
            color: #e8e3ce;
        }
        .grid-12 {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 12px;
        }
        .a4-container {
            width: 100%;
            max-width: 794px;
            margin: 0 auto;
            background-color: #0F0F0F;
            min-height: 1123px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
        }
        @page {
            size: A4 portrait;
            margin: 0;
        }
        @media print {
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #0F0F0F; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .a4-container { width: 100% !important; max-width: none !important; min-height: 100vh !important; box-shadow: none !important; margin: 0 !important; }
        }
    </style>
</head>
<body class="antialiased py-8 bg-[#0a0a0a]">
    
    <!-- Action Bar (No Print) -->
    <div class="no-print fixed top-4 right-4 z-[999] flex gap-2">
        <button onclick="window.print()" class="bg-theme-neon-yellow text-black px-4 py-2 rounded font-bold text-sm hover:opacity-90 flex items-center gap-2 shadow-lg">
            <span class="material-symbols-outlined text-[18px]">print</span> Print / Save PDF
        </button>
    </div>

<div class="bg-theme-bg shadow-2xl relative overflow-hidden a4-container">
    
    <!-- TopNavBar -->
    <header class="bg-theme-bg border-b border-outline-variant flex justify-between items-center w-full px-page-margin py-6 mx-auto">
        <div class="flex flex-col">
            <h1 class="font-report-title text-report-title text-primary tracking-tighter">VibeTimer ${periodLabel} Report</h1>
            <div class="flex items-center gap-4 mt-2">
                <div class="flex items-center gap-1 font-data-mono text-data-mono text-on-surface-variant">
                    <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                    <span>${formatShort(startDate)} - ${formatShort(endDate)}</span>
                </div>
                <div class="flex items-center gap-1 font-data-mono text-data-mono text-on-surface-variant">
                    <span class="material-symbols-outlined text-[16px]">account_circle</span>
                    <span>${userName || 'Unknown'}</span>
                </div>
            </div>
        </div>
        <div class="flex items-center gap-element-gap text-on-surface-variant">
            <div class="text-right">
                <p class="font-label-caps text-label-caps text-on-surface-variant">GENERATED</p>
                <p class="font-data-mono text-data-mono text-primary">${formatMedium(new Date())}</p>
            </div>
            <div class="flex gap-2">
                <div class="text-theme-cyan">
                    <span class="material-symbols-outlined">analytics</span>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="px-page-margin py-section-gap flex flex-col gap-section-gap pb-32">
        
        <!-- Section 2: Executive Summary Grid -->
        <section>
            <div class="grid-12">
                <div class="col-span-3 bg-theme-card border-t border-theme-neon-yellow p-4">
                    <p class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Total Hours</p>
                    <p class="font-headline-lg text-headline-lg text-primary">${thisPeriodHours}h</p>
                </div>
                <div class="col-span-3 bg-theme-card border-t border-theme-cyan p-4">
                    <p class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Daily Average</p>
                    <p class="font-headline-lg text-headline-lg text-primary">${dailyAvgHours}h</p>
                </div>
                <div class="col-span-3 bg-theme-card border-t border-theme-neon-yellow p-4 relative overflow-hidden">
                    <p class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">vs ${comparisonLabel}</p>
                    <p class="font-headline-lg text-headline-lg ${trendColorClass}">${trendSign}${percentChange}%</p>
                    <span class="material-symbols-outlined absolute -right-2 -bottom-4 text-[80px] ${trendColorClass} opacity-10" style="font-variation-settings: 'FILL' 1;">${trendIcon}</span>
                </div>
                <div class="col-span-3 bg-theme-card border-t border-theme-cyan p-4">
                    <p class="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Peak Day</p>
                    <p class="font-headline-lg text-headline-lg text-primary">${peakDayName ? peakDayName + ' - ' + peakHours + 'h' : 'None'}</p>
                </div>
            </div>
        </section>

        <!-- Section 3: Streak Insights -->
        <section class="grid-12">
            <div class="col-span-6 border border-theme-neon-yellow p-6 relative flex items-center justify-between group">
                <div class="absolute inset-0 bg-theme-neon-yellow opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div>
                    <p class="font-label-caps text-label-caps text-theme-neon-yellow uppercase tracking-widest mb-1">Current Streak</p>
                    <p class="font-headline-lg text-headline-lg text-primary">${currentStreak} Days</p>
                </div>
                <span class="material-symbols-outlined text-[48px] text-theme-neon-yellow" style="font-variation-settings: 'FILL' 1;">local_fire_department</span>
            </div>
            <div class="col-span-6 border border-theme-cyan p-6 relative flex items-center justify-between group">
                <div class="absolute inset-0 bg-theme-cyan opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div>
                    <p class="font-label-caps text-label-caps text-theme-cyan uppercase tracking-widest mb-1">30-Day Consistency</p>
                    <p class="font-headline-lg text-headline-lg text-primary">${consistency}%</p>
                </div>
                <span class="material-symbols-outlined text-[48px] text-theme-cyan" style="font-variation-settings: 'FILL' 1;">monitoring</span>
            </div>
        </section>

        <!-- Section 4: Daily Breakdown Table -->
        <section>
            <div class="w-full bg-theme-card rounded-sm overflow-hidden border-t border-theme-neon-yellow shadow-[0_0_15px_rgba(255,238,0,0.05)]">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-theme-card border-b border-[#222222]">
                            <th class="py-3 px-4 font-label-caps text-label-caps text-primary uppercase">Date</th>
                            <th class="py-3 px-4 font-label-caps text-label-caps text-primary uppercase">Day</th>
                            <th class="py-3 px-4 font-label-caps text-label-caps text-primary uppercase text-right">Hours Logged</th>
                            <th class="py-3 px-4 font-label-caps text-label-caps text-primary uppercase">Tags</th>
                        </tr>
                    </thead>
                    <tbody class="font-data-mono text-data-mono">
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer class="bg-theme-bg border-t border-outline-variant flex justify-between items-center w-full px-page-margin py-8 mt-auto">
        <div class="flex flex-col gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant tracking-widest">VibeTimer Analytics Methodology • Confidential Executive Report</span>
            <span class="font-body-md text-body-md text-on-surface-variant opacity-70">Day boundary offset by -4 hours. Streak requires >= 30 mins.</span>
        </div>
        <div class="flex gap-6">
            <span class="font-body-md text-body-md text-on-surface-variant opacity-70">VibeTimer</span>
        </div>
    </footer>
</div>
</body>
</html>`;
  }

  // ─── 5. Trigger Download ──────────────────────────────────────────
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `VibeTimer_${period}_report_${fmtDate(new Date())}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
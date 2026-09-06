const fs = require('fs');
let content = fs.readFileSync('src/pages/StatsPage.jsx', 'utf-8');

// 1. Imports
content = content.replace(
  "import React from 'react';",
  "import React, { useState, useMemo } from 'react';\nimport { useUser } from '@clerk/clerk-react';\nimport { useQuery } from 'convex/react';\nimport { api } from '../convex/_generated/api';"
);

// 2. Hook injection
const hookInjection = `
  const { user } = useUser();
  const fetchedData = useQuery(api.stats.getStats, user ? undefined : "skip");

  const [comparePeriod, setComparePeriod] = useState('weekly');
  const [compareOffset, setCompareOffset] = useState(1);

  const stats = useMemo(() => {
    if (!fetchedData) return null;

    const dataMap = {};
    const tagSum = {};
    fetchedData.forEach(d => {
      dataMap[d.date] = d.totalMs;
      if (d.tags) {
        for (const [tag, duration] of Object.entries(d.tags)) {
          tagSum[tag] = (tagSum[tag] || 0) + duration;
        }
      }
    });

    const dRef = new Date();
    dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000); 

    let thisWeekMs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      thisWeekMs += dataMap[d.toISOString().split('T')[0]] || 0;
    }

    let lastWeekMs = 0;
    for (let i = 7; i < 14; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      lastWeekMs += dataMap[d.toISOString().split('T')[0]] || 0;
    }

    const thisWeekHours = (thisWeekMs / 3600000).toFixed(1);
    const lastWeekHours = (lastWeekMs / 3600000).toFixed(1);
    const dailyAverage = (thisWeekMs / 3600000 / 7).toFixed(1);

    let percentChange = 0;
    if (lastWeekMs > 0) {
      percentChange = Math.round(((thisWeekMs - lastWeekMs) / lastWeekMs) * 100);
    } else if (thisWeekMs > 0) {
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
    } else {
      for (let i = 3; i >= 0; i--) {
        let currMs = 0; let prevMs = 0;
        for (let j = 0; j < 7; j++) {
           const d1 = new Date(dRef); d1.setDate(d1.getDate() - (i * 7 + j));
           currMs += dataMap[d1.toISOString().split('T')[0]] || 0;
           const d2 = new Date(dRef); d2.setDate(d2.getDate() - (i * 7 + j) - (compareOffset * 28));
           prevMs += dataMap[d2.toISOString().split('T')[0]] || 0;
        }
        maxChartMs = Math.max(maxChartMs, currMs, prevMs);
        barChartData.push({ label: \`W\${4 - i}\`, currMs, prevMs });
      }
    }

    const sortedTags = Object.entries(tagSum).sort((a,b) => b[1] - a[1]);
    const topTags = sortedTags.slice(0, 3).map(([name, ms]) => ({
      name, percent: Math.round((ms / Math.max(1, totalAllTimeMs)) * 100)
    }));

    return { thisWeekHours, lastWeekHours, dailyAverage, percentChange, totalAllTimeHours, bestDayStr, bestDayHours: (bestDayMs / 3600000).toFixed(1), heatmapDays, barChartData, maxChartMs, topTags };
  }, [fetchedData, comparePeriod, compareOffset]);

  const getHeatmapClass = (ms) => {
    if (ms >= 10800000) return "bg-primary-fixed box-glow";
    if (ms >= 3600000) return "bg-primary-fixed/60 border border-primary-fixed/80";
    if (ms > 0) return "bg-primary-fixed/30 border border-primary-fixed/50";
    return "bg-surface-container-high border border-outline-variant";
  };

  if (!user || !stats) {
    return <div className="fixed inset-0 bg-background text-primary-fixed flex flex-col items-center justify-center z-[100]">
      <div className="w-10 h-10 border-4 border-primary-fixed border-t-transparent rounded-full animate-spin mb-4"></div>
      Loading Analytics...
    </div>;
  }
`;

content = content.replace(
  'const navigate = useNavigate();',
  'const navigate = useNavigate();\n' + hookInjection
);

// Remove old getHeatmapClass function since we injected it
content = content.replace(/const getHeatmapClass = \(value\) => \{[\s\S]*?return "bg-surface-container-high border border-outline-variant";\n  \};/, '');

// 3. Grid Replacements
content = content.replace(
  /<div className=\"font-s-display-lg text-4xl md:text-5xl text-primary-fixed tabular-nums number-counter\" data-target=\"142\">142<\/div>/g,
  '<div className="font-s-display-lg text-4xl md:text-5xl text-primary-fixed tabular-nums number-counter">{stats.totalAllTimeHours}</div>'
);
content = content.replace(
  /<div className=\"font-s-display-lg text-4xl md:text-5xl text-primary tabular-nums\"><span className=\"number-counter\" data-target=\"2.1\">2.1<\/span>h<\/div>/g,
  '<div className="font-s-display-lg text-4xl md:text-5xl text-primary tabular-nums"><span className="number-counter">{stats.dailyAverage}</span>h</div>'
);
content = content.replace(
  /vs Last Month<\/div>\s*<div className=\"font-s-display-lg text-4xl md:text-5xl text-primary tabular-nums flex items-center\">\s*<span className=\"material-symbols-outlined text-primary-fixed mr-2 text-3xl\" data-icon=\"trending_up\">trending_up<\/span>\s*\+<span className=\"number-counter\" data-target=\"12\">12<\/span>%\s*<\/div>/g,
  'vs Last Period</div><div className="font-s-display-lg text-4xl md:text-5xl text-primary tabular-nums flex items-center"><span className={`material-symbols-outlined ${stats.percentChange >= 0 ? "text-primary-fixed" : "text-red-400"} mr-2 text-3xl`} data-icon={stats.percentChange >= 0 ? "trending_up" : "trending_down"}>{stats.percentChange >= 0 ? "trending_up" : "trending_down"}</span>{stats.percentChange >= 0 ? "+" : ""}<span className="number-counter">{stats.percentChange}</span>%</div>'
);
content = content.replace(
  /<div className=\"font-s-headline-lg text-3xl md:text-4xl text-primary mt-2\">Oct 12<\/div>\s*<div className=\"font-s-body-md text-on-surface mt-6 tabular-nums text-primary-fixed\">4.5h logged<\/div>/g,
  '<div className="font-s-headline-lg text-3xl md:text-4xl text-primary mt-2">{stats.bestDayStr}</div><div className="font-s-body-md text-on-surface mt-6 tabular-nums text-primary-fixed">{stats.bestDayHours}h logged</div>'
);

// 4. Focus Distribution Chart Replacement
const oldBarChart = /<div className=\"h-\\[300px\\] w-full flex items-end justify-between pt-8 pb-4 relative border-b border-outline-variant\">.*?<\/div>\s*<\/div>/s;
const newBarChart = `
          <div className="flex justify-between items-center w-full">
            <h3 className="font-s-headline-lg text-2xl text-primary">Focus Distribution</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1 text-sm text-on-surface-variant border border-outline-variant">
                <select className="bg-transparent outline-none cursor-pointer text-on-surface appearance-none" value={comparePeriod} onChange={e => { setComparePeriod(e.target.value); setCompareOffset(1); }}>
                  <option className="bg-surface" value="weekly">Weekly</option>
                  <option className="bg-surface" value="monthly">Monthly</option>
                </select>
                <div className="flex items-center gap-2 border-l border-outline-variant pl-3 ml-1">
                  <button onClick={() => setCompareOffset(o => o + 1)} className="hover:text-primary transition-colors flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                  <span className="text-xs w-20 text-center font-mono">{compareOffset} {comparePeriod === 'weekly' ? 'wk' : 'mo'} ago</span>
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
                      <div className="w-4 bg-surface-container-high border border-outline-variant rounded-t-sm transition-all" style={{height: \`\${prevHeight}%\`}}></div>
                      <div className="w-4 bg-primary-fixed rounded-t-sm box-glow bar-grow" style={{ height: \`\${currHeight}%\`, animationDelay: \`0.\${i + 1}s\` }}></div>
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
        </div>`;
content = content.replace(/<div className=\"flex justify-between items-center\">\s*<h3 className=\"font-s-headline-lg text-2xl text-primary\">Focus Distribution<\/h3>.*?<\/div>\s*<\/div>\s*<\/div>/s, newBarChart);

// 5. Heatmap replacement
const oldHeatmap = /<div className=\"grid grid-rows-7 gap-2 min-w-\\[700px\\] grid-flow-col pb-4\" id=\"heatmap-container\">.*?<\/div>/s;
const newHeatmap = `<div className="grid grid-rows-7 gap-2 min-w-[700px] grid-flow-col pb-4" id="heatmap-container">
            {stats.heatmapDays.map((day, index) => (
              <div 
                key={day.date} 
                className={\`w-5 h-5 rounded-sm transition-colors duration-300 \${getHeatmapClass(day.totalMs)} group relative cursor-pointer\`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-container-highest text-on-surface text-xs rounded border border-outline-variant whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {(day.totalMs / 3600000).toFixed(1)}h
                </div>
              </div>
            ))}
          </div>`;
content = content.replace(oldHeatmap, newHeatmap);

// 6. Tags replacement
const oldTags = /<ul className=\"font-s-label-sm text-sm text-outline space-y-3\">.*?<\/ul>/s;
const newTags = `<ul className="font-s-label-sm text-sm text-outline space-y-3">
                  {stats.topTags.map((tag, i) => (
                    <li key={tag.name} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-3"><span className={\`w-3 h-3 rounded-sm \${i === 0 ? 'bg-primary-fixed box-glow' : i === 1 ? 'bg-tertiary-fixed' : 'bg-secondary'}\`}></span> {tag.name}</span>
                      <span className="tabular-nums text-on-surface">{tag.percent}%</span>
                    </li>
                  ))}
                  {stats.topTags.length === 0 && <li className="text-on-surface-variant">No tags used yet</li>}
                </ul>`;
content = content.replace(oldTags, newTags);

fs.writeFileSync('src/pages/StatsPage.jsx', content);

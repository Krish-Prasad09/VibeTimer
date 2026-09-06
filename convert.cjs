const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'stitch_stats.html'), 'utf-8');

// Extract styles
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
let styles = styleMatch ? styleMatch[1] : '';

// Rename .glass-panel to .stats-glass-panel to avoid global conflicts
styles = styles.replace(/\.glass-panel/g, '.stats-glass-panel');
fs.mkdirSync(path.join(__dirname, 'src/pages'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'src/pages/StatsPage.css'), styles);

// Extract body
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
let bodyHtml = bodyMatch ? bodyMatch[1] : '';

// Convert HTML to JSX
// 1. replace class= with className=
bodyHtml = bodyHtml.replace(/class="/g, 'className="');
// 2. rename glass-panel to stats-glass-panel
bodyHtml = bodyHtml.replace(/stats-glass-panel/g, 'stats-glass-panel'); // wait, the original has class="glass-panel"
bodyHtml = bodyHtml.replace(/className="([^"]*)glass-panel([^"]*)"/g, 'className="$1stats-glass-panel$2"');
bodyHtml = bodyHtml.replace(/className="glass-panel"/g, 'className="stats-glass-panel"'); // fallback

// 3. self close img, hr, input, br
bodyHtml = bodyHtml.replace(/<img([^>]*?[^\/])>/g, '<img$1 />');
bodyHtml = bodyHtml.replace(/<input([^>]*?[^\/])>/g, '<input$1 />');
bodyHtml = bodyHtml.replace(/<br>/g, '<br />');
bodyHtml = bodyHtml.replace(/<hr([^>]*?[^\/])>/g, '<hr$1 />');

// 4. svg attributes
bodyHtml = bodyHtml.replace(/stroke-width/g, 'strokeWidth');
bodyHtml = bodyHtml.replace(/stroke-dasharray/g, 'strokeDasharray');
bodyHtml = bodyHtml.replace(/stroke-dashoffset/g, 'strokeDashoffset');
bodyHtml = bodyHtml.replace(/stroke-linecap/g, 'strokeLinecap');
bodyHtml = bodyHtml.replace(/fill-rule/g, 'fillRule');
bodyHtml = bodyHtml.replace(/clip-rule/g, 'clipRule');
bodyHtml = bodyHtml.replace(/viewbox/g, 'viewBox');
bodyHtml = bodyHtml.replace(/viewBox/gi, 'viewBox');
// inline styles: style="animation-delay: 0.1s" -> style={{ animationDelay: '0.1s' }}
bodyHtml = bodyHtml.replace(/style="([^"]*)"/g, (match, p1) => {
    let stylesObj = p1.split(';').filter(s => s.trim()).map(s => {
        let [key, val] = s.split(':');
        if (!key || !val) return '';
        key = key.trim().replace(/-([a-z])/g, (m, c) => c.toUpperCase());
        return `${key}: '${val.trim()}'`;
    }).filter(s => s).join(', ');
    return `style={{ ${stylesObj} }}`;
});

// Remove comments
bodyHtml = bodyHtml.replace(/<!--[\s\S]*?-->/g, '');

const componentStr = `import React from 'react';
import './StatsPage.css';

export default function StatsPage() {
  return (
    <div className="stats-page-container min-h-screen bg-background text-on-surface font-body-md pb-24">
      ${bodyHtml}
    </div>
  );
}
`;

fs.mkdirSync(path.join(__dirname, 'src/pages'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'src/pages/StatsPage.jsx'), componentStr);

console.log('Conversion complete.');

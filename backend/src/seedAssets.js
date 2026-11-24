import fs from 'node:fs';
import path from 'node:path';

export function ensureSeedAssets(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  const assets = {
    'seed-kundan-necklace.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8e3a3"/>
      <stop offset="50%" stop-color="#d4a238"/>
      <stop offset="100%" stop-color="#9e6d14"/>
    </linearGradient>
    <radialGradient id="ruby" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ff6b81"/>
      <stop offset="55%" stop-color="#b8142c"/>
      <stop offset="100%" stop-color="#6b0514"/>
    </radialGradient>
    <radialGradient id="pearl" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f3ece0"/>
      <stop offset="100%" stop-color="#cfc3b0"/>
    </radialGradient>
  </defs>
  <path d="M 65 40 Q 200 225 335 40" fill="none" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
  <path d="M 85 55 Q 200 205 315 55" fill="none" stroke="url(#gold)" stroke-width="6" stroke-dasharray="10 6"/>
  <g fill="url(#ruby)" stroke="url(#gold)" stroke-width="3">
    <ellipse cx="110" cy="95" rx="10" ry="13"/>
    <ellipse cx="145" cy="132" rx="11" ry="14"/>
    <ellipse cx="255" cy="132" rx="11" ry="14"/>
    <ellipse cx="290" cy="95" rx="10" ry="13"/>
  </g>
  <g transform="translate(200, 178)">
    <polygon points="0,-28 24,0 0,34 -24,0" fill="url(#gold)" stroke="#8c5f0f" stroke-width="2"/>
    <polygon points="0,-18 15,0 0,22 -15,0" fill="url(#ruby)"/>
    <circle cx="0" cy="48" r="9" fill="url(#pearl)" stroke="url(#gold)" stroke-width="2"/>
    <circle cx="-22" cy="36" r="7" fill="url(#pearl)" stroke="url(#gold)" stroke-width="2"/>
    <circle cx="22" cy="36" r="7" fill="url(#pearl)" stroke="url(#gold)" stroke-width="2"/>
    <circle cx="-42" cy="18" r="6" fill="url(#pearl)" stroke="url(#gold)" stroke-width="1.5"/>
    <circle cx="42" cy="18" r="6" fill="url(#pearl)" stroke="url(#gold)" stroke-width="1.5"/>
  </g>
</svg>`,
    'seed-crimson-lehenga.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="crimson" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b91c1c"/>
      <stop offset="50%" stop-color="#881337"/>
      <stop offset="100%" stop-color="#4c0519"/>
    </linearGradient>
    <linearGradient id="zari" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f3d68b"/>
      <stop offset="50%" stop-color="#d4a02c"/>
      <stop offset="100%" stop-color="#f3d68b"/>
    </linearGradient>
  </defs>
  <!-- Choli / Blouse -->
  <path d="M 145 55 L 175 45 Q 200 72 225 45 L 255 55 L 268 125 L 245 148 L 155 148 L 132 125 Z" fill="url(#crimson)" stroke="url(#zari)" stroke-width="4"/>
  <path d="M 155 140 L 245 140" stroke="url(#zari)" stroke-width="5" stroke-dasharray="6 4"/>
  <!-- Lehenga Skirt -->
  <path d="M 152 162 L 248 162 L 345 455 Q 200 485 55 455 Z" fill="url(#crimson)" stroke="url(#zari)" stroke-width="4"/>
  <!-- Gold pleats & border -->
  <path d="M 176 162 L 135 462 M 200 162 L 200 470 M 224 162 L 265 462" stroke="#d4a02c" stroke-width="1.5" opacity="0.45"/>
  <path d="M 68 420 Q 200 448 332 420" fill="none" stroke="url(#zari)" stroke-width="14"/>
  <path d="M 76 398 Q 200 424 324 398" fill="none" stroke="url(#zari)" stroke-width="4" stroke-dasharray="10 6"/>
  <!-- Dupatta drape -->
  <path d="M 145 55 Q 115 160 148 270 Q 175 245 170 155 Z" fill="#be123c" opacity="0.82" stroke="url(#zari)" stroke-width="2.5"/>
</svg>`,
    'seed-emerald-choker.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
  <defs>
    <linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="55%" stop-color="#ca8a04"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </linearGradient>
    <radialGradient id="emerald" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="55%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </radialGradient>
  </defs>
  <path d="M 75 95 Q 200 165 325 95 L 335 130 Q 200 205 65 130 Z" fill="url(#gold2)" stroke="#713f12" stroke-width="2"/>
  <g fill="url(#emerald)" stroke="#fef08a" stroke-width="2">
    <rect x="108" y="114" width="22" height="26" rx="4" transform="rotate(14 119 127)"/>
    <rect x="148" y="130" width="24" height="28" rx="4" transform="rotate(7 160 144)"/>
    <rect x="187" y="136" width="26" height="32" rx="5"/>
    <rect x="228" y="130" width="24" height="28" rx="4" transform="rotate(-7 240 144)"/>
    <rect x="270" y="114" width="22" height="26" rx="4" transform="rotate(-14 281 127)"/>
  </g>
  <g fill="url(#emerald)" stroke="url(#gold2)" stroke-width="2">
    <ellipse cx="200" cy="192" rx="10" ry="15"/>
    <ellipse cx="160" cy="182" rx="8" ry="12"/>
    <ellipse cx="240" cy="182" rx="8" ry="12"/>
  </g>
</svg>`,
    'seed-ivory-gown.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="ivory" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffdf9"/>
      <stop offset="50%" stop-color="#f3ead8"/>
      <stop offset="100%" stop-color="#dfd0b8"/>
    </linearGradient>
    <linearGradient id="champagne" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d6b47a"/>
      <stop offset="50%" stop-color="#f7e5be"/>
      <stop offset="100%" stop-color="#c49b56"/>
    </linearGradient>
  </defs>
  <path d="M 155 62 Q 178 88 200 72 Q 222 88 245 62 L 248 165 L 152 165 Z" fill="url(#ivory)" stroke="url(#champagne)" stroke-width="3"/>
  <rect x="150" y="160" width="100" height="14" rx="4" fill="url(#champagne)"/>
  <path d="M 152 174 L 248 174 L 330 462 Q 200 488 70 462 Z" fill="url(#ivory)" stroke="url(#champagne)" stroke-width="3"/>
  <path d="M 180 174 L 145 466 M 200 174 L 200 472 M 220 174 L 255 466" stroke="#c49b56" stroke-width="1.2" opacity="0.4"/>
  <circle cx="200" cy="167" r="5" fill="#fffdf9" stroke="#b08642" stroke-width="1.5"/>
</svg>`,
    'seed-temple-jhumkas.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
  <defs>
    <linearGradient id="gold3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <!-- Left Jhumka -->
  <g transform="translate(110, 60)">
    <circle cx="0" cy="0" r="22" fill="url(#gold3)" stroke="#78350f" stroke-width="2"/>
    <circle cx="0" cy="0" r="9" fill="#b91c1c"/>
    <path d="M -36 78 Q 0 18 36 78 Z" fill="url(#gold3)" stroke="#78350f" stroke-width="2"/>
    <line x1="-36" y1="78" x2="36" y2="78" stroke="#fef3c7" stroke-width="4"/>
    <circle cx="-26" cy="92" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="-13" cy="96" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="0" cy="98" r="5.5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="13" cy="96" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="26" cy="92" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
  </g>
  <!-- Right Jhumka -->
  <g transform="translate(250, 60)">
    <circle cx="0" cy="0" r="22" fill="url(#gold3)" stroke="#78350f" stroke-width="2"/>
    <circle cx="0" cy="0" r="9" fill="#b91c1c"/>
    <path d="M -36 78 Q 0 18 36 78 Z" fill="url(#gold3)" stroke="#78350f" stroke-width="2"/>
    <line x1="-36" y1="78" x2="36" y2="78" stroke="#fef3c7" stroke-width="4"/>
    <circle cx="-26" cy="92" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="-13" cy="96" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="0" cy="98" r="5.5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="13" cy="96" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="26" cy="92" r="5" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
  </g>
</svg>`,
    'seed-navy-sherwani.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="navy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="55%" stop-color="#172554"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#d4a02c"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
  </defs>
  <!-- Bandhgala Collar -->
  <path d="M 172 42 L 228 42 L 234 68 L 166 68 Z" fill="url(#navy)" stroke="url(#goldTrim)" stroke-width="3"/>
  <!-- Sherwani Body -->
  <path d="M 166 68 L 112 96 L 88 260 L 126 266 L 142 155 L 136 420 L 194 420 L 200 355 L 206 420 L 264 420 L 258 155 L 274 266 L 312 260 L 288 96 L 234 68 Z" fill="url(#navy)" stroke="url(#goldTrim)" stroke-width="3.5"/>
  <!-- Center placket & buttons -->
  <line x1="200" y1="68" x2="200" y2="355" stroke="url(#goldTrim)" stroke-width="4"/>
  <g fill="url(#goldTrim)">
    <circle cx="200" cy="105" r="4.5"/>
    <circle cx="200" cy="145" r="4.5"/>
    <circle cx="200" cy="185" r="4.5"/>
    <circle cx="200" cy="225" r="4.5"/>
    <circle cx="200" cy="265" r="4.5"/>
  </g>
</svg>`
  };

  for (const [filename, content] of Object.entries(assets)) {
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

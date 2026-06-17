// Genera racha.svg (ventana estilo Windows 95) con los datos de contribuciones
// del usuario, leídos desde la API GraphQL de GitHub.
//
// Uso:
//   GITHUB_TOKEN=<token> GH_LOGIN=<usuario> node scripts/generate-streak.mjs
//
// Sin GITHUB_TOKEN genera la tarjeta en cero (útil para el SVG inicial).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LOGIN = process.env.GH_LOGIN || "emi1i0";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "racha.svg");

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "streak-generator",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchDays(login) {
  const { user } = await gql(`query($login:String!){ user(login:$login){ createdAt } }`, { login });
  const startYear = new Date(user.createdAt).getFullYear();
  const now = new Date();
  const days = [];
  for (let y = startYear; y <= now.getFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString();
    const to = new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString();
    const data = await gql(
      `query($login:String!,$from:DateTime!,$to:DateTime!){
        user(login:$login){ contributionsCollection(from:$from,to:$to){
          contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`,
      { login, from, to }
    );
    for (const w of data.user.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) days.push({ date: d.date, count: d.contributionCount });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  // recorta días futuros (el calendario incluye la semana completa)
  const today = now.toISOString().slice(0, 10);
  return days.filter((d) => d.date <= today);
}

function analyze(days) {
  if (!days.length) return { total: 0, current: 0, currStart: null, currEnd: null, longest: 0, longStart: null, longEnd: null };
  const total = days.reduce((s, d) => s + d.count, 0);

  // racha actual (con día de gracia: si hoy aún está en 0, no la rompe)
  let current = 0, currStart = null, currEnd = null;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      if (!currEnd) currEnd = days[i].date;
      current++;
      currStart = days[i].date;
    } else if (i === days.length - 1) {
      continue; // hoy en 0 → día de gracia
    } else break;
  }

  // racha más larga
  let longest = 0, run = 0, tmpStart = null, longStart = null, longEnd = null;
  for (const d of days) {
    if (d.count > 0) {
      if (run === 0) tmpStart = d.date;
      run++;
      if (run > longest) { longest = run; longStart = tmpStart; longEnd = d.date; }
    } else run = 0;
  }
  return { total, current, currStart, currEnd, longest, longStart, longEnd };
}

function fmt(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MESES[m - 1]}`;
}
function range(a, b) {
  if (!a) return "—";
  return a === b ? fmt(a) : `${fmt(a)} - ${fmt(b)}`;
}

function render(s) {
  // ventana 495x200, escritorio teal + ventana gris con biseles + barra de título
  const c0 = 88, c1 = 247, c2 = 406; // centros de columnas
  const flame = (cx, cy) =>
    `<path d="M${cx},${cy - 16} C${cx + 9},${cy - 7} ${cx + 6},${cy + 2} ${cx},${cy + 3} C${cx - 6},${cy + 2} ${cx - 9},${cy - 7} ${cx},${cy - 16} Z" fill="#FF3030"/>
     <path d="M${cx},${cy - 9} C${cx + 4},${cy - 4} ${cx + 3},${cy + 1} ${cx},${cy + 2} C${cx - 3},${cy + 1} ${cx - 4},${cy - 4} ${cx},${cy - 9} Z" fill="#FFD23F"/>`;
  const groove = (x) =>
    `<line x1="${x}" y1="46" x2="${x}" y2="182" stroke="#808080" stroke-width="1"/>
     <line x1="${x + 1}" y1="46" x2="${x + 1}" y2="182" stroke="#ffffff" stroke-width="1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="551" height="256" viewBox="0 0 551 256" fill="none" role="img" aria-label="Racha de contribuciones">
  <defs>
    <linearGradient id="tbar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000080"/><stop offset="100%" stop-color="#1084d0"/>
    </linearGradient>
    <style>
      .num { font-family: Tahoma, Verdana, sans-serif; font-weight: bold; fill: #000080; }
      .lbl { font-family: Tahoma, Verdana, sans-serif; fill: #000000; }
      .dt  { font-family: Tahoma, Verdana, sans-serif; fill: #404040; }
      .ttl { font-family: Tahoma, Verdana, sans-serif; font-weight: bold; fill: #ffffff; }
    </style>
  </defs>

  <rect x="0" y="0" width="551" height="256" fill="#008080"/>

  <g transform="translate(28,28)">
  <!-- Ventana -->
  <rect x="8" y="8" width="479" height="184" fill="#c0c0c0"/>
  <path d="M8,192 L8,8 L487,8" stroke="#ffffff" stroke-width="2" fill="none"/>
  <path d="M8,192 L487,192 L487,8" stroke="#404040" stroke-width="2" fill="none"/>

  <!-- Barra de título -->
  <rect x="12" y="12" width="471" height="22" fill="url(#tbar)"/>
  <text class="ttl" x="20" y="28" font-size="13" letter-spacing="0.5">racha.exe</text>
  <rect x="464" y="14.5" width="16" height="16" fill="#c0c0c0" stroke="#404040" stroke-width="1"/>
  <path d="M467,18 L477,27 M477,18 L467,27" stroke="#000000" stroke-width="1.5"/>

  <!-- Divisores -->
  ${groove(167)}
  ${groove(327)}

  <!-- Columna 1: total -->
  <text class="num" x="${c0}" y="100" font-size="34" text-anchor="middle">${s.total}</text>
  <text class="lbl" x="${c0}" y="130" font-size="12" text-anchor="middle">Contribuciones</text>
  <text class="lbl" x="${c0}" y="146" font-size="12" text-anchor="middle">totales</text>

  <!-- Columna 2: racha actual (destacada) -->
  ${flame(c1, 58)}
  <circle cx="${c1}" cy="92" r="30" fill="none" stroke="#000080" stroke-width="3"/>
  <text class="num" x="${c1}" y="101" font-size="26" text-anchor="middle">${s.current}</text>
  <text class="lbl" x="${c1}" y="142" font-size="12" font-weight="bold" text-anchor="middle">Racha actual</text>
  <text class="dt"  x="${c1}" y="158" font-size="10" text-anchor="middle">${range(s.currStart, s.currEnd)}</text>

  <!-- Columna 3: racha más larga -->
  <text class="num" x="${c2}" y="100" font-size="34" text-anchor="middle">${s.longest}</text>
  <text class="lbl" x="${c2}" y="130" font-size="12" text-anchor="middle">Racha más larga</text>
  <text class="dt"  x="${c2}" y="148" font-size="10" text-anchor="middle">${range(s.longStart, s.longEnd)}</text>
  </g>
</svg>
`;
}

const stats = TOKEN ? analyze(await fetchDays(LOGIN)) : analyze([]);
writeFileSync(OUT, render(stats));
console.log(`racha.svg generado para ${LOGIN}:`, stats);

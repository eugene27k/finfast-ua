#!/usr/bin/env node
/**
 * Генератор архітектурної мапи для architecture.html
 *
 * Робить три речі:
 *  1. Сканує src/ і prisma/ — будує реальний інвентар вузлів (pages, api, lib, components, db models).
 *  2. Грепає fetch('/api/...') і import "@/lib/..." — будує ребра.
 *  3. Зливає з architecture.config.json (модулі, сценарії, потоки, зовнішні сервіси)
 *     і вписує результат як inline JSON у architecture.html.
 *
 * Запускати руками: node scripts/generate-architecture.js
 * Автоматично запускається через predev/prebuild у package.json.
 */

const fs = require("fs");
const path = require("path");

const ROOT       = path.join(__dirname, "..");
const SRC        = path.join(ROOT, "src");
const APP        = path.join(SRC, "app");
const API_ROOT   = path.join(APP, "api");
const LIB_DIR    = path.join(SRC, "lib");
const COMP_DIR   = path.join(SRC, "components");
const PRISMA     = path.join(ROOT, "prisma", "schema.prisma");
const CONFIG     = path.join(ROOT, "architecture.config.json");
const HTML_FILE  = path.join(ROOT, "architecture.html");

/* --------------------------- helpers --------------------------- */

function readAll(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAll(p, predicate));
    else if (predicate(p, entry.name)) out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).split(path.sep).join("/"); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* --------------------------- config --------------------------- */

if (!fs.existsSync(CONFIG)) {
  console.error(`[arch-gen] не знайдено ${rel(CONFIG)} — потрібен семантичний конфіг.`);
  process.exit(1);
}
const cfg = JSON.parse(read(CONFIG));

/* --------------------------- 1. scan --------------------------- */

const pageFiles = readAll(APP, (_p, n) => n === "page.tsx");
const apiFiles  = readAll(API_ROOT, (_p, n) => n === "route.ts");
const libFiles  = readAll(LIB_DIR, (_p, n) => n.endsWith(".ts"));
const compFiles = readAll(COMP_DIR, (_p, n) => n.endsWith(".tsx"));

const prismaSrc = fs.existsSync(PRISMA) ? read(PRISMA) : "";
const dbModels = [...prismaSrc.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]);

/* --------------------------- 2. build nodes --------------------------- */

const nodes = [];

// pages
function pageSlug(file) {
  let r = path.relative(APP, file).split(path.sep).join("/");
  // прибираємо `page.tsx` (з префіксом / або без, якщо файл — у корені)
  r = r.replace(/(^|\/)page\.tsx$/, "");
  // прибираємо групи маршрутизатора (app), (marketing) тощо
  r = r.replace(/\([^)]+\)\//g, "").replace(/^\([^)]+\)$/, "");
  return r || "home";
}
for (const f of pageFiles) {
  const slug = pageSlug(f);
  const url  = slug === "home" ? "/" : "/" + slug;
  nodes.push({
    id: "page-" + slug,
    group: "ui",
    kind: "page",
    name: capitalize(slug),
    sub: url,
    path: rel(f),
    url,
  });
}

// api
function apiSlug(file) {
  let r = path.relative(API_ROOT, file).split(path.sep).join("/");
  r = r.replace(/\/route\.ts$/, "");
  return r;
}
for (const f of apiFiles) {
  const slug = apiSlug(f);
  const url  = "/api/" + slug;
  const src  = read(f);
  const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b/g)].map(m => m[1]);
  const id = "api-" + slug.split("/").join("-");
  nodes.push({
    id,
    group: "api",
    kind: "api",
    name: (methods.length ? methods.join("/") + " " : "") + url,
    sub: methods.length ? methods.join(", ") : "",
    path: rel(f),
    url,
    methods,
  });
}

// lib
for (const f of libFiles) {
  const base = path.basename(f, ".ts");
  nodes.push({
    id: "lib-" + base.toLowerCase(),
    group: "lib",
    kind: "lib",
    name: "lib/" + base + ".ts",
    sub: "",
    path: rel(f),
  });
}

// components
for (const f of compFiles) {
  const base = path.basename(f, ".tsx");
  nodes.push({
    id: "comp-" + base.toLowerCase(),
    group: "comp",
    kind: "comp",
    name: base,
    sub: "",
    path: rel(f),
  });
}

// db
if (dbModels.length) {
  nodes.push({
    id: "db-sqlite",
    group: "db",
    kind: "db",
    name: "SQLite (Prisma)",
    sub: dbModels.join(" · "),
    path: rel(PRISMA),
  });
}

// externals + manual з конфіга
for (const ext of (cfg.externals || [])) nodes.push({ ...ext, kind: ext.kind || "external" });
for (const mn  of (cfg.manualNodes || [])) nodes.push({ ...mn,  kind: mn.kind  || "manual"   });

/* --------------------------- apply node overrides --------------------------- */
const overrides = cfg.nodeOverrides || {};
for (const n of nodes) if (overrides[n.id]) Object.assign(n, overrides[n.id]);

const nodesById = Object.fromEntries(nodes.map(n => [n.id, n]));

/* --------------------------- 3. build edges --------------------------- */

const edges = [];
const seen  = new Set();
function addEdge(from, to) {
  if (!from || !to || from === to) return;
  if (!nodesById[from] || !nodesById[to]) return;
  const k = from + "→" + to;
  if (seen.has(k)) return;
  seen.add(k); edges.push({ from, to });
}

// 3a. fetch('/api/...') у будь-якому js/tsx файлі
const allSources = [...pageFiles, ...compFiles, ...libFiles, ...apiFiles];
for (const f of allSources) {
  const src = read(f);
  const fetches = [...src.matchAll(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g)].map(m => m[1]);
  if (!fetches.length) continue;

  let fromId = sourceFileToNodeId(f);
  if (!fromId) continue;

  for (const url of fetches) {
    if (!url.startsWith("/api/")) continue;
    const apiPath = url.split("?")[0].replace(/^\/api\//, "").replace(/\/$/, "");
    const apiId = "api-" + apiPath.split("/").join("-");
    if (nodesById[apiId]) addEdge(fromId, apiId);
  }
}

// 3b. імпорти @/lib/* → ребра до lib-*
for (const f of [...apiFiles, ...compFiles, ...libFiles, ...pageFiles]) {
  const src = read(f);
  const fromId = sourceFileToNodeId(f);
  if (!fromId) continue;
  const libImports = [...src.matchAll(/from\s+['"](?:@\/lib\/|(?:\.{1,2}\/)+lib\/)([\w-]+)['"]/g)].map(m => m[1]);
  for (const lib of libImports) {
    const toId = "lib-" + lib.toLowerCase();
    if (nodesById[toId]) addEdge(fromId, toId);
  }
}

// 3c. імпорти @/components/* (page → comp та comp → comp)
for (const f of [...pageFiles, ...compFiles]) {
  const src = read(f);
  const fromId = sourceFileToNodeId(f);
  if (!fromId) continue;
  const compImports = [...src.matchAll(/from\s+['"](?:@\/components\/|(?:\.{1,2}\/)+components\/)([\w-]+)['"]/g)].map(m => m[1]);
  for (const c of compImports) {
    const compId = "comp-" + c.toLowerCase();
    if (nodesById[compId]) addEdge(compId, fromId); // компонент "вливається" у сторінку
  }
}

// 3d. Prisma: будь-що, що імпортує @/lib/prisma → ребро до db-sqlite
if (nodesById["lib-prisma"] && nodesById["db-sqlite"]) addEdge("lib-prisma", "db-sqlite");

// 3e. ручні ребра з конфіга
for (const e of (cfg.manualEdges || [])) addEdge(e.from, e.to);

function sourceFileToNodeId(f) {
  if (f.startsWith(API_ROOT)) {
    const slug = apiSlug(f);
    return "api-" + slug.split("/").join("-");
  }
  if (f.startsWith(LIB_DIR)) {
    return "lib-" + path.basename(f, ".ts").toLowerCase();
  }
  if (f.startsWith(COMP_DIR)) {
    return "comp-" + path.basename(f, ".tsx").toLowerCase();
  }
  if (f.startsWith(APP)) {
    return "page-" + pageSlug(f);
  }
  return null;
}

/* --------------------------- 4. auto layout (y per col) --------------------------- */

const groupToCol = { ui:"ui", comp:"comp", state:"comp", api:"api", lib:"lib", ext:"ext", db:"ext", store:"ext" };
// guaranteed колонки з конфіга
const COLS = cfg.cols || {
  ui:   { x:  8, label: "Pages" },
  comp: { x: 26, label: "Components" },
  api:  { x: 48, label: "API Routes" },
  lib:  { x: 70, label: "Lib / ORM" },
  ext:  { x: 90, label: "External · DB · Storage" },
};

const buckets = {};
for (const n of nodes) {
  if (!n.col) n.col = groupToCol[n.group] || "ui";
  (buckets[n.col] = buckets[n.col] || []).push(n);
}
// сортуємо вузли в колонці: ті що мають manual y — фіксовані, решта — за іменем
for (const col in buckets) {
  const arr = buckets[col];
  // спочатку manual y (зберігаємо)
  const fixed = arr.filter(n => Number.isFinite(n.y)).sort((a,b)=>a.y-b.y);
  const flow  = arr.filter(n => !Number.isFinite(n.y)).sort((a,b)=> a.name.localeCompare(b.name));

  // розкидаємо flow по вільних y, обходячи зайняті
  const STEP = 80;
  const START = 80;
  let cursor = START;
  function occupied(y) {
    return fixed.some(f => Math.abs(f.y - y) < 60);
  }
  for (const n of flow) {
    while (occupied(cursor)) cursor += STEP;
    n.y = cursor;
    cursor += STEP;
  }
}

/* --------------------------- 5. module assignment + items --------------------------- */

function matchAssignment(node) {
  const ma = cfg.moduleAssignment || {};
  if (Object.prototype.hasOwnProperty.call(ma, node.id)) return ma[node.id];
  return undefined;
}

const modulesData = JSON.parse(JSON.stringify(cfg.modules || []));
const moduleById = Object.fromEntries(modulesData.map(m => [m.id, m]));
const itemsByModule = {};
const orphans = [];

for (const node of nodes) {
  if (!["api", "page", "lib", "comp"].includes(node.kind)) continue;
  const modId = matchAssignment(node);
  if (modId === undefined) { orphans.push(node); continue; }
  if (modId === null) continue;          // явно «не в жодному модулі»
  if (!moduleById[modId]) continue;
  node.module = modId;                   // ← кешуємо, щоб arch-tooltip показав модуль
  (itemsByModule[modId] = itemsByModule[modId] || []).push(node);
}

// Заповнюємо items для модулів автоматично, якщо у конфізі вони не задані
for (const m of modulesData) {
  if (Array.isArray(m.items) && m.items.length) continue;
  const list = (itemsByModule[m.id] || []).slice().sort((a,b) => {
    const order = { page: 0, api: 1, comp: 2, lib: 3 };
    return (order[a.kind] - order[b.kind]) || a.name.localeCompare(b.name);
  });
  m.items = list.map(n => ({
    tag: { api: "API", page: "PAGE", lib: "LIB", comp: "COMP" }[n.kind] || "NODE",
    text: n.kind === "api"  ? n.url
        : n.kind === "page" ? (n.name + "  " + (n.url || ""))
        : n.kind === "lib"  ? n.name
        :                     n.name,
  }));
  if (!m.foot) m.foot = m.items.length + " елементів";
}

/* --------------------------- 6. build final data --------------------------- */

const data = {
  generatedAt: new Date().toISOString(),
  cols: COLS,
  nodes,
  edges,
  modules: modulesData,
  moduleEdges: cfg.moduleEdges || [],
  flows: cfg.flows || {},
  journeys: cfg.journeys || {},
};

/* --------------------------- 7. diagnostics --------------------------- */

const stats = { page: 0, api: 0, lib: 0, comp: 0, db: 0, external: 0, manual: 0 };
for (const n of nodes) stats[n.kind] = (stats[n.kind] || 0) + 1;
console.log(`[arch-gen] вузлів: ${nodes.length}  ·  page=${stats.page||0} api=${stats.api||0} lib=${stats.lib||0} comp=${stats.comp||0} db=${stats.db||0} ext=${stats.external||0} manual=${stats.manual||0}`);
console.log(`[arch-gen] ребер: ${edges.length}  ·  модулів: ${modulesData.length}  ·  потоків: ${Object.keys(data.flows).length}  ·  сценаріїв: ${Object.keys(data.journeys).length}`);

// Орфани — попередження
if (orphans.length) {
  console.warn(`[arch-gen] ⚠ ${orphans.length} вузлів без призначеного модуля (додай у architecture.config.json → moduleAssignment, або постав null щоб явно ігнорувати):`);
  for (const n of orphans) console.warn(`    ${n.id.padEnd(36)}  ${n.path || ""}`);
}

// Модулі без опису — попередження
const modulesNoDesc = modulesData.filter(m => !m.description || !m.description.trim());
if (modulesNoDesc.length) {
  console.warn(`[arch-gen] ⚠ ${modulesNoDesc.length} модулів без поля "description" (додай 2-3 речення українською у architecture.config.json → modules[].description):`);
  for (const m of modulesNoDesc) console.warn(`    ${m.id.padEnd(12)}  ${m.name}`);
}

// Перевірка: чи всі ID у flows/journeys/moduleAssignment/manualEdges існують
const allIds = new Set(nodes.map(n => n.id));
const allModIds = new Set(modulesData.map(m => m.id));
const danglingFlowSteps = [];
for (const [k, f] of Object.entries(data.flows)) {
  for (const s of (f.steps || [])) {
    if (!allIds.has(s.from)) danglingFlowSteps.push(`flow ${k}: невідомий from "${s.from}"`);
    if (!allIds.has(s.to))   danglingFlowSteps.push(`flow ${k}: невідомий to   "${s.to}"`);
  }
}
const danglingJourneySteps = [];
for (const [k, j] of Object.entries(data.journeys)) {
  for (const s of (j.steps || [])) {
    if (!allModIds.has(s.module)) danglingJourneySteps.push(`journey ${k}: невідомий module "${s.module}"`);
  }
}
const danglingAssignments = [];
for (const id of Object.keys(cfg.moduleAssignment || {})) {
  if (!allIds.has(id)) danglingAssignments.push(id);
}
if (danglingFlowSteps.length || danglingJourneySteps.length || danglingAssignments.length) {
  console.warn(`[arch-gen] ⚠ є посилання на неіснуючі вузли/модулі у конфізі:`);
  for (const x of danglingFlowSteps) console.warn("    " + x);
  for (const x of danglingJourneySteps) console.warn("    " + x);
  for (const x of danglingAssignments) console.warn(`    moduleAssignment: вузла "${x}" немає (можливо файл перейменовано/видалено)`);
}

/* --------------------------- 8. inject у HTML --------------------------- */

if (!fs.existsSync(HTML_FILE)) {
  console.error(`[arch-gen] не знайдено ${rel(HTML_FILE)} — пропускаю інжект.`);
  process.exit(1);
}
const html = read(HTML_FILE);
const json = JSON.stringify(data, null, 2);
const block = `<script id="arch-data" type="application/json">\n${json}\n</script>`;

const re = /<script id="arch-data" type="application\/json">[\s\S]*?<\/script>/;
let next;
if (re.test(html)) {
  next = html.replace(re, block);
} else {
  // вставимо перед першим інлайн <script>
  next = html.replace(/<script>/, block + "\n<script>");
}
if (next !== html) {
  fs.writeFileSync(HTML_FILE, next);
  console.log(`[arch-gen] ✓ записано у ${rel(HTML_FILE)}`);
} else {
  console.log(`[arch-gen] = ${rel(HTML_FILE)} без змін`);
}

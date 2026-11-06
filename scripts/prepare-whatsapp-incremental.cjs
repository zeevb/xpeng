const fs = require('node:fs');
const path = require('node:path');

const [repoDir, sourcePath, outputPath] = process.argv.slice(2);
if (!repoDir || !sourcePath || !outputPath) {
  throw new Error('Usage: node prepare-whatsapp-incremental.cjs <repo> <source> <output>');
}

const rawDir = path.join(repoDir, 'raw-data');
// Read dated mobile snapshots and browser checkpoints in the organized layout.
// Also accept legacy files directly in raw-data for older/manual exports.
function filesBelow(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(dir, entry.name);
    return entry.isDirectory() ? filesBelow(filename) : entry.isFile() ? [filename] : [];
  });
}
const legacyFiles = fs.existsSync(rawDir)
  ? fs.readdirSync(rawDir, { withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => path.join(rawDir, entry.name))
  : [];
const exportFiles = [...legacyFiles, ...filesBelow(path.join(rawDir, 'exports'))];
const mobileFiles = [...legacyFiles, ...filesBelow(path.join(rawDir, 'chats'))];
const cutoffs = new Map();
const remember = (name, value) => {
  const date = new Date(value);
  if (!name || Number.isNaN(date.valueOf())) return;
  if (!cutoffs.has(name) || date > new Date(cutoffs.get(name))) cutoffs.set(name, date.toISOString());
};

for (const filename of exportFiles) {
  if (!/^xpeng_whatsapp_export(?:-.*)?\.json$/.test(path.basename(filename))) continue;
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const group of data.groups || []) {
      // A partial run cannot establish continuous coverage. Legacy exports
      // lack an exact verified watermark and must never advance a mobile cutoff.
      if (['incremental_complete', 'incremental_up_to_date'].includes(group.status)
          && group.incrementalBoundaryReached && group.coveredThrough) {
        remember(group.name, group.coveredThrough);
      }
    }
  } catch {
    // Ignore malformed or interrupted files; valid checkpoints remain usable.
  }
}

for (const filename of mobileFiles) {
  const match = /^WhatsApp Chat with (.+)\.txt$/.exec(path.basename(filename));
  if (!match) continue;
  const text = fs.readFileSync(filename, 'utf8');
  const timestamp = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/gm;
  let latest = null;
  for (let item; (item = timestamp.exec(text));) {
    let year = Number(item[3]);
    if (year < 100) year += 2000;
    // These mobile exports use month/day/year and Israel local time.
    const date = new Date(year, Number(item[1]) - 1, Number(item[2]),
      Number(item[4]), Number(item[5]), Number(item[6] || 0));
    if (!Number.isNaN(date.valueOf()) && (!latest || date > latest)) latest = date;
  }
  // Mobile timestamps have minute precision: overlap the last minute so a
  // later message in that minute cannot be lost.
  if (latest) remember(match[1], new Date(latest.valueOf() - 1));
}

const marker = 'const previousExports = {}; // __XPENG_PREVIOUS_EXPORTS__';
const source = fs.readFileSync(sourcePath, 'utf8');
if (!source.includes(marker)) throw new Error('Incremental export marker not found');
const values = Object.fromEntries([...cutoffs].sort(([a], [b]) => a.localeCompare(b)));
const generated = source.replace(marker,
  `const previousExports = ${JSON.stringify(values)}; // generated from raw-data`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, generated, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);

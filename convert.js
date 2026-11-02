// Usage: node convert.js path/to/your-old-mcq.html
// Creates data/itt.json from your existing rawData, and an empty data/ca.json.
const fs = require('fs');
const t = fs.readFileSync(process.argv[2], 'utf8');
const s = t.indexOf('const rawData = [') + 16;
const e = t.indexOf('];', s) + 1;
const raw = new Function('return ' + t.slice(s, e))();
const names = { WO: 'MS Word', PP: 'MS PowerPoint', EX: 'MS Excel', AC: 'MS Access & SQL', ID: 'CaseWare IDEA', ST: 'Statutory Taxes & GST', ZO: 'Zoho Suites', TL: 'Tally Prime', DB: 'Oracle Fusion ERP' };
const out = raw.map(([c, id, q, a, b, c2, d, ans]) => ({ id, ch: names[c], q, o: [a, b, c2, d], a: 'ABCD'.indexOf(ans.trim()) }));
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/itt.json', JSON.stringify(out));
if (!fs.existsSync('data/ca.json')) fs.writeFileSync('data/ca.json', '[]');
console.log(out.length + ' questions written to data/itt.json');

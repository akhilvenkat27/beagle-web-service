const fs = require('fs');
const path = require('path');

const EXT = new Set(['.js', '.jsx', '.css', '.tsx', '.ts']);
const SRC = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(name))) out.push(p);
  }
  return out;
}

function apply(s) {
  let t = s;
  // exact phrases
  t = t.replace(/bg-white\b/g, 'bg-paper');
  t = t.replace(/text-white\b/g, 'text-paper');
  t = t.replace(/border-white\b/g, 'border-paper');
  t = t.replace(/ring-white\b/g, 'ring-paper');
  t = t.replace(/divide-white\b/g, 'divide-paper');
  t = t.replace(/stroke-white\b/g, 'stroke-paper');
  t = t.replace(/fill-white\b/g, 'fill-paper');
  t = t.replace(/from-white\b/g, 'from-paper');
  t = t.replace(/to-white\b/g, 'to-paper');
  t = t.replace(/via-white\b/g, 'via-paper');
  t = t.replace(/outline-white\b/g, 'outline-paper');
  t = t.replace(/caret-white\b/g, 'caret-paper');
  t = t.replace(/decoration-white\b/g, 'decoration-paper');
  t = t.replace(/shadow-white\b/g, 'shadow-paper');
  t = t.replace(/bg-black\/([0-9]+)/g, 'bg-ink-950/$1');
  t = t.replace(/bg-black\b/g, 'bg-ink-950');
  t = t.replace(/text-black\b/g, 'text-ink-950');
  t = t.replace(/border-black\b/g, 'border-ink-950');
  t = t.replace(/ring-black\b/g, 'ring-ink-950');
  t = t.replace(/from-black\b/g, 'from-ink-950');
  t = t.replace(/to-black\b/g, 'to-ink-950');
  t = t.replace(/bg-black bg-opacity-50/g, 'bg-ink-950/50');
  // chromatic utility families → semantic tokens
  const pairs = [
    ['gray-', 'ink-'],
    ['slate-', 'ink-'],
    ['zinc-', 'ink-'],
    ['stone-', 'ink-'],
    ['neutral-', 'ink-'],
    ['red-', 'risk-'],
    ['rose-', 'risk-'],
    ['orange-', 'caution-'],
    ['amber-', 'caution-'],
    ['yellow-', 'caution-'],
    ['lime-', 'success-'],
    ['green-', 'success-'],
    ['emerald-', 'success-'],
    ['teal-', 'link-'],
    ['cyan-', 'link-'],
    ['sky-', 'link-'],
    ['blue-', 'link-'],
    ['indigo-', 'focus-'],
    ['violet-', 'accent-'],
    ['fuchsia-', 'accent-'],
    ['pink-', 'accent-'],
    ['purple-', 'accent-'],
  ];
  for (const [a, b] of pairs) {
    t = t.split(a).join(b);
  }
  return t;
}

let n = 0;
for (const f of walk(SRC)) {
  const before = fs.readFileSync(f, 'utf8');
  const after = apply(before);
  if (after !== before) {
    fs.writeFileSync(f, after, 'utf8');
    n++;
  }
}
console.log('Updated files:', n);

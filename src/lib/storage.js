const KEY = 'pab-sim-v1';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadState() {
  if (typeof localStorage === 'undefined') return { history: {}, attempts: [] };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { history: {}, attempts: [] };
  const s = safeParse(raw);
  return s || { history: {}, attempts: [] };
}

export function saveState(s) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function recordAnswer(questionId, correct) {
  const s = loadState();
  const rec = s.history[questionId] || { seen: 0, correct: 0, wrong: 0 };
  rec.seen++;
  if (correct) rec.correct++; else rec.wrong++;
  rec.lastCorrect = !!correct;
  rec.lastSeen = new Date().toISOString();
  s.history[questionId] = rec;
  saveState(s);
}

export function recordAttempt(attempt) {
  const s = loadState();
  s.attempts = s.attempts || [];
  s.attempts.unshift(attempt);
  s.attempts = s.attempts.slice(0, 30);
  saveState(s);
}

export function clearAll() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}

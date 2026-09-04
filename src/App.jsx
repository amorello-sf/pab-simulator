import React, { useCallback, useEffect, useMemo, useState } from 'react';
import bundle from './data/questions.json';
import { shuffle, arraysEqualUnordered, sampleByBlueprint } from './lib/sampling.js';
import { loadState, recordAnswer, recordAttempt, clearAll } from './lib/storage.js';
import { Question, Navigator } from './components/Quiz.jsx';

const AREA_NAMES = bundle.meta.areas.map(a => a.name);
const DIFFS = ['easy', 'medium', 'hard'];
const COUNT_PRESETS = ['10', '20', '40', '60', '100', 'all', 'custom'];
const EXAM_TARGET = 60;
const EXAM_MINUTES = 105;

/* -------------------- Header -------------------- */
function Header({ mode, subtitle, timer, timerClass, onHome }) {
  return (
    <header className="header">
      <div>
        <div className="title">Salesforce PAB — Practice Simulator</div>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="status">
        <span className="badge">{mode}</span>
        <span className={`badge timer ${timerClass}`}>{timer}</span>
        <button className="btn ghost" onClick={onHome}>Home</button>
      </div>
    </header>
  );
}

/* -------------------- Home -------------------- */
function Home({ onGo }) {
  return (
    <section className="card">
      <h1>Choose a mode</h1>
      <p className="lead">
        Practice against the full 240-question bank aligned to Salesforce SU'26, then move to
        timed exam simulations when you're ready.
      </p>
      <div className="grid">
        <div className="mode-card" onClick={() => onGo('study-config')}>
          <div className="title">📚 Study mode</div>
          <div className="desc">
            Instant feedback with detailed explanations. Filter by area, difficulty, or
            previously missed. Choose exactly how many questions to attempt — the bank
            samples them proportionally across the exam blueprint.
          </div>
        </div>
        <div className="mode-card" onClick={() => onGo('exam-config')}>
          <div className="title">🎯 Exam mode</div>
          <div className="desc">
            60 randomized questions weighted by the official blueprint, 105-minute timer,
            feedback only at the end. Passing score 73%.
          </div>
        </div>
        <div className="mode-card" onClick={() => onGo('weak')}>
          <div className="title">🎯 Weak areas review</div>
          <div className="desc">
            Re-attempt only the questions you've missed in prior sessions. Sharpens the
            gaps before the real exam.
          </div>
        </div>
        <div className="mode-card" onClick={() => onGo('stats')}>
          <div className="title">📊 Your stats</div>
          <div className="desc">
            Lifetime accuracy per area and every exam attempt you've completed on this
            device.
          </div>
        </div>
      </div>
      <div className="persistence-info">
        Progress stays in this browser only (localStorage). Nothing leaves the device.
      </div>
    </section>
  );
}

/* -------------------- Study config -------------------- */
function StudyConfig({ onStart, onBack }) {
  const [selectedAreas, setSelectedAreas] = useState(new Set(AREA_NAMES));
  const [selectedDiffs, setSelectedDiffs] = useState(new Set(DIFFS));
  const [countMode, setCountMode] = useState('all');
  const [customCount, setCustomCount] = useState(30);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleOpts, setShuffleOpts] = useState(true);
  const [onlyMissed, setOnlyMissed] = useState(false);

  const pool = useMemo(() => {
    const state = loadState();
    let p = bundle.questions.filter(q =>
      selectedAreas.has(q.area) && selectedDiffs.has(q.difficulty)
    );
    if (onlyMissed) {
      p = p.filter(q => {
        const h = state.history[q.id];
        return h && (h.wrong > 0 || h.lastCorrect === false);
      });
    }
    return p;
  }, [selectedAreas, selectedDiffs, onlyMissed]);

  const target = useMemo(() => {
    if (pool.length === 0) return 0;
    if (countMode === 'all') return pool.length;
    if (countMode === 'custom') {
      const n = parseInt(customCount, 10);
      if (!Number.isFinite(n) || n < 1) return pool.length;
      return Math.min(n, pool.length);
    }
    return Math.min(parseInt(countMode, 10), pool.length);
  }, [countMode, customCount, pool.length]);

  // Deterministic (weight-only) preview so the split doesn't reshuffle on every render.
  const previewSplit = useMemo(() => {
    if (pool.length === 0 || target === 0) return [];
    const areaMeta = bundle.meta.areas.filter(a => selectedAreas.has(a.name));
    const totalWeight = areaMeta.reduce((s, a) => s + a.weight, 0) || 1;
    if (target >= pool.length) {
      return areaMeta.map(a => ({
        name: a.name,
        n: pool.filter(q => q.area === a.name).length,
      })).filter(x => x.n > 0);
    }
    // Same largest-remainder math as sampleByBlueprint, without shuffling
    const byAreaPool = Object.fromEntries(
      areaMeta.map(a => [a.name, pool.filter(q => q.area === a.name).length])
    );
    const raw = areaMeta.map(a => ({ name: a.name, exact: (a.weight / totalWeight) * target }));
    const quota = Object.fromEntries(raw.map(r => [r.name, Math.floor(r.exact)]));
    let assigned = raw.reduce((s, r) => s + Math.floor(r.exact), 0);
    const rems = raw.map(r => ({ name: r.name, rem: r.exact - Math.floor(r.exact) }))
                    .sort((a, b) => b.rem - a.rem);
    let ri = 0;
    while (assigned < target && rems.length > 0) {
      quota[rems[ri % rems.length].name]++; assigned++; ri++;
    }
    let deficit = 0;
    areaMeta.forEach(a => {
      if (quota[a.name] > byAreaPool[a.name]) {
        deficit += quota[a.name] - byAreaPool[a.name];
        quota[a.name] = byAreaPool[a.name];
      }
    });
    while (deficit > 0) {
      const cand = areaMeta
        .map(a => ({ name: a.name, room: byAreaPool[a.name] - quota[a.name] }))
        .filter(x => x.room > 0)
        .sort((a, b) => b.room - a.room);
      if (cand.length === 0) break;
      quota[cand[0].name]++; deficit--;
    }
    return areaMeta.map(a => ({ name: a.name, n: quota[a.name] })).filter(x => x.n > 0);
  }, [pool, target, selectedAreas]);

  const totalPreview = previewSplit.reduce((s, x) => s + x.n, 0);

  function toggleFrom(set, val, setter) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    if (next.size === 0) next.add(val); // never leave empty
    setter(next);
  }

  function begin() {
    if (pool.length === 0) return;
    let list = sampleByBlueprint(pool, target, Array.from(selectedAreas), bundle.meta.areas);
    if (!shuffleQ) {
      const areaOrder = new Map(bundle.meta.areas.map((a, i) => [a.name, i]));
      list = list.slice().sort((a, b) => {
        const d = (areaOrder.get(a.area) ?? 99) - (areaOrder.get(b.area) ?? 99);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
    }
    onStart(list, 'study', shuffleOpts);
  }

  return (
    <section className="card">
      <h1>📚 Study mode</h1>
      <p className="lead">
        Filter, pick a count, and go. Instant feedback and explanations after every answer.
      </p>

      <h3>Areas</h3>
      <div className="filters">
        {bundle.meta.areas.map(a => (
          <button
            key={a.name}
            type="button"
            className={`chip ${selectedAreas.has(a.name) ? 'on' : ''}`}
            onClick={() => toggleFrom(selectedAreas, a.name, setSelectedAreas)}
          >
            {a.name} ({a.count})
          </button>
        ))}
      </div>

      <h3>Difficulty</h3>
      <div className="filters">
        {DIFFS.map(d => (
          <button
            key={d}
            type="button"
            className={`chip ${selectedDiffs.has(d) ? 'on' : ''}`}
            onClick={() => toggleFrom(selectedDiffs, d, setSelectedDiffs)}
          >
            {d}
          </button>
        ))}
      </div>

      <h3>How many questions?</h3>
      <div className="filters">
        {COUNT_PRESETS.map(c => (
          <button
            key={c}
            type="button"
            className={`chip ${countMode === c ? 'on' : ''}`}
            onClick={() => setCountMode(c)}
          >
            {c === 'all' ? 'All available' : c === 'custom' ? 'Custom…' : c}
          </button>
        ))}
      </div>
      {countMode === 'custom' && (
        <div style={{ marginTop: 8 }}>
          <label className="inline">
            Custom count:{' '}
            <input
              type="number" min="1" max="240" step="1"
              value={customCount}
              onChange={e => setCustomCount(e.target.value)}
              style={{ width: 100 }}
              inputMode="numeric"
            />
          </label>
        </div>
      )}
      <div className="persistence-info">
        {pool.length === 0
          ? 'No questions match the current filters.'
          : `Will serve ${totalPreview} — split: ${previewSplit.map(x => `${x.name.split(' ')[0]} ${x.n}`).join(' · ')}${target < parseInt(countMode || '0', 10) ? ` (capped by ${pool.length} available)` : ''}`}
      </div>

      <h3>Options</h3>
      <div>
        <label className="inline">
          <input type="checkbox" checked={shuffleQ} onChange={e => setShuffleQ(e.target.checked)} />
          Shuffle question order
        </label>
        <label className="inline">
          <input type="checkbox" checked={shuffleOpts} onChange={e => setShuffleOpts(e.target.checked)} />
          Shuffle answer options
        </label>
        <label className="inline">
          <input type="checkbox" checked={onlyMissed} onChange={e => setOnlyMissed(e.target.checked)} />
          Only previously missed
        </label>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={begin} disabled={pool.length === 0}>Start studying</button>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}

/* -------------------- Exam config -------------------- */
function ExamConfig({ onStart, onBack }) {
  const [strict, setStrict] = useState(true);
  const preview = bundle.meta.areas.map(a => ({
    name: a.name, weight: a.weight, n: Math.round((a.weight / 100) * EXAM_TARGET),
  }));
  let sum = preview.reduce((s, x) => s + x.n, 0);
  while (sum > EXAM_TARGET) { preview.sort((a, b) => b.n - a.n)[0].n--; sum--; }
  while (sum < EXAM_TARGET) { preview.sort((a, b) => a.n - b.n)[0].n++; sum++; }

  function begin() {
    const picked = [];
    for (const p of preview) {
      const pool = shuffle(bundle.questions.filter(q => q.area === p.name));
      picked.push(...pool.slice(0, p.n));
    }
    onStart(shuffle(picked), 'exam', true, strict);
  }

  return (
    <section className="card">
      <h1>🎯 Exam mode</h1>
      <p className="lead">
        Mirrors the real Salesforce PAB exam: 60 questions, 105 minutes, weighted by area,
        no feedback until you submit.
      </p>
      <div className="area-list">
        {preview.map(p => (
          <div key={p.name} className="area-row">
            <div className="name">{p.name}</div>
            <div className="meta">{p.weight}% · {p.n} questions</div>
          </div>
        ))}
      </div>
      <div>
        <label className="inline">
          <input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} />
          Strict timing (auto-submit at timer expiry)
        </label>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={begin}>Start exam (105 min)</button>
        <button className="btn ghost" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}

/* -------------------- Quiz screen -------------------- */
function QuizScreen({
  quiz, onCheck, onSelect, onNext, onPrev, onFlag, onSubmit, onEndOverview,
}) {
  const { questions, orders, answers, checked, flags, currentIndex, mode, reviewMode } = quiz;
  const q = questions[currentIndex];
  const showCheck = mode === 'study' && !checked[currentIndex] && !reviewMode;
  const showSubmit = mode === 'exam' && currentIndex === questions.length - 1 && !reviewMode;

  return (
    <>
      <section className="card">
        <Question
          question={q}
          order={orders[currentIndex]}
          index={currentIndex}
          total={questions.length}
          selected={answers[currentIndex] || []}
          revealed={checked[currentIndex] || reviewMode}
          flagged={flags[currentIndex]}
          onSelect={onSelect}
        />
        <div className="nav-row">
          <div>
            <button className="btn ghost" onClick={onPrev} disabled={currentIndex === 0}>← Previous</button>
            <button className="btn ghost" onClick={onFlag}>
              {flags[currentIndex] ? '⚑ Unflag' : '⚑ Flag'}
            </button>
          </div>
          <div>
            {showCheck && (
              <button className="btn secondary" onClick={onCheck}>Check answer</button>
            )}
            {showSubmit ? (
              <button className="btn good" onClick={onSubmit}>Submit exam</button>
            ) : (
              <button className="btn" onClick={onNext}>
                {currentIndex === questions.length - 1 ? 'Finish →' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="card">
        <h3>Question navigator</h3>
        <Navigator
          questions={questions}
          answers={answers}
          checked={checked}
          flags={flags}
          currentIndex={currentIndex}
          revealAll={reviewMode}
          onJump={idx => quiz.goto(idx)}
        />
        <div className="btn-row">
          <button className="btn ghost" onClick={onEndOverview}>Review flagged / unanswered</button>
        </div>
      </section>
    </>
  );
}

/* -------------------- Results -------------------- */
function Results({ quiz, onReviewAll, onReviewMissed, onHome }) {
  const { questions, answers, mode, pct, correctCount, passed, areaTally } = quiz.summary;

  return (
    <section className="card">
      <h1>
        {mode === 'exam'
          ? (passed ? '🎉 Exam passed — great work!' : '📚 Exam not passed — keep practicing')
          : 'Study session complete'}
      </h1>
      <div className="results-summary">
        <div className={`stat ${passed ? 'pass' : 'fail'}`}>
          <div className="value">{pct}%</div><div className="label">Score</div>
        </div>
        <div className="stat">
          <div className="value">{correctCount}/{questions.length}</div><div className="label">Correct</div>
        </div>
        <div className="stat">
          <div className="value">{questions.length - correctCount}</div><div className="label">Missed</div>
        </div>
        <div className="stat">
          <div className="value">{passed ? 'PASS' : 'FAIL'}</div><div className="label">Threshold 73%</div>
        </div>
      </div>
      <h3>Breakdown by area</h3>
      <div>
        {bundle.meta.areas.map(a => {
          const t = areaTally[a.name];
          if (!t || t.total === 0) return null;
          const p = Math.round((t.correct / t.total) * 100);
          const barColor = p >= 73 ? 'var(--good)' : p >= 50 ? 'var(--warn)' : 'var(--bad)';
          return (
            <div key={a.name} className="breakdown-row">
              <div>
                <div className="name">{a.name}</div>
                <div className="sub">Blueprint weight {a.weight}%</div>
              </div>
              <div>{t.correct}/{t.total} · {p}%</div>
              <div className="bar"><span style={{ width: `${p}%`, background: barColor }} /></div>
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button className="btn" onClick={onReviewAll}>Review every question</button>
        <button className="btn secondary" onClick={onReviewMissed}>Review only missed</button>
        <button className="btn ghost" onClick={onHome}>Back to home</button>
      </div>
    </section>
  );
}

/* -------------------- Stats -------------------- */
function Stats({ onHome, onReset }) {
  const state = loadState();
  const hist = state.history || {};
  const totalSeen = Object.keys(hist).length;
  const totalAnswers = Object.values(hist).reduce((s, r) => s + r.seen, 0);
  const totalCorrect = Object.values(hist).reduce((s, r) => s + r.correct, 0);
  const acc = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const attempts = state.attempts || [];

  return (
    <section className="card">
      <h1>📊 Your stats</h1>
      <div className="results-summary">
        <div className="stat"><div className="value">{totalSeen}/240</div><div className="label">Unique questions seen</div></div>
        <div className="stat"><div className="value">{totalAnswers}</div><div className="label">Total answers</div></div>
        <div className="stat"><div className="value">{acc}%</div><div className="label">Lifetime accuracy</div></div>
        <div className="stat"><div className="value">{attempts.length}</div><div className="label">Exam attempts saved</div></div>
      </div>
      <h3>Per-area accuracy (all-time)</h3>
      {bundle.meta.areas.map(a => {
        const qs = bundle.questions.filter(q => q.area === a.name);
        let seen = 0, correct = 0, tries = 0;
        qs.forEach(q => { const h = hist[q.id]; if (h) { seen++; tries += h.seen; correct += h.correct; } });
        const p = tries ? Math.round((correct / tries) * 100) : 0;
        const barColor = p >= 73 ? 'var(--good)' : p >= 50 ? 'var(--warn)' : 'var(--bad)';
        return (
          <div key={a.name} className="breakdown-row">
            <div>
              <div className="name">{a.name}</div>
              <div className="sub">{seen}/{a.count} unique · {tries} attempts</div>
            </div>
            <div>{p}%</div>
            <div className="bar"><span style={{ width: `${p}%`, background: barColor }} /></div>
          </div>
        );
      })}
      <h3>Recent exam attempts</h3>
      {attempts.length === 0 ? (
        <p className="lead">No exam attempts yet.</p>
      ) : (
        attempts.map((a, i) => (
          <div key={i} className="breakdown-row">
            <div>
              <div className="name">{new Date(a.timestamp).toLocaleString()}</div>
              <div className="sub">{a.minutesUsed != null ? `${a.minutesUsed} min used` : '—'}</div>
            </div>
            <div>{a.correct}/{a.total}</div>
            <div><strong style={{ color: `var(--${a.passed ? 'good' : 'bad'})` }}>{a.pct}% · {a.passed ? 'PASS' : 'FAIL'}</strong></div>
          </div>
        ))
      )}
      <div className="btn-row">
        <button className="btn bad" onClick={onReset}>Reset all progress</button>
        <button className="btn ghost" onClick={onHome}>Back</button>
      </div>
    </section>
  );
}

/* -------------------- App root -------------------- */
export default function App() {
  const [screen, setScreen] = useState('home');
  const [quizState, setQuizState] = useState(null);
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Timer tick (only when exam is active)
  useEffect(() => {
    if (!quizState || quizState.mode !== 'exam' || quizState.reviewMode) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quizState]);

  // Auto-submit when strict timer runs out
  useEffect(() => {
    if (!quizState || quizState.mode !== 'exam' || quizState.reviewMode) return;
    if (!quizState.endsAt || !quizState.strict) return;
    if (now >= quizState.endsAt) submitQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, quizState]);

  const goHome = useCallback(() => {
    setScreen('home');
    setQuizState(null);
    setSummary(null);
  }, []);

  function launchQuiz(list, mode, shuffleOpts, strict = true) {
    const orders = list.map(q => {
      const keys = q.options.map(o => o.key);
      return shuffleOpts ? shuffle(keys) : keys;
    });
    const qs = {
      questions: list,
      orders,
      answers: list.map(() => []),
      checked: list.map(() => false),
      flags: list.map(() => false),
      currentIndex: 0,
      mode,
      reviewMode: false,
      startedAt: Date.now(),
      endsAt: mode === 'exam' ? Date.now() + EXAM_MINUTES * 60 * 1000 : null,
      strict,
    };
    // Reusable jump helper closed over setQuizState
    qs.goto = idx => setQuizState(prev => (prev ? { ...prev, currentIndex: idx, goto: prev.goto } : prev));
    setQuizState(qs);
    setScreen('quiz');
    setNow(Date.now());
    window.scrollTo({ top: 0 });
  }

  function startWeak() {
    const state = loadState();
    const pool = bundle.questions.filter(q => {
      const h = state.history[q.id];
      return h && (h.wrong > 0 || h.lastCorrect === false);
    });
    if (pool.length === 0) {
      alert("You have no missed questions yet. Try an exam or study session first, then come back — this mode requires previous attempts.");
      return;
    }
    launchQuiz(shuffle(pool), 'study', true);
  }

  /* -------- Quiz interactions -------- */
  const selectOption = key => {
    setQuizState(qs => {
      if (!qs || qs.checked[qs.currentIndex] || qs.reviewMode) return qs;
      const q = qs.questions[qs.currentIndex];
      const current = qs.answers[qs.currentIndex] || [];
      let next;
      if (q.type === 'single') {
        next = [key];
      } else {
        if (current.includes(key)) next = current.filter(x => x !== key);
        else if (current.length < q.selectCount) next = current.concat([key]);
        else return qs;
      }
      const answers = qs.answers.slice(); answers[qs.currentIndex] = next;
      return { ...qs, answers };
    });
  };

  const checkAnswer = () => {
    setQuizState(qs => {
      if (!qs) return qs;
      const q = qs.questions[qs.currentIndex];
      const sel = qs.answers[qs.currentIndex] || [];
      if (sel.length === 0) { alert('Pick an answer first.'); return qs; }
      if (q.type === 'multi' && sel.length !== q.selectCount) {
        alert(`This question requires exactly ${q.selectCount} answers.`); return qs;
      }
      const correct = arraysEqualUnordered(sel, q.correct);
      recordAnswer(q.id, correct);
      const checked = qs.checked.slice(); checked[qs.currentIndex] = true;
      return { ...qs, checked };
    });
  };

  const nextQ = () => {
    setQuizState(qs => {
      if (!qs) return qs;
      if (qs.currentIndex >= qs.questions.length - 1) {
        // finalize
        if (qs.mode === 'study') { setTimeout(submitQuiz, 0); return qs; }
        setTimeout(endOverview, 0);
        return qs;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { ...qs, currentIndex: qs.currentIndex + 1 };
    });
  };
  const prevQ = () => {
    setQuizState(qs => {
      if (!qs || qs.currentIndex === 0) return qs;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { ...qs, currentIndex: qs.currentIndex - 1 };
    });
  };
  const toggleFlag = () => {
    setQuizState(qs => {
      if (!qs) return qs;
      const flags = qs.flags.slice(); flags[qs.currentIndex] = !flags[qs.currentIndex];
      return { ...qs, flags };
    });
  };
  const gotoIdx = idx => {
    setQuizState(qs => qs ? { ...qs, currentIndex: idx } : qs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function endOverview() {
    setQuizState(qs => {
      if (!qs) return qs;
      const unanswered = qs.answers.map((a, i) => a.length === 0 ? i : -1).filter(i => i >= 0);
      const flagged = qs.flags.map((f, i) => f ? i : -1).filter(i => i >= 0);
      let msg = '';
      if (unanswered.length) msg += `${unanswered.length} unanswered (${unanswered.map(i => i + 1).join(', ')})\n`;
      if (flagged.length) msg += `${flagged.length} flagged (${flagged.map(i => i + 1).join(', ')})\n`;
      msg += qs.mode === 'exam' ? '\nSubmit exam now?' : '\nFinish and see results?';
      if (window.confirm(msg || 'Finish?')) setTimeout(submitQuiz, 0);
      return qs;
    });
  }

  function submitQuiz() {
    setQuizState(qs => {
      if (!qs) return qs;
      const areaTally = {};
      bundle.meta.areas.forEach(a => { areaTally[a.name] = { total: 0, correct: 0 }; });
      let correctCount = 0;
      const checked = qs.checked.slice();
      qs.questions.forEach((q, i) => {
        const ok = arraysEqualUnordered(qs.answers[i] || [], q.correct);
        if (ok) correctCount++;
        if (qs.mode === 'exam' && !checked[i]) {
          recordAnswer(q.id, ok); checked[i] = true;
        }
        if (areaTally[q.area]) {
          areaTally[q.area].total++;
          if (ok) areaTally[q.area].correct++;
        }
      });
      const pct = Math.round((correctCount / qs.questions.length) * 100);
      const passed = pct >= 73;
      if (qs.mode === 'exam') {
        const usedMs = qs.endsAt ? (EXAM_MINUTES * 60 * 1000 - (qs.endsAt - Date.now())) : null;
        recordAttempt({
          timestamp: new Date().toISOString(),
          total: qs.questions.length, correct: correctCount, pct, passed,
          areas: areaTally,
          minutesUsed: usedMs != null ? Math.max(0, Math.round(usedMs / 60000)) : null,
        });
      }
      setSummary({
        mode: qs.mode, questions: qs.questions, answers: qs.answers,
        pct, correctCount, passed, areaTally,
      });
      setScreen('results');
      return { ...qs, checked, reviewMode: true };
    });
  }

  function reviewAll() {
    setQuizState(qs => qs ? { ...qs, reviewMode: true, currentIndex: 0 } : qs);
    setScreen('quiz');
    window.scrollTo({ top: 0 });
  }
  function reviewMissed() {
    setQuizState(qs => {
      if (!qs) return qs;
      const idxs = qs.questions
        .map((q, i) => arraysEqualUnordered(qs.answers[i] || [], q.correct) ? -1 : i)
        .filter(i => i >= 0);
      if (idxs.length === 0) { alert('Nothing missed — perfect score!'); return qs; }
      const questions = idxs.map(i => qs.questions[i]);
      const orders = idxs.map(i => qs.orders[i]);
      const answers = idxs.map(i => qs.answers[i]);
      const flags = idxs.map(i => qs.flags[i]);
      const checked = idxs.map(() => true);
      setScreen('quiz');
      window.scrollTo({ top: 0 });
      return {
        ...qs, questions, orders, answers, flags, checked,
        currentIndex: 0, reviewMode: true,
      };
    });
  }

  function resetProgress() {
    if (!window.confirm('This deletes ALL saved history and exam attempts. Continue?')) return;
    clearAll();
    setScreen('stats');
  }

  /* -------- Header state -------- */
  let timerStr = '--:--';
  let timerClass = '';
  if (quizState && quizState.mode === 'exam' && !quizState.reviewMode && quizState.endsAt) {
    const remaining = Math.max(0, quizState.endsAt - now);
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    timerStr = (h > 0 ? `${h}:` : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    if (totalSec <= 60) timerClass = 'critical';
    else if (totalSec <= 600) timerClass = 'warn';
  }
  const modeBadge =
    screen === 'home' ? 'Home' :
    screen === 'study-config' ? 'Study' :
    screen === 'exam-config' ? 'Exam preview' :
    screen === 'stats' ? 'Stats' :
    screen === 'results' ? (quizState?.mode === 'exam' ? 'Exam · Results' : 'Study · Results') :
    quizState?.reviewMode ? 'Review' : (quizState?.mode === 'exam' ? 'Exam' : 'Study');

  const subtitle =
    screen === 'home'
      ? `240 questions · SU'26 aligned · Passing score 73%`
      : quizState
      ? `${quizState.questions.length} question${quizState.questions.length === 1 ? '' : 's'} loaded`
      : 'Choose a mode to start';

  /* -------- Render -------- */
  const quizForScreen = quizState ? {
    ...quizState,
    goto: gotoIdx,
    summary,
  } : null;

  return (
    <>
      <Header
        mode={modeBadge}
        subtitle={subtitle}
        timer={timerStr}
        timerClass={timerClass}
        onHome={goHome}
      />
      <main>
        {screen === 'home' && <Home onGo={key => {
          if (key === 'study-config') setScreen('study-config');
          else if (key === 'exam-config') setScreen('exam-config');
          else if (key === 'weak') startWeak();
          else if (key === 'stats') setScreen('stats');
        }} />}
        {screen === 'study-config' && (
          <StudyConfig
            onStart={(list, mode, shuffleOpts) => launchQuiz(list, mode, shuffleOpts)}
            onBack={goHome}
          />
        )}
        {screen === 'exam-config' && (
          <ExamConfig
            onStart={(list, mode, shuffleOpts, strict) => launchQuiz(list, mode, shuffleOpts, strict)}
            onBack={goHome}
          />
        )}
        {screen === 'quiz' && quizForScreen && (
          <QuizScreen
            quiz={quizForScreen}
            onCheck={checkAnswer}
            onSelect={selectOption}
            onNext={nextQ}
            onPrev={prevQ}
            onFlag={toggleFlag}
            onSubmit={submitQuiz}
            onEndOverview={endOverview}
          />
        )}
        {screen === 'results' && summary && (
          <Results
            quiz={{ summary }}
            onReviewAll={reviewAll}
            onReviewMissed={reviewMissed}
            onHome={goHome}
          />
        )}
        {screen === 'stats' && (
          <Stats onHome={goHome} onReset={resetProgress} />
        )}
        <div className="footer-note">
          Study material only — not an official Salesforce product. Questions written by Claude
          based on the SU'26 PAB exam outline. Always verify against Salesforce Help.
        </div>
      </main>
    </>
  );
}

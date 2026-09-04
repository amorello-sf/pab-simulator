import React, { useMemo } from 'react';
import { arraysEqualUnordered } from '../lib/sampling.js';

function escapeHtml(s) {
  return String(s ?? '');
}

function Option({ optKey, text, state, onClick, disabled }) {
  const cls = ['opt'];
  if (state === 'selected') cls.push('selected');
  else if (state === 'correct') cls.push('correct');
  else if (state === 'incorrect') cls.push('incorrect');
  else if (state === 'reveal') cls.push('reveal-correct');
  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="letter">{optKey}</span>
      <span className="text">{text}</span>
    </button>
  );
}

function Explanation({ question, selected }) {
  const isCorrect = arraysEqualUnordered(selected, question.correct);
  return (
    <div className={`explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
      <div className="label">
        {isCorrect ? '✓ Correct' : '✗ Incorrect'} — Correct: {question.correct.join(', ')}
      </div>
      <div>{escapeHtml(question.explanation)}</div>
      {question.reference && (
        <div className="ref">Reference: {escapeHtml(question.reference)}</div>
      )}
    </div>
  );
}

export function Question({
  question, order, index, total, selected, revealed, flagged, onSelect,
}) {
  const correctSet = useMemo(() => new Set(question.correct), [question]);
  return (
    <>
      <div className="progress">
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <div className="question-meta">
        <span className="tag">{question.area}</span>
        <span className="tag">{question.subcategory}</span>
        <span className={`tag diff-${question.difficulty}`}>{question.difficulty}</span>
        {question.type === 'multi' && (
          <span className="tag multi">Choose {question.selectCount}</span>
        )}
        {flagged && <span className="tag flagged">⚑ Flagged</span>}
        <span className="qmeta-spacer">Question {index + 1} of {total} · {question.id}</span>
      </div>
      {question.scenario && (
        <div className="scenario">{escapeHtml(question.scenario)}</div>
      )}
      <div className="qtext">{escapeHtml(question.question)}</div>
      <div className="options">
        {order.map(key => {
          const opt = question.options.find(o => o.key === key);
          const chosen = selected.includes(key);
          const isRight = correctSet.has(key);
          let state = null;
          if (revealed) {
            if (chosen && isRight) state = 'correct';
            else if (chosen && !isRight) state = 'incorrect';
            else if (!chosen && isRight) state = 'reveal';
          } else if (chosen) {
            state = 'selected';
          }
          return (
            <Option
              key={key}
              optKey={key}
              text={opt.text}
              state={state}
              onClick={() => onSelect(key)}
              disabled={revealed}
            />
          );
        })}
      </div>
      {revealed && <Explanation question={question} selected={selected} />}
    </>
  );
}

export function Navigator({
  questions, answers, checked, flags, currentIndex, revealAll, onJump,
}) {
  return (
    <div className="navigator">
      {questions.map((q, i) => {
        const cls = ['nav-item'];
        if (i === currentIndex) cls.push('current');
        const hasAnswer = (answers[i] || []).length > 0;
        if (hasAnswer) cls.push('answered');
        if (checked[i] || revealAll) {
          cls.length = 1; // reset to just 'nav-item'
          cls.push(i === currentIndex ? 'current' : (
            arraysEqualUnordered(answers[i] || [], q.correct) ? 'correct' : 'incorrect'
          ));
        }
        if (flags[i]) cls.push('flagged');
        return (
          <button
            key={q.id}
            type="button"
            className={cls.join(' ')}
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}${flags[i] ? ' (flagged)' : ''}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

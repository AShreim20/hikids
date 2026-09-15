import React from 'react';
import { detectTextDir } from '@/lib/textDirection';

// Minimal, dependency-free markdown renderer for assistant chat messages —
// no new library, no dangerouslySetInnerHTML (every piece of text still
// passes through React as a plain string child, so nothing the assistant
// writes can be interpreted as HTML). Supports exactly what the assistant is
// asked to use: **bold**, paragraphs (blank-line separated), bullet/numbered
// lists, and single line breaks — enough to stop raw "**text**" / "- item"
// syntax from ever reaching the customer, without pulling in a full
// markdown engine for a chat bubble.

const BULLET_RE = /^[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\d+[.)]\s+(.*)$/;
// A run of Latin letters/digits (with the punctuation that commonly glues
// them together — %, ., ,, :, -, /) inside an RTL line. Isolating it in a
// <bdi> keeps a stray English word or number from reordering the Arabic
// text around it, the same concern formatPrice() already handles for prices
// rendered in the product cards.
const LATIN_RUN_RE = /([A-Za-z0-9][A-Za-z0-9%.,:\-/]*)/g;

function withBidi(text, dir) {
  if (dir !== 'rtl' || !text) return text;
  // .split() with a capturing group alternates [plain, match, plain, match,
  // ...] — odd indices are always the captured Latin/number runs, so no
  // need to re-test them (re-testing a `g`-flagged regex would be stateful
  // and wrong here anyway, since .test() advances its own lastIndex).
  const parts = text.split(LATIN_RUN_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <bdi key={i} dir="ltr">{part}</bdi> : part));
}

// Splits on **bold** (non-greedy) and re-wraps survivors with withBidi so
// bidi-isolation still applies inside and around bold spans.
function renderInline(line, dir, keyPrefix) {
  const segments = line.split(/\*\*(.+?)\*\*/g);
  return segments.map((seg, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-b${i}`} className="font-bold">{withBidi(seg, dir)}</strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-t${i}`}>{withBidi(seg, dir)}</React.Fragment>
    )
  );
}

function renderParagraph(block, key) {
  const dir = detectTextDir(block);
  const lines = block.split('\n');
  return (
    <p key={key} dir={dir} className="leading-relaxed">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderInline(line, dir, `${key}-${i}`)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
}

function renderList(lines, key) {
  const dir = detectTextDir(lines.join(' '));
  const ordered = NUMBERED_RE.test(lines[0]);
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag key={key} dir={dir} className={`${ordered ? 'list-decimal' : 'list-disc'} ms-5 space-y-0.5`}>
      {lines.map((line, i) => {
        const m = line.match(BULLET_RE) || line.match(NUMBERED_RE);
        const content = m ? m[1] : line;
        return <li key={i}>{renderInline(content, dir, `${key}-li${i}`)}</li>;
      })}
    </Tag>
  );
}

function isListBlock(lines) {
  return lines.length > 0 && lines.every((l) => BULLET_RE.test(l) || NUMBERED_RE.test(l));
}

export default function ChatMarkdown({ text }) {
  const blocks = String(text ?? '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return null;
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        return isListBlock(lines) ? renderList(lines, `b${i}`) : renderParagraph(block, `b${i}`);
      })}
    </div>
  );
}

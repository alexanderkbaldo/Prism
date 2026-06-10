// Shared helpers for turning a stored Markdown brief into display-ready text.
// Used by the dashboard hero, the signal report, and the home preview.

// Strip inline Markdown (bold/italic/code/links, incl. stray markers) so a
// snippet renders as clean prose.
export function stripMd(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/[*_]{1,3}/g, "") // all bold/italic markers
    .replace(/\s+/g, " ")
    .trim();
}

// Pull the brief's "bottom line" out so it can lead instead of hide. Handles an
// inline "**Bottom line:** …" and a "## Bottom line" heading. Returns the plain
// sentence plus the remaining body.
export function extractBottomLine(text) {
  if (!text) return { sentence: null, body: text };
  let m = text.match(/\*\*\s*bottom line\s*:?\s*\*\*\s*([\s\S]+?)\s*$/i);
  if (m) return { sentence: stripMd(m[1]), body: text.slice(0, m.index).trim() };
  m = text.match(/\n#{1,6}\s*bottom line\s*:?\s*\n+([\s\S]+?)\s*$/i);
  if (m) return { sentence: stripMd(m[1]), body: text.slice(0, m.index).trim() };
  return { sentence: null, body: text };
}

// The brief's opening summary — first sentence after the first section heading.
// Distinct from the bottom line, so the two never repeat the same sentence.
export function extractRead(briefText) {
  if (!briefText) return null;
  let seenSection = false;
  for (const raw of briefText.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("##")) { seenSection = true; continue; }
    if (!seenSection || l.startsWith("#") || /bottom line/i.test(l)) continue;
    const clean = stripMd(l.replace(/^[-*>]\s*/, "").replace(/\(mock[^)]*\)/i, ""));
    if (clean.length < 20) continue;
    const m = clean.match(/^.*?[.?!](\s|$)/);
    return (m ? m[0] : clean).trim();
  }
  return null;
}

// Split a brief body into { signalKey: analystProse } by its ## headings.
export function parseSections(text) {
  if (!text) return {};
  const map = {};
  for (const part of text.split(/\n(?=#{1,6}\s)/)) {
    const m = part.match(/^#{1,6}\s*(.+?)\n([\s\S]*)$/);
    if (!m) continue;
    const heading = m[1].toLowerCase();
    const prose = m[2].trim();
    let key = null;
    if (/sentiment/.test(heading)) key = "sentiment";
    else if (/hiring|job/.test(heading)) key = "hiring";
    else if (/search|trend/.test(heading)) key = "trends";
    else if (/app|review/.test(heading)) key = "reviews";
    else if (/regulat|filing|sec/.test(heading)) key = "filings";
    if (key && !map[key]) map[key] = prose;
  }
  return map;
}

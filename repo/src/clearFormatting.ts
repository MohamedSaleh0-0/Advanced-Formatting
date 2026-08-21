import { RoleMatch, RoleRegex } from "./types";
import { findLineMatches } from "./delimiters";

// A span with an opening delimiter, content, and a closing delimiter, all
// as offsets within one line — the common shape shared by a role match
// (arbitrary-length open/close) and native bold `**`/italic `*` (fixed
// 2/1-length open/close). Letting both go through the same strip logic
// means the offset arithmetic is written and tested once.
interface DelimSpan {
	matchStart: number;
	openEnd: number;
	closeStart: number;
	matchEnd: number;
}

function spanContainsRange(span: DelimSpan, from: number, to: number): boolean {
	return span.matchStart <= from && to <= span.matchEnd;
}

function roleMatchToSpan(m: RoleMatch, line: string): DelimSpan {
	// wrapWithDelims (delimiters.ts) wraps every role-backed span in an
	// LRI/RLI + PDI directional isolate, sitting just OUTSIDE matchStart/
	// matchEnd (not part of the regex match itself, so findLineMatches
	// never sees them). Left alone, clearing formatting would strip the
	// role's own delimiters but leave those isolate marks behind as
	// orphaned invisible characters — check for them immediately adjacent
	// and fold them into the same removal zones if present.
	let matchStart = m.matchStart;
	let matchEnd = m.matchEnd;
	if (matchStart > 0 && (line[matchStart - 1] === "\u2066" || line[matchStart - 1] === "\u2067")) {
		matchStart -= 1;
	}
	if (matchEnd < line.length && line[matchEnd] === "\u2069") {
		matchEnd += 1;
	}
	return { matchStart, openEnd: m.contentStart, closeStart: m.contentEnd, matchEnd };
}

// Deepest (innermost) role match whose full span contains [from, to] —
// clearing formatting should peel the layer closest to the cursor first,
// not the outermost one.
function findInnermostRoleMatch(matches: RoleMatch[], from: number, to: number): RoleMatch | null {
	for (const m of matches) {
		if (m.matchStart <= from && to <= m.matchEnd) {
			return findInnermostRoleMatch(m.children, from, to) || m;
		}
	}
	return null;
}

function findNativeSpan(line: string, from: number, to: number, marker: "**" | "*", avoid: DelimSpan[]): DelimSpan | null {
	const markerLen = marker.length;
	const escaped = marker === "**" ? "\\*\\*" : "\\*";
	// Content excludes a bare "*" so "**bold**" isn't matched by the
	// italic pass, and so adjacent bold/italic spans on the same line
	// don't bleed into each other.
	const re = new RegExp(escaped + "([^\\n*]+?)" + escaped, "g");
	let m: RegExpExecArray | null;
	while ((m = re.exec(line))) {
		const span: DelimSpan = {
			matchStart: m.index,
			openEnd: m.index + markerLen,
			closeStart: m.index + markerLen + m[1].length,
			matchEnd: m.index + m[0].length,
		};
		if (avoid.some((a) => span.matchStart < a.matchEnd && span.matchEnd > a.matchStart)) continue;
		if (spanContainsRange(span, from, to)) return span;
	}
	return null;
}

function allNativeSpans(line: string, marker: "**" | "*", avoid: DelimSpan[]): DelimSpan[] {
	const markerLen = marker.length;
	const escaped = marker === "**" ? "\\*\\*" : "\\*";
	const re = new RegExp(escaped + "([^\\n*]+?)" + escaped, "g");
	const spans: DelimSpan[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(line))) {
		const span: DelimSpan = {
			matchStart: m.index,
			openEnd: m.index + markerLen,
			closeStart: m.index + markerLen + m[1].length,
			matchEnd: m.index + m[0].length,
		};
		if (avoid.some((a) => span.matchStart < a.matchEnd && span.matchEnd > a.matchStart)) continue;
		spans.push(span);
	}
	return spans;
}

function stripSpan(line: string, span: DelimSpan, from: number, to: number): { newLine: string; newFrom: number; newTo: number } {
	// Remove the close delimiter first (it's at the higher offset), then
	// the open one — each removal computed against the ORIGINAL
	// (pre-removal) coordinates of the other, since the two delimiters
	// never overlap and remain independent regardless of removal order.
	let newLine = line.slice(0, span.closeStart) + line.slice(span.matchEnd);
	newLine = newLine.slice(0, span.matchStart) + newLine.slice(span.openEnd);

	function adjust(pos: number): number {
		let p = pos;
		const closeLen = span.matchEnd - span.closeStart;
		if (p >= span.matchEnd) p -= closeLen;
		else if (p > span.closeStart) p = span.closeStart;
		const openLen = span.openEnd - span.matchStart;
		if (p >= span.openEnd) p -= openLen;
		else if (p > span.matchStart) p = span.matchStart;
		return p;
	}

	return { newLine, newFrom: adjust(from), newTo: adjust(to) };
}

export interface ClearFormattingResult {
	newLine: string;
	newFrom: number;
	newTo: number;
}

// Strips ONE layer of formatting (a role match, bold, or italic —
// whichever most tightly contains [from, to]) from `lineText`. Returns
// null if nothing formatted contains that range.
function stripOneLayer(lineText: string, from: number, to: number, roleRegexes: RoleRegex[]): ClearFormattingResult | null {
	const roleMatches = findLineMatches(lineText, 0, roleRegexes);
	const role = findInnermostRoleMatch(roleMatches, from, to);
	if (role) return stripSpan(lineText, roleMatchToSpan(role, lineText), from, to);

	const boldSpans = allNativeSpans(lineText, "**", []);
	const bold = boldSpans.find((s) => spanContainsRange(s, from, to));
	if (bold) return stripSpan(lineText, bold, from, to);

	const italic = findNativeSpan(lineText, from, to, "*", boldSpans);
	if (italic) return stripSpan(lineText, italic, from, to);

	return null;
}

// Repeatedly strips layers touching [chFrom, chTo] until none remain
// (bounded — a pathological, deeply nested line can't loop forever),
// matching a single "Clear formatting" invocation removing everything at
// once rather than requiring one run per layer. Returns null if nothing
// formatted was found at all, so the caller can tell the user that rather
// than silently no-op.
const MAX_LAYERS = 8;

export function clearFormattingAtRange(lineText: string, chFrom: number, chTo: number, roleRegexes: RoleRegex[]): ClearFormattingResult | null {
	let line = lineText;
	let from = chFrom;
	let to = chTo;
	let strippedAny = false;

	for (let i = 0; i < MAX_LAYERS; i++) {
		const stripped = stripOneLayer(line, from, to, roleRegexes);
		if (!stripped) break;
		line = stripped.newLine;
		from = stripped.newFrom;
		to = stripped.newTo;
		strippedAny = true;
	}

	return strippedAny ? { newLine: line, newFrom: from, newTo: to } : null;
}

import { HeadingKey } from "./types";
import { stripAllMarkers } from "./lineMarkers";

// Detects whether a raw line is a Markdown heading, and which level —
// used by the right-click "quick switch heading style" menu items
// (main.ts) so they only appear on an actual heading line, and act on
// the right H1-H6 config. Strips every per-line override marker first
// (lineMarkers.ts) — direction, alignment, bold overrides all prepend
// their marker before any Markdown syntax, including the heading `#`s.
export function detectHeadingKey(lineText: string): HeadingKey | null {
	const text = stripAllMarkers(lineText);
	const m = /^(#{1,6})\s/.exec(text);
	if (!m) return null;
	return ("h" + m[1].length) as HeadingKey;
}

// Estimates a list line's nesting depth (1 = top level) from its leading
// indentation, for the right-click "quick switch bullet style" menu
// (main.ts), which maps the detected depth onto
// `typography.listBulletShapes[depth - 1]` — the same per-depth array
// Settings already exposes. This is a heuristic, not a real parse: it
// assumes a tab or 4 spaces per indent level, which is Obsidian's
// default but is itself a user-configurable editor setting this plugin
// has no access to from a raw line of text. Good enough to point a
// right-click quick-action at the right depth in the common case; not a
// substitute for a real list-structure parser.
export function detectListDepth(lineText: string): number | null {
	const text = stripAllMarkers(lineText);
	const m = /^(\s*)([-*+]|\d+[.)])\s/.exec(text);
	if (!m) return null;
	const indent = m[1].replace(/\t/g, "    "); // treat a tab as one 4-space indent step
	const depth = Math.floor(indent.length / 4) + 1;
	return Math.max(1, depth);
}

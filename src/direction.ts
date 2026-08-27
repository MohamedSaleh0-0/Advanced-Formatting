import { registerMarkers, findOwnMarker, setOwnMarker, clusterBounds } from "./lineMarkers";

// Per-line forced text-direction — a single invisible Private-Use-Area
// character marks a line (paragraph, heading, or list item) as forced
// RTL or forced LTR, overriding whatever direction the content would
// otherwise resolve to.
//
// Same "invisible, markdown-native, lives in the real document text"
// approach as role delimiters (directFormat.ts/delimiters.ts), but for a
// whole-LINE property rather than an inline span — deliberately NOT a
// separate settings-side store keyed by line number, which would drift
// out of sync the moment a line above it is added or removed. A
// character IN the line survives edits, reorders, copy/paste, and
// reload exactly like the line's own content does.
//
// U+E210 range chosen to sit clearly apart from both the role-delimiter
// sentinels (U+E000/U+E001 + U+E100 range ids, directFormat.ts), the
// Bidi isolate characters (U+2066/2067/2069, delimiters.ts), and the
// other per-line override axes (headingOverrides.ts's U+E220 range) — no
// risk of collision between any of this plugin's invisible-marker
// systems.
export const FORCE_RTL_MARKER = "\uE210";
export const FORCE_LTR_MARKER = "\uE211";
const OWN_MARKERS = [FORCE_RTL_MARKER, FORCE_LTR_MARKER];
registerMarkers(OWN_MARKERS);

export type LineDirection = "rtl" | "ltr" | null;

// The marker must sit AFTER any block-level Markdown syntax (heading
// `#`s, a list item's bullet/number, a blockquote's `>`), never at the
// absolute start of the line — see lineMarkers.ts for the full
// reasoning (a marker at position 0 breaks CommonMark's own block-type
// parsing for that line, which is what made forcing direction on a
// list/heading line break its own formatting, before that was fixed).
//
// This axis's marker lives in the shared cluster (lineMarkers.ts)
// alongside any other axis's marker already on the line (e.g. a forced
// alignment from headingOverrides.ts) — findOwnMarker/setOwnMarker only
// ever touch THIS axis's own marker characters, leaving others in the
// cluster untouched.
//
// Only applies to the RAW markdown line text this plugin reads/writes
// directly (decorations.ts's Live Preview handling, and
// runSetLineDirection in main.ts). Reading view's applyLineDirection
// (readingMode.ts) operates on already-rendered DOM text content, which
// never contains this syntax in the first place (Obsidian strips it when
// rendering to HTML) — so it correctly keeps checking position 0, no
// change needed there.
export function detectLineDirection(lineText: string): LineDirection {
	const marker = findOwnMarker(lineText, OWN_MARKERS);
	if (marker === FORCE_RTL_MARKER) return "rtl";
	if (marker === FORCE_LTR_MARKER) return "ltr";
	return null;
}

// Returns the [from, to) span of the WHOLE marker cluster (every axis's
// marker on this line, not just this one) — decorations.ts hides the
// entire cluster as a single CM6 replace decoration, simpler and more
// robust than each axis hiding its own single character separately.
// Kept here (rather than callers importing clusterBounds directly from
// lineMarkers.ts) so decorations.ts doesn't need to know the shared
// mechanism exists at all, just "where's the stuff to hide."
export function lineMarkerClusterBounds(lineText: string): { from: number; to: number } | null {
	const { from, to } = clusterBounds(lineText);
	return to > from ? { from, to } : null;
}

export function stripLineDirectionMarker(lineText: string): string {
	return setOwnMarker(lineText, OWN_MARKERS, null);
}

// Returns the line's text with its direction marker set to `dir` (or
// removed, for `null`) — replaces any existing marker rather than
// stacking a second one, and always places it just after the block
// prefix (see lineMarkers.ts), never at position 0. Any OTHER axis's
// marker already on the line (alignment, bold) is preserved untouched.
export function setLineDirection(lineText: string, dir: LineDirection): string {
	if (dir === "rtl") return setOwnMarker(lineText, OWN_MARKERS, FORCE_RTL_MARKER);
	if (dir === "ltr") return setOwnMarker(lineText, OWN_MARKERS, FORCE_LTR_MARKER);
	return setOwnMarker(lineText, OWN_MARKERS, null);
}

// Reading view (readingMode.ts) checks already-RENDERED DOM text, not
// raw Markdown — Obsidian strips `#`/`-`/`>` syntax when rendering to
// HTML, so there's no block prefix to skip past there in the first
// place, and reusing the prefix-aware functions above on rendered text
// risks a false match: a heading literally titled "1. Introduction"
// would render as the text "1. Introduction", which the list-marker
// regex would wrongly treat as list syntax to skip over. These two
// check position 0 only, unconditionally — correct for rendered text,
// where the marker (if present) is always the literal first character.
// (Multiple axes CAN still stack in rendered text too, in principle, but
// each axis's marker is a single specific character, so checking "does
// this text start with MY marker" is unambiguous regardless — unlike
// the raw-markdown side, there's no shared "cluster" concept needed here
// since there's no block-prefix boundary to search past.)
export function detectRenderedTextDirection(text: string): LineDirection {
	if (text.startsWith(FORCE_RTL_MARKER)) return "rtl";
	if (text.startsWith(FORCE_LTR_MARKER)) return "ltr";
	return null;
}

export function stripRenderedTextDirectionMarker(text: string): string {
	if (text.startsWith(FORCE_RTL_MARKER) || text.startsWith(FORCE_LTR_MARKER)) return text.slice(1);
	return text;
}

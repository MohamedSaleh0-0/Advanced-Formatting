import { registerMarkers, findOwnMarker, setOwnMarker } from "./lineMarkers";

// Per-line overrides for a SPECIFIC heading's alignment/bold, layered on
// top of that heading level's shared style (typography.headings[key] in
// Settings) — NOT a replacement for it. Same invisible-marker mechanism
// as direction.ts (see there and lineMarkers.ts for the full reasoning),
// on a separate range of Private-Use-Area code points (U+E220 upward) so
// this axis's markers never collide with direction's (U+E210/E211) when
// both are present on the same line.
//
// This exists because the right-click "H2: Align left/center/right" and
// "H2: Toggle bold" menu items originally edited
// typography.headings["h2"] directly — a deliberate design choice at
// the time (documented as "a shortcut to the existing global setting,
// not a per-instance override"), which turned out to be the wrong call:
// it meant changing ONE heading's alignment visibly changed EVERY H2 in
// the note, reported as a bug. This replaces that mechanism entirely —
// the menu items now set/clear a per-line marker instead of touching
// the shared per-level style, so they only ever affect the heading
// actually clicked.

export type AlignOverride = "left" | "center" | "right" | null;

export const ALIGN_LEFT_MARKER = "\uE220";
export const ALIGN_CENTER_MARKER = "\uE221";
export const ALIGN_RIGHT_MARKER = "\uE222";
const ALIGN_MARKERS = [ALIGN_LEFT_MARKER, ALIGN_CENTER_MARKER, ALIGN_RIGHT_MARKER];
registerMarkers(ALIGN_MARKERS);

export const BOLD_ON_MARKER = "\uE223";
export const BOLD_OFF_MARKER = "\uE224";
const BOLD_MARKERS = [BOLD_ON_MARKER, BOLD_OFF_MARKER];
registerMarkers(BOLD_MARKERS);

export function detectAlignOverride(lineText: string): AlignOverride {
	const marker = findOwnMarker(lineText, ALIGN_MARKERS);
	if (marker === ALIGN_LEFT_MARKER) return "left";
	if (marker === ALIGN_CENTER_MARKER) return "center";
	if (marker === ALIGN_RIGHT_MARKER) return "right";
	return null;
}

export function setAlignOverride(lineText: string, align: AlignOverride): string {
	if (align === "left") return setOwnMarker(lineText, ALIGN_MARKERS, ALIGN_LEFT_MARKER);
	if (align === "center") return setOwnMarker(lineText, ALIGN_MARKERS, ALIGN_CENTER_MARKER);
	if (align === "right") return setOwnMarker(lineText, ALIGN_MARKERS, ALIGN_RIGHT_MARKER);
	return setOwnMarker(lineText, ALIGN_MARKERS, null);
}

// Three states, not a plain boolean: null means "no override, inherit
// the heading level's own bold setting" — distinct from an explicit
// override forcing it off, which is why "off" needs its own marker
// rather than just "absence of the ON marker."
export type BoldOverride = "on" | "off" | null;

export function detectBoldOverride(lineText: string): BoldOverride {
	const marker = findOwnMarker(lineText, BOLD_MARKERS);
	if (marker === BOLD_ON_MARKER) return "on";
	if (marker === BOLD_OFF_MARKER) return "off";
	return null;
}

export function setBoldOverride(lineText: string, bold: BoldOverride): string {
	if (bold === "on") return setOwnMarker(lineText, BOLD_MARKERS, BOLD_ON_MARKER);
	if (bold === "off") return setOwnMarker(lineText, BOLD_MARKERS, BOLD_OFF_MARKER);
	return setOwnMarker(lineText, BOLD_MARKERS, null);
}

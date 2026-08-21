// Shared low-level mechanism behind every per-line invisible-marker
// override this plugin uses (direction.ts, headingOverrides.ts, and any
// future axis) — see direction.ts's original reasoning: a marker must
// sit AFTER any block-level Markdown syntax (heading #s, list bullet/
// number, blockquote >), never at the absolute start of the line, or it
// breaks CommonMark's own block-type parsing for that line (this is what
// made forcing direction on a list/heading line break its own
// formatting, before that was fixed).
//
// Multiple independent overrides can be present on the same line at
// once (a heading with both a forced direction AND a forced alignment,
// say) — they live together in one small cluster of invisible
// characters right after the block prefix. Each axis module only ever
// touches ITS OWN registered marker characters within that cluster,
// leaving every other axis's marker there untouched — critical, because
// an earlier design (each axis independently checking `rest.startsWith(ownMarker)`
// right after the prefix, with no awareness of other axes) would break
// the moment two markers stacked: whichever axis's marker wasn't first
// in the cluster would silently stop being detected.
export function blockPrefixLength(lineText: string): number {
	let m = /^#{1,6}\s/.exec(lineText);
	if (m) return m[0].length;
	m = /^(?:>\s?)+/.exec(lineText);
	if (m) return m[0].length;
	m = /^(\s*)([-*+]|\d+[.)])\s/.exec(lineText);
	if (m) return m[0].length;
	return 0;
}

// Every marker character across every axis, so the cluster boundary can
// be found without any one axis module needing to know about the
// others. Populated via registerMarkers() at each axis module's load
// time (direction.ts, headingOverrides.ts import and call this).
const knownMarkers = new Set<string>();
export function registerMarkers(chars: string[]): void {
	for (const c of chars) knownMarkers.add(c);
}
export function isKnownMarker(ch: string): boolean {
	return knownMarkers.has(ch);
}

export function splitCluster(lineText: string): { prefix: string; cluster: string; content: string } {
	const prefixLen = blockPrefixLength(lineText);
	const prefix = lineText.slice(0, prefixLen);
	let i = prefixLen;
	while (i < lineText.length && knownMarkers.has(lineText[i])) i++;
	return { prefix, cluster: lineText.slice(prefixLen, i), content: lineText.slice(i) };
}

// The marker cluster's [from, to) ch-offset span within the line — for
// decorations.ts to hide the WHOLE cluster as one CM6 replace
// decoration, regardless of how many distinct markers happen to be in
// it (simpler and more robust than hiding each marker character
// separately).
export function clusterBounds(lineText: string): { from: number; to: number } {
	const prefixLen = blockPrefixLength(lineText);
	const { cluster } = splitCluster(lineText);
	return { from: prefixLen, to: prefixLen + cluster.length };
}

// Reads which of `ownMarkers` (if any) is present in the line's marker
// cluster — an axis module's `detect` functions are built on this.
export function findOwnMarker(lineText: string, ownMarkers: string[]): string | null {
	const { cluster } = splitCluster(lineText);
	for (const ch of cluster) {
		if (ownMarkers.includes(ch)) return ch;
	}
	return null;
}

// Replaces this axis's marker within the cluster (removing it entirely
// if `newMarker` is null) while preserving every other axis's marker
// already there, in whatever order they already were — an axis
// module's `set`/`clear` functions are built on this.
export function setOwnMarker(lineText: string, ownMarkers: string[], newMarker: string | null): string {
	const { prefix, cluster, content } = splitCluster(lineText);
	const kept = Array.from(cluster).filter((ch) => !ownMarkers.includes(ch));
	const newCluster = newMarker ? kept.join("") + newMarker : kept.join("");
	return prefix + newCluster + content;
}

// Strips ALL markers from every axis, leaving the prefix and real
// content untouched — used where something just needs the line's true
// content regardless of which overrides are on it (e.g. lineContext.ts
// detecting a heading level or list depth).
export function stripAllMarkers(lineText: string): string {
	const { prefix, content } = splitCluster(lineText);
	return prefix + content;
}

// Rendered-text equivalent of the cluster mechanism above, for
// readingMode.ts: already-rendered DOM text has no block-syntax prefix
// to skip past (Obsidian strips `#`/`-`/`>` when rendering to HTML), so
// the whole leading run of known marker characters — however many axes
// happen to be stacked — IS the cluster, starting at position 0.
export function scanRenderedTextMarkers(text: string): { markers: string[]; content: string } {
	let i = 0;
	while (i < text.length && knownMarkers.has(text[i])) i++;
	return { markers: Array.from(text.slice(0, i)), content: text.slice(i) };
}

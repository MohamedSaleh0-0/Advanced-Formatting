// Footnote numbering shared by Live Preview (decorations.ts, which builds
// the whole footnote block from scratch — Obsidian doesn't construct one
// there) and Reading view (readingMode.ts, which only needs to convert the
// digits Obsidian already rendered). Kept here, not duplicated per-caller,
// same reasoning as delimiters.ts: one mechanism, not a special case per
// feature.

const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Replaces ASCII 0-9 anywhere in a string with their Arabic-Indic form. Any
 * non-digit characters (a period, an NBSP, surrounding text) pass through
 * unchanged, so this is safe to run on a whole rendered label, not just a
 * bare number. */
export function convertDigitsToArabicIndic(text: string): string {
	return text.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

export function toArabicIndicNumeral(n: number): string {
	return convertDigitsToArabicIndic(String(n));
}

export interface FootnoteDef {
	label: string;
	/** Start of the whole `[^label]:` marker (== start of its line). */
	markerFrom: number;
	/** End of the marker, including one optional space after the colon. */
	markerTo: number;
	lineFrom: number;
}

export interface FootnoteRef {
	label: string;
	from: number;
	to: number;
}

// Definitions must start a line (CommonMark footnote convention allows up
// to 3 leading spaces, same tolerance as other block starts).
const DEF_LINE_RE = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?/gm;
const TOKEN_RE = /\[\^([^\]\s]+)\]/g;

export function findFootnoteDefinitions(docText: string): FootnoteDef[] {
	const defs: FootnoteDef[] = [];
	DEF_LINE_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = DEF_LINE_RE.exec(docText))) {
		defs.push({
			label: m[1],
			markerFrom: m.index,
			markerTo: m.index + m[0].length,
			lineFrom: m.index,
		});
	}
	return defs;
}

/** All `[^label]` occurrences that are references, not a definition's own
 * opening bracket (definitions are excluded by position, using the same
 * defs list — so a definition's marker is never double-counted). */
export function findFootnoteReferences(docText: string, defs: FootnoteDef[]): FootnoteRef[] {
	const refs: FootnoteRef[] = [];
	TOKEN_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TOKEN_RE.exec(docText))) {
		const from = m.index;
		const to = from + m[0].length;
		const isDefMarker = defs.some((d) => from >= d.markerFrom && from < d.markerTo);
		if (isDefMarker) continue;
		refs.push({ label: m[1], from, to });
	}
	return refs;
}

/** Sequential numbering by order of first REFERENCE appearance in the body
 * — matches how Obsidian's own Reading view numbers footnotes (not
 * definition order, since definitions are often listed in a different
 * order at the bottom). A label that's defined but never referenced still
 * gets a number, appended after all referenced ones, by definition order —
 * an edge case, not the common path, but it shouldn't come out unlabeled. */
export function buildFootnoteNumberMap(docText: string): Map<string, number> {
	const defs = findFootnoteDefinitions(docText);
	const refs = findFootnoteReferences(docText, defs);

	const map = new Map<string, number>();
	let next = 1;
	for (const r of refs) {
		if (!map.has(r.label)) map.set(r.label, next++);
	}
	for (const d of defs) {
		if (!map.has(d.label)) map.set(d.label, next++);
	}
	return map;
}

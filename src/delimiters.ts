import { Delimiters, Profile, Role, RoleMatch, RoleRegex } from "./types";

// Resolves a role's matching delimiters — reads open/close directly if
// present (every role from now on), or derives them from a legacy
// `marker` field so roles saved before open/close existed keep working
// without requiring the user to re-enter anything.
export function resolveDelims(role: Role): Delimiters | null {
	if (role.open && role.close) return { open: role.open, close: role.close };
	if (role.marker) return { open: "{" + role.marker, close: role.marker + "}" };
	return null;
}

// Arabic + Hebrew Unicode blocks (main block, presentation forms A/B) —
// enough to tell "this selection is predominantly RTL script" from
// "predominantly something else" without pulling in a full bidi library.
const RTL_RANGE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function isPredominantlyRtl(text: string): boolean {
	return RTL_RANGE.test(text);
}

// Some delimiter glyphs — notably the "ayah" preset's ornate Arabic
// parentheses ﴿ ﴾ (U+FD3E/FD3F) — are Bidi_Mirrored characters designed
// to look correct wrapping RTL (Arabic) content. Now that roles can be
// applied to ANY selected text (not just Arabic), the same glyphs can end
// up wrapping English/Latin content instead, and render visually
// backwards: the mirroring resolves against whatever embedding direction
// the surrounding paragraph happens to have, not against the actually-
// wrapped content. Wrapping the WHOLE match (open + content + close) in a
// Unicode directional isolate — LRI (U+2066) for predominantly-LTR
// content, RLI (U+2067) for predominantly-RTL, closed by PDI (U+2069) —
// forces the mirroring to resolve consistently against the content that's
// actually there. These are zero-width formatting characters (Unicode
// category Cf), invisible in any renderer, on both sides of the match —
// NOT inside the hidden delimiter zones, so they aren't covered by the
// atomic-range fix in decorations.ts (that only spans matchStart..
// contentStart and contentEnd..matchEnd); in practice this means up to 2
// extra (invisible, real) cursor stops right at each edge of a formatted
// span — a real but minor tradeoff against getting the delimiter's visual
// direction right, not something to silently fold into the "hidden"
// zones without touching the core regex-matching logic in this file.
export function wrapWithDelims(text: string, open: string, close: string): string {
	const isolateStart = isPredominantlyRtl(text) ? "\u2067" : "\u2066"; // RLI : LRI
	return isolateStart + open + text + close + "\u2069"; // PDI
}

// A selection re-drawn over already-formatted text (e.g. re-running
// "Format selection" on a word you just formatted, or re-wrapping with a
// different role) includes the PREVIOUS formatting's delimiters as part
// of the raw selected string — CM6 only hides them from RENDERING, they
// still occupy real positions in the document, so `editor.getSelection()`
// picks them up like any other character. Formatting again without
// accounting for that wraps the ALREADY-wrapped text, nesting layer on
// layer — which is the concrete mechanism behind the reported
// "formatting twice produces gibberish" bug (each layer's role id,
// visible or not, ends up concatenated into the result).
//
// This peels every recognizable layer (a directional-isolate wrapper, a
// complete role-delimiter wrap, or a native **bold**/*italic* wrap) off
// the OUTSIDE of `text`, repeatedly, stopping once nothing more matches.
// It only strips a layer that wraps the ENTIRE remaining string — never
// touches formatting on a sub-part of a larger selection — so re-
// formatting a previously-formatted selection now OVERRIDES cleanly
// (starts from the real underlying content) rather than nesting.
// Deliberately "override", not "merge/adjust": pre-filling the format
// dialog with the previous formatting's own values so the user can
// tweak rather than restate them is a separate, still-open backlog item
// (see PROJECT_CONTEXT.md).
export function unwrapDirectFormatting(text: string, roles: Role[]): string {
	let s = text;
	let changed = true;
	while (changed) {
		changed = false;

		if ((s.startsWith("\u2066") || s.startsWith("\u2067")) && s.endsWith("\u2069") && s.length >= 2) {
			s = s.slice(1, -1);
			changed = true;
			continue;
		}

		for (const r of roles) {
			const delims = resolveDelims(r);
			if (!delims || !delims.open || !delims.close) continue;
			if (
				s.length >= delims.open.length + delims.close.length &&
				s.startsWith(delims.open) &&
				s.endsWith(delims.close)
			) {
				s = s.slice(delims.open.length, s.length - delims.close.length);
				changed = true;
				break;
			}
		}
		if (changed) continue;

		if (s.startsWith("**") && s.endsWith("**") && s.length > 4) {
			s = s.slice(2, -2);
			changed = true;
			continue;
		}
		if (s.startsWith("*") && s.endsWith("*") && !s.startsWith("**") && s.length > 2) {
			s = s.slice(1, -1);
			changed = true;
			continue;
		}
	}
	return s;
}

export function escapeRegExp(str: string): string {


	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds one regex per role from its (possibly multi-character, possibly
// asymmetric) open/close delimiters — "«"/"»", "[?"/"?]", "{="/"=}" all go
// through the same path.
//
// Content matching is plain non-greedy (`[^\n]*?`), NOT a character class
// excluding the role's own delimiter characters. An earlier version
// excluded those characters, reasoning it would stop runaway matches —
// but that broke nesting: excluding "[" from a "[!...!]" role's content
// also blocks matching through a *different* role's "[?...?]" nested
// inside it, since both delimiters start with "[". Non-greedy backtracking
// already finds the nearest valid CLOSE STRING correctly without excluding
// individual characters (verified: "{=first=} plain {=second=}" still
// matches only "{=first=}", not spanning to "second" — the lazy quantifier
// stops at the first successful full close match, character-class
// exclusion was never actually required for that case either).
export function buildRoleRegexes(roles: Role[]): RoleRegex[] {
	const result: RoleRegex[] = [];
	for (const r of roles) {
		if (r.enabled === false) continue;
		const delims = resolveDelims(r);
		if (!delims || !delims.open || !delims.close) continue;
		const escOpen = escapeRegExp(delims.open);
		const escClose = escapeRegExp(delims.close);
		result.push({ role: r, delims, regex: new RegExp(escOpen + "([^\\n]*?)" + escClose, "g") });
	}
	return result;
}

// Cross-profile delimiter clutter: a delimiter pair is "orphaned" after
// switching FROM oldProfile TO newProfile if some ENABLED role in
// oldProfile used it but no ENABLED role in newProfile does. Compares
// literal open+close strings only, not role identity — two roles in
// different profiles that happen to use the same delimiters are treated
// as "the same pair" here on purpose, since this is entirely about
// visual clutter from the leftover TEXT, not about role semantics.
export function computeOrphanedDelimiters(oldProfile: Profile, newProfile: Profile): Delimiters[] {
	const newPairs = new Set<string>();
	for (const r of newProfile.roles) {
		if (r.enabled === false) continue;
		const d = resolveDelims(r);
		if (d) newPairs.add(d.open + "\u0000" + d.close);
	}

	const seen = new Set<string>();
	const orphaned: Delimiters[] = [];
	for (const r of oldProfile.roles) {
		if (r.enabled === false) continue;
		const d = resolveDelims(r);
		if (!d) continue;
		const key = d.open + "\u0000" + d.close;
		if (newPairs.has(key) || seen.has(key)) continue;
		seen.add(key);
		orphaned.push(d);
	}
	return orphaned;
}

// Same regex construction as buildRoleRegexes, but for a bare list of
// delimiter pairs with no role behind them — used only to find and
// cosmetically hide leftover clutter after a profile switch (see
// computeOrphanedDelimiters above), never to apply any role's styling.
export function buildOrphanedRegexes(pairs: Delimiters[]): { delims: Delimiters; regex: RegExp }[] {
	return pairs
		.filter((d) => d.open && d.close)
		.map((d) => ({
			delims: d,
			regex: new RegExp(escapeRegExp(d.open) + "([^\\n]*?)" + escapeRegExp(d.close), "g"),
		}));
}

// Nesting is bounded by recursion depth, not hardcoded — but capped, since
// a pathological input (deeply repeated delimiters) could otherwise force
// very deep recursion. Each recursive call operates on a strictly smaller
// substring than its parent, so this can't loop forever even without the
// cap; the cap only bounds worst-case work on adversarial input.
const MAX_NESTING_DEPTH = 6;

interface RawMatch {
	role: Role;
	matchStart: number;
	matchEnd: number;
	contentStart: number;
	contentEnd: number;
}

function findRawMatches(text: string, textFrom: number, roleRegexes: RoleRegex[]): RawMatch[] {
	const found: RawMatch[] = [];
	for (const { role, delims, regex } of roleRegexes) {
		regex.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(text))) {
			const full = m[0];
			const matchStart = textFrom + m.index;
			const matchEnd = matchStart + full.length;
			found.push({
				role,
				matchStart,
				matchEnd,
				contentStart: matchStart + delims.open.length,
				contentEnd: matchEnd - delims.close.length,
			});
		}
	}
	return found;
}

// Finds matches in `lineText` (an absolute-coordinates substring starting
// at `lineFrom`), and — new — recurses into each match's own content to
// find roles nested inside it, attaching them as `.children` rather than
// discarding them as a conflicting overlap. Two matches that merely
// overlap without one fully containing the other are still ambiguous and
// still get skipped (first one wins, same as before) — only genuine
// containment becomes nesting.
export function findLineMatches(lineText: string, lineFrom: number, roleRegexes: RoleRegex[], depth = 0): RoleMatch[] {
	const found = findRawMatches(lineText, lineFrom, roleRegexes);
	// Ascending start; when two matches start at the same position, the
	// longer one is treated as the outer one.
	found.sort((a, b) => a.matchStart - b.matchStart || b.matchEnd - b.matchStart - (a.matchEnd - a.matchStart));

	const result: RoleMatch[] = [];
	let lastEnd = -1;
	for (const f of found) {
		if (f.matchStart < lastEnd) continue; // overlaps a previously accepted match at THIS level — ambiguous, skip
		if (f.contentEnd < f.contentStart) continue; // malformed

		let children: RoleMatch[] = [];
		if (depth < MAX_NESTING_DEPTH && f.contentEnd > f.contentStart) {
			const innerText = lineText.slice(f.contentStart - lineFrom, f.contentEnd - lineFrom);
			children = findLineMatches(innerText, f.contentStart, roleRegexes, depth + 1);
		}

		result.push({ ...f, children });
		lastEnd = f.matchEnd;
	}
	return result;
}

// Finds the outermost existing role match (if any) on `lineText` whose
// span fully CONTAINS [fromCh, toCh) — used before re-formatting/re-
// wrapping a selection, to find the REAL boundaries of any formatting
// already there, rather than trusting the raw selected text's own
// boundaries to include it.
//
// That distinction is the actual root cause of "reformatting already-
// formatted text produces gibberish" surviving the previous attempted
// fix (which only stripped old delimiters found INSIDE the raw
// selection string, via unwrapDirectFormatting — correct as far as it
// went, but built on a false assumption). The same round's separate
// atomic-ranges fix made real click-drag text selection in CM6 correctly
// stop AT the edge of a hidden delimiter zone instead of stepping
// through it — which is exactly the fix that made copying formatted
// text stop producing gibberish. But it means a user re-selecting a
// formatted word by eye now gets a selection that EXCLUDES the hidden
// delimiters on both sides, not one that includes them. Replacing only
// that inner range leaves the OLD delimiters sitting in the document
// immediately outside the new replacement, now orphaned — unmatched by
// any role's regex (since the old open and old close are no longer
// adjacent to their own former content), so they render as their raw,
// undecorated Private-Use-Area characters: visible tofu-box glyphs
// mixed into otherwise normal text, which is exactly what was reported.
//
// Only searches TOP-LEVEL matches — `findLineMatches` already returns
// just the outermost, non-overlapping matches per line (nested ones are
// each match's own `.children`), which is exactly "the real boundaries
// of whatever formatting is here," regardless of how many layers deep
// unwrapDirectFormatting will need to peel once it's handed this match's
// full text.
export function findEnclosingRoleMatch(lineText: string, fromCh: number, toCh: number, roles: Role[]): RoleMatch | null {
	const regexes = buildRoleRegexes(roles);
	if (!regexes.length) return null;
	const matches = findLineMatches(lineText, 0, regexes);
	for (const m of matches) {
		if (m.matchStart <= fromCh && m.matchEnd >= toCh) return m;
	}
	return null;
}

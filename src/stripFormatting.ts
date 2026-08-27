import { AdvancedFormattingSettings, Delimiters } from "./types";
import { resolveDelims, buildOrphanedRegexes } from "./delimiters";

// Every delimiter pair this plugin could have EVER written into a note,
// across every profile and every role — named or hidden/ephemeral,
// enabled or disabled. Deliberately ignores role.enabled and profile
// identity: a disabled role's delimiters, or a role from a profile the
// user isn't even using anymore, can still be sitting in a note as
// literal text (that's the same "orphaned delimiter" situation
// computeOrphanedDelimiters/decorations.ts already cosmetically hide
// while the plugin is running — see delimiters.ts). "Strip formatting"
// is the actual removal counterpart to that cosmetic hiding, so it has
// to catch everything those roles could have produced, not just
// whatever's currently active.
//
// Also naturally covers legacy delimiters from ephemeral roles created
// before the sentinel scheme changed (see directFormat.ts) — a role
// object created back then still has its ORIGINAL open/close saved
// verbatim on it, so it's picked up here with no special-casing.
export function collectAllDelimiterPairs(settings: AdvancedFormattingSettings): Delimiters[] {
	const seen = new Set<string>();
	const pairs: Delimiters[] = [];
	for (const profile of settings.profiles) {
		for (const role of profile.roles) {
			const d = resolveDelims(role);
			if (!d || !d.open || !d.close) continue;
			const key = d.open + "\u0000" + d.close;
			if (seen.has(key)) continue;
			seen.add(key);
			pairs.push(d);
		}
	}
	return pairs;
}

// Repeatedly strips every known delimiter pair from `line`, replacing
// each full match with just its inner content — the same "peel one
// layer, repeat until nothing changes" approach as
// unwrapDirectFormatting (delimiters.ts), generalized from "the whole
// string is one wrapped span" to "find and unwrap every wrapped span
// anywhere in the line, as many times as it takes." That generalization
// is what's needed to fully flatten NESTED roles (a role wrapped inside
// another role, see README's "Nested roles") in one pass over the line,
// rather than requiring the caller to already know the nesting depth.
//
// Matches never cross a line boundary anywhere else in this codebase
// (delimiters.ts's buildRoleRegexes/findLineMatches) — this keeps that
// same constraint and operates one line at a time.
export function stripDelimitersFromLine(line: string, pairs: Delimiters[]): string {
	let s = line;
	if (pairs.length) {
		const regexes = buildOrphanedRegexes(pairs); // same {delims, regex} construction buildRoleRegexes uses, for a bare pair list with no role behind it
		let changed = true;
		let guard = 0;
		// Bounded the same spirit as findLineMatches's MAX_NESTING_DEPTH —
		// real notes nest at most a handful of levels (verified to 3 in
		// the README); this only guards against a deliberately
		// adversarial line looping a very long time.
		while (changed && guard < 20) {
			changed = false;
			guard++;
			for (const { regex } of regexes) {
				regex.lastIndex = 0;
				const next = s.replace(regex, "$1");
				if (next !== s) {
					s = next;
					changed = true;
				}
			}
		}
	}
	return stripStrayIsolates(s);
}

// Once every role's own open/close is gone, any LRI/RLI...PDI
// directional-isolate wrapper that surrounded it (wrapWithDelims,
// delimiters.ts — added around every role-wrapped span to keep
// mirrored-glyph delimiters like the ayah preset's ﴿﴾ rendering the
// right way round) is now orphaned too: its whole purpose no longer
// applies to plain text, and left behind it's a small number of
// genuinely invisible but real extra characters. Only touches a
// start-isolate immediately followed (later on the line, with no OTHER
// start-isolate in between) by an end-isolate, so an isolate character
// the user or some other plugin added for an unrelated reason is left
// alone.
function stripStrayIsolates(line: string): string {
	return line.replace(/[\u2066\u2067]([^\u2066\u2067\u2069]*)\u2069/g, "$1");
}

export interface StripResult {
	text: string;
	changed: boolean;
}

// Full-note version of stripDelimitersFromLine — splits on "\n" rather
// than operating on the whole string as one regex target, consistent
// with matches never crossing a line boundary elsewhere in this
// codebase, and rejoins with "\n" (line endings inside a note body are
// already normalized to "\n" by the time Obsidian hands text to a
// plugin, same assumption every other line-based function here makes).
export function stripDelimitersFromText(fullText: string, pairs: Delimiters[]): StripResult {
	const lines = fullText.split("\n");
	let changed = false;
	const out = lines.map((line) => {
		const stripped = stripDelimitersFromLine(line, pairs);
		if (stripped !== line) changed = true;
		return stripped;
	});
	return { text: out.join("\n"), changed };
}
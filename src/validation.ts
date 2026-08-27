import { Notice } from "obsidian";
import { Role } from "./types";
import { resolveDelims } from "./delimiters";

// Native Markdown/Obsidian tokens a role's delimiter shouldn't collide
// with — using one of these verbatim would fight with (or silently break)
// Obsidian's own formatting for that token.
const NATIVE_TOKENS = ["**", "*", "__", "_", "~~", "==", "`", "```", "#"];

export function validateRoles(roles: Role[]): void {
	const seen = new Map<string, string>();
	for (const r of roles) {
		if (r.enabled === false) continue;
		const delims = resolveDelims(r);
		if (!delims || !delims.open || !delims.close) {
			new Notice(
				'Advanced Formatting: "' + (r.label || r.id) + '" has no open/close delimiters set and will be ignored until you set them.'
			);
			continue;
		}
		const key = delims.open + "\u0000" + delims.close;
		if (seen.has(key)) {
			new Notice(
				'Advanced Formatting: "' + (r.label || r.id) + '" uses the exact same open/close as "' + seen.get(key) + '" — give them different delimiters.'
			);
		}
		seen.set(key, r.label || r.id);
		// Soft warning only, not a hard block: a Latin letter as the first
		// character of "open" risks the same RTL-flip bug a full word tag
		// caused earlier (Unicode bidi picks direction from the first
		// strong character; punctuation is skipped, letters aren't).
		if (/^[A-Za-z]/.test(delims.open)) {
			new Notice(
				'Advanced Formatting: "' + (r.label || r.id) + '" starts with a Latin letter ("' + delims.open + '") — this can flip an Arabic line to LTR. A symbol is safer.'
			);
		}
		if (NATIVE_TOKENS.includes(delims.open) || NATIVE_TOKENS.includes(delims.close)) {
			new Notice(
				'Advanced Formatting: "' + (r.label || r.id) + '" uses "' + delims.open + '"/"' + delims.close + '", which is also native Markdown syntax — this will likely fight with Obsidian\'s own formatting for that token.'
			);
		}
	}
}

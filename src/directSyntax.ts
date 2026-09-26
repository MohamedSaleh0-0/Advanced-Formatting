import { DirectFormatOptions, defaultDirectFormatOptions } from "./directFormat";
import { Role } from "./types";

export const DIRECT_OPEN = "~={";
export const DIRECT_CLOSE = "=~";

// Keep the formatting metadata out of the surrounding paragraph's Unicode
// bidi calculation. LRI/PDI are invisible and affect only the metadata
// between them; the user's formatted text remains in the paragraph's normal
// direction context. This works for Arabic, Hebrew, Syriac, Thaana, N'Ko,
// Adlam, and other RTL scripts without needing a language-specific branch.
const BIDI_ISOLATE_OPEN = "\u2066";
const BIDI_ISOLATE_RTL = "\u2067";
const BIDI_ISOLATE_CLOSE = "\u2069";
const BIDI_ISOLATES = /[\u2066\u2067\u2068\u2069]/g;

export type BidiDirection = "ltr" | "rtl";

// Numbers and punctuation do not establish paragraph direction. This is
// intentionally a first-strong scan, rather than an RTL-character presence
// check: an English line that ends with an Arabic citation must remain LTR.
const RTL_STRONG = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG = /[A-Za-z\u00C0-\u02AF\u0370-\u052F]/;

export function detectTextDirection(text: string): BidiDirection {
	for (const char of text) {
		if (RTL_STRONG.test(char)) return "rtl";
		if (LTR_STRONG.test(char)) return "ltr";
	}
	return "ltr";
}

function isolateAttributes(attributes: string, direction: BidiDirection): string {
	const isolate = direction === "rtl" ? BIDI_ISOLATE_RTL : BIDI_ISOLATE_OPEN;
	return isolate + attributes + BIDI_ISOLATE_CLOSE;
}

function normalizeAttributes(raw: string): string {
	return raw.replace(BIDI_ISOLATES, "");
}

export interface DirectSyntaxMatch {
	matchStart: number;
	matchEnd: number;
	contentStart: number;
	contentEnd: number;
	opts: DirectFormatOptions;
	role?: Role;
}

function unquote(value: string): string {
	const trimmed = value.trim();
	return trimmed.replace(/^(["'])(.*)\1$/, "$2");
}

export function parseDirectAttributes(raw: string): DirectFormatOptions | null {
	const opts = defaultDirectFormatOptions();
	const normalized = normalizeAttributes(raw);
	const shorthand = normalized.trim();
	if (/^(#[0-9a-f]{3,8}|[a-z][a-z0-9-]*)$/i.test(shorthand)) {
		opts.color = shorthand;
		return opts;
	}

	const parts = normalized.split(";");
	for (let partIndex = 0; partIndex < parts.length; partIndex++) {
		const part = parts[partIndex];
		const token = part.trim();
		if (!token) continue;
		const colon = token.indexOf(":");
		if (colon === -1) {
			if (token === "bold") opts.bold = true;
			else if (token === "italic") opts.italic = true;
			else if (token === "underline") opts.underline = true;
			else return null;
			continue;
		}
		const key = token.slice(0, colon).trim().toLowerCase();
		const value = unquote(token.slice(colon + 1));
		if (!value) continue;
		switch (key) {
			case "color": opts.color = value; break;
			case "background":
			case "bg": opts.backgroundColor = value; break;
			case "font": opts.fontFamily = value; break;
			case "size": {
				const n = Number(value);
				if (!Number.isFinite(n)) return null;
				opts.sizeEm = n;
				break;
			}
			case "css":
				// CSS is the final attribute because CSS declarations contain
				// semicolons themselves. Treat the remainder as one value.
				opts.customCss = normalized.slice(normalized.indexOf(":", normalized.indexOf(token)) + 1).trim();
				partIndex = parts.length;
				break;
			case "role": return null;
			default: return null;
		}
	}
	return hasDirectAttributes(opts) ? opts : null;
}

export function hasDirectAttributes(opts: DirectFormatOptions): boolean {
	return opts.bold || opts.italic || opts.underline || !!opts.color || !!opts.backgroundColor ||
		!!opts.fontFamily || opts.sizeEm != null || !!opts.customCss.trim();
}

export function findDirectMatches(text: string, textFrom = 0): DirectSyntaxMatch[] {
	const result: DirectSyntaxMatch[] = [];
	const openRe = /~=\{([^\n{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = openRe.exec(text))) {
		const close = text.indexOf(DIRECT_CLOSE, match.index + match[0].length);
		if (close === -1) continue;
		const opts = parseDirectAttributes(match[1]);
		if (!opts) continue;
		const contentStart = match.index + match[0].length;
		result.push({
			matchStart: textFrom + match.index,
			matchEnd: textFrom + close + DIRECT_CLOSE.length,
			contentStart: textFrom + contentStart,
			contentEnd: textFrom + close,
			opts,
		});
		openRe.lastIndex = close + DIRECT_CLOSE.length;
	}
	return result;
}

export function findRoleSyntaxMatches(text: string, roles: Role[], textFrom = 0): DirectSyntaxMatch[] {
	const result: DirectSyntaxMatch[] = [];
	const re = new RegExp("~=\\{(?:[\\u2066\\u2067])?role:([^}\\n]+)(?:" + BIDI_ISOLATE_CLOSE + ")?\\}", "g");
	let match: RegExpExecArray | null;
	while ((match = re.exec(text))) {
		const roleId = normalizeAttributes(match[1]);
		const role = roles.find((candidate) => candidate.enabled !== false && (candidate.id === roleId || candidate.label === roleId));
		if (!role) continue;
		const close = text.indexOf(DIRECT_CLOSE, match.index + match[0].length);
		if (close === -1) continue;
		const contentStart = match.index + match[0].length;
		result.push({ matchStart: textFrom + match.index, matchEnd: textFrom + close + DIRECT_CLOSE.length, contentStart: textFrom + contentStart, contentEnd: textFrom + close, opts: {
			bold: role.bold, italic: role.italic, underline: role.underline, color: role.color || "", backgroundColor: role.highlightColor || "", fontFamily: role.fontFamily || "", sizeEm: role.sizeEm, customCss: role.customCss || "",
		}, role });
		re.lastIndex = close + DIRECT_CLOSE.length;
	}
	return result;
}

export function unwrapReadableSyntax(text: string, roles: Role[]): string {
	let value = text;
	let changed = true;
	while (changed) {
		changed = false;
		// A selection can contain plain text alongside an already-formatted
		// word. Remove one layer anywhere in that selection, not only when
		// the selection itself is exactly one complete formatted span. This
		// also peels malformed-looking nested direct syntax one layer at a
		// time: the first parser pass may pair an outer opener with an inner
		// closer, but the next pass then sees and removes the remaining layer.
		const matches = [...findDirectMatches(value), ...findRoleSyntaxMatches(value, roles)]
			.sort((a, b) => a.matchStart - b.matchStart || b.matchEnd - a.matchEnd);
		const match = matches[0];
		if (!match) break;
		value = value.slice(0, match.matchStart) + value.slice(match.contentStart, match.contentEnd) + value.slice(match.matchEnd);
		changed = true;
	}
	return value;
}

export function buildRoleSyntaxMarkup(text: string, role: Role, direction = detectTextDirection(text)): string {
	return DIRECT_OPEN + isolateAttributes("role:" + (role.id || role.label), direction) + "}" + text + DIRECT_CLOSE;
}

export function directOptionsToAttributes(opts: DirectFormatOptions): string {
	const attrs: string[] = [];
	if (opts.color) attrs.push("color:" + opts.color);
	if (opts.backgroundColor) attrs.push("bg:" + opts.backgroundColor);
	if (opts.fontFamily) attrs.push("font:" + opts.fontFamily);
	if (opts.sizeEm != null) attrs.push("size:" + opts.sizeEm);
	if (opts.bold) attrs.push("bold");
	if (opts.italic) attrs.push("italic");
	if (opts.underline) attrs.push("underline");
	if (opts.customCss.trim()) attrs.push("css:" + opts.customCss.trim());
	return attrs.join("; ");
}

export function buildDirectSyntaxMarkup(text: string, opts: DirectFormatOptions, direction = detectTextDirection(text)): string {
	if (!text || !hasDirectAttributes(opts)) return text;
	const hasNonNative = opts.underline || !!opts.color || !!opts.backgroundColor || !!opts.fontFamily || opts.sizeEm != null || !!opts.customCss.trim();
	if (!hasNonNative) {
		let native = text;
		if (opts.italic) native = "*" + native + "*";
		if (opts.bold) native = "**" + native + "**";
		return native;
	}
	const attrs = opts.color && !opts.bold && !opts.italic && !opts.underline && !opts.backgroundColor && !opts.fontFamily && opts.sizeEm == null && !opts.customCss.trim()
		? opts.color
		: directOptionsToAttributes(opts);
	return DIRECT_OPEN + isolateAttributes(attrs, direction) + "}" + text + DIRECT_CLOSE;
}

export function directOptionsToStyle(opts: DirectFormatOptions): string {
	const css: string[] = [];
	if (opts.bold) css.push("font-weight:700");
	if (opts.italic) css.push("font-style:italic");
	if (opts.underline) css.push("text-decoration:underline");
	if (opts.color) css.push("color:" + opts.color);
	if (opts.backgroundColor) css.push("background-color:" + opts.backgroundColor);
	if (opts.fontFamily) css.push("font-family:" + opts.fontFamily);
	if (opts.sizeEm != null) css.push("font-size:" + opts.sizeEm + "em");
	if (opts.customCss.trim()) css.push(opts.customCss.trim());
	return css.join("; ");
}

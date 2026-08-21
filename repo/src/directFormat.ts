import { Profile, Role } from "./types";
import { wrapWithDelims } from "./delimiters";

// Direct/instance formatting — the MS-Word-style "select this text and
// format it" command. Still deliberately separate from the ordinary Role
// system in that nothing here is user-named or shown in Settings — but as
// of this revision it's built ENTIRELY OUT OF an ordinary Role under the
// hood, auto-generated and pushed into the active profile, rather than raw
// inline HTML.
//
// Why the pivot: the first version wrapped non-native properties (color,
// background, font, size, underline) in a raw `<span style="...">`. That
// failed in real Obsidian — Live Preview showed the literal tag text
// instead of rendering it, and in the observed case the wrapped word
// vanished entirely, rather than degrading gracefully. Obsidian's Live
// Preview does not reliably render arbitrary raw inline HTML the way
// Reading view does; this was the one thing flagged as unverified without
// a live Obsidian to test against, and it broke exactly as flagged.
//
// The role/delimiter/decoration/stylesheet pipeline (delimiters.ts,
// decorations.ts, readingMode.ts, stylesheet.ts) is the one mechanism in
// this codebase actually proven to render live, in both Live Preview and
// Reading view, across many earlier rounds — because it's what every
// named role already runs on. Routing this feature through the same
// pipeline means it inherits that track record instead of retesting a new
// one. Concretely: every property WITHOUT native Markdown syntax (color,
// background/highlight color, font family, font size, underline, extra
// CSS) becomes an auto-generated, hidden, one-off Role, matched via
// Private-Use-Area-sentinel delimiters that can't collide with anything a
// user could type or any preset role's own delimiters. Bold and italic —
// which DO have native Markdown syntax — stay OUTSIDE that role entirely,
// as real `**`/`*`, per the original ask to keep them native rather than
// folding them into the role's own bold/italic CSS fields: not just
// stylistic — it means a selection formatted with ONLY bold/italic (no
// other property) never touches the role system at all, produces zero
// proprietary delimiters, and renders correctly in any Markdown reader,
// this plugin or not.
export interface DirectFormatOptions {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	/** Empty string = not applied. */
	color: string;
	/** Empty string = not applied. Maps to Role.highlightColor. */
	backgroundColor: string;
	/** Empty string = not applied. */
	fontFamily: string;
	/** null = not applied. */
	sizeEm: number | null;
	/** Raw extra CSS declarations, spliced into the role's rule same as
	 * any named role's customCss escape hatch. Empty = not applied. */
	customCss: string;
}

export function defaultDirectFormatOptions(): DirectFormatOptions {
	return {
		bold: false,
		italic: false,
		underline: false,
		color: "",
		backgroundColor: "",
		fontFamily: "",
		sizeEm: null,
		customCss: "",
	};
}

export function hasAnyFormatting(opts: DirectFormatOptions): boolean {
	return (
		opts.bold ||
		opts.italic ||
		opts.underline ||
		!!opts.color ||
		!!opts.backgroundColor ||
		!!opts.fontFamily ||
		opts.sizeEm != null ||
		!!opts.customCss.trim()
	);
}

// True only for the properties that end up on the auto-generated Role
// (i.e. everything except bold/italic, which never touch it).
function needsRole(opts: DirectFormatOptions): boolean {
	return (
		opts.underline ||
		!!opts.color ||
		!!opts.backgroundColor ||
		!!opts.fontFamily ||
		opts.sizeEm != null ||
		!!opts.customCss.trim()
	);
}

// One CSS-relevant signature per distinct combination of role-backed
// properties — used to find and reuse an already-existing ephemeral role
// rather than creating a new one every single time the same formatting is
// applied again. Bounds growth to the number of DISTINCT styles actually
// used, not the number of times the command is run; doesn't reclaim a
// role that's no longer referenced anywhere in the vault (that would need
// a vault-wide scan this doesn't do — see PROJECT_CONTEXT.md backlog).
function signature(opts: DirectFormatOptions): string {
	return [opts.underline ? "u" : "", opts.color, opts.backgroundColor, opts.fontFamily, opts.sizeEm ?? "", opts.customCss.trim()].join(
		"\u0000"
	);
}

function roleSignature(r: Role): string {
	return [r.underline ? "u" : "", r.color, r.highlightColor, r.fontFamily, r.sizeEm ?? "", r.customCss.trim()].join("\u0000");
}

// Private-Use-Area sentinels: never appear in normal typed text, never
// collide with a human-chosen delimiter like the presets' <<>>, [?...?],
// {=...=}. The unique id sandwiched inside guarantees two DIFFERENT
// ephemeral roles never match each other's text either.
//
// The id itself is encoded into a SECOND range of Private-Use-Area code
// points (U+E100 upward) rather than written as its own literal base36
// characters — the earlier version embedded the raw readable id (e.g.
// "dfmsqh3gmx") directly in the delimiter. That's invisible in Live
// Preview (CM6 decoration hides it), but the RAW document text still
// contains that readable string — so any time the raw text leaks past
// the decoration layer (a selection that includes it, or a clipboard
// copy that isn't intercepted), what appears is that readable id
// fragment, which is exactly the "gibberish" reported: distinct id
// strings from separate formatting passes concatenated together with
// the real word. Encoding the id itself into invisible code points too
// means a leak surfaces as invisible/empty characters, not garbage text
// — the id is still just as unique, just no longer human-readable.
const INVISIBLE_ID_BASE = 0xe100;
function encodeInvisibleId(id: string): string {
	return Array.from(id)
		.map((ch) => String.fromCodePoint(INVISIBLE_ID_BASE + parseInt(ch, 36)))
		.join("");
}
function makeDelims(id: string): { open: string; close: string } {
	const enc = encodeInvisibleId(id);
	return { open: "\uE000" + enc, close: "\uE001" + enc };
}

// Matches the existing "prefix" + Date.now() convention used everywhere
// else in this codebase for auto-generated ids (see main.ts/settingsTab.ts
// profile/role duplication) — short and consistent, rather than a longer
// scheme invented just for this feature.
//
// The counter suffix is the one addition beyond that convention: plain
// Date.now() alone is only millisecond-resolution, so two ephemeral
// roles built in quick succession (e.g. re-formatting something twice
// fast enough to land in the same millisecond) could otherwise get the
// IDENTICAL id — and therefore identical delimiters, breaking the "every
// ephemeral role's delimiters are unique" assumption findEnclosingRoleMatch
// and the regex matcher both depend on. Found while writing this round's
// sanity tests (two roles built back-to-back in one synchronous test
// script collided), not the actual cause of the reported gibberish bug —
// that was findEnclosingRoleMatch's real fix, in delimiters.ts — but a
// real latent bug regardless, worth closing at the same time.
let idCounter = 0;
function freshId(): string {
	idCounter = (idCounter + 1) % 1296; // wraps every 1296 calls; two base-36 digits
	return "df" + Date.now().toString(36) + idCounter.toString(36).padStart(2, "0");
}

// Finds a reusable ephemeral role in `profile` with an identical style
// signature, or builds (but does NOT push into profile.roles — the
// caller does that, same as createProfile/duplicateProfile in main.ts
// only ever return a value and let the caller decide what to do with it)
// a brand new one otherwise. Returns null if this formatting doesn't need
// a role at all (bold/italic only, or nothing at all).
export function findOrBuildEphemeralRole(profile: Profile, opts: DirectFormatOptions): Role | null {
	if (!needsRole(opts)) return null;

	const sig = signature(opts);
	const existing = profile.roles.find((r) => r.hidden && roleSignature(r) === sig);
	if (existing) return existing;

	const id = freshId();
	const delims = makeDelims(id);
	return {
		id,
		label: "",
		open: delims.open,
		close: delims.close,
		color: opts.color,
		bold: false,
		italic: false,
		underline: opts.underline,
		fontFamily: opts.fontFamily,
		sizeEm: opts.sizeEm,
		highlightColor: opts.backgroundColor,
		customCss: opts.customCss,
		enabled: true,
		hidden: true,
		delimiterDisplay: "hide",
	};
}

// Builds the actual text to insert: the role-delimited span (if `role` is
// non-null) or the raw text (if not), with bold/italic wrapped natively
// OUTSIDE that — same emergent `***text***` behavior as before when both
// are set, since it's still just string concatenation.
export function buildDirectFormatMarkup(text: string, opts: DirectFormatOptions, role: Role | null): string {
	if (!text) return text;
	let core = text;
	if (role && role.open && role.close) core = wrapWithDelims(text, role.open, role.close);
	if (opts.italic) core = "*" + core + "*";
	if (opts.bold) core = "**" + core + "**";
	return core;
}

// Reverse of buildDirectFormatMarkup. Given a line's text and an existing
// role match's span within it (from findEnclosingRoleMatch in
// delimiters.ts), figures out the FULL current formatting: the role's
// own properties, PLUS whether it's also wrapped in native **/* — those
// live OUTSIDE the role entirely (see buildDirectFormatMarkup above), so
// they're never part of the role match itself and have to be detected
// separately by looking at what's immediately outside its edges. Also
// grows the range to include that outer wrapping, so a caller replacing
// [from, to) removes it too rather than leaving it to double up
// (`**` + new `**` = `****`).
//
// Used to pre-fill "Format selection" with what's actually there instead
// of a blank form, and to make Colorize/wrap-as-role MERGE with existing
// formatting rather than silently discarding whatever property they
// don't themselves touch (e.g. Colorize only sets color — without this,
// re-running it on bold+underlined text would drop both).
export function detectExistingFormatAroundRole(
	lineText: string,
	matchStart: number,
	matchEnd: number,
	role: Role
): { from: number; to: number; opts: DirectFormatOptions } {
	let from = matchStart;
	let to = matchEnd;
	let italic = false;
	let bold = false;
	// wrapWithDelims (delimiters.ts) always adds a directional-isolate
	// wrapper (LRI/RLI ... PDI) immediately OUTSIDE the role's own
	// open/close delimiters whenever a role is involved — so it sits
	// between the role match boundary and any bold/italic stars, not
	// coincident with either. Not user-facing formatting (it's automatic
	// bidi correctness), so it doesn't set any opts flag — just needs to
	// be skipped past before checking for stars, or the checks below
	// would be looking at the isolate characters instead of the stars
	// one position further out.
	if ((lineText[from - 1] === "\u2066" || lineText[from - 1] === "\u2067") && lineText[to] === "\u2069") {
		from -= 1;
		to += 1;
	}
	// Bold (**) is the OUTERMOST wrapper (see buildDirectFormatMarkup:
	// `**` + `*` + role-wrapped-content + `*` + `**`) — must be checked
	// and stripped BEFORE italic, or italic's single-`*` check consumes
	// one star of what's actually a bold marker and the bold check that
	// follows no longer sees a clean `**` next to the (now wrong)
	// boundary.
	if (lineText.slice(from - 2, from) === "**" && lineText.slice(to, to + 2) === "**") {
		bold = true;
		from -= 2;
		to += 2;
	}
	if (lineText[from - 1] === "*" && lineText[to] === "*") {
		italic = true;
		from -= 1;
		to += 1;
	}
	return {
		from,
		to,
		opts: {
			bold,
			italic,
			underline: !!role.underline,
			color: role.color || "",
			backgroundColor: role.highlightColor || "",
			fontFamily: role.fontFamily || "",
			sizeEm: role.sizeEm,
			customCss: role.customCss || "",
		},
	};
}

// The case detectExistingFormatAroundRole can't cover: a selection whose
// ONLY existing direct formatting is native bold/italic, with no role
// involved at all — needsRole() is false for that combination (see
// above), so there's no role match to find in the first place. Checked
// as a fallback when findEnclosingRoleMatch finds nothing.
export function detectBareBoldItalic(
	lineText: string,
	fromCh: number,
	toCh: number
): { from: number; to: number; opts: DirectFormatOptions } | null {
	let from = fromCh;
	let to = toCh;
	let italic = false;
	let bold = false;
	// Same "bold is outermost, check it first" reasoning as
	// detectExistingFormatAroundRole above.
	if (lineText.slice(from - 2, from) === "**" && lineText.slice(to, to + 2) === "**") {
		bold = true;
		from -= 2;
		to += 2;
	}
	if (lineText[from - 1] === "*" && lineText[to] === "*") {
		italic = true;
		from -= 1;
		to += 1;
	}
	if (!bold && !italic) return null;
	return { from, to, opts: Object.assign(defaultDirectFormatOptions(), { bold, italic }) };
}

// Preview-only: a live CSS approximation of the final look, rendered
// directly in the modal's own DOM (never written to the note) so the user
// gets visual feedback without staring at opaque delimiter characters.
export function buildPreviewStyle(opts: DirectFormatOptions): string {
	const decls: string[] = [];
	if (opts.bold) decls.push("font-weight: 700");
	if (opts.italic) decls.push("font-style: italic");
	if (opts.underline) decls.push("text-decoration: underline");
	if (opts.color) decls.push("color: " + opts.color);
	if (opts.backgroundColor) decls.push("background-color: " + opts.backgroundColor);
	if (opts.fontFamily) decls.push("font-family: " + opts.fontFamily);
	if (opts.sizeEm != null) decls.push("font-size: " + opts.sizeEm + "em");
	const extra = opts.customCss.trim().replace(/;\s*$/, "");
	if (extra) decls.push(extra);
	return decls.join("; ");
}

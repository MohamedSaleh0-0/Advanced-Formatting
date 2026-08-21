import { App, MarkdownPostProcessorContext, Plugin } from "obsidian";
import { AdvancedFormattingSettings, RoleMatch } from "./types";
import { getActiveProfile } from "./defaults";
import { buildRoleRegexes, findLineMatches, resolveDelims } from "./delimiters";
import { shouldApplyToFile } from "./scope";
import { convertDigitsToArabicIndic } from "./footnotes";
import { FORCE_RTL_MARKER, FORCE_LTR_MARKER } from "./direction";
import { ALIGN_LEFT_MARKER, ALIGN_CENTER_MARKER, ALIGN_RIGHT_MARKER, BOLD_ON_MARKER, BOLD_OFF_MARKER } from "./headingOverrides";
import { scanRenderedTextMarkers, isKnownMarker } from "./lineMarkers";

export interface ReadingModePlugin extends Plugin {
	app: App;
	settings: AdvancedFormattingSettings;
}

// Builds a real nested <span> for a match: the outer span's textContent
// is only the leaf/non-nested-child parts; each child role gets its own
// nested <span> inside it. This is what lets CSS inheritance (color,
// font-family, font-weight, font-style) fall through from an outer role
// to an inner one that doesn't set its own — no JS merge logic needed.
//
// Delimiter display: default ("auto"/"hide") drops the delimiter
// characters entirely, same as Reading view already never shows raw `**`
// around bold text. "show" renders the real literal delimiters; "alias"
// renders the alias text instead — always, since Reading view has no
// cursor to reveal-on-focus with (same reason a wikilink alias never
// shows its target in Reading view either).
function buildSpanForMatch(m: RoleMatch, text: string): HTMLSpanElement {
	const span = document.createElement("span");
	span.className = "af-role-" + m.role.id;

	const mode = m.role.delimiterDisplay || "auto";
	let prefix = "";
	let suffix = "";
	if (mode === "show") {
		const delims = resolveDelims(m.role);
		prefix = delims ? delims.open : "";
		suffix = delims ? delims.close : "";
	} else if (mode === "alias") {
		prefix = m.role.aliasOpen || "";
		suffix = m.role.aliasClose || "";
	}

	if (prefix) {
		const openSpan = document.createElement("span");
		openSpan.className = "af-role-tag-shown";
		openSpan.textContent = prefix;
		span.appendChild(openSpan);
	}

	if (!m.children.length) {
		span.appendChild(document.createTextNode(text.slice(m.contentStart, m.contentEnd)));
	} else {
		let cursor = m.contentStart;
		for (const child of m.children) {
			if (child.matchStart > cursor) {
				span.appendChild(document.createTextNode(text.slice(cursor, child.matchStart)));
			}
			span.appendChild(buildSpanForMatch(child, text));
			cursor = child.matchEnd;
		}
		if (cursor < m.contentEnd) {
			span.appendChild(document.createTextNode(text.slice(cursor, m.contentEnd)));
		}
	}

	if (suffix) {
		const closeSpan = document.createElement("span");
		closeSpan.className = "af-role-tag-shown";
		closeSpan.textContent = suffix;
		span.appendChild(closeSpan);
	}

	return span;
}

// Reading view already builds a full footnotes block natively (hr +
// numbered list) — unlike Live Preview, nothing needs to be constructed
// here. Only the inline reference marker's actual digit characters need
// converting; the footnote LIST's own numbers are a browser-generated
// ::marker from list-style-type (set to "arabic-indic" in stylesheet.ts),
// not real text, so there's nothing here to touch for those.
//
// Obsidian's exact footnote-ref markup isn't verified against a live
// instance (no network access here) — this targets the conventional
// selector plus a couple of fallbacks, and only ever touches text that's
// purely digits, so a selector miss just does nothing rather than
// corrupting unrelated content.
function convertFootnoteRefNumerals(el: HTMLElement): void {
	const candidates = el.querySelectorAll('sup.footnote-ref, sup[id^="fnref"], a.footnote-ref');
	candidates.forEach((node) => {
		const text = node.textContent || "";
		if (/^[0-9]+$/.test(text)) {
			node.textContent = convertDigitsToArabicIndic(text);
		}
	});
}

// Reading view has no cursor/line concept to hang a CM6 line-decoration
// off of (see decorations.ts's Live Preview handling) — the markers are
// still real text in the rendered block though, so this walks each
// block-level element Obsidian rendered and checks whether its OWN text
// starts with one or more override markers (direction, alignment,
// bold — headingOverrides.ts). Uses lineMarkers.ts's rendered-text
// scanner rather than the raw-markdown prefix-aware functions —
// Obsidian strips `#`/`-`/`>` syntax when rendering to HTML, so unlike
// the raw editor line, any markers here are always the literal first
// characters with no block prefix to skip past first (and reusing the
// prefix-aware raw functions risks a false match against ordinary
// rendered text, like a heading literally titled "1. Introduction").
// Tags the block with whichever classes apply (stylesheet.ts turns them
// into `direction`/`text-align`/`font-weight`), and strips the whole
// leading marker run out of whichever text node it actually landed in,
// in one pass — not one strip per axis, which would each need to
// re-walk the DOM.
const OVERRIDE_BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote";
function applyLineOverrides(el: HTMLElement): void {
	const blocks: HTMLElement[] = [];
	if (el.matches && el.matches(OVERRIDE_BLOCK_SELECTOR)) blocks.push(el);
	el.querySelectorAll(OVERRIDE_BLOCK_SELECTOR).forEach((b) => blocks.push(b as HTMLElement));

	for (const block of blocks) {
		const { markers, content } = scanRenderedTextMarkers(block.textContent || "");
		if (!markers.length) continue;

		if (markers.includes(FORCE_RTL_MARKER)) block.classList.add("af-force-rtl");
		if (markers.includes(FORCE_LTR_MARKER)) block.classList.add("af-force-ltr");
		if (markers.includes(ALIGN_LEFT_MARKER)) block.classList.add("af-align-left");
		if (markers.includes(ALIGN_CENTER_MARKER)) block.classList.add("af-align-center");
		if (markers.includes(ALIGN_RIGHT_MARKER)) block.classList.add("af-align-right");
		if (markers.includes(BOLD_ON_MARKER)) block.classList.add("af-bold-on");
		if (markers.includes(BOLD_OFF_MARKER)) block.classList.add("af-bold-off");

		const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
		let n: Node | null;
		let remaining = markers.length;
		while (remaining > 0 && (n = walker.nextNode())) {
			const text = (n as Text).nodeValue || "";
			let stripped = text;
			let strippedHere = 0;
			while (strippedHere < remaining && stripped.length && isKnownMarker(stripped[0])) {
				stripped = stripped.slice(1);
				strippedHere++;
			}
			if (strippedHere > 0) {
				(n as Text).nodeValue = stripped;
				remaining -= strippedHere;
			}
		}
		void content;
	}
}

export function registerReadingModeProcessor(plugin: ReadingModePlugin): void {
	plugin.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const file = ctx && ctx.sourcePath ? plugin.app.vault.getAbstractFileByPath(ctx.sourcePath) : null;
		if (!shouldApplyToFile(plugin, file, plugin.app)) return;

		convertFootnoteRefNumerals(el);
		applyLineOverrides(el);

		const roleRegexes = buildRoleRegexes(getActiveProfile(plugin.settings).roles);
		if (!roleRegexes.length) return;

		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
		const textNodes: Text[] = [];
		let n: Node | null;
		while ((n = walker.nextNode())) textNodes.push(n as Text);

		for (const node of textNodes) {
			const text = node.nodeValue || "";
			const matches = findLineMatches(text, 0, roleRegexes);
			if (!matches.length) continue;

			const frag = document.createDocumentFragment();
			let last = 0;
			for (const m of matches) {
				if (m.matchStart > last) frag.appendChild(document.createTextNode(text.slice(last, m.matchStart)));
				frag.appendChild(buildSpanForMatch(m, text));
				last = m.matchEnd;
			}
			if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

			if (node.parentNode) node.parentNode.replaceChild(frag, node);
		}
	});
}

import { HeadingKey, Profile } from "./types";
import { SHAPE_PRESETS } from "./defaults";

export function buildStylesheet(profile: Profile): string {
	let css = "";
	const t = profile.typography;
	const SCOPE = "body.af-scope-active ";

	// 1. Font Family (Excluding Frontmatter & Metadata)
	if (t.fontFamily) {
		css +=
			SCOPE + ".markdown-source-view.mod-cm6 .cm-line:not(.cm-hmd-frontmatter), " +
			SCOPE + ".markdown-preview-view:not(.metadata-container) {\n";
		css += "  font-family: " + t.fontFamily + ";\n";
		css += "}\n\n";
	}

	// 2. Base Font Size (paragraphs, list items, blockquotes, and lines
	// while editing — excluding headings/code/footnotes/frontmatter)
	css +=
		SCOPE + ".markdown-preview-view p:not(.footnotes p),\n" +
		SCOPE + ".markdown-preview-view li:not(.footnotes li),\n" +
		SCOPE + ".markdown-preview-view blockquote,\n" +
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line:not(.HyperMD-header):not(.HyperMD-codeblock):not(.HyperMD-footnote):not(.cm-hmd-frontmatter) {\n" +
		"  font-size: " + t.fontSize + "px;\n" +
		"  line-height: " + t.lineHeight + ";\n" +
		"}\n\n";

	// 3. Force sub-elements in lists to inherit font (rather than falling
	// back to the theme's own list-item styling) — EXCLUDING this
	// plugin's own role spans (`class*="af-role-"` covers both
	// `af-role-<id>` content spans and `af-role-tag...` delimiter spans).
	// Without this exclusion, a role's own font-size/font-family lost
	// inside a list item specifically: both rules end up with the same
	// class-selector count, and this one has one more type selector
	// (the bare `span`), which in CSS specificity comparison counts as
	// MORE specific, not less — a real, demonstrable bug, not just a
	// theoretical risk.
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .HyperMD-list-line:not(.HyperMD-footnote) span:not([class*=\"af-role-\"]) {\n" +
		"  font-size: inherit;\n" +
		"  font-family: inherit;\n" +
		"}\n\n";

	// 4. Justify & first-line indent
	if (t.justify || t.firstLineIndent) {
		css +=
			SCOPE + ".markdown-preview-view p:not(.footnotes p),\n" +
			SCOPE + ".markdown-source-view.mod-cm6 .cm-line:not(.HyperMD-header):not(.HyperMD-list-line):not(.HyperMD-quote):not(.HyperMD-codeblock):not(.HyperMD-footnote):not(.cm-hmd-frontmatter) {\n" +
			(t.justify ? "  text-align: justify;\n" : "") +
			(t.firstLineIndent ? "  text-indent: " + t.firstLineIndentEm + "em;\n" : "") +
			"}\n\n";
	}

	// 4b. Paragraph spacing — deliberately separate from line height
	// (rule 2): line height is the gap WITHIN one paragraph's own wrapped
	// lines; this is the gap BETWEEN paragraphs, like a word processor's
	// "space after paragraph."
	//
	// Reading view has a real DOM paragraph boundary (`<p>`), built only
	// where the SOURCE has a blank line between paragraphs (CommonMark's
	// actual definition of "paragraph") — exact there.
	//
	// Live Preview has no such boundary — a paragraph is just consecutive
	// `.cm-line` elements — but critically, ONE `.cm-line` already always
	// corresponds to exactly ONE raw source line (word-wrap only changes
	// how many screen rows it takes up, never how many `.cm-line`
	// elements exist), regardless of whether the writer left a blank
	// line between "paragraphs" or just pressed Enter once — which is
	// how plenty of people actually write, including how this was
	// described when asked for. So: spacing on every qualifying
	// `.cm-line` directly (same exclusion set as rule 4 above —
	// headings/lists/quotes/code/footnotes/frontmatter skip it, so it
	// only affects genuine prose lines, not spacing out list items or
	// blockquote lines from each other).
	//
	// This has now failed to visibly apply in real Obsidian TWICE despite
	// reasonable, community-standard CSS (`.cm-line { margin-bottom }` is
	// a common pattern in published Obsidian CSS snippets) — the most
	// likely remaining explanation is something outside this stylesheet's
	// visibility entirely (e.g. CM6 setting an inline style directly on
	// the line element for its own layout/measurement purposes, which
	// beats any external stylesheet rule regardless of selector
	// specificity, `!important` aside). So this round switches from
	// `margin-bottom` to `padding-bottom` (sidesteps margin-collapsing
	// edge cases entirely — always creates visible space, never
	// conditionally merges with an adjacent margin) AND adds
	// `!important`, the one thing still guaranteed to win against an
	// inline style. Not the "win honestly, no `!important`" approach the
	// rest of this file uses — deliberately deviating here specifically
	// because two non-`!important` attempts already failed and
	// `.cm-line` spacing isn't something a theme author would plausibly
	// be relying on controlling via their own CSS anyway.
	if (t.paragraphSpacingEm) {
		css +=
			SCOPE + ".markdown-preview-view p:not(.footnotes p),\n" +
			SCOPE + ".markdown-preview-view blockquote,\n" +
			SCOPE + ".markdown-preview-view ul,\n" +
			SCOPE + ".markdown-preview-view ol {\n" +
			"  margin-bottom: " + t.paragraphSpacingEm + "em !important;\n" +
			"}\n\n";
		css +=
			SCOPE + ".markdown-source-view.mod-cm6 .cm-line:not(.HyperMD-header):not(.HyperMD-list-line):not(.HyperMD-quote):not(.HyperMD-codeblock):not(.HyperMD-footnote):not(.cm-hmd-frontmatter) {\n" +
			"  padding-bottom: " + t.paragraphSpacingEm + "em !important;\n" +
			"}\n\n";
	}

	// 5. Content column width — literal values, not just a CSS variable
	// (a variable alone can be shadowed by Obsidian/the theme redeclaring
	// it closer to the element), and no !important (flagged in plugin
	// review) — the SCOPE-prefixed selector chain carries enough
	// specificity on its own.
	const w = t.fileLineWidthPx + "px";
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .cm-sizer,\n" +
		SCOPE + ".markdown-preview-view .markdown-preview-sizer {\n" +
		"  max-width: " + w + ";\n" +
		"  margin-left: auto;\n" +
		"  margin-right: auto;\n" +
		"}\n" +
		SCOPE + ".markdown-source-view.mod-cm6 .cm-content,\n" +
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line {\n" +
		"  max-width: " + w + ";\n" +
		"}\n\n";

	// 6. Headings H1–H6 — both the line itself and the inner formatting
	// span, so it applies whether Obsidian styles the line or the span
	// in a given version.
	for (let i = 1; i <= 6; i++) {
		const hKey = ("h" + i) as HeadingKey;
		const hConf = t.headings ? t.headings[hKey] : null;
		if (!hConf) continue;

		const selector =
			SCOPE + ".markdown-preview-view h" + i + ",\n" +
			SCOPE + ".markdown-source-view.mod-cm6 .HyperMD-header-" + i + ",\n" +
			SCOPE + ".markdown-source-view.mod-cm6 .HyperMD-header-" + i + " span.cm-header";

		css += selector + " {\n";
		if (hConf.sizeEm) css += "  font-size: " + hConf.sizeEm + "em;\n";
		if (hConf.color) css += "  color: " + hConf.color + ";\n";
		if (hConf.align && hConf.align !== "auto") css += "  text-align: " + hConf.align + ";\n";
		if (hConf.bold) css += "  font-weight: bold;\n";
		if (hConf.underline) css += "  text-decoration: underline;\n";
		if (hConf.fontFamily) css += "  font-family: " + hConf.fontFamily + ";\n";
		// Escape hatch, same as roles — appended LAST so it can override
		// anything above via normal cascade (last declaration wins within
		// one rule), no !important needed.
		if (hConf.customCss) css += "  " + hConf.customCss + "\n";
		css += "}\n\n";
	}

	// 7. Nested list bullet shapes — official Obsidian shape variables for
	// Live Preview, native list-style-type keywords for Reading view.
	const shapes = t.listBulletShapes || [];
	shapes.forEach((shapeName, i) => {
		const depth = i + 1;
		const preset = SHAPE_PRESETS[shapeName] || SHAPE_PRESETS.circle;
		const nesting = "ul ".repeat(depth).trim();

		css +=
			SCOPE + ".HyperMD-list-line-" + depth + " {\n" +
			"  --list-bullet-radius: " + preset.radius + ";\n" +
			"  --list-bullet-transform: " + preset.transform + ";\n" +
			"}\n";
		css += SCOPE + ".markdown-preview-view " + nesting + " {\n";
		css += "  list-style-type: " + preset.readingType + ";\n";
		css += "}\n\n";
	});

	// 8. Footnotes — size, plus the حاشية look (Arabic-Indic numerals and a
	// matbaʿa-style rule), unified across both views. Reading view builds
	// its own footnotes block/list natively; Live Preview's block is our
	// own widget markup from decorations.ts (readingMode.ts/decorations.ts
	// handle the actual digit conversion — this is styling only).
	css +=
		SCOPE + ".markdown-preview-view .footnotes,\n" +
		SCOPE + ".markdown-preview-view .footnotes p,\n" +
		SCOPE + ".markdown-preview-view .footnotes li,\n" +
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.HyperMD-footnote,\n" +
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.HyperMD-footnote span,\n" +
		SCOPE + ".af-footnote-def-marker,\n" +
		SCOPE + ".af-footnote-ref-widget {\n" +
		"  font-size: " + t.footnoteSizePx + "px;\n" +
		"  line-height: 1.4;\n" +
		"}\n\n";

	// Reading view's footnote list numbers are a browser ::marker (from
	// the <ol>'s own counter), not real text — "arabic-indic" is a
	// predefined CSS counter style, so this needs no JS at all. The
	// inline reference numeral's digit characters ARE real text and are
	// converted in readingMode.ts instead.
	css +=
		SCOPE + ".markdown-preview-view .footnotes ol {\n" +
		"  list-style-type: arabic-indic;\n" +
		"}\n\n";

	// The rule above the footnote block — Reading view already renders an
	// <hr> here natively; Live Preview's is our own separator widget.
	// Styled together so both views match.
	css +=
		SCOPE + ".markdown-preview-view .footnotes hr,\n" +
		SCOPE + ".af-footnote-separator {\n" +
		"  border: none;\n" +
		"  border-top: 1px solid var(--text-muted);\n" +
		"  width: 40%;\n" +
		"  margin: 1.2em 0 0.6em 0;\n" +
		"}\n\n";

	css +=
		SCOPE + ".af-footnote-def-marker {\n" +
		"  color: var(--text-muted);\n" +
		"}\n\n";

	css +=
		SCOPE + ".af-footnote-ref-widget {\n" +
		"  vertical-align: super;\n" +
		"  font-size: 0.7em;\n" +
		"  color: var(--text-accent);\n" +
		"  cursor: default;\n" +
		"}\n\n";

	// 9. Inline roles — the formatting-tag look (visible marker chars,
	// only while the cursor is inside that span) plus one rule per role.
	//
	// These were the only bare, single-class selectors in this whole file
	// (everything above uses the SCOPE-prefixed ancestor chain instead).
	// That's why role styling lost inside callouts (and would lose inside
	// any other element with its own more-specific CSS, e.g. tables): a
	// theme's ".callout-content" alone already outranks a single class.
	// Scoping + doubling the class raises this to real specificity — same
	// "no !important, win honestly" approach used everywhere else here.
	css += SCOPE + ".af-role-tag-active.af-role-tag-active {\n";
	css += "  opacity: 0.5;\n";
	css += "  font-family: var(--font-monospace);\n";
	css += "}\n\n";

	for (const r of profile.roles) {
		if (r.enabled === false) continue;
		// Nested under the same ancestor chains as rule 2's base
		// font-size/line-height (rather than a bare doubled-class
		// selector) so this always outranks it, in both Live Preview and
		// Reading view — the doubled class alone only reliably won
		// against a THEME's rules (single-class selectors it can outrank
		// by having two), not against this plugin's OWN base typography
		// rule 2, which nests several classes deep and otherwise wins on
		// its own higher specificity (same "no !important" approach).
		css +=
			SCOPE + ".markdown-source-view.mod-cm6 .cm-line .af-role-" + r.id + ".af-role-" + r.id + ",\n" +
			SCOPE + ".markdown-preview-view p .af-role-" + r.id + ".af-role-" + r.id + ",\n" +
			SCOPE + ".markdown-preview-view li .af-role-" + r.id + ".af-role-" + r.id + ",\n" +
			SCOPE + ".markdown-preview-view blockquote .af-role-" + r.id + ".af-role-" + r.id + ",\n" +
			SCOPE + ".af-role-" + r.id + ".af-role-" + r.id + " {\n";
		css += "  color: " + r.color + ";\n";
		if (r.bold) css += "  font-weight: 700;\n";
		if (r.italic) css += "  font-style: italic;\n";
		if (r.underline) css += "  text-decoration: underline;\n";
		if (r.fontFamily) css += "  font-family: " + r.fontFamily + ";\n";
		if (r.sizeEm) { css += "  font-size: " + r.sizeEm + "em;\n"; css += "  line-height: normal;\n"; }
		if (r.highlightColor) {
			css += "  background-color: " + r.highlightColor + ";\n";
			css += "  padding: 0.05em 0.2em;\n";
			css += "  border-radius: 3px;\n";
		}
		// Escape hatch: appended LAST so it can override any property
		// above it via normal cascade (last declaration wins within one
		// rule) — no !important needed anywhere.
		if (r.customCss) css += "  " + r.customCss + "\n";
		css += "}\n\n";
	}

	// 10. Forced per-line direction (direction.ts) — an explicit,
	// deliberate override for one specific line/paragraph/heading, so
	// this is placed LAST and given real ancestor-chain specificity (same
	// technique as the role rules above) to beat both the base typography
	// rules and the per-heading-level styles on equal-specificity ties.
	// `direction` flips text flow; `text-align` follows it so the visual
	// alignment (and, for lists, native browser bullet-position mirroring
	// under `direction: rtl`) actually matches rather than just the
	// underlying character order.
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.af-force-rtl,\n" +
		SCOPE + ".markdown-preview-view .af-force-rtl {\n" +
		"  direction: rtl;\n" +
		"  text-align: right;\n" +
		"  unicode-bidi: isolate;\n" +
		"}\n\n";
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.af-force-ltr,\n" +
		SCOPE + ".markdown-preview-view .af-force-ltr {\n" +
		"  direction: ltr;\n" +
		"  text-align: left;\n" +
		"  unicode-bidi: isolate;\n" +
		"}\n\n";

	// 11. Per-instance heading alignment/bold overrides (headingOverrides.ts)
	// — same "explicit override, placed LAST with real ancestor-chain
	// specificity" reasoning as direction above. These exist because the
	// right-click heading quick-switch USED to edit
	// typography.headings[key] directly (a global, per-LEVEL style) —
	// which meant changing one heading's alignment visibly changed every
	// heading of that level, reported as a bug. Now it sets one of these
	// per-line markers instead, so only the specific heading clicked is
	// affected; the per-level style in Settings remains what every OTHER
	// heading of that level still uses.
	for (const align of ["left", "center", "right"]) {
		css +=
			SCOPE + ".markdown-source-view.mod-cm6 .cm-line.af-align-" + align + ",\n" +
			SCOPE + ".markdown-preview-view .af-align-" + align + " {\n" +
			"  text-align: " + align + ";\n" +
			"}\n\n";
	}
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.af-bold-on,\n" +
		SCOPE + ".markdown-preview-view .af-bold-on {\n" +
		"  font-weight: bold;\n" +
		"}\n\n";
	css +=
		SCOPE + ".markdown-source-view.mod-cm6 .cm-line.af-bold-off,\n" +
		SCOPE + ".markdown-preview-view .af-bold-off {\n" +
		"  font-weight: normal;\n" +
		"}\n\n";

	return css;
}

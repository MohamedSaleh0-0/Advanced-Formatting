import {
	HeadingStyles,
	AdvancedFormattingSettings,
	ListBulletShape,
	Role,
	ShapePreset,
	TypographySettings,
} from "./types";

export const SHAPE_PRESETS: Record<ListBulletShape, ShapePreset> = {
	circle: { radius: "50%", transform: "none", readingType: "disc" },
	square: { radius: "0%", transform: "none", readingType: "square" },
	diamond: { radius: "0%", transform: "rotate(45deg)", readingType: "square" },
};

export const DEFAULT_HEADING_STYLES: HeadingStyles = {
	h1: { sizeEm: 1.8, color: "", align: "center", bold: true, underline: false, fontFamily: "", customCss: "" },
	h2: { sizeEm: 1.5, color: "", align: "auto", bold: true, underline: false, fontFamily: "", customCss: "" },
	h3: { sizeEm: 1.25, color: "", align: "auto", bold: true, underline: false, fontFamily: "", customCss: "" },
	h4: { sizeEm: 1.1, color: "", align: "auto", bold: true, underline: false, fontFamily: "", customCss: "" },
	h5: { sizeEm: 1.0, color: "", align: "auto", bold: true, underline: false, fontFamily: "", customCss: "" },
	h6: { sizeEm: 0.9, color: "", align: "auto", bold: true, underline: false, fontFamily: "", customCss: "" },
};

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
	fontFamily: "",
	fontSize: 18,
	lineHeight: 1.6,
	paragraphSpacingEm: 0,
	justify: true,
	firstLineIndent: true,
	firstLineIndentEm: 1.5,
	headings: DEFAULT_HEADING_STYLES,
	fileLineWidthPx: 700,
	listBulletShapes: ["circle", "square", "diamond"],
	footnoteSizePx: 12,
};

// Right-click quick-color menu — these
// four are just a starting point (matches the "red, green, yellow,
// customize" example given when this was requested). "Custom..." is
// always offered in the menu in addition to whatever's declared here,
// so an empty list still works, just with only that one option.
export const DEFAULT_QUICK_COLORS: string[] = ["#E03131", "#F2B705", "#2F9E44", "#1971C2", "#E8590C"];

// A few genuinely useful starting snippets — not exhaustive, just enough
// that "CSS Snippets" in Settings isn't a blank, unexplained list the
// first time someone opens it. All editable/removable like anything else
// here.
export const DEFAULT_CSS_SNIPPETS: { name: string; css: string }[] = [
	{ name: "Wide letter spacing", css: "letter-spacing: 0.05em;" },
	{ name: "Small caps", css: "font-variant: small-caps;" },
	{ name: "Subtle shadow", css: "text-shadow: 0 1px 2px rgba(0,0,0,0.25);" },
];

// Every role carries explicit open/close delimiters instead of a single
// symmetric marker — this is what makes "[?" ... "?]" for a user-defined
// class like "question" work the same way "«" ... "»" for hadith does,
// with no special-casing per role.
//
// `enabled: false` means the role is defined but inert — no matching, no
// decoration, no CSS effect — until switched on. Presets ship this way
// (seeded by default, off by default, deletable) rather than requiring a
// separate "quick add" step.
export const PRESET_ROLES: Record<string, Role> = {
	question: {
		id: "question", label: "Question", color: "#1D5DA6",
		bold: false, italic: true, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "", customCss: "", enabled: true,
	},
	note: {
		id: "note", label: "Note", color: "#4B5563",
		bold: false, italic: false, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "#F3F4F6", customCss: "", enabled: true,
	},
	important: {
		id: "important", label: "Important", color: "#B3261E",
		bold: true, italic: false, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "#FDEDEC", customCss: "", enabled: true,
	},
};

// Ships with generic, disabled example roles only — no domain-specific
// (e.g. Islamic-studies) roles are enabled or included by default. Those
// are simply starter roles in the global configuration.
export function defaultRoles(): Role[] {
	return [
		Object.assign({}, PRESET_ROLES.question),
		Object.assign({}, PRESET_ROLES.note),
		Object.assign({}, PRESET_ROLES.important),
	];
}

export function defaultSettings(): AdvancedFormattingSettings {
	return {
		roles: defaultRoles(),
		typography: mergeTypography(DEFAULT_TYPOGRAPHY),
		quickColors: DEFAULT_QUICK_COLORS.slice(),
		cssSnippets: DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s)),
		uiLanguage: "en",
	};
}

// Merges a saved (possibly older, possibly hand-edited/imported)
// typography object against the current defaults — top-level fields via
// a plain Object.assign, but headings need a PER-LEVEL merge
// specifically: a shallow top-level Object.assign would let an old
// saved h1 object completely replace the default h1 object, silently
// dropping any field (like fontFamily/customCss) the old save predates.
// Shared by settings loading and any future settings import path.
export function mergeTypography(saved: unknown): TypographySettings {
	const savedRecord = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
	const typography = Object.assign({}, DEFAULT_TYPOGRAPHY, savedRecord);
	const savedHeadings = savedRecord.headings && typeof savedRecord.headings === "object"
		? (savedRecord.headings as Record<string, unknown>)
		: {};
	const headings = {} as typeof DEFAULT_HEADING_STYLES;
	for (const key of Object.keys(DEFAULT_HEADING_STYLES) as (keyof typeof DEFAULT_HEADING_STYLES)[]) {
		headings[key] = Object.assign({}, DEFAULT_HEADING_STYLES[key], savedHeadings[key] || {});
	}
	typography.headings = headings;
	return typography;
}

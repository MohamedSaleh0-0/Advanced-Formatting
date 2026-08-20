import {
	HeadingStyles,
	AdvancedFormattingSettings,
	ListBulletShape,
	Profile,
	Role,
	ScopeSettings,
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

export const DEFAULT_SCOPE: ScopeSettings = {
	mode: "global",
	cssclassValue: "styled-note",
	folders: [],
};

// Right-click "Colorize" quick-menu — user-declared per profile, these
// four are just a starting point (matches the "red, green, yellow,
// customize" example given when this was requested). "Custom..." is
// always offered in the menu in addition to whatever's declared here,
// so an empty list still works, just with only that one option.
export const DEFAULT_QUICK_COLORS: string[] = ["#E03131", "#2F9E44", "#F2B705", "#1971C2"];

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
const PRESET_ROLES: Record<string, Role> = {
	question: {
		id: "question", label: "Question", open: "[?", close: "?]", color: "#1D5DA6",
		bold: false, italic: true, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "", customCss: "", enabled: false,
	},
	note: {
		id: "note", label: "Note", open: "[!", close: "!]", color: "#4B5563",
		bold: false, italic: false, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "#F3F4F6", customCss: "", enabled: false,
	},
	important: {
		id: "important", label: "Important", open: "[*", close: "*]", color: "#B3261E",
		bold: true, italic: false, underline: false, fontFamily: "", sizeEm: null,
		highlightColor: "#FDEDEC", customCss: "", enabled: false,
	},
};

// Ships with generic, disabled example roles only — no domain-specific
// (e.g. Islamic-studies) roles are enabled or included by default. Those
// belong in a separate, optional, importable profile (see settingsBackup.ts
// import/export) rather than the shipped default.
export function defaultRoles(): Role[] {
	return [
		Object.assign({}, PRESET_ROLES.question),
		Object.assign({}, PRESET_ROLES.note),
		Object.assign({}, PRESET_ROLES.important),
	];
}

export function freshProfile(id: string, name: string): Profile {
	return {
		id,
		name,
		description: "",
		roles: defaultRoles(),
		typography: JSON.parse(JSON.stringify(DEFAULT_TYPOGRAPHY)),
		scope: Object.assign({}, DEFAULT_SCOPE),
		quickColors: DEFAULT_QUICK_COLORS.slice(),
		cssSnippets: DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s)),
	};
}

// A ready-made profile for Arabic Islamic scholarly notes — matn/sharh-
// style roles (the ones this plugin originally shipped as its default,
// before the rename round made the shipped default neutral). NOT part of
// defaultSettings()/freshProfile() — only created when the user
// explicitly asks for it (see main.ts's "Add Islamic/Arabic profile"
// command), via the same `settings.profiles.push(...)` append path
// settingsBackup.ts's JSON import already uses. Once added it's an
// ordinary profile like any other, so it's deletable through the
// existing profile-delete UI with no special-casing needed.
export function islamicProfile(): Profile {
	return {
		id: "islamic-" + Date.now(),
		name: "Islamic / Arabic Scholarly",
		description: "Matn/sharh-style roles for Arabic scholarly notes: matn, تعليلات, حديث, آية.",
		roles: [
			{
				id: "matn", label: "المتن", open: "{=", close: "=}", color: "#A50021",
				bold: true, italic: false, underline: false, fontFamily: "", sizeEm: null,
				highlightColor: "", customCss: "", enabled: true,
			},
			{
				id: "taleel", label: "التعليلات", open: "{~", close: "~}", color: "#215E99",
				bold: true, italic: false, underline: false, fontFamily: "", sizeEm: null,
				highlightColor: "", customCss: "", enabled: true,
			},
			{
				id: "hadith", label: "حديث", open: "«", close: "»", color: "#0B6E4F",
				bold: false, italic: false, underline: false, fontFamily: "", sizeEm: null,
				highlightColor: "#FFF7DC", customCss: "", enabled: false,
			},
			{
				id: "ayah", label: "آية", open: "﴾", close: "﴿", color: "#8A6D00",
				bold: true, italic: false, underline: false, fontFamily: "", sizeEm: 1.08,
				highlightColor: "", customCss: "", enabled: false,
			},
		],
		typography: Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TYPOGRAPHY)), {
			fontSize: 20, // Arabic script commonly benefits from a bit more size than Latin text at the same "readable" level
		}),
		scope: Object.assign({}, DEFAULT_SCOPE),
		quickColors: DEFAULT_QUICK_COLORS.slice(),
		cssSnippets: DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s)),
	};
}

export function defaultSettings(): AdvancedFormattingSettings {
	const def = freshProfile("default", "Default");
	return {
		profiles: [def],
		activeProfileId: def.id,
		uiLanguage: "en",
	};
}

export function getActiveProfile(settings: AdvancedFormattingSettings): Profile {
	return settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0];
}

// Merges a saved (possibly older, possibly hand-edited/imported)
// typography object against the current defaults — top-level fields via
// a plain Object.assign, but headings need a PER-LEVEL merge
// specifically: a shallow top-level Object.assign would let an old
// saved h1 object completely replace the default h1 object, silently
// dropping any field (like fontFamily/customCss) the old save predates.
// Shared by main.ts's hydrateProfile (existing saved settings) and
// settingsBackup.ts's import (a pasted JSON blob, which could be
// arbitrarily old or hand-edited) — both need the exact same safety.
export function mergeTypography(saved: any): TypographySettings {
	const typography = Object.assign({}, DEFAULT_TYPOGRAPHY, saved || {});
	const savedHeadings = (saved && saved.headings) || {};
	const headings = {} as typeof DEFAULT_HEADING_STYLES;
	for (const key of Object.keys(DEFAULT_HEADING_STYLES) as (keyof typeof DEFAULT_HEADING_STYLES)[]) {
		headings[key] = Object.assign({}, DEFAULT_HEADING_STYLES[key], savedHeadings[key] || {});
	}
	typography.headings = headings;
	return typography;
}

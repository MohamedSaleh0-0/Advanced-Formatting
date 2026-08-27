// Fonts bundled directly with the plugin — genuinely "plug and play,"
// unlike any other font-family value in this plugin (typed free-text, or
// picked from uiHelpers.ts's COMMON_FONTS list): those only work if the
// exact-named font is ALREADY installed on the user's operating system,
// which this plugin has no way to change. These, by contrast, ship as
// actual font files inside the plugin folder — no OS installation step,
// they just work the moment the plugin is enabled.
//
// All three are SIL Open Font License (OFL) fonts, which explicitly
// permits bundling/redistribution — each font's `OFL.txt` license text
// is kept alongside its files in this same fonts/ directory, as the
// license requires. Sourced from the google/fonts GitHub repository
// (the canonical, versioned source Google Fonts publishes from).
//
// Deliberately a short, curated list (not an attempt to bundle "every
// possible font") — these three cover the Arabic-script need this
// project has repeatedly come back to (Amiri and Scheherazade New are
// both classic Naskh-style faces suited to Quranic/scholarly text; Noto
// Naskh Arabic is a clean modern alternative with broad Unicode
// coverage), kept small enough in total (~670KB as WOFF2) not to bloat
// the plugin.
export interface BundledFontFile {
	weight: number;
	style: "normal" | "italic";
	// Relative to the plugin's own folder (this.manifest.dir) — resolved
	// to a real usable URL at runtime via
	// app.vault.adapter.getResourcePath(), never a plain relative CSS
	// url() (which would resolve against the page origin, not the plugin
	// folder, and silently fail to load).
	path: string;
}

export interface BundledFont {
	id: string;
	label: string;
	files: BundledFontFile[];
}

export const BUNDLED_FONTS: BundledFont[] = [
	{
		id: "amiri",
		label: "Amiri (bundled)",
		files: [
			{ weight: 400, style: "normal", path: "fonts/amiri/Amiri-Regular.woff2" },
			{ weight: 700, style: "normal", path: "fonts/amiri/Amiri-Bold.woff2" },
		],
	},
	{
		id: "scheherazade-new",
		label: "Scheherazade New (bundled)",
		files: [
			{ weight: 400, style: "normal", path: "fonts/scheherazade-new/ScheherazadeNew-Regular.woff2" },
			{ weight: 700, style: "normal", path: "fonts/scheherazade-new/ScheherazadeNew-Bold.woff2" },
		],
	},
	{
		id: "noto-naskh-arabic",
		label: "Noto Naskh Arabic (bundled)",
		files: [
			// A single variable-font file covering the full weight axis —
			// declared as a weight RANGE (100-900) below rather than one
			// fixed weight, so both normal and bold text correctly render
			// via the same file instead of synthetically fake-bolding.
			{ weight: 400, style: "normal", path: "fonts/noto-naskh-arabic/NotoNaskhArabic-Variable.woff2" },
		],
	},
];

// Builds the @font-face declarations for every bundled font, resolving
// each file's plugin-relative path to a real app:// resource URL via the
// given resolver (main.ts passes `(p) =>
// this.app.vault.adapter.getResourcePath(normalizePath(this.manifest.dir + "/" + p))`).
// Generated ONCE at plugin load into its own <style> element — these
// never change at runtime, unlike the per-profile stylesheet
// (stylesheet.ts), so there's no reason to regenerate this on every
// saveAndApply().
export function buildBundledFontFaceCss(resolvePath: (relativePath: string) => string): string {
	let css = "";
	for (const font of BUNDLED_FONTS) {
		for (const file of font.files) {
			const url = resolvePath(file.path);
			const weightDecl = font.id === "noto-naskh-arabic" ? "100 900" : String(file.weight);
			css +=
				"@font-face {\n" +
				'  font-family: "' + font.label + '";\n' +
				"  src: url(\"" + url + '") format("woff2");\n' +
				"  font-weight: " + weightDecl + ";\n" +
				"  font-style: " + file.style + ";\n" +
				"  font-display: swap;\n" +
				"}\n\n";
		}
	}
	return css;
}

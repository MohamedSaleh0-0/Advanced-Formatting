import { App, Modal, Notice, Setting } from "obsidian";
import { AdvancedFormattingSettings, Profile } from "./types";
import { DEFAULT_QUICK_COLORS, DEFAULT_CSS_SNIPPETS, mergeTypography } from "./defaults";
import { isolate, t, tn, UiLanguage } from "./i18n";

// Export/import operate on a single PROFILE, not the whole settings blob
// — that's the natural shareable unit now that roles are fully
// user-defined ("legal document markup", "fiction manuscript", etc.)
// rather than one global configuration.
export async function exportSettingsToClipboard(app: App, profile: Profile, lang: UiLanguage | undefined): Promise<void> {
	const json = JSON.stringify(profile, null, 2);
	try {
		await navigator.clipboard.writeText(json);
		new Notice(t("noticeCopiedToClipboard", lang));
	} catch (e) {
		// Clipboard permissions can be finicky in an Electron renderer —
		// fall back to a modal with the text selected for manual copy
		// rather than silently failing.
		new ExportFallbackModal(app, json, lang).open();
	}
}

class ExportFallbackModal extends Modal {
	private json: string;
	private lang: UiLanguage | undefined;
	constructor(app: App, json: string, lang: UiLanguage | undefined) {
		super(app);
		this.json = json;
		this.lang = lang;
	}
	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.dir = this.lang === "ar" ? "rtl" : "ltr";
		contentEl.createEl("h2", { text: t("copyManuallyTitle", this.lang) });
		contentEl.createEl("p", { text: t("copyManuallyDesc", this.lang) });
		const ta = contentEl.createEl("textarea", { text: this.json });
		ta.style.cssText = "width:100%;height:300px;font-family:var(--font-monospace);";
		ta.focus();
		ta.select();
	}
	onClose(): void {
		this.contentEl.empty();
	}
}

export interface ImportTarget {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
}

// Imports a pasted profile as a NEW profile appended to the list — does
// NOT touch existing profiles. Importing a friend's "coding" profile
// should never silently wipe out your own.
export class ImportSettingsModal extends Modal {
	private plugin: ImportTarget;
	private onImported: () => void;

	constructor(app: App, plugin: ImportTarget, onImported: () => void) {
		super(app);
		this.plugin = plugin;
		this.onImported = onImported;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const lang = this.plugin.settings.uiLanguage;
		contentEl.dir = lang === "ar" ? "rtl" : "ltr";

		contentEl.createEl("h2", { text: t("importProfileTitle", lang) });
		contentEl.createEl("p", { text: t("importProfileDesc", lang) });

		let pastedText = "";
		const ta = contentEl.createEl("textarea");
		ta.style.cssText = "width:100%;height:250px;font-family:var(--font-monospace);";
		ta.addEventListener("input", () => {
			pastedText = ta.value;
		});

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText(t("importBtn", lang)).onClick(async () => {
				let parsed: unknown;
				try {
					parsed = JSON.parse(pastedText);
				} catch (e) {
					new Notice(t("noticeInvalidJson", lang));
					return;
				}
				const candidate = parsed as Partial<Profile>;
				if (!candidate || !Array.isArray(candidate.roles) || !candidate.typography || !candidate.scope) {
					new Notice(t("noticeNotAProfile", lang));
					return;
				}
				const imported: Profile = {
					id: "profile" + Date.now(),
					name: (candidate.name || t("importedProfileDefaultName", lang)) + "",
					description: typeof candidate.description === "string" ? candidate.description : "",
					roles: candidate.roles,
					typography: mergeTypography(candidate.typography),
					scope: candidate.scope as Profile["scope"],
					quickColors: Array.isArray(candidate.quickColors) ? candidate.quickColors : DEFAULT_QUICK_COLORS.slice(),
					cssSnippets: Array.isArray(candidate.cssSnippets) ? candidate.cssSnippets : DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s)),
				};
				this.plugin.settings.profiles.push(imported);
				await this.plugin.saveAndApply();
				new Notice(tn("noticeImportedAs", isolate(imported.name), lang));
				this.close();
				this.onImported();
			})
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

import { App, Modal, Setting } from "obsidian";
import { AdvancedFormattingSettings, HeadingAlign, HeadingKey, HeadingStyle } from "./types";
import { t, tn } from "./i18n";
import { getActiveProfile } from "./defaults";
import { openSnippetMenu, renderFontFamilyPicker } from "./uiHelpers";

export interface SavesSettings {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
}

// The detailed editor for one heading level, opened from the compact
// Settings row's gear icon — same "compact row + gear -> full editor in
// a modal" pattern as RoleEditModal, and for the same reason: a
// Setting's root element is block-level/full-width regardless of a
// parent flex row, so packing size/align/color/bold/underline/font/CSS
// all into one row either overflows or forces everything to be tiny.
// This is a per-LEVEL style (every H2 in the note, not one specific
// heading) — for a one-off override on a single heading, see the
// right-click menu's per-instance align/bold overrides instead
// (headingOverrides.ts).
export class HeadingEditModal extends Modal {
	private plugin: SavesSettings;
	private headingKey: HeadingKey;
	private style: HeadingStyle;
	private onCloseCallback?: () => void;

	constructor(app: App, plugin: SavesSettings, headingKey: HeadingKey, style: HeadingStyle, onClose?: () => void) {
		super(app);
		this.plugin = plugin;
		this.headingKey = headingKey;
		this.style = style;
		this.onCloseCallback = onClose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const style = this.style;
		const lang = this.plugin.settings.uiLanguage;
		contentEl.dir = lang === "ar" ? "rtl" : "ltr";

		contentEl.createEl("h2", { text: tn("headingLabel", this.headingKey.slice(1), lang) });

		new Setting(contentEl).setName(t("headingSizeLabel", lang)).addSlider((slider) =>
			slider
				.setLimits(0.7, 3.5, 0.05)
				.setValue(style.sizeEm)
				.setDynamicTooltip()
				.onChange(async (value) => {
					style.sizeEm = value;
					await this.plugin.saveAndApply();
				})
		);

		new Setting(contentEl).setName(t("headingAlignLabel", lang)).addDropdown((dd) =>
			dd
				.addOptions({ auto: t("alignAuto", lang), left: t("alignLeft", lang), center: t("alignCenter", lang), right: t("alignRight", lang) })
				.setValue(style.align)
				.onChange(async (value) => {
					style.align = value as HeadingAlign;
					await this.plugin.saveAndApply();
				})
		);

		new Setting(contentEl).setName(t("textColorLabel", lang)).addColorPicker((cp) =>
			cp.setValue(style.color || "#000000").onChange(async (value) => {
				style.color = value;
				await this.plugin.saveAndApply();
			})
		);

		new Setting(contentEl).setName(t("boldLabel", lang)).addToggle((toggle) =>
			toggle.setValue(style.bold).onChange(async (value) => {
				style.bold = value;
				await this.plugin.saveAndApply();
			})
		);

		new Setting(contentEl).setName(t("underlineLabel", lang)).addToggle((toggle) =>
			toggle.setValue(style.underline).onChange(async (value) => {
				style.underline = value;
				await this.plugin.saveAndApply();
			})
		);

		renderFontFamilyPicker(contentEl, style.fontFamily || "", async (value) => {
			style.fontFamily = value;
			await this.plugin.saveAndApply();
		});

		const cssSetting = new Setting(contentEl).setName(t("customCssLabel", lang)).setDesc(t("customCssDesc", lang));
		cssSetting.addButton((btn) =>
			btn.setButtonText(t("snippetsBtn", lang)).onClick((evt) => {
				const snippets = getActiveProfile(this.plugin.settings).cssSnippets;
				openSnippetMenu(evt, snippets, (css) => {
					style.customCss = style.customCss ? style.customCss + "\n" + css : css;
					this.plugin.saveAndApply();
					this.onOpen();
				});
			})
		);
		cssSetting.addTextArea((ta) =>
			ta.setValue(style.customCss || "").onChange(async (value) => {
				style.customCss = value;
				await this.plugin.saveAndApply();
			})
		);
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.onCloseCallback) this.onCloseCallback();
	}
}

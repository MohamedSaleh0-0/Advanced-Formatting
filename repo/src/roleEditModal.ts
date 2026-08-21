import { App, Modal, Setting } from "obsidian";
import { AdvancedFormattingSettings, Role } from "./types";
import { t } from "./i18n";
import { getActiveProfile } from "./defaults";
import { openSnippetMenu, renderFontFamilyPicker } from "./uiHelpers";

export interface SavesSettings {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
}

// The detailed editor for one role, opened from the compact list row's
// gear icon. Deliberately NOT an inline accordion — nesting a Setting
// component inside a custom flex row doesn't lay out compactly, since a
// Setting's root element is block-level/full-width by design regardless
// of its parent's flex context. A modal sidesteps that entirely, and
// matches the QuickAdd-plugin pattern this was modeled on (compact list
// row + gear icon -> separate editor surface).
export class RoleEditModal extends Modal {
	private plugin: SavesSettings;
	private role: Role;
	private onCloseCallback?: () => void;

	constructor(app: App, plugin: SavesSettings, role: Role, onClose?: () => void) {
		super(app);
		this.plugin = plugin;
		this.role = role;
		this.onCloseCallback = onClose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const role = this.role;
		const lang = this.plugin.settings.uiLanguage;
		contentEl.dir = lang === "ar" ? "rtl" : "ltr";

		contentEl.createEl("h2", { text: role.label || role.id });

		const delimSetting = new Setting(contentEl).setName(t("delimitersLabel", lang)).setDesc(t("delimitersDesc", lang));
		delimSetting.controlEl.createSpan({ text: t("fieldOpenLabel", lang), cls: "af-field-label" });
		delimSetting.addText((text) =>
			text.setValue(role.open || "").onChange(async (value) => {
				role.open = value;
				await this.plugin.saveAndApply();
			})
		);
		delimSetting.controlEl.createSpan({ text: t("fieldCloseLabel", lang), cls: "af-field-label" });
		delimSetting.addText((text) =>
			text.setValue(role.close || "").onChange(async (value) => {
				role.close = value;
				await this.plugin.saveAndApply();
			})
		);

		const displayMode = role.delimiterDisplay || "auto";
		const displaySetting = new Setting(contentEl).setName(t("delimiterDisplayLabel", lang)).setDesc(t("delimiterDisplayDesc", lang));
		displaySetting.addDropdown((dd) =>
			dd
				.addOptions({ auto: t("ddAuto", lang), show: t("ddShow", lang), hide: t("ddHide", lang), alias: t("ddAlias", lang) })
				.setValue(displayMode)
				.onChange(async (value) => {
					role.delimiterDisplay = value as Role["delimiterDisplay"];
					await this.plugin.saveAndApply();
					this.onOpen(); // re-render to show/hide the alias fields below
				})
		);

		if (displayMode === "alias") {
			const aliasSetting = new Setting(contentEl).setName(t("aliasTextLabel", lang)).setDesc(t("aliasTextDesc", lang));
			aliasSetting.controlEl.createSpan({ text: t("fieldOpenLabel", lang), cls: "af-field-label" });
			aliasSetting.addText((text) =>
				text.setValue(role.aliasOpen || "").onChange(async (value) => {
					role.aliasOpen = value;
					await this.plugin.saveAndApply();
				})
			);
			aliasSetting.controlEl.createSpan({ text: t("fieldCloseLabel", lang), cls: "af-field-label" });
			aliasSetting.addText((text) =>
				text.setValue(role.aliasClose || "").onChange(async (value) => {
					role.aliasClose = value;
					await this.plugin.saveAndApply();
				})
			);
		}

		// Only meaningful in "show" mode — the delimiters are already
		// visible there either way; this decides whether they ALSO pick
		// up the role's own color/font/size/etc., or stay in the plain
		// default tag appearance. In "auto"/"alias" mode the delimiters
		// are hidden or replaced by alias text most of the time, so
		// styling them doesn't apply.
		if (displayMode === "show") {
			new Setting(contentEl)
				.setName(t("styleDelimitersLabel", lang))
				.setDesc(t("styleDelimitersDesc", lang))
				.addToggle((toggle) =>
					toggle.setValue(!!role.styleDelimiters).onChange(async (value) => {
						role.styleDelimiters = value;
						await this.plugin.saveAndApply();
					})
				);
		}

		new Setting(contentEl).setName(t("textColorLabel", lang)).addColorPicker((cp) =>
			cp.setValue(role.color).onChange(async (value) => {
				role.color = value;
				await this.plugin.saveAndApply();
			})
		);

		contentEl.createEl("p", { text: t("fontFamilyDesc", lang), cls: "setting-item-description" });
		renderFontFamilyPicker(contentEl, role.fontFamily || "", async (value) => {
			role.fontFamily = value;
			await this.plugin.saveAndApply();
		});

		new Setting(contentEl).setName(t("boldLabel", lang)).addToggle((toggle) =>
			toggle.setValue(role.bold).onChange(async (value) => {
				role.bold = value;
				await this.plugin.saveAndApply();
			})
		);

		new Setting(contentEl).setName(t("italicLabel", lang)).addToggle((toggle) =>
			toggle.setValue(role.italic).onChange(async (value) => {
				role.italic = value;
				await this.plugin.saveAndApply();
			})
		);

		new Setting(contentEl).setName(t("underlineLabel", lang)).addToggle((toggle) =>
			toggle.setValue(role.underline).onChange(async (value) => {
				role.underline = value;
				await this.plugin.saveAndApply();
			})
		);

		const sizeSetting = new Setting(contentEl).setName(t("customSizeLabel", lang)).setDesc(t("customSizeDesc", lang));
		const sizeEnabled = role.sizeEm != null;
		sizeSetting.addToggle((toggle) =>
			toggle.setValue(sizeEnabled).onChange(async (value) => {
				role.sizeEm = value ? role.sizeEm || 1.0 : null;
				await this.plugin.saveAndApply();
				this.onOpen(); // re-render this modal to show/hide the slider
			})
		);
		if (sizeEnabled) {
			sizeSetting.addSlider((slider) =>
				slider
					.setLimits(0.6, 2.0, 0.02)
					.setValue(role.sizeEm as number)
					.setDynamicTooltip()
					.onChange(async (value) => {
						role.sizeEm = value;
						await this.plugin.saveAndApply();
					})
			);
		}

		const highlightSetting = new Setting(contentEl).setName(t("highlightBgLabel", lang)).setDesc(t("highlightBgDesc", lang));
		const highlightEnabled = !!role.highlightColor;
		highlightSetting.addToggle((toggle) =>
			toggle.setValue(highlightEnabled).onChange(async (value) => {
				role.highlightColor = value ? role.highlightColor || "#FFF7DC" : "";
				await this.plugin.saveAndApply();
				this.onOpen();
			})
		);
		if (highlightEnabled) {
			highlightSetting.addColorPicker((cp) =>
				cp.setValue(role.highlightColor).onChange(async (value) => {
					role.highlightColor = value;
					await this.plugin.saveAndApply();
				})
			);
		}

		const cssSetting = new Setting(contentEl).setName(t("customCssLabel", lang)).setDesc(t("customCssDesc", lang));
		cssSetting.addButton((btn) =>
			btn.setButtonText(t("snippetsBtn", lang)).onClick((evt) => {
				const snippets = getActiveProfile(this.plugin.settings).cssSnippets;
				openSnippetMenu(evt, snippets, (css) => {
					role.customCss = role.customCss ? role.customCss + "\n" + css : css;
					this.plugin.saveAndApply();
					this.onOpen(); // re-render to reflect the appended snippet
				});
			})
		);
		cssSetting.addTextArea((ta) =>
			ta.setValue(role.customCss || "").onChange(async (value) => {
				role.customCss = value;
				await this.plugin.saveAndApply();
			})
		);
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.onCloseCallback) this.onCloseCallback();
	}
}

import { App, Modal, Setting } from "obsidian";
import { AdvancedFormattingSettings, Role } from "./types";
import { t } from "./i18n";
import { openSnippetMenu, renderColorPicker, renderFontFamilyPicker } from "./uiHelpers";

export interface SavesSettings {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
}

export class RoleEditModal extends Modal {
	private onCloseCallback?: () => void;
	constructor(app: App, private plugin: SavesSettings, private role: Role, onClose?: () => void) {
		super(app);
		this.onCloseCallback = onClose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const role = this.role;
		const lang = this.plugin.settings.uiLanguage;
		contentEl.dir = lang === "ar" ? "rtl" : "ltr";
		contentEl.createEl("h2", { text: role.label || role.id });
		new Setting(contentEl).setName("Syntax").setDesc("Stored as ~={role:name}text=~ in notes.").addText((text) => { text.setValue(role.id); text.inputEl.disabled = true; });
		renderColorPicker(contentEl, role.color, this.plugin.settings.quickColors, async (value) => { role.color = value; await this.plugin.saveAndApply(); });
		contentEl.createEl("p", { text: t("fontFamilyDesc", lang), cls: "setting-item-description" });
		renderFontFamilyPicker(contentEl, role.fontFamily || "", (value) => { role.fontFamily = value; void this.plugin.saveAndApply(); });
		new Setting(contentEl).setName(t("boldLabel", lang)).addToggle((toggle) => toggle.setValue(role.bold).onChange(async (value) => { role.bold = value; await this.plugin.saveAndApply(); }));
		new Setting(contentEl).setName(t("italicLabel", lang)).addToggle((toggle) => toggle.setValue(role.italic).onChange(async (value) => { role.italic = value; await this.plugin.saveAndApply(); }));
		new Setting(contentEl).setName(t("underlineLabel", lang)).addToggle((toggle) => toggle.setValue(role.underline).onChange(async (value) => { role.underline = value; await this.plugin.saveAndApply(); }));
		const size = new Setting(contentEl).setName(t("customSizeLabel", lang));
		size.addToggle((toggle) => toggle.setValue(role.sizeEm != null).onChange(async (value) => { role.sizeEm = value ? role.sizeEm || 1 : null; await this.plugin.saveAndApply(); this.onOpen(); }));
		if (role.sizeEm != null) size.addSlider((slider) => slider.setLimits(0.6, 3, 0.05).setValue(role.sizeEm as number).setDynamicTooltip().onChange(async (value) => { role.sizeEm = value; await this.plugin.saveAndApply(); }));
		const highlight = new Setting(contentEl).setName(t("highlightBgLabel", lang));
		highlight.addToggle((toggle) => toggle.setValue(!!role.highlightColor).onChange(async (value) => { role.highlightColor = value ? role.highlightColor || "#FFF3CD" : ""; await this.plugin.saveAndApply(); this.onOpen(); }));
		if (role.highlightColor) highlight.addColorPicker((cp) => cp.setValue(role.highlightColor).onChange(async (value) => { role.highlightColor = value; await this.plugin.saveAndApply(); }));
		const cssSetting = new Setting(contentEl).setName(t("customCssLabel", lang));
		cssSetting.addButton((button) => button.setButtonText(t("snippetsBtn", lang)).onClick((event) => openSnippetMenu(event, this.plugin.settings.cssSnippets, (css) => { role.customCss = role.customCss ? role.customCss + "\n" + css : css; void this.plugin.saveAndApply(); this.onOpen(); })));
		cssSetting.addTextArea((area) => area.setValue(role.customCss || "").onChange(async (value) => { role.customCss = value; await this.plugin.saveAndApply(); }));
	}

	onClose(): void {
		this.contentEl.empty();
		this.onCloseCallback?.();
	}
}

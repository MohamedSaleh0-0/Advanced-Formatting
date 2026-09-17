import { App, ExtraButtonComponent, Plugin, PluginSettingTab, Setting, TextAreaComponent, TextComponent, ToggleComponent } from "obsidian";
import { AdvancedFormattingSettings, HeadingKey, Role } from "./types";
import { DEFAULT_HEADING_STYLES } from "./defaults";
import { RoleEditModal } from "./roleEditModal";
import { HeadingEditModal } from "./headingEditModal";
import { colorLabel } from "./colorNames";
import { renderFontFamilyPicker } from "./uiHelpers";

export interface AdvancedFormattingPluginLike extends Plugin {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
}

export class AdvancedFormattingSettingTab extends PluginSettingTab {
	plugin: AdvancedFormattingPluginLike;

	constructor(app: App, plugin: AdvancedFormattingPluginLike) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private section(title: string, description?: string): void {
		new Setting(this.containerEl).setName(title).setHeading();
		if (description) this.containerEl.createEl("p", { text: description, cls: "setting-item-description" });
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const settings = this.plugin.settings;
		const lang = settings.uiLanguage;
		containerEl.dir = lang === "ar" ? "rtl" : "ltr";

		new Setting(containerEl).setName("Settings language").addDropdown((dd) =>
			dd.addOptions({ en: "English", ar: "العربية" }).setValue(lang || "en").onChange(async (value) => {
				settings.uiLanguage = value as "en" | "ar";
				await this.plugin.saveAndApply();
				this.display();
			})
		);

		this.section("Typography", "Global text appearance for every note.");
		renderFontFamilyPicker(containerEl, settings.typography.fontFamily, (value) => {
			settings.typography.fontFamily = value;
			void this.plugin.saveAndApply();
		});
		new Setting(containerEl).setName("Font size").addSlider((s) => s.setLimits(10, 48, 1).setValue(settings.typography.fontSize).setDynamicTooltip().onChange(async (v) => {
			settings.typography.fontSize = v;
			await this.plugin.saveAndApply();
		}));
		new Setting(containerEl).setName("Line height").addSlider((s) => s.setLimits(1, 2.5, 0.1).setValue(settings.typography.lineHeight).setDynamicTooltip().onChange(async (v) => {
			settings.typography.lineHeight = v;
			await this.plugin.saveAndApply();
		}));
		new Setting(containerEl).setName("Paragraph spacing").addSlider((s) => s.setLimits(0, 3, 0.1).setValue(settings.typography.paragraphSpacingEm).setDynamicTooltip().onChange(async (v) => {
			settings.typography.paragraphSpacingEm = v;
			await this.plugin.saveAndApply();
		}));
		new Setting(containerEl).setName("Justify paragraphs").addToggle((t) => t.setValue(settings.typography.justify).onChange(async (v) => {
			settings.typography.justify = v;
			await this.plugin.saveAndApply();
		}));
		new Setting(containerEl).setName("Indent first line").addToggle((t) => t.setValue(settings.typography.firstLineIndent).onChange(async (v) => {
			settings.typography.firstLineIndent = v;
			await this.plugin.saveAndApply();
		})).addSlider((s) => s.setLimits(0.5, 4, 0.25).setValue(settings.typography.firstLineIndentEm).setDynamicTooltip().onChange(async (v) => {
			settings.typography.firstLineIndentEm = v;
			await this.plugin.saveAndApply();
		}));
		new Setting(containerEl).setName("Content width").addSlider((s) => s.setLimits(400, 1600, 20).setValue(settings.typography.fileLineWidthPx).setDynamicTooltip().onChange(async (v) => {
			settings.typography.fileLineWidthPx = v;
			await this.plugin.saveAndApply();
		}));

		this.section("Headings", "Global styles for H1–H6.");
		for (let i = 1; i <= 6; i++) {
			const key = ("h" + i) as HeadingKey;
			const style = settings.typography.headings[key] || DEFAULT_HEADING_STYLES[key];
			new Setting(containerEl).setName("Heading " + i).addSlider((s) => s.setLimits(0.7, 3.5, 0.05).setValue(style.sizeEm).setDynamicTooltip().onChange(async (v) => {
				style.sizeEm = v;
				await this.plugin.saveAndApply();
			})).addExtraButton((b) => b.setIcon("settings").setTooltip("Edit heading style").onClick(() => new HeadingEditModal(this.app, this.plugin, key, style, () => this.display()).open()));
		}

		this.section("Lists", "Choose the bullet shape for each nesting level.");
		settings.typography.listBulletShapes.forEach((shape, index) => {
			new Setting(containerEl).setName("Bullet level " + (index + 1)).addDropdown((dd) => dd.addOptions({ circle: "Circle", square: "Square", diamond: "Diamond" }).setValue(shape).onChange(async (v) => {
				settings.typography.listBulletShapes[index] = v as typeof shape;
				await this.plugin.saveAndApply();
			}));
		});

		this.section("Quick colors", "Colors shown in the editor context menu for selected text.");
		settings.quickColors.forEach((color, index) => {
			const row = new Setting(containerEl).setName(colorLabel(color));
			row.addColorPicker((picker) => picker.setValue(color).onChange(async (value) => {
				settings.quickColors[index] = value;
				row.setName(colorLabel(value));
				await this.plugin.saveAndApply();
			}));
			row.addExtraButton((button) => button.setIcon("trash").setTooltip("Remove color").onClick(async () => {
				settings.quickColors.splice(index, 1);
				await this.plugin.saveAndApply();
				this.display();
			}));
		});
		new Setting(containerEl).addButton((button) => button.setButtonText("Add quick color").onClick(async () => {
			settings.quickColors.push("#888888");
			await this.plugin.saveAndApply();
			this.display();
		}));

		this.section("Inline roles", "Reusable global styles applied with the Apply inline role command.");
		const list = containerEl.createDiv({ cls: "af-role-list" });
		settings.roles.forEach((role, index) => {
			if (role.hidden) return;
			const row = list.createDiv({ cls: "af-role-row" });
			const input = row.createEl("input", { type: "text", cls: "af-role-title-input", value: role.label || role.id });
			input.addEventListener("change", () => { role.label = input.value; void this.plugin.saveAndApply(); });
			const controls = row.createDiv({ cls: "af-role-row-controls" });
			new ToggleComponent(controls).setTooltip("Enable role").setValue(role.enabled !== false).onChange(async (value) => { role.enabled = value; await this.plugin.saveAndApply(); });
			new ExtraButtonComponent(controls).setIcon("settings").setTooltip("Edit role").onClick(() => new RoleEditModal(this.app, this.plugin, role, () => this.display()).open());
			new ExtraButtonComponent(controls).setIcon("copy").setTooltip("Duplicate role").onClick(async () => {
				const copy: Role = Object.assign({}, role, { id: role.id + "-copy-" + Date.now(), label: (role.label || role.id) + " (copy)" });
				settings.roles.splice(index + 1, 0, copy);
				await this.plugin.saveAndApply();
				this.display();
			});
			new ExtraButtonComponent(controls).setIcon("trash").setTooltip("Remove role").onClick(async () => {
				settings.roles.splice(index, 1);
				await this.plugin.saveAndApply();
				this.display();
			});
		});
		new Setting(containerEl).addButton((button) => button.setButtonText("Add role").onClick(async () => {
			settings.roles.push({ id: "role-" + Date.now(), label: "New role", color: "#888888", bold: false, italic: false, underline: false, fontFamily: "", sizeEm: null, highlightColor: "", customCss: "", enabled: true });
			await this.plugin.saveAndApply();
			this.display();
		}));

		this.section("Advanced", "Reusable CSS snippets for inline roles.");
		containerEl.createEl("p", {
			text: "Save declaration fragments here, then reuse them from an inline role. Do not include braces or selectors.",
			cls: "af-snippet-help setting-item-description",
		});
		const examples = containerEl.createEl("code", { cls: "af-snippet-examples" });
		examples.setText("letter-spacing: 0.05em;\nfont-variant: small-caps;\ntext-shadow: 0 1px 2px #0004;");
		settings.cssSnippets.forEach((snippet, index) => {
			const card = containerEl.createDiv({ cls: "af-snippet-card" });
			const name = new TextComponent(card).setValue(snippet.name).setPlaceholder("Snippet name");
			name.inputEl.classList.add("af-snippet-name");
			name.onChange(async (v) => { snippet.name = v; await this.plugin.saveAndApply(); });
			const css = new TextAreaComponent(card).setValue(snippet.css).setPlaceholder("letter-spacing: 0.05em;");
			css.inputEl.classList.add("af-snippet-css");
			css.onChange(async (v) => { snippet.css = v; await this.plugin.saveAndApply(); });
			const remove = new ExtraButtonComponent(card).setIcon("trash").setTooltip("Remove snippet");
			card.querySelector<HTMLElement>(".clickable-icon")?.classList.add("af-snippet-remove");
			remove.onClick(async () => { settings.cssSnippets.splice(index, 1); await this.plugin.saveAndApply(); this.display(); });
		});
		new Setting(containerEl).addButton((button) => button.setButtonText("Add CSS snippet").onClick(async () => { settings.cssSnippets.push({ name: "New snippet", css: "" }); await this.plugin.saveAndApply(); this.display(); }));
	}
}

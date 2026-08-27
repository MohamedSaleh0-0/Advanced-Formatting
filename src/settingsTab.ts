import { App, ExtraButtonComponent, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent, TextComponent, ToggleComponent } from "obsidian";
import { HeadingAlign, HeadingKey, AdvancedFormattingSettings, Profile, Role } from "./types";
import { DEFAULT_HEADING_STYLES, getActiveProfile } from "./defaults";
import { RoleEditModal } from "./roleEditModal";
import { HeadingEditModal } from "./headingEditModal";
import { exportSettingsToClipboard, ImportSettingsModal } from "./settingsBackup";
import { isolate, t, tn } from "./i18n";
import { colorLabel } from "./colorNames";
import { renderFontFamilyPicker } from "./uiHelpers";

// What the settings tab needs from the plugin instance. Kept as an
// interface here (rather than importing the concrete Plugin class from
// main.ts) to avoid a circular import between the two modules.
export interface AdvancedFormattingPluginLike extends Plugin {
	settings: AdvancedFormattingSettings;
	saveAndApply(): Promise<void>;
	registerRoleCommand(role: Role): void;
	unregisterRoleCommand(role: Role): void;
	switchProfile(id: string): Promise<void>;
	createProfile(name: string): Profile;
	addIslamicProfile(): Profile;
	duplicateProfile(id: string): Profile | null;
	deleteProfile(id: string): void;
}

export class AdvancedFormattingSettingTab extends PluginSettingTab {
	plugin: AdvancedFormattingPluginLike;

	// Which profile the pane is currently displaying/editing — deliberately
	// NOT the same thing as plugin.settings.activeProfileId, and never
	// persisted. Lets you look at and tweak a profile without switching
	// what's actually applied to your notes; the "Switch profile..."
	// command is the only thing that changes activeProfileId. Falls back
	// to the active profile whenever unset or pointing at a profile that
	// no longer exists (e.g. after a delete).
	private viewingProfileId: string | null = null;

	private getViewedProfile(): Profile {
		const settings = this.plugin.settings;
		if (this.viewingProfileId) {
			const found = settings.profiles.find((p) => p.id === this.viewingProfileId);
			if (found) return found;
		}
		return getActiveProfile(settings);
	}

	constructor(app: App, plugin: AdvancedFormattingPluginLike) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Rebuilding the whole pane (containerEl.empty() + re-render) resets
	// scroll to the top by default, which is disorienting when it happens
	// after a small action deep in a long settings page. Save/restore the
	// scroll position around any rebuild triggered from inside the pane.
	redraw(): void {
		const scrollTop = this.containerEl.scrollTop;
		this.display();
		requestAnimationFrame(() => {
			this.containerEl.scrollTop = scrollTop;
		});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const lang = this.plugin.settings.uiLanguage;
		// Native browser mirroring: with dir="rtl" on the container, flex
		// rows (the whole pane's row layout — see the inline flex styles
		// throughout this file) reverse visual order and text-align flips
		// automatically, with no per-element CSS changes needed — this
		// codebase already avoided hardcoded left/right physical
		// properties in its settings-pane CSS (checked before relying on
		// this), so this one attribute is genuinely sufficient for layout
		// mirroring, not just a partial gesture at it.
		containerEl.dir = lang === "ar" ? "rtl" : "ltr";

		containerEl.createEl("h2", { text: t("appTitle", lang) });

		// Language toggle — first thing in the pane, deliberately: it
		// changes how everything below it reads, so it shouldn't be
		// buried under a profile-specific section.
		new Setting(containerEl)
			.setName(t("uiLanguageLabel", lang))
			.setDesc(t("uiLanguageDesc", lang))
			.addDropdown((dd) =>
				dd
					.addOptions({ en: "English", ar: "العربية" })
					.setValue(lang || "en")
					.onChange(async (value) => {
						this.plugin.settings.uiLanguage = value as "en" | "ar";
						await this.plugin.saveAndApply();
						this.redraw();
					})
			);

		// Profiles — one active profile at a time, changed ONLY via the
		// "Switch profile..." command (not from here — see viewingProfileId
		// above). This dropdown picks which profile the rest of the pane
		// displays/edits, independent of which one is actually applied to
		// your notes right now.
		containerEl.createEl("h3", { text: t("profileSectionTitle", lang) });
		const profileRow = new Setting(containerEl).setName(t("viewingProfileLabel", lang)).setDesc(t("viewingProfileDesc", lang));

		const profileOptions: Record<string, string> = {};
		for (const p of this.plugin.settings.profiles) {
			profileOptions[p.id] = p.name + (p.id === this.plugin.settings.activeProfileId ? t("profileActiveSuffix", lang) : "");
		}
		profileRow.addDropdown((dd) =>
			dd
				.addOptions(profileOptions)
				.setValue(this.getViewedProfile().id)
				.onChange((value) => {
					this.viewingProfileId = value;
					this.redraw();
				})
		);

		const viewedProfile = this.getViewedProfile();

		const statusEl = containerEl.createEl("p");
		statusEl.style.cssText = "font-size:0.85em;opacity:0.75;margin-top:-8px;";
		statusEl.setText(
			viewedProfile.id === this.plugin.settings.activeProfileId ? t("profileActiveStatus", lang) : t("profileInactiveStatus", lang)
		);

		const profileNameSetting = new Setting(containerEl).setName(t("profileNameLabel", lang));
		profileNameSetting.addText((text) =>
			text.setValue(viewedProfile.name).onChange(async (value) => {
				viewedProfile.name = value || viewedProfile.name;
				await this.plugin.saveAndApply();
			})
		);
		profileNameSetting.addExtraButton((btn) =>
			btn
				.setIcon("copy")
				.setTooltip(t("duplicateProfileTooltip", lang))
				.onClick(async () => {
					const copy = this.plugin.duplicateProfile(viewedProfile.id);
					if (copy) {
						await this.plugin.saveAndApply();
						new Notice(tn("noticeDuplicatedAs", isolate(copy.name), lang));
						this.viewingProfileId = copy.id;
						this.redraw();
					}
				})
		);
		profileNameSetting.addExtraButton((btn) =>
			btn
				.setIcon("trash")
				.setTooltip(t("deleteProfileTooltip", lang))
				.onClick(async () => {
					this.plugin.deleteProfile(viewedProfile.id);
					await this.plugin.saveAndApply();
					// viewingProfileId may now point at a profile that no
					// longer exists — getViewedProfile() already falls back
					// to the active one in that case, but clear it
					// explicitly so the dropdown doesn't show a stale id.
					this.viewingProfileId = null;
					this.redraw();
				})
		);

		new Setting(containerEl)
			.setName(t("profileDescLabel", lang))
			.setDesc(t("profileDescDesc", lang))
			.addText((text) =>
				text
					.setPlaceholder(t("profileDescPlaceholder", lang))
					.setValue(viewedProfile.description || "")
					.onChange(async (value) => {
						viewedProfile.description = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl).addButton((btn) =>
			btn.setButtonText(t("newProfileBtn", lang)).onClick(async () => {
				const p = this.plugin.createProfile("New profile");
				await this.plugin.saveAndApply();
				this.viewingProfileId = p.id;
				this.redraw();
			})
		);

		// Not the default, not auto-added — deliberately opt-in (see
		// defaults.ts's islamicProfile()). Once added it's an ordinary
		// profile, deletable the same way any other profile is.
		new Setting(containerEl).setDesc(t("addIslamicProfileDesc", lang)).addButton((btn) =>
			btn.setButtonText(t("addIslamicProfileBtn", lang)).onClick(async () => {
				const p = this.plugin.addIslamicProfile();
				await this.plugin.saveAndApply();
				this.viewingProfileId = p.id;
				this.redraw();
			})
		);

		// Scope
		containerEl.createEl("h3", { text: t("scopeSectionTitle", lang) });
		new Setting(containerEl).setName(t("scopeModeLabel", lang)).addDropdown((dd) =>
			dd
				.addOptions({
					global: t("scopeModeGlobal", lang),
					cssclass: t("scopeModeCssclass", lang),
					"folder-include": t("scopeModeFolderInclude", lang),
					"folder-exclude": t("scopeModeFolderExclude", lang),
					"smart-arabic-title": t("scopeModeSmartArabic", lang),
				})
				.setValue(viewedProfile.scope.mode)
				.onChange(async (value) => {
					viewedProfile.scope.mode = value as AdvancedFormattingSettings["profiles"][number]["scope"]["mode"];
					await this.plugin.saveAndApply();
					this.redraw();
				})
		);

		if (viewedProfile.scope.mode === "cssclass") {
			new Setting(containerEl).setName(t("cssclassValueLabel", lang)).addText((text) =>
				text.setValue(viewedProfile.scope.cssclassValue).onChange(async (value) => {
					viewedProfile.scope.cssclassValue = value;
					await this.plugin.saveAndApply();
				})
			);
		}

		if (viewedProfile.scope.mode === "folder-include" || viewedProfile.scope.mode === "folder-exclude") {
			new Setting(containerEl).setName(t("foldersLabel", lang)).addTextArea((ta) =>
				ta.setValue((viewedProfile.scope.folders || []).join("\n")).onChange(async (value) => {
					viewedProfile.scope.folders = value
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					await this.plugin.saveAndApply();
				})
			);
		}

		// Typography
		containerEl.createEl("h3", { text: t("typographySectionTitle", lang) });

		renderFontFamilyPicker(containerEl, viewedProfile.typography.fontFamily, async (value) => {
			viewedProfile.typography.fontFamily = value;
			await this.plugin.saveAndApply();
		});

		new Setting(containerEl).setName(t("fontSizeLabel", lang)).addSlider((slider) =>
			slider
				.setLimits(10, 48, 1)
				.setValue(viewedProfile.typography.fontSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					viewedProfile.typography.fontSize = value;
					await this.plugin.saveAndApply();
				})
		);

		new Setting(containerEl).setName(t("lineHeightLabel", lang)).addSlider((slider) =>
			slider
				.setLimits(1.0, 2.5, 0.1)
				.setValue(viewedProfile.typography.lineHeight)
				.setDynamicTooltip()
				.onChange(async (value) => {
					viewedProfile.typography.lineHeight = value;
					await this.plugin.saveAndApply();
				})
		);

		// Separate from line height on purpose — line height is the space
		// WITHIN a paragraph (between its own wrapped lines); this is the
		// gap BETWEEN paragraphs, independently adjustable the way a word
		// processor's "space after paragraph" is separate from its line
		// spacing.
		new Setting(containerEl).setName(t("paragraphSpacingLabel", lang)).addSlider((slider) =>
			slider
				.setLimits(0, 3, 0.1)
				.setValue(viewedProfile.typography.paragraphSpacingEm)
				.setDynamicTooltip()
				.onChange(async (value) => {
					viewedProfile.typography.paragraphSpacingEm = value;
					await this.plugin.saveAndApply();
				})
		);

		new Setting(containerEl).setName(t("justifyLabel", lang)).addToggle((toggle) =>
			toggle.setValue(viewedProfile.typography.justify).onChange(async (value) => {
				viewedProfile.typography.justify = value;
				await this.plugin.saveAndApply();
			})
		);

		new Setting(containerEl)
			.setName(t("indentFirstLineLabel", lang))
			.addToggle((toggle) =>
				toggle.setValue(viewedProfile.typography.firstLineIndent).onChange(async (value) => {
					viewedProfile.typography.firstLineIndent = value;
					await this.plugin.saveAndApply();
				})
			)
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 4, 0.25)
					.setValue(viewedProfile.typography.firstLineIndentEm)
					.setDynamicTooltip()
					.onChange(async (value) => {
						viewedProfile.typography.firstLineIndentEm = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl).setName(t("contentWidthLabel", lang)).addSlider((slider) =>
			slider
				.setLimits(400, 1600, 20)
				.setValue(viewedProfile.typography.fileLineWidthPx)
				.setDynamicTooltip()
				.onChange(async (value) => {
					viewedProfile.typography.fileLineWidthPx = value;
					await this.plugin.saveAndApply();
				})
		);

		new Setting(containerEl)
			.setName(t("footnoteSizeLabel", lang))
			.addSlider((slider) =>
				slider
					.setLimits(8, 24, 1)
					.setValue(viewedProfile.typography.footnoteSizePx)
					.setDynamicTooltip()
					.onChange(async (value) => {
						viewedProfile.typography.footnoteSizePx = value;
						await this.plugin.saveAndApply();
					})
			);

		// Headings H1-H6
		containerEl.createEl("h3", { text: t("headingsSectionTitle", lang) });

		for (let i = 1; i <= 6; i++) {
			const hKey = ("h" + i) as HeadingKey;
			const hConf = viewedProfile.typography.headings[hKey] || DEFAULT_HEADING_STYLES[hKey];
			const row = new Setting(containerEl).setName(tn("headingLabel", i, lang));

			row.addSlider((slider) =>
				slider
					.setLimits(0.7, 3.5, 0.05)
					.setValue(hConf.sizeEm || DEFAULT_HEADING_STYLES[hKey].sizeEm)
					.setDynamicTooltip()
					.onChange(async (val) => {
						hConf.sizeEm = val;
						await this.plugin.saveAndApply();
					})
			);

			row.addDropdown((dd) =>
				dd
					.addOptions({ auto: t("alignAuto", lang), left: t("alignLeft", lang), center: t("alignCenter", lang), right: t("alignRight", lang) })
					.setValue(hConf.align || "auto")
					.onChange(async (val) => {
						hConf.align = val as HeadingAlign;
						await this.plugin.saveAndApply();
					})
			);

			row.addExtraButton((btn) =>
				btn
					.setIcon("settings")
					.setTooltip(t("headingEditTooltip", lang))
					.onClick(() => {
						new HeadingEditModal(this.app, this.plugin, hKey, hConf, () => this.redraw()).open();
					})
			);
		}

		// List Bullets
		containerEl.createEl("h3", { text: t("listBulletsSectionTitle", lang) });
		viewedProfile.typography.listBulletShapes.forEach((shape, i) => {
			new Setting(containerEl).setName(tn("bulletDepthLabel", i + 1, lang)).addDropdown((dd) =>
				dd
					.addOptions({
						circle: t("bulletCircle", lang),
						square: t("bulletSquare", lang),
						diamond: t("bulletDiamond", lang),
					})
					.setValue(shape)
					.onChange(async (value) => {
						viewedProfile.typography.listBulletShapes[i] = value as typeof shape;
						await this.plugin.saveAndApply();
					})
			);
		});

		// Quick Colors — the palette offered in the right-click "Colorize"
		// menu (main.ts), in addition to the always-present "Custom..."
		// entry there. Deliberately separate from Roles: this is
		// color-only, one-click, no dialog — for when you just want to
		// tint a word or two without opening Format selection.
		containerEl.createEl("h3", { text: t("quickColorsSectionTitle", lang) });
		containerEl.createEl("p", { text: t("quickColorsSectionDesc", lang), cls: "setting-item-description" });
		viewedProfile.quickColors.forEach((color, i) => {
			const setting = new Setting(containerEl).setName(colorLabel(color));
			setting
				.addColorPicker((picker) =>
					picker.setValue(color).onChange(async (value) => {
						viewedProfile.quickColors[i] = value;
						setting.setName(colorLabel(value));
						await this.plugin.saveAndApply();
					})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip(t("removeColorTooltip", lang))
						.onClick(async () => {
							viewedProfile.quickColors.splice(i, 1);
							await this.plugin.saveAndApply();
							this.redraw();
						})
				);
		});
		new Setting(containerEl).addButton((btn) =>
			btn.setButtonText(t("addColorBtn", lang)).onClick(async () => {
				viewedProfile.quickColors.push("#888888");
				await this.plugin.saveAndApply();
				this.redraw();
			})
		);

		// CSS Snippets — named, reusable Custom CSS fragments. A quick-pick
		// source for the Custom CSS field in Format selection and the role
		// editor (both offer a "Snippets..." button next to that field),
		// so a declaration like "letter-spacing: 0.05em;" doesn't need
		// retyping every time it's wanted.
		containerEl.createEl("h3", { text: t("cssSnippetsSectionTitle", lang) });
		containerEl.createEl("p", { text: t("cssSnippetsSectionDesc", lang), cls: "setting-item-description" });
		viewedProfile.cssSnippets.forEach((snippet, i) => {
			const card = containerEl.createDiv({ cls: "af-snippet-card" });
			const header = card.createDiv({ cls: "af-snippet-card-header" });
			new TextComponent(header)
				.setValue(snippet.name)
				.setPlaceholder(t("snippetNameLabel", lang))
				.onChange(async (value) => {
					snippet.name = value;
					await this.plugin.saveAndApply();
				}).inputEl.addClass("af-snippet-name-input");
			new ExtraButtonComponent(header)
				.setIcon("trash")
				.setTooltip(t("removeSnippetTooltip", lang))
				.onClick(async () => {
					viewedProfile.cssSnippets.splice(i, 1);
					await this.plugin.saveAndApply();
					this.redraw();
				});
			const ta = new TextAreaComponent(card)
				.setValue(snippet.css)
				.setPlaceholder("letter-spacing: 0.05em;")
				.onChange(async (value) => {
					snippet.css = value;
					await this.plugin.saveAndApply();
				});
			ta.inputEl.rows = 2;
			ta.inputEl.addClass("af-snippet-css-input");
		});
		new Setting(containerEl).addButton((btn) =>
			btn.setButtonText(t("addSnippetBtn", lang)).onClick(async () => {
				viewedProfile.cssSnippets.push({ name: "New snippet", css: "" });
				await this.plugin.saveAndApply();
				this.redraw();
			})
		);

		// currently VIEWED, which is the natural shareable unit now that
		// roles are fully user-defined (a "legal document markup" profile,
		// a "fiction manuscript" profile) rather than one global blob.
		containerEl.createEl("h3", { text: t("backupSectionTitle", lang) });
		new Setting(containerEl)
			.setName(t("exportLabel", lang))
			.setDesc(tn("exportDescTemplate", isolate(viewedProfile.name), lang))
			.addButton((btn) =>
				btn.setButtonText(t("exportBtn", lang)).onClick(async () => {
					await exportSettingsToClipboard(this.app, viewedProfile, lang);
				})
			);
		new Setting(containerEl)
			.setName(t("importLabel", lang))
			.setDesc(t("importDesc", lang))
			.addButton((btn) =>
				btn.setButtonText(t("importBtn", lang)).onClick(() => {
					new ImportSettingsModal(this.app, this.plugin, () => this.redraw()).open();
				})
			);

		// Inline Roles — general-purpose "dynamic classifying": any text
		// wrapped between a role's open/close delimiters gets that role's
		// styling, invisibly under the hood — the delimiters themselves
		// hide unless the cursor is inside them, exactly like ** on bold
		// text. Presets are just pre-filled examples of this, nothing about
		// matching is specific to them.
		containerEl.createEl("h3", { text: t("inlineRolesSectionTitle", lang) });
		containerEl.createEl("p", { text: t("inlineRolesDesc", lang) });

		// Role commands (and their hotkeys) only reflect the ACTIVE
		// profile — see registerRoleCommand/switchProfile in main.ts.
		// Adding/removing/duplicating a role while viewing a profile
		// that ISN'T active must not touch the command registry: those
		// commands aren't live, and touching them here would register a
		// hotkey-able command for a role that isn't actually reachable
		// until that profile is switched to.
		const isEditingActive = viewedProfile.id === this.plugin.settings.activeProfileId;

		if (isEditingActive) {
			containerEl.createEl("p", { text: t("hotkeyHint", lang), cls: "af-hotkey-hint" });
		}

		const list = containerEl.createDiv({ cls: "af-role-list" });

		viewedProfile.roles.forEach((role, index) => {
			if (role.hidden) return; // auto-generated by "Format selection...", not a user-facing row
			const row = list.createDiv({ cls: "af-role-row" });
			// Inline, not class-based: a class-based rule lost to something
			// in Obsidian's own settings-pane stylesheet (near-certainly a
			// more specific selector beating a single custom class
			// regardless of load order) — inline style beats any selector
			// that isn't !important, which this project avoids on
			// principle, so this is a structural fix, not a guess.
			row.style.cssText =
				"display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border);";

			const titleInput = row.createEl("input", {
				type: "text",
				cls: "af-role-title-input",
				value: role.label || role.id,
			});
			titleInput.style.cssText = "flex:1 1 auto;min-width:0;";
			titleInput.addEventListener("change", async () => {
				role.label = titleInput.value;
				await this.plugin.saveAndApply();
			});

			const controls = row.createDiv({ cls: "af-role-row-controls" });
			controls.style.cssText = "display:flex;align-items:center;gap:6px;flex:0 0 auto;";

			new ToggleComponent(controls)
				.setTooltip(t("roleToggleTooltip", lang))
				.setValue(role.enabled !== false)
				.onChange(async (value) => {
					role.enabled = value;
					await this.plugin.saveAndApply();
				});

			new ExtraButtonComponent(controls)
				.setIcon("settings")
				.setTooltip(t("roleEditTooltip", lang))
				.onClick(() => {
					new RoleEditModal(this.app, this.plugin, role, () => this.redraw()).open();
				});

			new ExtraButtonComponent(controls)
				.setIcon("copy")
				.setTooltip(t("roleDuplicateTooltip", lang))
				.onClick(async () => {
					const copy: Role = Object.assign({}, role, {
						id: role.id + "-copy" + Date.now(),
						label: (role.label || role.id) + " (copy)",
					});
					viewedProfile.roles.splice(index + 1, 0, copy);
					if (isEditingActive) this.plugin.registerRoleCommand(copy);
					await this.plugin.saveAndApply();
					this.redraw();
				});

			new ExtraButtonComponent(controls)
				.setIcon("trash")
				.setTooltip(t("roleRemoveTooltip", lang))
				.onClick(async () => {
					const removed = role;
					const removedIndex = index;
					viewedProfile.roles.splice(index, 1);
					if (isEditingActive) this.plugin.unregisterRoleCommand(removed);
					await this.plugin.saveAndApply();
					this.redraw();

					const notice = new Notice("", 5000);
					notice.noticeEl.setText(tn("noticeRemoved", isolate(removed.label || removed.id), lang));
					const undoBtn = notice.noticeEl.createEl("button", { text: t("undoBtn", lang), cls: "af-undo-btn" });
					undoBtn.onclick = async () => {
						viewedProfile.roles.splice(removedIndex, 0, removed);
						if (isEditingActive) this.plugin.registerRoleCommand(removed);
						await this.plugin.saveAndApply();
						this.redraw();
						notice.hide();
					};
				});
		});

		new Setting(containerEl).addButton((btn) =>
			btn.setButtonText(t("blankRoleBtn", lang)).onClick(async () => {
				const newRole: Role = {
					id: "role" + Date.now(),
					label: t("newRoleDefaultLabel", lang),
					open: "",
					close: "",
					color: "#888888",
					bold: false,
					italic: false,
					underline: false,
					fontFamily: "",
					sizeEm: null,
					highlightColor: "",
					customCss: "",
					enabled: true,
				};
				viewedProfile.roles.push(newRole);
				if (isEditingActive) this.plugin.registerRoleCommand(newRole);
				await this.plugin.saveAndApply();
				this.redraw();
			})
		);
	}
}

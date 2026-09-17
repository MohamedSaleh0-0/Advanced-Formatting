import { Menu, Setting, TextComponent } from "obsidian";
import { BUNDLED_FONTS } from "./bundledFonts";

// Opens a real popup menu (not a Settings-style dropdown — matches what
// was actually asked for) listing every saved CSS snippet by name;
// picking one hands its CSS back to the caller, which decides whether to
// replace or append to whatever's already in the Custom CSS field.
// Shows a single disabled-feeling "no snippets saved" item rather than
// silently doing nothing if the list is empty, since a popup with zero
// items reads as broken, not empty-by-design.
export function openSnippetMenu(
	evt: MouseEvent,
	snippets: { name: string; css: string }[],
	onPick: (css: string) => void
): void {
	const menu = new Menu();
	if (!snippets.length) {
		menu.addItem((item) => item.setTitle("No snippets saved — add one in Settings").setDisabled(true));
	} else {
		for (const s of snippets) {
			menu.addItem((item) =>
				item
					.setTitle(s.name || "(unnamed)")
					.setIcon("file-code")
					.onClick(() => onPick(s.css))
			);
		}
	}
	menu.showAtMouseEvent(evt);
}

// A short, curated list of fonts common enough to be worth one-click
// access — NOT bundled with the plugin, so (unlike BUNDLED_FONTS,
// bundledFonts.ts) each of these only works if that exact font is
// already installed on the user's operating system. Kept separate from
// the bundled list so the picker below can clearly label which is
// which, rather than implying every option here is "plug and play."
const COMMON_INSTALLED_FONTS: string[] = [
	"Georgia",
	"Times New Roman",
	"Garamond",
	"Verdana",
	"Trebuchet MS",
	"Courier New",
];

const CUSTOM_VALUE = "__custom__";

// Renders a font-family picker as a dropdown (grouped: bundled fonts
// that work with zero setup, then common fonts that need to already be
// installed) PLUS a "Custom..." option that reveals a freeform text
// field for typing any other exact, already-installed font name. Two
// `Setting` rows (dropdown, then the text field — hidden unless
// "Custom..." is selected) rather than one, since Obsidian's `Setting`
// doesn't support two independent controls cleanly sharing one row here.
//
// `currentValue` is the role/format's existing fontFamily string (empty
// = theme default). `onChange` fires with the final font-family value to
// actually use, from either control.
export function renderFontFamilyPicker(container: HTMLElement, currentValue: string, onChange: (value: string) => void): void {
	const knownValues = new Set<string>(["", ...BUNDLED_FONTS.map((f) => f.label), ...COMMON_INSTALLED_FONTS]);
	const isCustom = currentValue !== "" && !knownValues.has(currentValue);

	let customText: TextComponent | null = null;

	const dropdownSetting = new Setting(container).setName("Font").addDropdown((dd) => {
		// Use the public DropdownComponent API. Directly mutating selectEl
		// caused the entire settings renderer to abort on the target runtime.
		dd.addOption("", "Default (theme font)");
		for (const font of BUNDLED_FONTS) {
			dd.addOption(font.label, "Bundled: " + font.label);
		}
		for (const name of COMMON_INSTALLED_FONTS) {
			dd.addOption(name, "Installed: " + name);
		}
		dd.addOption(CUSTOM_VALUE, "Custom...");

		dd.setValue(isCustom ? CUSTOM_VALUE : currentValue);
		dd.onChange((value) => {
			if (value === CUSTOM_VALUE) {
				customRow.settingEl.removeClass("af-hidden");
				if (customText) customText.inputEl.focus();
				return;
			}
			customRow.settingEl.addClass("af-hidden");
			onChange(value);
		});
	});
	void dropdownSetting;

	const customRow = new Setting(container).setName("Custom font name").addText((text) => {
		customText = text;
		text
			.setValue(isCustom ? currentValue : "")
			.setPlaceholder("Exact installed font name")
			.onChange((value) => onChange(value));
	});
	if (!isCustom) customRow.settingEl.addClass("af-hidden");
}

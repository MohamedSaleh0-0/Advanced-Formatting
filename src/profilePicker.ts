import { App, FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { Profile } from "./types";

export class ProfilePickerModal extends FuzzySuggestModal<Profile> {
	private profiles: Profile[];
	private onPick: (profile: Profile) => void;

	constructor(app: App, profiles: Profile[], onPick: (profile: Profile) => void) {
		super(app);
		this.profiles = profiles;
		this.onPick = onPick;
		this.setPlaceholder("Switch to profile...");
	}

	getItems(): Profile[] {
		return this.profiles;
	}

	getItemText(profile: Profile): string {
		return profile.name;
	}

	// Description is purely a note-to-self for the user, not part of the
	// fuzzy-search text itself (getItemText) — shown as subtext instead,
	// same visual pattern Obsidian's own file/command switchers use for
	// secondary info under the main line.
	renderSuggestion(match: FuzzyMatch<Profile>, el: HTMLElement): void {
		const profile = match.item;
		el.createDiv({ text: profile.name });
		if (profile.description) {
			el.createDiv({ text: profile.description, cls: "af-profile-suggestion-desc" });
		}
	}

	onChooseItem(profile: Profile): void {
		this.onPick(profile);
	}
}

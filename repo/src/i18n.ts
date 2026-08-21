export type UiLanguage = "en" | "ar";

// Every static, user-facing string in the settings pane (and the Notice
// toasts settings actions trigger), keyed by a stable id — English is
// the source of truth for meaning. Arabic strings were translated in
// good faith but haven't been proofed by a native speaker for register/
// tone; worth a pass before relying on them for anything public-facing.
//
// Deliberately NOT covering: user data (role labels, profile names —
// never translate what the user typed), or command-palette command
// names registered in main.ts (Obsidian's command palette is one
// unified list across all plugins; switching just this plugin's entries
// to Arabic would be inconsistent with everything else in it, more
// confusing than helpful, and — for the per-role hotkey commands —
// would change a command's identity out from under an already-bound
// hotkey. Scoped to the settings PANE itself, which is what was asked
// for and is where a language toggle actually makes sense).
const STRINGS: Record<string, { en: string; ar: string }> = {
	appTitle: { en: "Advanced Formatting", ar: "التنسيق المتقدم" },
	uiLanguageLabel: { en: "Settings language", ar: "لغة الإعدادات" },
	uiLanguageDesc: { en: "Language for this settings pane only — doesn't affect your notes.", ar: "لغة صفحة الإعدادات فقط — لا تؤثر على ملاحظاتك." },

	profileSectionTitle: { en: "Profile", ar: "الملف الشخصي" },
	viewingProfileLabel: { en: "Viewing profile", ar: "الملف المعروض" },
	viewingProfileDesc: {
		en: 'Views/edits this profile only — doesn\'t change which one applies to your notes (use "Switch profile..." for that).',
		ar: 'يعرض/يعدّل هذا الملف فقط — لا يغيّر الملف المُطبَّق على ملاحظاتك (استخدم "تبديل الملف الشخصي..." لذلك).',
	},
	profileActiveStatus: { en: "This profile is currently active.", ar: "هذا الملف نشط حاليًا." },
	profileInactiveStatus: {
		en: 'Not currently active. Run "Switch profile..." from the command palette to make this one active.',
		ar: 'غير نشط حاليًا. شغّل أمر "تبديل الملف الشخصي..." من لوحة الأوامر لتفعيله.',
	},
	profileNameLabel: { en: "Profile name", ar: "اسم الملف الشخصي" },
	profileActiveSuffix: { en: " (active)", ar: " (نشط)" },
	duplicateProfileTooltip: { en: "Duplicate this profile", ar: "نسخ هذا الملف الشخصي" },
	deleteProfileTooltip: { en: "Delete this profile", ar: "حذف هذا الملف الشخصي" },
	profileDescLabel: { en: "Profile description", ar: "وصف الملف الشخصي" },
	profileDescDesc: {
		en: 'When to use this profile — shown in the "Switch profile..." picker.',
		ar: 'متى تُستخدم هذا الملف — يظهر عند اختيار ملف عبر أمر "تبديل الملف الشخصي...".',
	},
	profileDescPlaceholder: { en: "What is this profile for?", ar: "ما الغرض من هذا الملف؟" },
	newProfileBtn: { en: "+ New profile", ar: "+ ملف جديد" },
	addIslamicProfileBtn: { en: "+ Add Islamic/Arabic profile", ar: "+ إضافة ملف إسلامي/عربي" },
	addIslamicProfileDesc: {
		en: "Adds a ready-made profile with matn/taleel/hadith/ayah roles for Arabic scholarly notes — separate from your default, deletable like any other.",
		ar: "يضيف ملفًا جاهزًا يتضمن أدوار المتن والتعليلات والحديث والآية للملاحظات العلمية العربية — منفصل عن ملفك الافتراضي، وقابل للحذف كأي ملف آخر.",
	},

	scopeSectionTitle: { en: "Scope", ar: "نطاق التطبيق" },
	scopeModeLabel: { en: "Mode", ar: "الوضع" },
	scopeModeGlobal: { en: "Every note (global)", ar: "كل الملاحظات (عام)" },
	scopeModeCssclass: { en: "Notes with a specific cssclass in frontmatter", ar: "الملاحظات التي تحمل cssclass معينة في الفرونت ماتر" },
	scopeModeFolderInclude: { en: "Only these folders", ar: "هذه المجلدات فقط" },
	scopeModeFolderExclude: { en: "Every folder except these", ar: "كل المجلدات ما عدا هذه" },
	scopeModeSmartArabic: { en: "Auto: note title starts with Arabic", ar: "تلقائي: عنوان الملاحظة يبدأ بحرف عربي" },
	cssclassValueLabel: { en: "cssclass value", ar: "قيمة cssclass" },
	foldersLabel: { en: "Folders (one per line)", ar: "المجلدات (كل مجلد في سطر)" },

	typographySectionTitle: { en: "Typography", ar: "الخطوط والتنسيق" },
	bodyFontLabel: { en: "Body font family", ar: "خط النص الأساسي" },
	fontSizeLabel: { en: "Font size (px)", ar: "حجم الخط (بكسل)" },
	lineHeightLabel: { en: "Line height", ar: "ارتفاع السطر" },
	paragraphSpacingLabel: { en: "Paragraph spacing", ar: "تباعد الفقرات" },
	justifyLabel: { en: "Justify body text", ar: "ضبط توسيط النص (Justify)" },
	indentFirstLineLabel: { en: "Indent first line of paragraphs", ar: "إزاحة أول سطر في الفقرات" },
	contentWidthLabel: { en: "Content column width (px)", ar: "عرض عمود المحتوى (بكسل)" },
	footnoteSizeLabel: { en: "Footnote size (px)", ar: "حجم خط الهامش (بكسل)" },

	headingsSectionTitle: { en: "Headings Styling (H1 - H6)", ar: "تنسيق العناوين (H1 - H6)" },
	headingLabel: { en: "Heading {n}", ar: "العنوان {n}" },
	headingEditTooltip: { en: "Edit style (color, bold, font, CSS, ...)", ar: "تعديل النمط (اللون، الغامق، الخط، CSS، ...)" },
	headingSizeLabel: { en: "Size", ar: "الحجم" },
	headingAlignLabel: { en: "Alignment", ar: "المحاذاة" },
	alignAuto: { en: "Auto", ar: "تلقائي" },
	alignRight: { en: "Right", ar: "يمين" },
	alignCenter: { en: "Center", ar: "وسط" },
	alignLeft: { en: "Left", ar: "يسار" },

	listBulletsSectionTitle: { en: "Nested list bullets", ar: "رموز القوائم المتداخلة" },
	quickColorsSectionTitle: { en: "Quick colors", ar: "ألوان سريعة" },
	quickColorsSectionDesc: {
		en: 'Colors offered in the right-click "Colorize" menu.',
		ar: 'الألوان المعروضة في قائمة "تلوين" عند النقر بزر الفأرة الأيمن.',
	},
	removeColorTooltip: { en: "Remove color", ar: "إزالة اللون" },
	addColorBtn: { en: "+ Add color", ar: "+ إضافة لون" },
	cssSnippetsSectionTitle: { en: "CSS snippets", ar: "مقتطفات CSS" },
	cssSnippetsSectionDesc: {
		en: 'Reusable CSS fragments — pick one from "Snippets..." next to any Custom CSS field.',
		ar: 'مقتطفات CSS قابلة لإعادة الاستخدام — اخترها من زر "مقتطفات..." بجانب أي حقل CSS مخصص.',
	},
	snippetNameLabel: { en: "Name", ar: "الاسم" },
	removeSnippetTooltip: { en: "Remove snippet", ar: "إزالة المقتطف" },
	addSnippetBtn: { en: "+ Add snippet", ar: "+ إضافة مقتطف" },
	bulletDepthLabel: { en: "Depth {n} shape", ar: "شكل المستوى {n}" },
	bulletCircle: { en: "Circle", ar: "دائرة" },
	bulletSquare: { en: "Square", ar: "مربع" },
	bulletDiamond: { en: "Diamond", ar: "معين" },

	backupSectionTitle: { en: "Backup / sharing", ar: "نسخ احتياطي / مشاركة" },
	exportLabel: { en: "Export this profile", ar: "تصدير هذا الملف الشخصي" },
	exportDescTemplate: { en: 'Copies "{n}" (roles, typography, scope) as JSON to the clipboard.', ar: 'ينسخ "{n}" (الأدوار، التنسيق، النطاق) كـ JSON إلى الحافظة.' },
	exportBtn: { en: "Export", ar: "تصدير" },
	importLabel: { en: "Import as new profile", ar: "استيراد كملف شخصي جديد" },
	importDesc: {
		en: "Paste a profile JSON blob (from Export, or shared by someone else) to add it as a new profile — doesn't touch your existing ones.",
		ar: "الصق بيانات JSON لملف شخصي (من التصدير، أو مشتركة من شخص آخر) لإضافته كملف جديد — دون المساس بملفاتك الحالية.",
	},
	importBtn: { en: "Import", ar: "استيراد" },

	inlineRolesSectionTitle: { en: "Inline roles", ar: "الأدوار المضمنة" },
	inlineRolesDesc: {
		en: "Wrap text in a role's delimiters to style it. Presets below are off by default — click the gear to edit.",
		ar: "أحِط النص بعلامتي الدور لتنسيقه. الأدوار الجاهزة أدناه مطفأة افتراضيًا — اضغط أيقونة الإعدادات للتعديل.",
	},
	hotkeyHint: {
		en: 'Each role above is also its own command — go to Settings \u2192 Hotkeys and search "Wrap selection as" to assign one a keyboard shortcut.',
		ar: 'كل دور أعلاه هو أيضًا أمر مستقل — اذهب إلى الإعدادات \u2190 اختصارات لوحة المفاتيح وابحث عن "Wrap selection as" لتعيين اختصار له.',
	},
	roleToggleTooltip: { en: "On / off", ar: "تشغيل / إيقاف" },
	roleEditTooltip: { en: "Edit style (color, font, size, delimiters, ...)", ar: "تعديل النمط (اللون، الخط، الحجم، العلامات، ...)" },
	roleDuplicateTooltip: { en: "Duplicate this role", ar: "نسخ هذا الدور" },
	roleRemoveTooltip: { en: "Remove role", ar: "إزالة الدور" },
	blankRoleBtn: { en: "+ Blank role", ar: "+ دور فارغ" },
	newRoleDefaultLabel: { en: "New role", ar: "دور جديد" },

	// RoleEditModal (the gear-icon detail editor for one role)
	fieldOpenLabel: { en: "Open", ar: "الفتح" },
	fieldCloseLabel: { en: "Close", ar: "الإغلاق" },
	delimitersLabel: { en: "Delimiters", ar: "علامات الفتح والإغلاق" },
	delimitersDesc: {
		en: 'What you type before/after the wrapped text — e.g. "«" and "»", or "[?" and "?]".',
		ar: 'ما تكتبه قبل/بعد النص المُحاط — مثل "«" و"»"، أو "[?" و"?]".',
	},
	delimiterDisplayLabel: { en: "Delimiter display", ar: "طريقة عرض العلامات" },
	delimiterDisplayDesc: {
		en: "Auto: hidden unless editing (default). Show: always visible. Hide: never visible. Alias: shows different text instead, like a wikilink alias.",
		ar: "تلقائي: تختفي إلا عند التحرير (الافتراضي). إظهار: تظهر دائمًا. إخفاء: لا تظهر أبدًا. اسم بديل: يظهر نص مختلف بدلًا منها، مثل الاسم البديل في رابط الويكي.",
	},
	ddAuto: { en: "Auto (hide unless editing)", ar: "تلقائي (إخفاء إلا عند التحرير)" },
	ddShow: { en: "Always show", ar: "إظهار دائمًا" },
	ddHide: { en: "Always hide", ar: "إخفاء دائمًا" },
	ddAlias: { en: "Custom alias", ar: "اسم بديل مخصص" },
	aliasTextLabel: { en: "Alias text", ar: "نص الاسم البديل" },
	aliasTextDesc: {
		en: 'What to show instead — e.g. "(" / ")" instead of the real delimiters, or leave one side blank to just hide that side.',
		ar: 'ما يظهر بدلًا من العلامات — مثل "(" / ")" بدلًا من العلامات الحقيقية، أو اترك أحد الجانبين فارغًا لإخفائه فقط.',
	},
	textColorLabel: { en: "Text color", ar: "لون النص" },
	fontFamilyLabel: { en: "Font family", ar: "نوع الخط" },
	fontFamilyDesc: { en: "Leave blank to inherit the body font.", ar: "اتركه فارغًا لوراثة خط النص الأساسي." },
	boldLabel: { en: "Bold", ar: "غامق" },
	italicLabel: { en: "Italic", ar: "مائل" },
	underlineLabel: { en: "Underline", ar: "تسطير" },
	customSizeLabel: { en: "Custom text size", ar: "حجم نص مخصص" },
	customSizeDesc: { en: "Off = inherit the body size.", ar: "إيقاف = وراثة حجم النص الأساسي." },
	highlightBgLabel: { en: "Highlight background", ar: "خلفية تمييز" },
	highlightBgDesc: { en: "Off = no background.", ar: "إيقاف = بلا خلفية." },
	customCssLabel: { en: "Custom CSS (advanced)", ar: "CSS مخصص (متقدم)" },
	customCssDesc: {
		en: 'Raw CSS declarations, applied last so they can override anything above — e.g. "text-shadow: 1px 1px 2px gold;"',
		ar: 'تصريحات CSS خام، تُطبَّق أخيرًا بحيث يمكنها تجاوز أي شيء أعلاه — مثل "text-shadow: 1px 1px 2px gold;"',
	},
	snippetsBtn: { en: "Snippets...", ar: "مقتطفات..." },
	styleDelimitersLabel: { en: "Style the delimiters too", ar: "تنسيق الفواصل أيضًا" },
	styleDelimitersDesc: {
		en: "Only applies with delimiters set to always show — makes the delimiter characters themselves pick up this role's color/font/size, instead of the plain default tag appearance.",
		ar: "ينطبق فقط عند ضبط الفواصل على الإظهار الدائم — يجعل أحرف الفاصل نفسها تأخذ لون/خط/حجم هذا الدور، بدلاً من مظهر الوسم الافتراضي البسيط.",
	},

	// settingsBackup.ts (Export fallback + Import modal — both launched
	// from within the settings pane, so translated; also in scope).
	copyManuallyTitle: { en: "Copy profile manually", ar: "نسخ الملف الشخصي يدويًا" },
	copyManuallyDesc: { en: "Clipboard access was denied — select all the text below and copy it yourself.", ar: "تم رفض الوصول إلى الحافظة — حدد كل النص أدناه وانسخه يدويًا." },
	importProfileTitle: { en: "Import profile", ar: "استيراد ملف شخصي" },
	importProfileDesc: {
		en: "Paste a profile JSON blob (from Export, or shared by someone else) below. This adds it as a NEW profile — your existing profiles are untouched.",
		ar: "الصق بيانات JSON لملف شخصي (من التصدير، أو مشتركة من شخص آخر) أدناه. سيُضاف كملف شخصي جديد — ملفاتك الحالية لن تتأثر.",
	},
	noticeCopiedToClipboard: { en: "Advanced Formatting: profile copied to clipboard.", ar: "التنسيق المتقدم: تم نسخ الملف الشخصي إلى الحافظة." },
	noticeInvalidJson: { en: "Advanced Formatting: that isn't valid JSON.", ar: "التنسيق المتقدم: هذا ليس JSON صالحًا." },
	noticeNotAProfile: {
		en: 'Advanced Formatting: that JSON doesn\'t look like a profile export (missing "roles"/"typography"/"scope").',
		ar: 'التنسيق المتقدم: لا يبدو أن هذا JSON تصدير ملف شخصي (ناقص "roles"/"typography"/"scope").',
	},
	noticeImportedAs: { en: 'Advanced Formatting: imported as "{n}".', ar: 'التنسيق المتقدم: تم الاستيراد باسم "{n}".' },
	importedProfileDefaultName: { en: "Imported profile", ar: "ملف مستورد" },

	// Notice toasts triggered by settings actions. {n} is always
	// user-supplied text (a profile/role name) — always spliced in via
	// isolate() from i18n.ts, never raw concatenation.
	noticeSwitchedTo: { en: 'Advanced Formatting: switched to "{n}".', ar: 'التنسيق المتقدم: تم التبديل إلى "{n}".' },
	noticeAddedProfile: { en: 'Advanced Formatting: added profile "{n}".', ar: 'التنسيق المتقدم: تمت إضافة الملف الشخصي "{n}".' },
	noticeDuplicatedAs: { en: 'Advanced Formatting: duplicated as "{n}".', ar: 'التنسيق المتقدم: تم النسخ باسم "{n}".' },
	noticeCantDeleteLast: { en: "Advanced Formatting: can't delete the last remaining profile.", ar: "التنسيق المتقدم: لا يمكن حذف الملف الشخصي الأخير المتبقي." },
	noticeRemoved: { en: 'Removed "{n}". ', ar: 'تمت إزالة "{n}". ' },
	undoBtn: { en: "Undo", ar: "تراجع" },
};

export function t(key: keyof typeof STRINGS, lang: UiLanguage | undefined): string {
	const entry = STRINGS[key];
	if (!entry) return String(key); // missing translation — fail loud-ish rather than silently blank
	return lang === "ar" ? entry.ar : entry.en;
}

/** t() for a string with a {n} placeholder (heading/depth numbers) — kept
 * separate from t() rather than naive concatenation because English and
 * Arabic don't always put the number in the same place relative to the
 * noun; a template with a placeholder handles that, string-gluing
 * doesn't. */
export function tn(key: keyof typeof STRINGS, n: number | string, lang: UiLanguage | undefined): string {
	return t(key, lang).replace("{n}", String(n));
}

/**
 * Wraps user-supplied text (a profile or role name — never translated,
 * could be Arabic, English, or mixed) in Unicode directional-isolate
 * marks before splicing it into a translated Arabic sentence. Without
 * this, a Latin-script name embedded in RTL surrounding text (or vice
 * versa) can visually reorder in ways that make the sentence unreadable
 * — isolating it tells the renderer "figure out this substring's own
 * direction independently, don't let it bleed into the sentence around
 * it," which is the standard fix for exactly this kind of interpolation.
 */
export function isolate(text: string): string {
	return "\u2068" + text + "\u2069";
}

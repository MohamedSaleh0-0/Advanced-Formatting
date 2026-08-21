# Project Context (read this first — chat history was compacted)

If picking this up with no memory of prior conversation, this file plus
`README.md` is everything needed. `src/*.ts` is the real source; `main.js`
at the repo root is committed BUILD OUTPUT (bundled, never hand-edited —
`npm run build` regenerates it).

## What this is

An Obsidian plugin, originally built for Arabic Islamic scholarly notes,
now generalized (by the user) into: typography/layout controls + a
fully user-defined inline "dynamic classifying" system (wrap text in
any open/close delimiter pair, it gets that class's styling live in the
editor) + **multiple switchable settings profiles**. Named **"Advanced
Formatting"** (id `advanced-formatting`) — see the "Plugin rename —
done" backlog entry. Ships with neutral defaults now (no Islamic-
specific roles baked in); an Islamic/Arabic profile is planned as a
separate, optional, deletable download rather than a shipped default.

Two standing principles the user has enforced repeatedly by correcting
over-narrow implementations: (1) build one generic mechanism, not a
special case per feature; (2) never guess twice about the same class of
bug — find the structural cause.

## Architecture

```
src/
  types.ts         — Role, Profile, TypographySettings, ScopeSettings,
                      AdvancedFormattingSettings ({ profiles: Profile[],
                      activeProfileId })
  defaults.ts        — defaults, PRESET_ROLES, defaultRoles(),
                      freshProfile(), defaultSettings(), getActiveProfile()
  delimiters.ts       — resolveDelims, buildRoleRegexes, findLineMatches
                      (recursive — returns a match TREE with .children
                      for nested roles, not a flat list)
  validation.ts        — duplicate-delimiter, Latin-letter-RTL-flip, and
                      native-Markdown-token collision warnings
  scope.ts              — shouldApplyToFile, now reads the ACTIVE
                      profile's scope
  decorations.ts         — CM6 ViewPlugin; recursively emits nested marks
                      for nested roles; reads active profile's roles
  readingMode.ts          — Reading-view post-processor; recursively
                      builds real nested <span> DOM (not flattened text)
  footnotes.ts               — pure logic, no CM6/DOM: Arabic-Indic
                      numeral conversion + finding footnote refs/defs in
                      doc text + sequential numbering by first-REFERENCE
                      order (not definition order). Shared by
                      decorations.ts (builds the whole Live Preview
                      footnote block from scratch) and readingMode.ts
                      (only needs to convert digits Obsidian already
                      rendered) — same file, not duplicated per caller.
  stylesheet.ts            — buildStylesheet(profile: Profile) — takes a
                      profile directly, not the whole settings object
  i18n.ts                  — t()/tn()/isolate(): the settings-pane
                      translation dictionary (English source of truth +
                      Arabic) and the bidi-safe interpolation helper for
                      splicing user data (profile/role names) into
                      translated sentences. Pure, no DOM/Obsidian deps —
                      importable from anywhere (settingsTab.ts,
                      roleEditModal.ts, settingsBackup.ts, main.ts's
                      settings-triggered Notices).
  roleEditModal.ts          — detailed per-role editor (opened via gear
                      icon from the compact role-list row)
  rolePicker.ts              — FuzzySuggestModal: "wrap with role...
                      (search)" command
  profilePicker.ts            — FuzzySuggestModal: "Switch profile..."
                      command
  settingsBackup.ts             — export/import a SINGLE PROFILE as JSON
                      (clipboard, with manual-copy fallback modal);
                      import APPENDS as a new profile, never replaces
  settingsTab.ts                 — profile switcher/manager at top, then
                      scope/typography/headings/bullets/backup/roles, all
                      operating on getActiveProfile(settings)
  main.ts                         — Plugin class: load/migrate settings,
                      switchProfile/createProfile/duplicateProfile/
                      deleteProfile, role command registration,
                      `export = AdvancedFormattingPlugin` at the end (NOT
                      `export default` — see below)

types/
  obsidian.d.ts   — HAND-WRITTEN ambient types (no network access to fetch
                    the real `obsidian` package) — covers exactly the API
                    surface used, including FuzzySuggestModal added this
                    round
  codemirror.d.ts  — same, for @codemirror/view / @codemirror/state
  global.d.ts       — declare function require() (@types/node unavailable)

scripts/bundle.js — hand-rolled CommonJS bundler (esbuild unavailable, no
network access). Combines dist/*.js into one main.js using a tiny local
module registry (__modules/__localRequire); external packages (obsidian,
@codemirror/*) stay as real require() calls. `npm run build` = tsc then
this, one command.
```

### Non-obvious things worth knowing before touching this code

- **`export =`, not `export default`** in main.ts. Plain tsc/CommonJS (no
  bundler smoothing it over) compiles `export default` to
  `exports.default = X`, but Obsidian's loader needs `require("main.js")`
  to hand back the class directly. Caught by reasoning, not trial and
  error.
- **No real `obsidian`/`@codemirror` type packages** — hand-written
  ambient `.d.ts` files stand in for them. "Compiles clean" means
  internally consistent with the author's understanding of the API, not
  verified against Obsidian's real published types.
  **Update, this round**: the environment this round ran in DOES have
  npm registry access (confirmed: `npm install obsidian` succeeds, real
  `esbuild` is installable too — see `scripts/bundle.js`'s own comment
  about this). Used it once as a one-off cross-check, not a migration:
  compiled the whole `src/` tree against the REAL published `obsidian`
  package's `.d.ts` instead of the hand-written stand-in. Result: clean
  except one pre-existing spot, `main.ts`'s `unregisterRoleCommand`
  calling `this.app.commands.removeCommand(...)` — `commands` is real,
  undocumented, commonly used by plugins via a cast, but genuinely absent
  from the public `App` type, which is why the hand-written ambient type
  had to declare it and the real one doesn't. Nothing else — meaning
  everything else in this codebase (roles, decorations, reading mode,
  stylesheet, profiles, this round's direct-formatting code) type-checks
  against the real API surface, not just against itself. The repo's
  actual build still uses the hand-written types + hand-rolled bundler
  (didn't switch — that's a bigger call than this round's scope), but if
  network access holds in future rounds, migrating to the real
  `obsidian`/`@codemirror` packages + real `esbuild` is now genuinely
  available, not blocked — see Backlog.
- **Verification tiers, weakest to strongest, all still true**: (1) pure
  Node logic tests of matching/CSS-string functions, (2) `tsc --strict
  --noEmit` (real compiler, zero errors), (3) a stubbed-Obsidian smoke
  test that actually `require()`s the compiled/bundled `main.js`,
  instantiates the plugin, and runs real `onload()`/`onunload()`. None of
  this is a run inside real Obsidian, which isn't available here — DOM/
  CM6 rendering specifics remain unverified beyond what the user tests by
  hand.
- **`tsconfig.json`'s `ignoreDeprecations: "6.0"` was invalid** for the
  installed compiler (TS 5.9.3 rejects it outright — `error TS5103`) and
  wasn't suppressing anything real (removing it compiles clean). Removed.
  This never surfaced before because tier-2 verification had never run
  against a real installed `tsc` until this round.

## The five biggest mechanisms, condensed

1. **Inline roles**: a role = label + open + close delimiter (arbitrary
   strings, not necessarily symmetric, not necessarily wrapped in `{ }`)
   + style (color/bold/italic/underline/font/size/highlight/raw custom
   CSS). `«hadith»`, `﴿ayah﴾`, `[?question?]`, `{=matn=}` all go through
   one code path — nothing hardcoded per role. Delimiters hide unless the
   cursor is inside that span (real CM6 `ViewPlugin`, not CSS-only —
   this was the whole point vs. plugins like "Dynamic Highlights" that
   only affect Reading view).
2. **Nesting**: a role can contain another role. Rendered as a genuinely
   nested `<span>`/CM6 mark (not flattened), so CSS inheritance gives
   "inner falls back to outer for anything unset" for free — no merge
   logic. Verified 3 levels deep for DIFFERENT roles. **Known limitation**:
   a role nested inside ITSELF doesn't work (needs balanced-bracket
   counting, not implemented) — different-role nesting is fine at any
   depth.
3. **حاشية-style footnotes** (this round): Live Preview previously had
   nothing — Obsidian doesn't build a footnotes block there at all, so
   `[^label]` refs and `[^label]: text` definitions just sat as literal
   source text. Now `decorations.ts` builds real CM6 widgets: each
   reference becomes a small superscript numeral badge, each definition's
   `[^label]:` prefix becomes a numeral marker, and a horizontal-rule
   widget is inserted once above the first definition (matbaʿa-style, per
   user's choice over a decorative divider or no separator). Reading view
   gets the same look via CSS + a small DOM pass: the footnote LIST's own
   numbers are a native `list-style-type: arabic-indic` (no JS needed —
   it's a real predefined CSS counter style); the inline reference
   numeral's actual digit characters get converted by
   `convertFootnoteRefNumerals` in `readingMode.ts` (selector unverified
   against real Obsidian — see "Open, unresolved"). Numbering is
   sequential by order of first REFERENCE in the body (matches how
   Obsidian's own Reading view numbers footnotes), computed over the
   WHOLE document so a reference and its definition always agree
   regardless of scroll position — not per-visible-range. Separator width
   (40%) and colors are hardcoded for now, not exposed as settings; user
   didn't ask for that and it wasn't added unprompted. Verified: pure
   numbering logic (tier 1, incl. out-of-order defs, repeated refs,
   defined-but-unreferenced labels), generated CSS contains the expected
   rules, and — new for this round — an actual runtime instantiation
   against a stubbed CM6 (`WidgetType` subclasses really extended and
   `toDOM()` really called, decorations confirmed sorted/non-overlapping
   as real CM6 requires). Not yet confirmed inside real Obsidian.
4. **Profiles**: `settings.roles/typography/scope` (singular)
   became `settings.profiles: Profile[]` + `activeProfileId`. Manual,
   global switch — user's explicit choice over auto-scope-per-note
   resolution: one active profile at a time, switched via command palette
   ("Switch profile...") or the Settings dropdown, not auto-selected per
   file. Migration from old single-profile saved data is automatic and
   verified (wraps existing roles/typography/scope into one "Default"
   profile, nothing lost — tested with a real stubbed loadData()).
5. **Direct/instance formatting**: a NEW, deliberately separate
   mechanism from named roles — `directFormat.ts` (pure) +
   `formatSelectionModal.ts` (UI) + the `format-selection` command.
   MS-Word-style "select this text and format it": one-off, no
   user-visible settings entry.
   **v1 (abandoned, real-Obsidian tested, actually broken)**: everything
   without native Markdown syntax rode on a raw inline
   `<span style="...">`. Failed in real Obsidian — Live Preview showed
   the literal tag text instead of rendering it, and the wrapped word
   itself disappeared rather than degrading gracefully. This was the one
   thing flagged as unverified at build time (no live Obsidian available
   here to test raw-HTML rendering against), and it broke exactly as
   flagged — a real lesson, not just a caveat that happened to matter:
   "compiles clean" and "tsc against the real types" verify structure,
   never CM6/DOM rendering behavior, which stayed genuinely untested
   until a human ran it.
   **v2 (current)**: routes through the SAME role/delimiter/decoration/
   stylesheet pipeline every named role already uses — the one mechanism
   in this codebase actually proven to render live. Turning on
   color/background/font/size/underline/custom-CSS auto-generates a
   hidden, one-off Role (`Role.hidden: true`, `delimiterDisplay: "hide"`)
   with Private-Use-Area-sentinel delimiters (`\uE000<id>` /
   `\uE001<id>`) that can't collide with anything typed by hand or any
   preset role's own delimiters, pushed into the active profile, deduped
   by style signature so re-applying the identical formatting reuses the
   same role instead of creating a new one each time (still doesn't
   reclaim a role no longer referenced anywhere in the vault — see
   Backlog). Bold/italic stay OUTSIDE that role entirely, as real
   `**`/`*` (per the original ask to keep them native): a selection
   formatted with ONLY bold/italic never touches the role system at
   all — zero proprietary delimiters, renders in any Markdown reader.
   Combining both still gets `***text***` for free from plain string
   concatenation. Settings' role list filters out `hidden` roles so
   these don't clutter the UI. The modal's live preview switched from
   showing the (now opaque, PUA-character) raw markup to a locally
   CSS-styled sample rendered only inside the modal's own DOM — never
   written to the note.
   Verified: pure functions (dedup-by-signature, bold-only needs no
   role, `***` emergent case) — tier 1; `tsc --strict` against both the
   hand-written AND the real published `obsidian` types — tier 2; a
   stubbed-modal run driving the real `Setting` toggle callbacks through
   to Apply, PLUS — new this round, and the actual gap that let v1 ship
   broken — feeding the resulting inserted string back through the real
   `findLineMatches`/`buildRoleRegexes` matcher and `buildStylesheet` to
   confirm the round-trip actually recovers the original text and a CSS
   rule with the right properties, not just that no function threw —
   tier 3. Still not a run inside real Obsidian; CM6's own rendering of
   `Decoration.replace`/mark on PUA characters specifically remains the
   one unverified link, though it's the same decoration API every
   existing role already exercises successfully, not new surface.

## Key decisions, condensed (why, not just what)

- Word-tags → symbol markers → arbitrary delimiters, each forced by a
  real problem (word-tags flip RTL lines via Unicode bidi; hadith/ayah
  needed asymmetric non-brace-wrapped delimiters).
- No box/callout styles, ever — inline only, explicit standing rule.
- No dedicated "heading-like" role (a "side heading" is just a heading
  with different alignment/color) — per-level H1–H6 settings instead.
- Color palette (cream+olive) built, tested, ABANDONED — repainted the
  whole Obsidian app chrome via global theme vars, not just note content.
  Removed entirely per explicit user instruction.
- No `!important` anywhere (Obsidian plugin-review flags it) —
  sufficiently-specific selectors instead.
- **Callout bug, resolved**: role styling (`.af-role-<id>`) was the
  only bare, single-class, unscoped selector in the whole stylesheet —
  every other section (fonts, headings, footnotes, list bullets, column
  width) uses the `SCOPE`-prefixed ancestor chain for specificity. A
  theme's callout CSS (e.g. `.callout-content`) is at least as specific
  as one bare class, so it won unconditionally — in Reading view AND
  Live Preview alike, since the cause was never about which view renders
  it. This also would have lost inside anything else with its own
  specific styling (tables, etc.), not just callouts. Fixed by scoping
  the role rule with `SCOPE` and doubling the class
  (`.af-role-x.af-role-x`) to raise real specificity, same
  no-`!important` approach as the rest of the file. Verified at the
  CSS-string-generation level (tier 1); not yet confirmed inside a real
  callout in Obsidian. Superseded by a further specificity fix in this
  round's "Font-size/font-family not applying" entry below, which nests
  the role selector under real ancestor chains rather than relying on
  the doubled class alone.
- Settings-page role-row layout broke TWICE on the same mechanism (a CSS
  class expected to force `display:flex` lost to something more specific
  in Obsidian's own stylesheet). Second fix used **inline styles**
  (`element.style.cssText`), which nothing but `!important` can lose to —
  general lesson: prefer inline styles for load-bearing layout inside a
  host app's own styled surface.
- Settings UI redesigned around QuickAdd's pattern (user supplied
  reference screenshots): compact single-row list + gear icon opening a
  `Modal` (`RoleEditModal`) for details, not an inline accordion — the
  accordion's `Setting`-inside-flex-container was the root cause of the
  layout bug (a `Setting`'s root element is block-level/full-width by
  design, can't sit compactly inline regardless of CSS).
- TypeScript rewrite + hand-rolled bundler: both forced by "no network
  access" (no real `obsidian`/`@codemirror` types, no esbuild) — solved
  with hand-written ambient types and a small purpose-built CommonJS
  bundler rather than skipped.
- Profiles: manual switch chosen explicitly over auto per-note scope
  resolution — simpler, and it's what the user actually asked for the
  second time it was discussed.

## Open, unresolved

- **Reading-view footnote-ref selector, unverified**: `readingMode.ts`'s
  `convertFootnoteRefNumerals` targets `sup.footnote-ref` (+ two
  fallbacks) to convert digits to Arabic-Indic. Obsidian's exact markup
  isn't confirmed against a live instance (no network access here) — if
  the inline reference numeral doesn't convert when tested by hand, this
  selector is the first place to check (inspect the real element and
  adjust). The footnote LIST's own numbers don't have this risk — they're
  a native CSS `list-style-type: arabic-indic`, not JS-dependent.

## Backlog

- [x] **Plugin rename — done.** Weighed evocative/branded names (Rubric,
  Folio, Typeset, Scriptorium, Illuminate) against plain descriptive ones;
  landed on plain-descriptive as the goal ("express what it does, easy to
  search"), passed through "Full Formatting" (no conflicts, but rejected),
  and settled on **"Advanced Formatting"**, id `advanced-formatting`.
  Applied throughout: `manifest.json` id/name/description, `package.json`
  name, all TS identifiers (`IslamicStylePlugin` -> `AdvancedFormattingPlugin`,
  `IslamicStyleSettings` -> `AdvancedFormattingSettings`,
  `IslamicStyleSettingTab` -> `AdvancedFormattingSettingTab`,
  `createIslamicViewPlugin` -> `createFormattingViewPlugin`), every CSS
  class prefix (`islamic-role-` -> `af-role-`, `islamic-footnote-` ->
  `af-footnote-`, etc.), the generated `<style>` element id, the body
  scope class, all user-facing Notice strings, `i18n.ts`'s `appTitle`
  (en + ar), and the README. Rebuilt `main.js` from source (typechecked
  clean) rather than hand-edited.
  - Also stripped the "islamic-style" footprint from the **default
    settings**, not just the name: `PRESET_ROLES` no longer includes
    `hadith`/`ayah`; `defaultRoles()` no longer includes the always-on
    `matn`/`taleel` roles. The shipped default profile is now three
    generic, English-labeled, **disabled-by-default** example roles
    (Question/Note/Important) — genuinely neutral, not just renamed.
    `DEFAULT_SCOPE.cssclassValue` changed from `islamic-note` to
    `styled-note`.
  - Deliberately not built now, per instruction: a separate, optional
    "Islamic" profile (would ship the old matn/taleel/hadith/ayah role
    set) that a user could download and import via the existing
    export/import JSON mechanism, rather than shipping by default.
- [ ] Format-selection modal: detect the selected text's EXISTING
  formatting and pre-fill the fields on open (currently always opens
  blank) — needs reverse-parsing already-applied `**`/`<span
  style="...">` back into field state; real work, not started.
- [ ] Format-selection: a way to "promote" a one-off direct-formatted
  span into a saved, reusable Role (currently the two mechanisms don't
  talk to each other at all).
- [ ] Consider migrating off the hand-written ambient `obsidian`/
  `@codemirror` types + hand-rolled bundler to the real npm packages +
  real `esbuild`, now that this round confirmed npm registry access
  works in this environment — was blocked before, isn't anymore, but is
  a real infra change (touches every file that imports from "obsidian")
  and hasn't been done.
- [ ] Same-role self-nesting via balanced-bracket counting (if ever needed)
- [ ] Quote/intense-quote non-box styling
- [ ] Decorative dividers — low priority
- [ ] Paragraph spacing before/after (distinct from first-line indent)
- [ ] Document-wide custom-CSS field (mirrors the per-role one)
- [ ] Drop caps for chapter openings
- [ ] Separate Latin/English font override for text embedded in RTL
- [ ] Saved-profile explicit per-note frontmatter override (was considered
  during profile planning, NOT built — user chose manual-only switching)
- [ ] Reuse generated CSS as an Obsidian → PDF export stylesheet
- [ ] Live-preview sample-text box in Settings
- [ ] Command to re-classify an already-wrapped span
- [ ] Multi-line role spans (currently can't cross a newline) — also
  now applies to `wrapWithDelims`'s isolate wrapping and to Clear
  Formatting (both explicitly restricted to one line, matching this
  existing limitation rather than inventing a new rule).
- [ ] Teach `delimiters.ts`'s core regex matching to absorb an adjacent
  directional isolate mark (LRI/RLI immediately before, PDI
  immediately after) into a role match's hidden/atomic zones, so those
  2 characters get the same atomic cursor treatment the delimiters
  themselves now have — deferred this round as higher-risk for a
  cosmetic edge case (see "Direct-formatting fixes round").
- [ ] Visual confirmation (this needs a live Obsidian, not available
  here) that the `wrapWithDelims` directional-isolate fix actually
  renders the ayah role's ﴿﴾ correctly around non-Arabic content —
  reasoned from Unicode bidi semantics, not yet eyeballed.
- [ ] Status-bar indicator showing the active profile
- [deferred] Logical pagination with per-page حاشية sections

## Settings UX round — all built

Requested in one batch, rated for effort/risk before touching code. Two
needed an explicit design decision before starting — both decided by the
user and built accordingly. All six items from this round are done.

- [x] Wrap-when-disabled inserts inert delimiters instead of refusing —
  `main.ts` `registerRoleCommand` no longer checks `role.enabled` at all.
  Verified via a real `onload()` + command-callback run against a
  stubbed Obsidian.
- [x] Per-profile description field — `Profile.description: string`
  (required, defaults to `""`; `hydrateProfile` backfills old saves;
  `settingsBackup.ts`'s import path carries it over or defaults it).
  Shown as subtext in "Switch profile..." via `renderSuggestion` (needed
  extending the ambient `FuzzySuggestModal`/`createDiv` types). Verified
  through a real migration-path `onload()`.
- [x] **Per-role delimiter display mode: show / hide / custom alias** —
  new `Role.delimiterDisplay` + `aliasOpen`/`aliasClose`. Reuses the
  active/inactive cursor-detection + widget-replace mechanism already in
  `decorations.ts` (same one the footnote widgets use) — "alias" mode
  shows the alias text via a widget while the cursor's elsewhere and
  reveals the real delimiters (a plain mark, same as normal "auto" mode)
  the moment the cursor enters the span, matching a wikilink alias's UX
  exactly. Reading view (`readingMode.ts`'s `buildSpanForMatch`, which
  previously ALWAYS dropped delimiters entirely) now prepends/appends
  either the literal delimiters ("show") or the alias text ("alias") —
  no cursor concept there, so "alias" always shows, same reasoning as
  why a wikilink alias never reveals its target in Reading view either.
  Verified: instantiated the real widget classes against a stubbed CM6
  and confirmed both states directly — alias widget showing while
  inactive, real delimiters as a plain mark once "active."
- [x] **View/edit any profile in Settings without activating it** —
  `AdvancedFormattingSettingTab.viewingProfileId` (pane-local, never
  persisted) decoupled from `settings.activeProfileId`; the profile
  dropdown only changes what's viewed, "Switch profile..." is the only
  thing that activates. Every role-command register/unregister call in
  the roles list is now gated on `viewedProfile.id ===
  settings.activeProfileId` — editing a non-active profile's roles must
  never touch the live command registry. Found and fixed a real related
  bug while in this code: deleting the ACTIVE profile left stale hotkey
  commands registered and never registered the fallback profile's roles
  — `deleteProfile()` now does the same command-registry swap
  `switchProfile()` does. Verified: a real `display()` run against a
  stubbed Setting-builder API in both languages, plus confirming
  `activeProfileId` genuinely doesn't change when only the viewed
  profile changes.
- [x] **Cross-profile delimiter clutter: auto-hide orphaned delimiters on
  switch** — `computeOrphanedDelimiters` (delimiters.ts) diffs the old
  vs. new active profile's enabled roles by literal open/close string
  (not role identity — two roles in different profiles with the same
  delimiters count as "the same pair" on purpose, since this is about
  leftover TEXT, not role semantics). Stored on `plugin.
  orphanedDelimiterPairs` — in-memory only, never persisted, REPLACED
  (not accumulated) on every subsequent switch. Broader than originally
  scoped: applies to ANY note opened during the session until the next
  switch, not just whichever note happened to be open at switch time —
  cheap upgrade once the mechanism is string-based rather than
  position-based, and strictly more useful. `decorations.ts` hides only
  the delimiter characters (never the content between them — no role
  styling applied, purely cosmetic). Scope decision made deliberately:
  Live Preview only, not Reading view — Reading view re-renders fresh
  from source every time with no accumulated state to clean up, so an
  unrecognized delimiter showing as plain text there is the same
  situation as any other non-matching syntax, not leftover clutter in
  the way it is in an open editor. Verified: `computeOrphanedDelimiters`
  directly (shared delimiters excluded, disabled roles excluded,
  genuinely orphaned pair caught), the real decorations only hiding
  delimiter characters and never content, AND an adversarial
  overlap-guard test — forced a role's delimiters to partially overlap
  an orphaned pair's and confirmed the defensive non-overlap guard (see
  next item) holds.
- [x] **Arabic/English settings-UI language toggle with full RTL layout
  mirroring** — `settings.uiLanguage: "en" | "ar"` (global, not
  per-profile — it's a UI preference, not a typography choice),
  `i18n.ts`'s `t()`/`tn()` translation dictionary, threaded through
  `settingsTab.ts`, `roleEditModal.ts`, and `settingsBackup.ts`'s Import/
  Export-fallback modals. RTL mirroring is `containerEl.dir = "rtl"` —
  genuinely sufficient by itself here (not just a gesture at RTL)
  because this codebase's settings-pane CSS was checked first and had
  zero hardcoded physical-direction properties (no `margin-left`/
  `text-align: left`/etc.) to begin with — every row already used
  logical flex properties, so native RTL mirroring just works. User
  data (profile/role names) spliced into translated sentences goes
  through `isolate()` — wraps it in Unicode directional-isolate marks
  (U+2068/U+2069) so a Latin-script name inside an Arabic sentence (or
  vice versa) can't visually reorder the surrounding text.
  **Deliberately out of scope**: command-palette-invoked surfaces
  (`rolePicker.ts`'s "Wrap selection with role...", `profilePicker.ts`'s
  "Switch to profile...", and per-role hotkey command NAMES in
  `main.ts`) — these live in Obsidian's single unified command palette
  alongside every other plugin's English commands; translating just
  this plugin's entries would be inconsistent with the rest of that
  list, more confusing than helpful, and for the per-role hotkey
  commands specifically would change a command's identity out from
  under an already-bound hotkey. The ask was a settings-language toggle,
  which is what got built — this boundary was a deliberate scope call,
  not an oversight, and worth knowing about if it ever feels
  inconsistent.
  **Translation quality caveat**: Arabic strings were translated in
  good faith (implementer is capable but not a certified translator)
  and haven't been proofed by a native speaker for register/tone —
  worth a pass before treating this as production-quality copy, though
  every string should be understandable and correct in meaning.
  Verified: a real `display()` run in Arabic against a stubbed
  Setting-builder API confirmed `containerEl.dir` actually flips to
  `"rtl"` and the whole render completes without throwing.

A defensive non-overlap guard was also added to `decorations.ts`'s final
decoration-add pass while building the orphaned-delimiter feature: role
decorations and orphaned-delimiter decorations come from two independent
matchers over the same text, and CM6 requires the whole sequence added
to one builder to be strictly non-overlapping — on adversarial input
(e.g. an orphaned pair that's a substring of a live role's delimiters)
they could otherwise collide and the whole decoration pass would throw.
First-sorted segment wins, same rule `findLineMatches` already uses for
role-vs-role overlaps. Stress-tested with a forced overlap case.

## Direct formatting round — all built (revised after real-Obsidian testing found v1 broken)

- [x] **"Format selection..." command** — see mechanism #5 above for
  full design reasoning and BOTH the v1 (raw HTML, broke) and v2
  (role-backed, current) versions.
- [x] `types/obsidian.d.ts`'s `ButtonComponent` extended with `setCta()`
  — confirmed present on the real published type too, not a guess.
- [x] `tsconfig.json` bug found and fixed (see "Non-obvious things").
- [x] `types.ts`: `Role.hidden?: boolean` added — auto-generated
  ephemeral roles only, filtered out of the Settings role list
  (`settingsTab.ts`).

## Rename — done

See Backlog's "Plugin rename — done" entry for the full account of what
changed and why. Final name: "Advanced Formatting", id
`advanced-formatting`.

## Direct-formatting fixes round — all built, this is the round that
## found and fixed three real bugs from live-Obsidian testing

User tested the direct-formatting round (above) by hand in real
Obsidian and reported back three concrete problems plus one feature
gap. Fixed all four; every fix cross-checked against the REAL published
`obsidian`/`@codemirror/view`/`@codemirror/state` npm packages (network
access confirmed working again this round — see "Non-obvious things"),
not just the hand-written ambient stand-ins.

- [x] **Cursor barrier — "had to press the arrow key ~16 times" fixed
  at the root, not patched around.** Root cause: hidden/replaced
  delimiter ranges (`Decoration.replace({})`, used for every role's
  "hide"/"auto" tag display and for footnote markers) were never
  registered with CM6's `EditorView.atomicRanges` facet. Visually
  hidden text still exists in the document; without `atomicRanges`,
  arrow keys step through it one invisible character at a time. This
  bug existed for every role from the start — short 2-4 char presets
  (`«»`, `[?...?]`) made it easy to not notice; the auto-generated
  direct-format delimiters (which embedded a unique id) were long
  enough to make it obvious. Fixed in `decorations.ts`:
  `createIslamicViewPlugin` now returns `[viewPlugin, atomicExtension]`
  (an array — CM6 `Extension`s compose), where the second element reads
  the SAME decoration set the ViewPlugin built for that frame via
  `view.plugin(viewPlugin)`, not a second independent computation.
  Verified against the real `@codemirror/view` package: capturing the
  actual function passed to `EditorView.atomicRanges.of()` and calling
  it directly against fake `view.plugin()` stand-ins, both the found-
  instance and not-yet-found-instance (`Decoration.none` fallback)
  paths. Also shortened `directFormat.ts`'s ephemeral role ids from
  `"fmt" + Date.now().toString(36) + Math.random()...` (~18 chars) down
  to the SAME `"prefix" + Date.now()` convention already used
  everywhere else in this codebase for auto-generated ids
  (`"df" + Date.now().toString(36)`, ~10 chars) — a minor defense-in-
  depth trim on top of the real fix, not a substitute for it.
- [x] **"Clear formatting" command — didn't exist before, real gap.**
  New `clearFormatting.ts` (pure) + `clear-formatting` command + right-
  click menu item. Deliberately POSITION-based (cursor/selection
  line+ch), not text-based: a role's "hide"-mode delimiters are
  invisible to mouse/click selection (`Decoration.replace` removes them
  from what's clickable), so a user dragging across the visibly
  formatted word never actually selects the delimiter characters — a
  text-based "strip these characters from the selection" approach would
  silently find nothing for the single most common case. Instead reads
  the cursor's line, re-derives role matches via the SAME
  `findLineMatches` matcher decorations.ts uses, finds the innermost
  role match and/or native bold/italic span containing the cursor, and
  iteratively peels ALL layers touching it (bounded at 8) in one
  invocation — a Word-"Clear Formatting"-style full clear, not a
  peel-one-layer-per-run tool. Also strips the directional isolate
  marks (see next item) that sit just outside a role match, or those
  would be left behind as orphaned invisible characters. Ordinary
  Ctrl+Z still undoes the original formatting action too — this is an
  explicit "remove formatting here" action, not a replacement for undo.
- [x] **Right-click / context-menu access — didn't exist before, real
  gap.** `editor-menu` workspace event now adds "Format selection..."
  (only when there's an active selection) and "Clear formatting"
  (always) to the native right-click menu, both calling the SAME
  methods (`openFormatSelectionModal`/`runClearFormatting`, now shared
  between the commands and the menu, not duplicated) the command-
  palette commands use.
- [x] **Delimiter glyphs rendering backwards on non-Arabic content —
  real bug, screenshot-confirmed** (ayah role's ornate ﴿﴾ parens
  applied to the English word "there" rendered visually reversed).
  Root cause: `﴿`/`﴾` (U+FD3E/FD3F) are Bidi_Mirrored characters
  designed to look correct wrapping RTL content; now that roles can be
  applied to ANY selected text (not just Arabic — that's the whole
  point of the generalization direction), the same glyphs wrapping
  LTR content mirror against the wrong resolved direction. Fixed with
  `delimiters.ts`'s new `wrapWithDelims(text, open, close)`: wraps the
  WHOLE match in a Unicode directional isolate — LRI (U+2066) for
  predominantly-LTR content, RLI (U+2067) for predominantly-RTL
  (detected via an Arabic/Hebrew Unicode-block regex,
  `isPredominantlyRtl`), closed by PDI (U+2069) — so the mirroring
  resolves against the actually-wrapped content instead of the
  surrounding paragraph. Applied everywhere a role gets wrapped around
  a selection: `main.ts`'s per-role commands, `rolePicker.ts`'s
  "Wrap selection with role..." picker, AND `directFormat.ts`'s
  ephemeral-role wrapping — one shared function, not three copies.
  **Real, honest caveat — this is a bidi-correctness fix reasoned from
  Unicode semantics, not something rendered and visually confirmed
  here** (no live Obsidian). If "there" still looks wrong after this
  build, that's the next thing to report back, the same way the raw-
  HTML failure got caught. Known, accepted side effect: the isolate
  marks sit OUTSIDE the matched delimiter range (not inside the hidden
  tag zones), so they're invisible (Unicode format characters, zero
  rendering width) but NOT covered by the atomic-range fix above — up
  to 2 extra real-but-invisible cursor stops at the edges of any
  role-wrapped span. Judged an acceptable tradeoff against getting the
  mirroring right; teaching the core regex-matching in `delimiters.ts`
  to absorb adjacent isolates into the hidden/atomic zones would fix
  it but wasn't done this round (higher-risk change to heavily-relied-
  on matching logic for a cosmetic edge case).

Ambient-type note from this round's real-package cross-check: the
real `@codemirror/view` types the hand-written `EditorView.plugin()`
stand-in more loosely than reality (real signature needs the specific
`ViewPlugin<T>` value to infer `T`; the ambient version defaults to
`any`) — confirmed functionally correct at runtime (the whole point of
`.plugin()` is a lookup that returns the actual constructed instance,
which does have `.decorations`), just a compile-time strictness gap in
the simplified ambient declarations, not a bug. Not fixed — noted for
whoever eventually does the real-package migration in the backlog.

Keep this file current as things ship — that's the point of it.

## Bug-fix round — user-reported issues from real-world use, all
## fixed (untested in real Obsidian — see caveats per item)

User reported five problems after actually using the direct-formatting
round day-to-day: font-size/font-family silently not applying, a
"format the same text twice -> gibberish" bug, the same gibberish
appearing when copying formatted text, and the previously-flagged
cursor-barrier/bidi issues still present. Root-caused and fixed all of
them:

- [x] **Font-size/font-family not applying to role content — root
  cause: this plugin's OWN base typography rule beat its OWN per-role
  rule.** In list items specifically, this was a hard, provable bug:
  `stylesheet.ts` section 3's `.HyperMD-list-line span { font-size:
  inherit }` and the per-role rule ended up with the same class count,
  and the list rule had one MORE element-type selector (the bare
  `span`) — which counts as HIGHER specificity, not lower, so it won.
  Fixed two ways: (1) section 3 now excludes this plugin's own spans
  via `span:not([class*="af-role-"])`; (2) the per-role rule (section
  9) is now nested under the same real ancestor chains as section 2's
  base font-size/line-height rule (`.cm-line` in Live Preview; `p`/
  `li`/`blockquote` in Reading view) instead of a bare doubled-class
  selector, so it structurally outranks section 2 everywhere, not just
  in lists. Also added `line-height: normal` alongside any role
  `sizeEm` override, defensively, since CM6 lines otherwise compute
  height from the base font size and could clip a larger inline span.
  Outside of list items, no other competing rule was found in this
  plugin's own stylesheet or the general cascade rules of Live
  Preview/Reading view — if it's still not applying somewhere after
  this, the next thing to check by hand is a theme/snippet setting
  `font-size`/`font-family` with its own high specificity or
  `!important` on `.cm-line`/paragraph text specifically.
- [x] **"Format twice -> gibberish" and "copy -> gibberish", root
  cause found and fixed at the source, not patched around.** Two
  compounding causes: (1) CM6 decorations only control what RENDERS —
  the hidden delimiter characters are still real document text, so
  `editor.getSelection()` on already-formatted text returns them too;
  reformatting without accounting for that wrapped the ALREADY-wrapped
  text, nesting layer on layer. (2) Worse, the previous version's
  ephemeral-role delimiters embedded their unique id as literal
  readable base36 ASCII (e.g. `dfmsqh3gmx`) next to a Private-Use-Area
  sentinel — invisible via CM6 decoration, but NOT invisible in the
  raw text, so any leak (a spanning selection, or an un-intercepted
  copy) surfaced that readable id text directly, which is exactly the
  reported "gibberish" (distinct ids from separate formatting passes,
  concatenated with the real word). Fixed: `directFormat.ts` now
  encodes the id into a second Private-Use-Area range (`U+E100+`)
  instead of literal characters — a leak now surfaces as invisible/
  empty characters, never readable garbage. `delimiters.ts` adds
  `unwrapDirectFormatting()`, which peels the isolate wrapper, a full
  role-delimiter wrap, or native `**`/`*` off the OUTSIDE of a
  selection, repeatedly, before re-formatting — wired into all three
  places that write formatted text (`openFormatSelectionModal`,
  `registerRoleCommand`, `RolePickerModal`), so re-formatting now
  overrides cleanly instead of nesting. `decorations.ts` adds a CM6
  `domEventHandlers({ copy, cut })` extension that rewrites the
  clipboard payload to strip hidden-role delimiters and the isolate
  marks before the browser's default copy runs, for defense in depth
  even where the unwrap-before-format path doesn't apply (copying to
  paste elsewhere, not to reformat). Verified end-to-end at the pure-
  function level (built `dist/`, ran the actual compiled
  `findOrBuildEphemeralRole`/`buildDirectFormatMarkup`/
  `unwrapDirectFormatting` against a simulated "format the same
  selection three times" loop): output length stays flat across
  passes instead of growing, no readable id substring appears in the
  output, and unwrapping any of the three passes' output recovers the
  exact original text. NOT verified against real CM6 selection/
  clipboard behavior in actual Obsidian (no live instance here) — the
  root-cause reasoning and the pure-function behavior are solid, but
  the DOM-level `copy`/`cut` interception specifically should be
  confirmed by hand.
  - Deliberately "override," not "merge/adjust": this makes
    reformatting REPLACE the previous formatting with the newly
    chosen options, using the real underlying text as the base. Pre-
    filling the format dialog with the previous formatting's own
    values so the user can tweak instead of restate them is the
    separate, still-open "detect existing formatting" backlog item
    below — not done this round.
- [x] **Cursor barrier — still present per user's real-Obsidian
  testing despite the earlier atomicRanges fix; found a second,
  deeper cause.** The earlier fix registered `atomicRanges` but fed it
  the ENTIRE combined decoration set — including `Decoration.mark`
  ranges for visible role content and shown/active delimiter tags, not
  just the genuinely hidden `Decoration.replace` ranges. Mixing
  atomic and ordinary-editable ranges under one atomic-range provider
  doesn't reliably collapse each hidden run into the single clean jump
  atomicRanges is supposed to produce. Fixed: every decoration segment
  in `decorations.ts` is now tagged `atomic: true/false` at the point
  it's created (true only for `Decoration.replace`/widget entries —
  hidden delimiter tags, footnote ref/def markers, orphaned-delimiter
  cleanup; false for content marks and shown/active tags), and
  `buildDecorations` now returns two separate RangeSets built from the
  same sorted, de-overlapped pass — `deco` (everything, for rendering)
  and `atomic` (the filtered subset, for `atomicRanges`). The
  ViewPlugin instance exposes both; `atomicRanges.of()` now reads only
  `atomicDecorations`. Not yet re-confirmed by hand in real Obsidian —
  next test pass should specifically re-check the arrow-key-crossing
  case that prompted this.
- [ ] **Delimiter bidi-mirroring fix — still unverified**, unchanged
  this round (see "Direct-formatting fixes round" above for what was
  built). Flagging again since it's adjacent to this round's other
  cursor/rendering work and due for the same real-Obsidian pass.

## Feature round — LTR/RTL direction, quick heading/bullet switching,
## paragraph spacing, opt-in Islamic profile, README rewrite

Four checklist items the user asked for after the bug-fix round, all
built and typechecked; none re-tested by hand in real Obsidian yet.

- [x] **Forced per-line RTL/LTR direction** — new `direction.ts`:
  a single invisible Private-Use-Area marker (`U+E210` RTL / `U+E211`
  LTR) prepended to a line's raw text, same "lives in the real document
  text" approach as role delimiters, but for a whole-LINE property
  rather than an inline span (deliberately not a settings-side store
  keyed by line number, which would drift the moment a line above it
  is added/removed). `decorations.ts` hides the marker and applies a
  `Decoration.line` class in Live Preview; `readingMode.ts` finds the
  matching block element and strips the marker from Reading view's
  rendered text; `stylesheet.ts` turns the class into `direction`/
  `text-align`/`unicode-bidi`. Right-click menu items (checked/
  unchecked to reflect the current line's state) plus three new
  commands: Force RTL, Force LTR, Clear direction override — applies
  to every line the selection touches, not just the cursor's own line.
- [x] **Right-click quick-switch for heading style and bullet style** —
  deliberately implemented as shortcuts to the EXISTING global
  per-level/per-depth settings (`typography.headings[key]`,
  `typography.listBulletShapes[depth]`), not a new per-instance
  override system — flagged clearly to the user as an interpretation
  call, since "switch ... settings" was somewhat ambiguous between
  "change the global setting" and "override just this one instance."
  Heading detection and list-depth detection live in new
  `lineContext.ts`; list-depth is an explicit heuristic (assumes
  4-space/tab indents from leading whitespace), not a real list-
  structure parse — documented as such in code and README.
- [x] **Paragraph spacing** — new `typography.paragraphSpacingEm`
  setting, separate from `lineHeight` (which is spacing WITHIN a
  paragraph's own wrapped lines). Reading view: exact, real `<p>`
  `margin-bottom`. Live Preview: best-effort approximation via
  `:has(> br:only-child)` targeting blank-line paragraph separators,
  since CM6's line-based model has no real paragraph boundary the way
  Reading view's DOM does — flagged as approximate, not exact, in both
  code comments and the README.
- [x] **Opt-in Islamic/Arabic profile** — `islamicProfile()` in
  defaults.ts brings back the old matn/taleel/hadith/ayah roles as a
  ready-made profile, but NOT part of `defaultSettings()`/
  `freshProfile()` — only created via a new "+ Add Islamic/Arabic
  profile" Settings button or the "Add Islamic/Arabic profile"
  command, appended the same way settingsBackup.ts's JSON import
  already appends profiles. Once added it's an ordinary profile,
  deletable through the existing generic profile-delete UI — no
  special-casing needed for "deletable."
- [x] **README rewrite** — full pass covering every current feature
  (roles, Format selection/Clear formatting, direction toggle, quick
  heading/bullet switch, typography incl. paragraph spacing,
  footnotes, scope, profiles incl. the Islamic preset), an honest
  "Known limitations / unverified" section distinguishing real
  limitations from this-round fixes not yet hand-tested, and a
  concrete 7-item "Suggested screen recordings" list.
- **Type-stub verification note**: this round's new API surface
  (`Editor.getLine`/`setLine` — already present, just confirmed;
  `Menu`/`MenuItem` including `setChecked`; `Decoration.line`;
  `EditorView.dispatch`/`domEventHandlers`; `EditorState.sliceDoc`;
  `EditorSelection.main`; `SelectionRange.empty`) was checked against
  the REAL published `obsidian`, `@codemirror/view`, and
  `@codemirror/state` npm packages (network access worked this
  round) rather than hand-modeled from documentation memory — narrows
  but doesn't close the gap the "Ambient-type note" backlog item
  flags; a full migration to the real packages as devDependencies is
  still not done.

## Round after real-Obsidian testing — the actual double-format
## gibberish root cause found, Colorize quick-color menu, cleanup

User tested the previous two rounds' fixes by hand in real Obsidian
and reported back precisely: font size/font type now work, copying no
longer produces gibberish, but **double-formatting still produces
gibberish** — with a screenshot showing literal tofu-box glyphs mixed
into otherwise normal text.

- [x] **The REAL root cause of "double-format -> gibberish", found and
  fixed.** The previous round's fix (`unwrapDirectFormatting`) was
  correct as far as it went, but rested on a false assumption: that
  `editor.getSelection()` on already-formatted text still includes the
  hidden delimiters flanking it. It doesn't — not reliably — because
  that SAME earlier round's separate atomic-ranges fix (see "Bug-fix
  round" above) correctly made a real click-drag selection stop AT the
  edge of a hidden delimiter zone instead of stepping through it. That
  fix is exactly why copying stopped producing gibberish; it's also
  why reformatting kept producing it, since `replaceSelection` on a
  selection that excludes the old delimiters leaves them behind,
  orphaned — unmatched by any role's regex, so they render as their
  raw, undecorated Private-Use-Area characters (the tofu boxes in the
  screenshot). Fixed properly this time: `delimiters.ts` adds
  `findEnclosingRoleMatch(lineText, fromCh, toCh, roles)`, which finds
  the outermost EXISTING role match (if any) that fully contains the
  selection — the real boundaries of whatever formatting is there,
  independent of what the selection itself happens to include. Wired
  into a new `resolveFormattingTarget()` helper on the plugin class
  (main.ts), used by `openFormatSelectionModal`, `registerRoleCommand`,
  `RolePickerModal`, and the new `runColorize` — every place that
  writes formatted text now replaces the REAL span, not just the
  selection. Verified with a precise char-code-level test (not just
  "no readable garbage," but confirming the OLD role's delimiter
  sentinel is completely absent from the result and a re-scan finds
  exactly one clean match).
  - **Second bug found while building that test**: `directFormat.ts`'s
    `freshId()` used millisecond-only `Date.now()` with no counter, so
    two ephemeral roles built in the same millisecond got IDENTICAL
    ids/delimiters — a real latent bug (not the cause of the reported
    issue, but would have caused a similar-looking failure under fast
    enough repeated use). Fixed with a wrapping per-session counter
    suffix.
- [x] **Colorize right-click menu** — a fast, color-only path via a
  new per-profile `quickColors: string[]` (Settings: "Quick colors"
  section, add/edit/remove swatches via `addColorPicker`/
  `addExtraButton`), plus an always-present "Custom..." entry
  (`customColorModal.ts`, a minimal `addColorPicker` + Apply button).
  Works off an explicit selection OR — the case actually asked for —
  a bare right-click on a word with nothing selected, via a new
  `getWordRangeAtCursor()` that expands from the cursor over Unicode
  letters/digits/underscore (verified against both Latin and Arabic
  text, and correctly returns nothing on punctuation). Deliberately
  built on the exact same `resolveFormattingTarget`/
  `findOrBuildEphemeralRole`/`buildDirectFormatMarkup` pipeline as
  Format selection, specifically so re-colorizing already-colored text
  doesn't reopen the gibberish bug above — colorizing a previously
  colorized word is an entirely ordinary way to hit that exact case.
  **Known cosmetic limitation**: Obsidian's `MenuItem` API has no way
  to tint an icon to match each color, so quick-color menu items show
  a plain circle icon plus the hex code as text, not an actual color
  swatch — a real UI limitation, not an oversight.
- [x] **Default scope, checked, already correct** — `DEFAULT_SCOPE.mode`
  was already `"global"`, the Settings dropdown already lists Global
  first and correctly reflects the stored value, and `hydrateProfile`
  already backfills missing scope data with the global default. No
  code change was needed; verified rather than assumed.
- [x] **Hollow-circle bullet removed** — confirmed broken in real
  Obsidian per the user, and explicitly told to remove rather than
  fix it. Removed from `ListBulletShape`, `SHAPE_PRESETS`, both
  dropdowns (Settings and the right-click quick-switch), with a
  migration in `hydrateProfile` mapping any already-saved
  `"hollow-circle"` to `"circle"`.

## Round after a real-Obsidian screenshot of the Colorize menu —
## readable color names, detecting/pre-filling existing formatting,
## merge instead of override

User sent a screenshot of the Colorize menu working in real Obsidian
(good confirmation the plugin loads and renders correctly there) with
three notes: hex codes in the menu aren't memorable, "Format
selection" shows a blank form even on already-formatted text instead
of reflecting what's there, and using Colorize on underlined text
silently removed the underline.

- [x] **Readable color names + visual swatch, not hex text.** New
  `colorNames.ts`: a short curated list of common color names (not the
  full CSS 140+ table — the goal is glance-readable, not spec-exact),
  matched by nearest RGB Euclidean distance, falling back to the hex
  itself if nothing is a close enough match (so an unusual custom color
  never gets a confidently wrong name). Discovered `MenuItem.setTitle`
  accepts a `DocumentFragment`, not just a string (confirmed against
  the real `obsidian` package) — used to render an actual colored
  circle (inline `background-color`) next to the name, since
  `setIcon`'s Lucide icons are monochrome and can't be tinted
  per-item. Same `colorLabel()` also used for the Quick Colors swatches
  in Settings, updating live as each color's picker changes.
- [x] **"Format selection" pre-fills from existing formatting; Colorize
  merges instead of overriding — the actual "detect existing
  formatting" backlog item, finally built.** New
  `detectExistingFormatAroundRole()` and `detectBareBoldItalic()`
  (directFormat.ts) reconstruct the FULL current `DirectFormatOptions`
  from whatever's at the selection: the enclosing role's own properties
  (color/backgroundColor/fontFamily/sizeEm/underline/customCss) via
  `findEnclosingRoleMatch`, PLUS bold/italic — which live OUTSIDE the
  role entirely as native `**`/`*` (see buildDirectFormatMarkup) and so
  can never be read off the role itself, only detected by checking the
  characters immediately surrounding its match. `resolveFormattingTarget`
  (main.ts) now returns this as `existingOpts`; `openFormatSelectionModal`
  passes it into `FormatSelectionModal` as a genuine pre-fill (accepts
  an optional 4th constructor arg now); `runColorize` merges it with
  `{ color }` via `Object.assign` rather than starting from
  `defaultDirectFormatOptions()` — this is the actual fix for
  "colorizing underlined text removes the underline," and the same
  mechanism would have silently dropped bold/italic/font/size/highlight
  too, not just underline.
  - **Two real bugs found and fixed while building this**, both in the
    bold/italic detection specifically (caught by writing precise
    char-position tests, not by inspection):
    1. Checking italic (`*`) before bold (`**`) let the italic check
       consume one star of what was actually a bold marker, so the
       bold check immediately after — now looking at the wrong
       boundary — never matched. Bold is the OUTERMOST wrapper per
       buildDirectFormatMarkup, so it has to be checked and stripped
       FIRST; fixed the order in both functions.
    2. `wrapWithDelims` always adds a directional-isolate wrapper
       (LRI/RLI...PDI) immediately outside a role's own delimiters
       whenever a role is involved — sitting BETWEEN the role's match
       boundary and any bold/italic stars, a third layer neither
       function originally accounted for. Without skipping past it
       first, the star checks were comparing against the isolate
       characters instead of the actual stars one position further
       out, so bold/italic went undetected on ANY role-backed
       (color/underline/font/etc.) text that also had them — exactly
       the combination the reported bug involved. Fixed by skipping
       the isolate wrapper before checking for stars, only in
       `detectExistingFormatAroundRole` (the bare-bold-italic path has
       no role and therefore no isolate wrapper to skip).
    Verified with an exhaustive combo test: bold + italic + underline +
    color + role all set at once, confirming all four properties
    detect correctly AND the detected range exactly matches the full
    original markup (`***⁦stays⁩***`, not a partial/off-by-one span).

## Round after two more real-Obsidian screenshots — direction marker
## was breaking Markdown block-type parsing, paragraph spacing fixed
## to match what was actually asked for

User reported: forcing direction on a list line disrupts the list's
formatting; forcing direction on one heading changes ALL headings of
that level; and the paragraph-spacing slider has no visible effect.

- [x] **Direction marker was breaking CommonMark block-type parsing —
  root cause of BOTH the list and heading reports, fixed at the
  source.** `direction.ts`'s marker was inserted as the absolute FIRST
  character of the raw line, unconditionally — before a list's
  `-`/`*`/`1.`, before a heading's `#`s, before a blockquote's `>`.
  CommonMark requires that syntax to be the literal first character(s)
  of the line to be recognized as that block type AT ALL. A list line
  with the marker first is no longer parsed as a list item (list
  formatting visibly breaking, as reported); a heading line with the
  marker first is no longer parsed as that heading level — and unlike
  the list case, a block-type misparse on one line can cascade through
  CM6's incremental parser and misalign OTHER nearby headings' own
  level detection, which is what "changing one heading's direction
  changed every heading of that level" actually was. Fixed: new
  `blockPrefixLength()` detects the block-syntax prefix (heading `#`s,
  list bullet/number, blockquote `>`) and every raw-markdown-facing
  function (`detectLineDirection`, `stripLineDirectionMarker`,
  `setLineDirection`, new `lineDirectionMarkerOffset`) now places/reads
  the marker AFTER that prefix, never at position 0 unconditionally.
  `decorations.ts` updated to hide the marker at its real offset
  (previously assumed always 0).
  - **Split into raw-vs-rendered variants** — `readingMode.ts` checks
    already-RENDERED DOM text (Obsidian strips `#`/`-`/`>` syntax when
    rendering to HTML, so there's no prefix to skip there, and
    reusing the prefix-aware functions on rendered text risked a false
    match: a heading literally titled "1. Introduction" would render
    as text starting with "1. ", which the list-marker regex would
    wrongly treat as syntax to skip past). Added
    `detectRenderedTextDirection`/`stripRenderedTextDirectionMarker` —
    plain position-0 checks, no prefix logic — and switched
    `readingMode.ts` to use those instead.
  - Verified exhaustively: bullet/nested-bullet/ordered-list/heading/
    blockquote/plain-paragraph lines all keep their native syntax
    intact at position 0 after setting a direction, `lineContext.ts`'s
    heading/list-depth detection still works on a direction-marked
    line, toggling RTL->LTR doesn't stack a second marker, and the
    reading-view edge case (rendered text that coincidentally looks
    like list syntax) strips correctly without misfiring.
- [x] **Paragraph spacing — root cause was a wrong definition of
  "paragraph," not a broken selector.** The previous round's Live
  Preview approximation only targeted blank CommonMark-paragraph-
  separator lines (`:has(> br:only-child)`) — which does nothing
  visible for anyone who writes without leaving a truly blank line
  between paragraphs (just pressing Enter once), which is how the
  feature was actually described when asked for, and is extremely
  common note-taking style. Fixed by dropping the blank-line-only
  heuristic entirely: since CM6's `.cm-line` already always
  corresponds to exactly one raw source line regardless of word-wrap,
  `margin-bottom` is now applied directly to every qualifying
  `.cm-line` (same exclusion set as rule 4's justify/indent — headings/
  lists/quotes/code/footnotes/frontmatter skip it), matching "space
  after every Enter-separated line" exactly. Reading view is
  unchanged (real `<p>` margin-bottom, correct for its stricter
  CommonMark definition) — flagged as a known, inherent discrepancy:
  someone who writes without blank lines between paragraphs will see
  the spacing in Live Preview but not Reading view, since Reading
  view's DOM genuinely has no paragraph boundary to hang it on in that
  case; fixing that would need a Reading-view-specific post-processing
  pass (finding `<br>`-joined runs within one rendered `<p>` and
  inserting spacing there), not done this round.

## Large round — live-apply Format selection, CSS snippets, bundled
## fonts, style-delimiters, paragraph-spacing retry #2, list-direction
## removed (per explicit fallback), Colorize UX

Biggest single round yet. In order of what's most structurally
significant:

- [x] **Format selection now applies live — the actual architecture
  change, not just a UI tweak.** Every field (bold/italic/underline/
  color/background/font/size) now calls `onChange` immediately on
  toggle, which main.ts's `openFormatSelectionModal` uses to
  re-`editor.replaceRange()` the live result in place, tracking the
  evolving `[currentFrom, currentTo)` range as the markup's length
  changes between steps. Custom CSS is the deliberate exception — its
  own "Apply CSS" button, not live-on-keystroke (reformatting the
  document mid-typo would be disruptive in a way toggling a checkbox
  isn't). "Cancel" now means something different than before: reverts
  the document to the EXACT original raw text (a new `raw` field on
  `resolveFormattingTarget`'s return, captured before any live edits),
  not just "close without applying" — meaningful now that changes
  happen as you go rather than only on a final confirm.
  - **Solved the role-churn problem this creates before it shipped**,
    not after: naively calling `findOrBuildEphemeralRole` on every
    single toggle and pushing whatever it returns would leave one
    throwaway role in Settings per toggle in a live session (toggle
    bold, then color, then underline = 3 abandoned roles, only the
    last one ever actually used). `openFormatSelectionModal` now
    tracks `pendingNewRole` — a role created THIS session that isn't
    (yet) reused elsewhere — and removes it before considering pushing
    a new one on the next change, so at most ONE extra role survives
    when the modal closes, and zero if the final state happens to
    match an already-existing role. Verified with a dedicated
    simulation test: 5 toggle steps through different combinations
    leave exactly 1 extra role (not 5); Cancel removes it entirely,
    restoring the baseline count; toggling to a combination matching
    an already-committed (non-pending) role correctly reuses it and
    drops the abandoned pending one.
- [x] **CSS Snippets** — new `Profile.cssSnippets: {name, css}[]`
  (hydrated/migrated/import-backfilled like `quickColors`), a
  Settings section to manage them (three starter snippets included:
  wide letter spacing, small caps, subtle text shadow), and a
  `openSnippetMenu()` helper (uiHelpers.ts) that renders a REAL popup
  menu (`new Menu().showAtMouseEvent(evt)` — confirmed this exact
  pattern against the real `obsidian` package, not just the
  editor-menu event path used elsewhere) listing every saved snippet
  by name. Wired into both Format selection's and the role editor's
  Custom CSS fields via a "Snippets..." button — picking one appends
  its CSS to whatever's already there.
- [x] **Bundled fonts — genuine zero-install fonts, not just a curated
  list of names.** New `fonts/` directory with real font files:
  Amiri, Scheherazade New, and Noto Naskh Arabic, all SIL Open Font
  License (permits bundling/redistribution), fetched from the
  `google/fonts` GitHub repo (the canonical versioned source),
  converted TTF -> WOFF2 (~2MB -> ~670KB total) via `fonttools`. Each
  font's `OFL.txt` license text is kept alongside its files, as the
  license requires. `bundledFonts.ts` declares the manifest and
  builds `@font-face` CSS at runtime via
  `app.vault.adapter.getResourcePath(normalizePath(this.manifest.dir + "/" + relativePath))`
  — confirmed this exact API (including `PluginManifest.dir` and
  `DataAdapter.getResourcePath`) against the real `obsidian` package.
  Generated ONCE at `onload()` into its own `<style id="af-bundled-fonts">`
  element (fonts don't change per-profile, unlike the main generated
  stylesheet, so no reason to regenerate on every `saveAndApply()`).
  **The `fonts/` folder must now be copied alongside `main.js`/
  `manifest.json`/`styles.css`** when installing — noted in the
  README's install section, since it's a new hard requirement this
  round.
  - `uiHelpers.ts`'s `renderFontFamilyPicker()` presents these grouped
    under "Bundled — works immediately" in a dropdown, separately from
    a "Common — must already be installed" group (Georgia, Times New
    Roman, etc. — curated names only, NOT bundled, still require the
    font to already exist on the user's OS) and a "Custom..." option
    that reveals a freeform text field. Wired into both the role
    editor and Format selection, replacing the old plain text-only
    font field in both places.
- [x] **`styleDelimiters` on Role** — new optional field, exposed as a
  "Style the delimiters too" toggle in the role editor (only shown
  when Delimiter display is "show", since that's the only mode where
  it's meaningful). `decorations.ts`'s `tagDecoration` adds the same
  `af-role-<id>` class the content span gets to the delimiter tag span
  too when enabled, so the SAME CSS color/font/size rule
  (stylesheet.ts) applies to both — verified no competing CSS rule for
  `.af-role-tag-shown` exists that would fight it.
- [x] **Colorize UX: readable names + swatches, and merges instead of
  overriding.** Discovered `MenuItem.setTitle` accepts a
  `DocumentFragment`, not just a string (confirmed against the real
  package) — used to render an actual colored circle next to a
  human-readable name (`colorNames.ts` — nearest-match against a
  curated list, falls back to hex if nothing's close enough) instead
  of a raw hex code nobody can memorize. Colorize now starts from
  whatever formatting is already at the selection
  (`resolveFormattingTarget`'s `existingOpts`) and merges the new
  color into it via `Object.assign`, rather than starting from a blank
  `defaultDirectFormatOptions()` — fixes "colorizing underlined text
  silently removed the underline."
- [x] **Paragraph spacing — second attempt.** The blank-line-only
  heuristic from the FIRST attempt was replaced (previous round) with
  margin-bottom on every qualifying `.cm-line` directly — reported as
  STILL not visibly applying at all in real Obsidian, despite that
  being a community-standard CSS pattern. Given two non-`!important`
  attempts have now failed, switched to `padding-bottom` (sidesteps
  margin-collapsing entirely) + `!important` (the one thing guaranteed
  to beat an inline style, which is the most likely remaining
  explanation — CM6 may set one directly on `.cm-line` for its own
  layout/measurement purposes, invisible to this stylesheet). This is
  the one deliberate exception to this file's "win via specificity,
  never `!important`" philosophy, reasoned through explicitly in the
  code comment: `.cm-line` spacing isn't something a theme author
  would plausibly be relying on controlling via their own CSS, unlike
  color/font/etc., so the usual risk `!important` carries (silently
  overriding a legitimate theme customization) doesn't really apply
  here. STILL UNVERIFIED in real Obsidian as of this round — if this
  third attempt also fails, the remaining explanation is something
  even `!important` can't reach (a JS-level inline `style` attribute
  reapplied on every render would still lose to `!important` per CSS
  spec, so at that point the issue would likely be structural — e.g.
  CM6 genuinely not reflowing line heights from a padding change at
  all — and worth a different approach entirely, like a widget-based
  spacer rather than CSS).
- [x] **List-direction: removed, not just scoped down further.** Per
  explicit instruction after a SECOND report of the same breakage
  despite the marker-position root-cause fix (previous round) — see
  that round's entry for what was already tried. This round: "Force
  right-to-left"/"Force left-to-right" no longer offered (menu items
  hidden, and `runSetLineDirection` skips list lines outright when
  SETTING a direction) for list lines specifically — paragraphs/
  headings/blockquotes unaffected, since the feature works there.
  "Clear direction override" still works on a list line, so a stale
  marker from before this exclusion existed can still be removed.
  Reasoned but unverified explanation for the remaining breakage:
  `direction: rtl/ltr` likely conflicts with Obsidian's own
  bullet-position CSS (padding/logical-property based, commonly
  calibrated assuming LTR) in a way this plugin doesn't control and
  can't fix without live-testing against Obsidian's actual internal
  CSS.

## Round: heading align/bold quick-switch fixed to be per-instance
## (was mutating the global per-level setting), global font-family
## field converted to the same picker as Format selection

User reported the heading-alignment quick-switch changed EVERY heading
of that level, not just the one clicked — this was a real, previously-
acknowledged design choice (documented at the time as "a shortcut to
the existing global setting, deliberately not per-instance") that
turned out to be the wrong call once actually used. Also asked for the
global "body font family" Settings field to use the same bundled/
common/custom picker Format selection got last round, not just there.

- [x] **New shared per-line marker infrastructure — `lineMarkers.ts`.**
  Generalizes direction.ts's marker mechanism (a single invisible
  character placed after any block-syntax prefix, never at position 0
  — see that round's entry for why) to support MULTIPLE independent
  axes coexisting correctly on the same line (a heading can now have a
  forced direction AND a forced alignment AND a forced bold, all at
  once). This was a real design gap the original single-axis version
  would have hit the moment a second axis was added: each axis
  checking `rest.startsWith(ownMarker)` right after the block prefix,
  with no awareness of other axes, breaks the instant two markers
  stack — whichever axis's marker isn't first in the cluster stops
  being detected. `lineMarkers.ts` centralizes cluster
  detection/mutation (`splitCluster`, `findOwnMarker`,
  `setOwnMarker`, `stripAllMarkers`) so each axis module only ever
  touches its OWN registered marker characters, leaving others in the
  cluster untouched. `direction.ts` was refactored to build on this
  (public API unchanged, verified via the existing test suite) rather
  than left as a special case.
- [x] **`headingOverrides.ts`** — per-line alignment (`left`/`center`/
  `right`/null) and bold (`on`/`off`/null — three states, not a plain
  boolean, since null means "inherit the level's own setting" and is
  distinct from an explicit force-off) on the U+E220 marker range,
  registered with lineMarkers.ts alongside direction's U+E210 range.
- [x] **The right-click heading menu now sets these per-line markers
  instead of mutating `typography.headings[key]`** — the actual fix.
  "Align auto"/"Bold: auto" clears the override; the heading level's
  shared Settings-configured style is completely unaffected by any of
  this, still exactly what every OTHER heading of that level uses.
  `decorations.ts` (Live Preview) and `readingMode.ts` (Reading view)
  both updated to detect/apply all three axes together — Live Preview
  now hides the WHOLE marker cluster as one CM6 replace decoration
  (simpler and more robust than each axis hiding its own single
  character separately) and combines however many classes apply into
  one `Decoration.line`; Reading view's `applyLineDirection` was
  generalized into `applyLineOverrides`, using a new
  `scanRenderedTextMarkers` (lineMarkers.ts) that reads the whole
  leading run of marker characters in rendered text at once (rendered
  text has no block prefix, so unlike the raw-markdown side, the
  cluster there just IS the leading run from position 0).
  `stylesheet.ts` adds `.af-align-left/center/right` and
  `.af-bold-on/off` CSS, same ancestor-chain-specificity technique as
  direction's rules.
  - Verified exhaustively: a heading with alignment override only; a
    heading with direction+alignment stacked (confirming alignment
    detection ISN'T clobbered by direction's marker sitting in the
    same cluster — the exact bug the shared-infrastructure rewrite
    exists to prevent); three markers stacked at once
    (direction+align+bold), all three still independently detected;
    clearing just ONE axis leaves the other two untouched; full
    round-trip back to the exact original line; and a list line with
    align+bold markers still correctly parses as a list (heading/list
    detection in lineContext.ts now strips ALL markers, not just
    direction's, before matching).
  - **Bullet shape's quick-switch is UNCHANGED this round** — still
    mutates `typography.listBulletShapes[depth]` globally, the same
    bug class alignment/bold just got fixed for. Not converted this
    round (would need a parallel per-instance mechanism specifically
    for a single list item's bullet, plus CSS var override with
    sufficient specificity against the existing per-depth rule) —
    explicitly flagged as a known remaining gap in the README rather
    than silently left inconsistent.
- [x] **Global "body font family" Settings field** now uses
  `renderFontFamilyPicker` (uiHelpers.ts) — the same bundled/common/
  custom grouped picker Format selection and the role editor already
  had, replacing the old plain text field. All four font-family entry
  points in the plugin (global Typography, per-role, Format selection,
  Colorize doesn't have one) are now consistent.

## Round: heading styling gets full parity with roles (font family,
## Custom CSS), Settings UI polish pass ahead of release

User asked for headings to be customizable to the same depth as roles
(not just color/size/underline), and — separately, explicitly framed
as a pre-release polish pass — asked for a general Settings UI review:
shorter/less-obvious descriptions, and no Arabic text appearing by
default in the English UI.

- [x] **`HeadingStyle` gets `fontFamily`/`customCss`**, matching what
  `Role` already has. `stylesheet.ts`'s per-level heading CSS block
  now emits `font-family` and appends `customCss` LAST (same "escape
  hatch, applied last so it can override anything above" pattern as
  role CSS — no `!important` needed).
- [x] **Found and fixed a real hydration bug while wiring this up**:
  `hydrateProfile`'s heading merge was `Object.assign({},
  DEFAULT_HEADING_STYLES, savedHeadings)` — a SHALLOW merge at the
  top level (keys `h1`..`h6`). Since an old saved `h1` object is a
  complete object, that shallow assign would use it AS-IS, not
  merging within it — meaning any brand-new field added to
  `HeadingStyle` (exactly the situation `fontFamily`/`customCss`
  just created) would silently be missing for every existing user's
  saved headings, backfilled only for a fresh install. Fixed with a
  proper per-level merge, extracted into a new shared
  `mergeTypography()` (defaults.ts) — also applied to
  `settingsBackup.ts`'s JSON-import path, which had the same gap
  AND wasn't merging typography against defaults at all before
  (a raw unsafe cast). Verified with a simulated old-shape saved
  profile: custom values on an old `h1` survive, missing new fields
  backfill to `""` rather than `undefined`.
- [x] **`HeadingEditModal`** (new file, mirrors `RoleEditModal`
  exactly) — size, alignment, color, bold, underline, font family
  (the grouped bundled/common/custom picker), Custom CSS with its own
  "Snippets..." popup. Settings' per-heading row simplified to just
  size + alignment + a gear icon opening this modal (color/bold/
  underline/font/CSS moved out of the row) — the same "compact row +
  gear -> full editor" pattern roles already use, for the same
  reason: a `Setting` row is block-level regardless of a parent flex
  container, so the OLD row (slider + dropdown + color swatch + a
  labeled toggle) was already at its practical limit; adding 3 more
  controls to it directly wasn't viable.
  - **Also closed a real, separate gap while here**: `bold` has
    existed on `HeadingStyle` since headings were first built, but
    was NEVER exposed as a Settings control anywhere — only settable
    via the per-instance right-click override from two rounds ago, or
    by hand-editing the default. Now has a real toggle in
    `HeadingEditModal`.
  - This is the per-LEVEL style (every H2 in the note) — for a
    one-off override on a single specific heading, the right-click
    menu's per-instance align/bold overrides (headingOverrides.ts,
    previous round) are the separate, already-correct mechanism for
    that; this round doesn't change or duplicate that.
- [x] **Settings UI polish pass.** Found and fixed 8 i18n keys where
  Arabic text was hardcoded directly into the ENGLISH value (visible
  as e.g. "Scope — نطاق التطبيق" as a section title even with
  Settings language set to English) — leftover from the plugin's
  original single-audience design, never cleaned up when the
  language toggle was added. Fixed: `scopeSectionTitle`,
  `typographySectionTitle`, `inlineRolesSectionTitle`,
  `bodyFontDesc`, `footnoteSizeDesc` (both fully Arabic in the
  English slot; both descriptions were also stale — written for the
  old plain-text font field / redundant with their own label — so
  dropped entirely rather than translated), `alignAuto`/`alignRight`/
  `alignCenter`/`alignLeft` (each had a parenthetical Arabic gloss
  baked into the English label). Also trimmed several
  longer-than-needed descriptions (`viewingProfileDesc`,
  `profileDescDesc`, `quickColorsSectionDesc`,
  `cssSnippetsSectionDesc`, `inlineRolesDesc`,
  `delimiterDisplayDesc`) — cutting restated-the-label filler and
  redundant examples, keeping only what's actually non-obvious.
  Removed two now-dead CSS/i18n leftovers (`af-toggle-label`,
  `underlineTooltip`) from the heading-row simplification above.

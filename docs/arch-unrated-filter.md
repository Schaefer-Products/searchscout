# Architecture Specification: Unrated Keywords Filter

**Prepared by:** Angular Architect
**Date:** 2026-03-07
**Implements:** `docs/ux-unrated-filter.md` + `docs/ui-unrated-filter.md`
**Target file:** `src/app/components/dashboard/dashboard.component.ts` (and `.html`, `.scss`)

---

## 1. New Component State

Add one boolean property to `DashboardComponent`, alongside the existing `showHidden` declaration:

```typescript
showUnratedOnly: boolean = false;
```

**Type:** `boolean`
**Default:** `false`
**Reset point:** Inside `analyzeDomain()`, in the `if (isDifferentDomain)` branch, alongside the existing reset of `showHidden` — set `this.showUnratedOnly = false;` (UX requirement R5).

No signal, no Subject, no new observable. Plain boolean property is sufficient because `cdr.detectChanges()` is called wherever `showUnratedOnly` changes.

---

## 2. `applyHiddenFilter()` Change

Replace the current implementation entirely. The new logic composes both filter predicates independently (UX requirement R7):

```typescript
private applyHiddenFilter(): void {
  let result = this.keywords;

  // Step 1 — hidden filter (existing logic)
  if (!this.showHidden) {
    result = result.filter(
      kw => !this.keywordRatingService.isHidden(kw.keyword)
    );
  }

  // Step 2 — unrated-only filter (new)
  if (this.showUnratedOnly) {
    result = result.filter(
      kw => this.keywordRatingService.getRating(kw.keyword) === undefined
    );
  }

  this.filteredKeywords = result;
  this.pagination.reset(this.filteredKeywords);
}
```

Key decisions:
- The two filter steps are applied sequentially on `result`, not nested ternaries. This keeps each predicate independently readable.
- `getRating(kw.keyword) === undefined` is the correct unrated predicate. `KeywordRatingService.getRating()` returns `RatingValue | undefined`; a keyword is unrated when the key is absent from `ratingsMap` (the map entry is `undefined`). A keyword rated 0 (hidden) has a stored `RatingValue` of `0` — it is not `undefined` — so hidden keywords correctly pass through `isHidden()` in step 1 and do not appear in the unrated filter result set unless `showHidden` is also true.
- `this.keywords` (the full sorted array, not the paginated slice) is always the source. This satisfies UX requirement R2 (count and filter source are always the full dataset).
- Filter application order (hidden first, then unrated) produces the most predictable UX: a hidden keyword that has rating 0 is excluded by step 1 in the default `showHidden = false` state, and step 2 never sees it.

---

## 3. New Methods

### `toggleShowUnratedOnly()`

```typescript
toggleShowUnratedOnly(): void {
  this.showUnratedOnly = !this.showUnratedOnly;
  this.applyHiddenFilter();
  this.cdr.detectChanges();
}
```

Pattern is identical to the existing `toggleShowHidden()`. No additional work is needed: `applyHiddenFilter()` rebuilds `filteredKeywords` and resets pagination, and `detectChanges()` propagates all template bindings.

### `unratedCount` getter

```typescript
get unratedCount(): number {
  return this.keywords.filter(
    kw => this.keywordRatingService.getRating(kw.keyword) === undefined
  ).length;
}
```

- Operates on `this.keywords` (full sorted array), never on `filteredKeywords` or `displayedKeywords`, satisfying UX requirement R2.
- Uses the same `=== undefined` predicate as `applyHiddenFilter()` step 2 so the button label count and the filtered row count are always consistent.
- Updates automatically on every change-detection cycle triggered by `ratings$` subscription (existing `ratingsSub` in `ngOnInit` already calls `applyHiddenFilter()` then `cdr.detectChanges()` on every rating mutation — this also re-evaluates the getter, satisfying UX requirement R3).

---

## 4. Template Binding Points

All bindings are in `dashboard.component.html`. The new toggle block is inserted immediately after the closing `</div>` of `hidden-keywords-toggle` (UI spec section 4, after the existing show-hidden block at approximately line 179).

| Template expression | Bound to | Notes |
|---|---|---|
| `*ngIf="hasAnalyzed && keywords.length > 0"` | wrapper `<div class="unrated-keywords-toggle">` | Hides the entire block until analysis produces results (R1, R8) |
| `[class.unrated-filter-active]="showUnratedOnly"` | `<button class="btn-toggle-hidden btn-toggle-unrated">` | Drives the active/inactive visual state |
| `[attr.aria-pressed]="showUnratedOnly"` | same `<button>` | Communicates toggle state to assistive technology |
| `[attr.aria-label]="showUnratedOnly ? 'Stop showing unrated keywords only, ' + unratedCount + ' unrated' : 'Show unrated keywords only, ' + unratedCount + ' unrated'"` | same `<button>` | Accessible label changes with state |
| `(click)="toggleShowUnratedOnly()"` | same `<button>` | Wires the click event to the method |
| `{{ showUnratedOnly ? 'Showing unrated only (' + unratedCount + ')' : 'Show unrated only (' + unratedCount + ')' }}` | button text content | Present-participle label in active state |
| `*ngIf="showUnratedOnly && unratedCount === 0"` | `<tr class="unrated-complete-state">` inside `<tbody>` | Completion state row (R6) |
| `[attr.colspan]="keywords[0]?.etv ? 6 : 5"` | `<td>` inside completion row | Dynamic colspan matches the ETV column guard already used in the table header |
| `[hidden]="showUnratedOnly && unratedCount === 0"` | `<tr *ngFor="let keyword of displayedKeywords">` | Hides normal rows during completion state without destroying DOM (avoids layout thrash) |

No new `@Input()` or `@Output()` bindings are required. All bindings reference properties of `DashboardComponent` itself.

---

## 5. Change Detection

The component uses the **default** (`CheckAlways`) change detection strategy — there is no `changeDetection: ChangeDetectionStrategy.OnPush` in the `@Component` decorator. The existing pattern of calling `this.cdr.detectChanges()` after every state mutation is sufficient and must be maintained for consistency.

Specific call sites for the new feature:

| Call site | Reason |
|---|---|
| End of `toggleShowUnratedOnly()` | Propagates `showUnratedOnly` flip and rebuilt `filteredKeywords` |
| Existing `ratingsSub` handler (already present in `ngOnInit`) | Re-evaluates `unratedCount` getter and `filteredKeywords` on every rating change |

No `OnPush` migration is required or recommended as part of this feature. The `unratedCount` getter is a pure derived computation from `this.keywords` and the in-memory `ratingsMap` inside `KeywordRatingService`; it does not introduce any subscription or async complexity. Adding `OnPush` would require converting `showUnratedOnly` to a signal or wrapping it in a Subject, which is out of scope.

---

## 6. No New Services or Models Needed

This feature is purely additive to `DashboardComponent`. The following confirms no new artefacts are required:

| Concern | Verdict | Rationale |
|---|---|---|
| New service | Not needed | `KeywordRatingService.getRating()` is already public and returns `RatingValue \| undefined` — the exact predicate needed |
| New model/interface | Not needed | `RatingValue` and `KeywordRatingMap` already cover all type needs |
| New pipe | Not needed | Filter logic lives in `applyHiddenFilter()` as it does for the hidden filter |
| New component | Not needed | Button and completion state are simple inline HTML per the UI spec |
| New IDB store/key | Not needed | `showUnratedOnly` is transient session state; the UX spec (R5) explicitly requires it to reset on domain switch, confirming it must not be persisted |
| New RxJS observable | Not needed | The existing `ratings$` subscription already triggers re-evaluation of the getter and filter on every rating change |

---

## 7. Domain-Switch Reset (Implementation Note)

In `analyzeDomain()`, inside the `if (isDifferentDomain)` block (currently around line 161 in the component), add:

```typescript
this.showUnratedOnly = false;
```

Place it alongside the existing `this.showHidden` reset if one is present, or directly after `this.showCompetitorAnalysis = false;`. This satisfies UX requirement R5 without requiring any service interaction.

---

## Summary of All Additions to `dashboard.component.ts`

| Addition | Location | Type |
|---|---|---|
| `showUnratedOnly: boolean = false` | Class property block, after `showHidden` | Property |
| `get unratedCount(): number` | After `get hiddenCount()` | Getter |
| `toggleShowUnratedOnly(): void` | After `toggleShowHidden()` | Method |
| Updated `applyHiddenFilter()` | Replace existing private method | Private method |
| `this.showUnratedOnly = false` | Inside `if (isDifferentDomain)` in `analyzeDomain()` | Statement |

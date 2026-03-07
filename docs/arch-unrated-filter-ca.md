# Architecture Specification: Unrated Keywords Filter — Competitor Analysis (Feature 9)

**Prepared by:** Angular Architect
**Date:** 2026-03-07
**Implements:** `docs/ux-unrated-filter-ca.md`, `docs/ui-unrated-filter-ca.md`
**Target file:** `src/app/components/competitor-analysis/competitor-analysis.component.ts`

---

## Overview

This specification defines the exact TypeScript changes to `CompetitorAnalysisComponent` required to implement the unrated keywords filter. No new services, models, or tokens are needed. All changes are confined to `competitor-analysis.component.ts`.

---

## 1. New State Property

**Location:** In the "Display state" block, after `viewMode: ViewMode = 'opportunities';` (line 49).

```ts
showUnratedOnly: boolean = false;
```

**Constraints:**
- Default is `false` — the filter is inactive on component mount and after every view-mode switch.
- Must be declared as a class field (not inside any method), so it is directly referenceable from the template.

---

## 2. New Private Subscription Field

**Location:** After `private analysisSubscription: Subscription = Subscription.EMPTY;` (line 86).

```ts
private ratingsSub: Subscription | null = null;
```

**Constraints:**
- Typed as `Subscription | null` to distinguish "not yet subscribed" from `Subscription.EMPTY`.
- Initialised to `null`; assigned in `ngOnInit`.
- Must be `private` — it is lifecycle infrastructure, not part of the public API.

---

## 3. New `unratedCount` Getter

**Location:** In the getters block, after the `remainingTopicsCount` getter (line 73).

```ts
get unratedCount(): number {
  return this.getKeywordsForCurrentView().filter(
    kw => this.keywordRatingService.getRating(kw.keyword) === undefined
  ).length;
}
```

**Constraints:**
- Calls `getKeywordsForCurrentView()` — the single authoritative source for the current view's keyword list.
- `getRating() === undefined` is the canonical unrated check used throughout the codebase (matches the dashboard implementation).
- This is a getter, not a stored property, because the underlying data (`results`, `viewMode`, and the ratings map) can change independently. A getter ensures the count is always current without requiring explicit invalidation.
- The template reads `unratedCount` twice per render (button label and aria-label); because `getKeywordsForCurrentView()` is a simple array lookup with no I/O, this is acceptable.

---

## 4. New `toggleShowUnratedOnly()` Method

**Location:** After `setViewMode()` (line 163), before `updateDisplayedKeywords()`.

```ts
toggleShowUnratedOnly(): void {
  this.showUnratedOnly = !this.showUnratedOnly;
  this.updateDisplayedKeywords();
  this.cdr.detectChanges();
}
```

**Constraints:**
- Flips `showUnratedOnly` then immediately refreshes the displayed list and triggers change detection.
- Follows the identical pattern used in `DashboardComponent.toggleShowUnratedOnly()`.
- Does **not** reset pagination state independently — `updateDisplayedKeywords()` calls `keywordPagination.reset()`, which handles that.

---

## 5. Updated `updateDisplayedKeywords()`

**Replace** the existing method body (lines 165–174) with:

```ts
updateDisplayedKeywords(): void {
  if (!this.results || this.viewMode === 'blog-topics') return;

  let keywords = this.getKeywordsForCurrentView();

  if (this.showUnratedOnly) {
    keywords = keywords.filter(
      kw => this.keywordRatingService.getRating(kw.keyword) === undefined
    );
  }

  const sorted = this.sortKeywords(keywords);
  this.keywordPagination.reset(sorted);

  // Pre-compute adjusted scores for the full current view (filtered or not)
  this.adjustedScores = {};
  for (const kw of this.getKeywordsForCurrentView()) {
    this.adjustedScores[kw.keyword] = this.getAdjustedScore(kw.keyword, kw.opportunityScore);
  }
}
```

**Key decisions:**

- The unrated filter is applied **after** `getKeywordsForCurrentView()` and **before** `sortKeywords()`. This ordering is mandatory: sorting an already-filtered list is cheaper and produces correct pagination.
- `adjustedScores` is still populated from the **unfiltered** `getKeywordsForCurrentView()` list, not the filtered `keywords` variable. This ensures scores are pre-computed for all rows, including rows that may be revealed when the filter is toggled off — avoiding a missing-key scenario in the template's `adjustedScores[keyword.keyword]` binding.
- `keywordPagination.reset(sorted)` resets the displayed slice to the first page of the filtered+sorted list.

---

## 6. Updated `loadMore()`

**Replace** the existing method body (lines 176–186) with:

```ts
loadMore(): void {
  let keywords = this.getKeywordsForCurrentView();

  if (this.showUnratedOnly) {
    keywords = keywords.filter(
      kw => this.keywordRatingService.getRating(kw.keyword) === undefined
    );
  }

  const newLimit = this.keywordPagination.displayed.length + this.keywordPagination.chunk;
  this.keywordPagination.displayed = this.sortKeywords(keywords).slice(0, newLimit);

  // Ensure adjustedScores covers any newly loaded keywords
  for (const kw of this.keywordPagination.displayed) {
    if (!(kw.keyword in this.adjustedScores)) {
      this.adjustedScores[kw.keyword] = this.getAdjustedScore(kw.keyword, kw.opportunityScore);
    }
  }

  this.cdr.detectChanges();
}
```

**Constraints:**
- Must apply the same unrated filter that `updateDisplayedKeywords()` applies, so that "Load more" appends from the correct filtered pool.
- The filter condition is intentionally duplicated (not extracted) to match the existing style of the component, where `loadMore` and `updateDisplayedKeywords` are parallel methods.
- If the filter is extracted to a private helper in a future refactor, both sites should be updated together.

---

## 7. Updated `setViewMode()`

**Replace** the existing method body (lines 155–163) with:

```ts
setViewMode(mode: ViewMode): void {
  this.showUnratedOnly = false;
  this.viewMode = mode;

  if (mode === 'blog-topics') {
    this.topicPagination.reset(this.blogTopics);
  } else {
    this.updateDisplayedKeywords();
  }
}
```

**Constraints:**
- `showUnratedOnly = false` must be set **before** `this.viewMode = mode` and before `updateDisplayedKeywords()` is called. If the reset happened after, `updateDisplayedKeywords()` would run one cycle with the stale `showUnratedOnly = true` and produce an incorrect first render.
- No `cdr.detectChanges()` is needed here — the call to `updateDisplayedKeywords()` (or `topicPagination.reset()`) is synchronous and will be picked up by the next normal change detection cycle triggered by the click event.

---

## 8. Updated `hasMoreKeywords` Getter

**Replace** the existing getter (lines 59–61) with:

```ts
get hasMoreKeywords(): boolean {
  if (this.showUnratedOnly) {
    const filteredCount = this.getKeywordsForCurrentView().filter(
      kw => this.keywordRatingService.getRating(kw.keyword) === undefined
    ).length;
    return this.keywordPagination.displayed.length < filteredCount;
  }
  return this.keywordPagination.displayed.length < this.getKeywordsForCurrentView().length;
}
```

**Constraints:**
- When `showUnratedOnly` is active, `hasMoreKeywords` must compare `displayed.length` against the **filtered** total, not the raw view total. Without this fix, the "Load more" button would appear even when all unrated keywords are already displayed.
- The filter expression is repeated (not delegated to `unratedCount`) because `unratedCount` counts all unrated keywords in the view, whereas here we need the count of the sorted+filtered pool that `loadMore` draws from. They are semantically equivalent today but keeping them separate avoids an implicit dependency if either changes.

---

## 9. `ngOnInit` — Add `ratingsSub` Subscription

**Replace** the existing `ngOnInit` body (lines 88–91) with:

```ts
ngOnInit(): void {
  this.ratingsSub = this.keywordRatingService.ratings$.subscribe(() => {
    this.updateDisplayedKeywords();
    this.cdr.detectChanges();
  });

  // Auto-start analysis when component loads
  this.analyzeCompetitors();
}
```

**Constraints:**
- The subscription must be established **before** `analyzeCompetitors()` is called. Although the first emission from `ratings$` is unlikely to race with the analysis completing, this ordering is defensive and consistent with standard Angular lifecycle practice.
- The subscription callback receives the new `KeywordRatingMap` but ignores it — `updateDisplayedKeywords()` and `unratedCount` both call `keywordRatingService.getRating()` directly, so they always read the latest state without needing the emitted value.
- `cdr.detectChanges()` is required because `CompetitorAnalysisComponent` uses `OnPush`-compatible injection of `ChangeDetectorRef`. An external Observable emission does not automatically trigger a view update.

---

## 10. `ngOnDestroy` — Unsubscribe `ratingsSub`

**Replace** the existing `ngOnDestroy` body (lines 93–95) with:

```ts
ngOnDestroy(): void {
  this.analysisSubscription.unsubscribe();
  this.ratingsSub?.unsubscribe();
}
```

**Constraints:**
- Uses optional chaining (`?.`) because `ratingsSub` is typed `Subscription | null` and could theoretically be null if the component is destroyed before `ngOnInit` completes (edge case in testing).
- Both subscriptions must be unsubscribed independently — do not chain them.

---

## Summary of All Changes

| # | Target | Change type | One-line description |
|---|--------|-------------|----------------------|
| 1 | Class field block | Add | `showUnratedOnly: boolean = false` |
| 2 | Class field block | Add | `private ratingsSub: Subscription \| null = null` |
| 3 | Getters block | Add | `unratedCount` getter — filtered count for current view |
| 4 | Methods | Add | `toggleShowUnratedOnly()` — flips flag, refreshes list |
| 5 | `updateDisplayedKeywords()` | Modify | Apply unrated filter between view fetch and sort |
| 6 | `loadMore()` | Modify | Apply unrated filter before slicing paginated batch |
| 7 | `setViewMode()` | Modify | Reset `showUnratedOnly = false` before switching view |
| 8 | `hasMoreKeywords` getter | Modify | Compare against filtered count when filter is active |
| 9 | `ngOnInit` | Modify | Subscribe `ratingsSub` to `ratings$` for real-time updates |
| 10 | `ngOnDestroy` | Modify | Unsubscribe `ratingsSub` alongside `analysisSubscription` |

---

## Invariants and Constraints

- **No new services, models, or injection tokens.** All additions use existing `KeywordRatingService` APIs (`getRating`, `ratings$`).
- **Filter order is always: view slice → unrated filter → sort → paginate.** Any deviation breaks the "load more" count and sort correctness.
- **`adjustedScores` is always populated from the unfiltered view.** This prevents stale or missing score lookups when the filter is toggled.
- **`showUnratedOnly` resets to `false` on every `setViewMode()` call**, including when switching between keyword views (not just to/from `blog-topics`). This matches the UX brief requirement.
- **`unratedCount` is computed from `getKeywordsForCurrentView()`**, which means it reflects the current view's population, not all keywords for the domain. This is the specified behaviour per the UX brief section 3.

# UI Design Specification: Unrated Keywords Filter — Competitor Analysis

**Prepared by:** UI Designer
**Date:** 2026-03-07
**Implements:** UX brief `docs/ux-unrated-filter-ca.md`
**Baseline spec:** `docs/ui-unrated-filter.md` (Feature 8 — Dashboard)
**Target file:** `src/app/components/competitor-analysis/competitor-analysis.component`

---

## 1. Placement

The toggle button lives inside `.table-container`, which is the `<div>` at line 353 of the current template. That container already holds `.scroll-hint` as its first child, followed by `.table-scroll-wrapper`.

Insert the unrated toggle as a new sibling **between the opening `<div class="table-container">` tag and the existing `.scroll-hint` div**. This mirrors Feature 8, where the unrated toggle sits directly above the scroll hint and table.

Exact DOM order inside `.table-container` after the change:

```
<div class="table-container" …>
  <!-- NEW: unrated toggle -->
  <div class="unrated-keywords-toggle" …>…</div>

  <!-- EXISTING: scroll hint (unchanged) -->
  <div class="scroll-hint">…</div>

  <!-- EXISTING: table scroll wrapper (unchanged) -->
  <div class="table-scroll-wrapper">…</div>
</div>
```

The button must NOT render when `viewMode === 'blog-topics'` or `!analysisComplete`. Because `.table-container` itself is already gated by `*ngIf="viewMode !== 'blog-topics' && displayedKeywords.length > 0"` (line 357), the blog-topics exclusion is partially handled. However the UX brief also requires suppression when analysis is not complete. Use an explicit `*ngIf` on the wrapper div (see section 2) so the condition is self-documenting and robust against future template restructuring.

---

## 2. HTML Structure — Toggle Button

Add the following block immediately after the opening `<div class="table-container" …>` tag (before the existing `<div class="scroll-hint">`):

```html
<!-- Unrated-only filter toggle -->
<div
  class="unrated-keywords-toggle"
  *ngIf="analysisComplete && viewMode !== 'blog-topics'"
>
  <button
    type="button"
    class="btn-toggle-hidden btn-toggle-unrated"
    [class.unrated-filter-active]="showUnratedOnly"
    [attr.aria-pressed]="showUnratedOnly"
    [attr.aria-label]="showUnratedOnly
      ? 'Stop showing unrated keywords only, ' + unratedCount + ' unrated'
      : 'Show unrated keywords only, ' + unratedCount + ' unrated'"
    (click)="toggleShowUnratedOnly()"
  >
    {{ showUnratedOnly ? 'Showing unrated only (' + unratedCount + ')' : 'Show unrated only (' + unratedCount + ')' }}
  </button>
</div>
```

Key decisions:

- `*ngIf="analysisComplete && viewMode !== 'blog-topics'"` is the authoritative render gate. It combines both exclusion conditions from the UX brief in one place, even though the parent `*ngIf` on `.table-container` already excludes blog-topics — the explicit condition here is defensive and aids readability.
- `btn-toggle-hidden` is the existing base class from the dashboard. It provides text-link styling without duplication.
- `btn-toggle-unrated` is the modifier class that scopes unrated-specific overrides (active fill state). This matches Feature 8 exactly.
- `[class.unrated-filter-active]="showUnratedOnly"` triggers the filled accent pill via CSS.
- `[attr.aria-pressed]` communicates toggle state to assistive technology.
- The label uses present-participle "Showing" in the active state, matching the UX brief.

---

## 3. Completion State — Table Body HTML

When `showUnratedOnly === true` and `unratedCount === 0`, replace the normal `<tbody>` rows with a single spanning completion row.

**Column count analysis:**

The keywords table always has exactly 6 columns across all keyword view modes:

| Column | Opportunities | All / Shared / Unique |
|---|---|---|
| Rating | yes | yes |
| Keyword | yes | yes |
| Volume | yes | yes |
| Difficulty | yes | yes |
| Competitors | yes | yes |
| Opportunity Score | yes (`*ngIf="viewMode === 'opportunities'"`) | no |
| Your Position | no | yes (`*ngIf="viewMode !== 'opportunities'"`) |

The sixth column is always present — it is either "Opportunity Score" (opportunities view) or "Your Position" (all other views). Therefore `colspan="6"` is a fixed value, not dynamic.

Replace the existing `<tbody>` block (lines 418–475 of the current template) with:

```html
<tbody>
  <!-- Completion state: shown when filter is active and all keywords have been rated -->
  <tr
    class="unrated-complete-state"
    *ngIf="showUnratedOnly && unratedCount === 0"
  >
    <td colspan="6">
      <div class="unrated-complete-inner">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3>All keywords rated</h3>
        <p>You have rated every keyword in this view. Toggle off "Showing unrated only" to see the full table.</p>
      </div>
    </td>
  </tr>

  <!-- Normal rows: suppressed while completion state is showing -->
  <tr
    *ngFor="let keyword of displayedKeywords"
    [class.opportunity]="keyword.isOpportunity"
    [hidden]="showUnratedOnly && unratedCount === 0"
  >
    <td class="rating-cell">
      <app-keyword-rating
        [keyword]="keyword.keyword"
        [currentRating]="keywordRatingService.getRating(keyword.keyword)"
        (ratingChanged)="onKeywordRatingChanged(keyword.keyword, $event)"
      ></app-keyword-rating>
    </td>
    <td class="keyword-cell">
      <span class="keyword-text">{{ keyword.keyword }}</span>
      <span class="badge opportunity" *ngIf="keyword.isOpportunity">Opportunity</span>
    </td>
    <td class="volume-cell">{{ keyword.searchVolume | number }}</td>
    <td class="difficulty-cell">
      <div class="difficulty-bar">
        <div
          class="difficulty-fill"
          [style.width.%]="keyword.difficulty"
          [class.easy]="keyword.difficulty < 30"
          [class.medium]="keyword.difficulty >= 30 && keyword.difficulty < 70"
          [class.hard]="keyword.difficulty >= 70"
        ></div>
      </div>
      <span class="difficulty-value">{{ keyword.difficulty }}</span>
    </td>
    <td class="competitor-count-cell">
      <span class="competitor-badge">{{ keyword.competitorCount }}</span>
      <div class="competitor-domains">
        <span *ngFor="let comp of keyword.competitorRankings" class="domain-tag">
          {{ comp.domain }} (#{{ comp.position }})
        </span>
      </div>
    </td>
    <td class="position-cell" *ngIf="viewMode !== 'opportunities'">
      <span
        *ngIf="keyword.userRanking"
        class="position-badge"
        [class.top]="keyword.userRanking.position <= 3"
        [class.good]="keyword.userRanking.position > 3 && keyword.userRanking.position <= 10"
        [class.okay]="keyword.userRanking.position > 10"
      >
        #{{ keyword.userRanking.position }}
      </span>
      <span *ngIf="!keyword.userRanking" class="no-ranking">—</span>
    </td>
    <td class="score-cell" *ngIf="viewMode === 'opportunities'">
      <div
        class="score-badge"
        [class.high]="adjustedScores[keyword.keyword] >= 70"
        [class.medium]="adjustedScores[keyword.keyword] >= 40 && adjustedScores[keyword.keyword] < 70"
        [class.low]="adjustedScores[keyword.keyword] < 40"
      >
        {{ adjustedScores[keyword.keyword] }}
      </div>
    </td>
  </tr>
</tbody>
```

Notes:

- `[hidden]` on normal rows avoids DOM churn as the last unrated keyword is rated; the row disappears via CSS without Angular destroying and recreating the list.
- The completion row body copy says "in this view" (not "for this domain") because the unrated count is per current view, not global — this matches the UX brief distinction in section 3.
- The SVG circle-check path is identical to Feature 8 and is already used in the app's Heroicons outline set.

---

## 4. SCSS Changes

### Global vs. component-scoped styles

The `.btn-toggle-unrated`, `.unrated-filter-active`, and `.unrated-complete-state` rules are **identical** to Feature 8. They should be added to `competitor-analysis.component.scss` as component-scoped styles rather than promoted to a global stylesheet, for two reasons:

1. The dashboard and competitor analysis components are compiled independently. Sharing these rules globally would introduce coupling between two otherwise-independent components.
2. The SCSS variables and mixins are already imported in both component files (`@use 'variables' as *`), so there is no duplication cost for the token references.

If a future design system extraction is desired, the rules below are structured to lift cleanly into a shared partial.

### Rules to add to `competitor-analysis.component.scss`

Add the following block inside the `.results-container .table-container` rule, directly after the closing brace of the `.scroll-hint` rule (after line 207 of the current SCSS):

```scss
// Unrated-only filter toggle
.unrated-keywords-toggle {
  padding: $space-2 $space-4;
  border-bottom: 1px solid $color-border;
  background: $color-bg-page;

  .btn-toggle-unrated {
    // Inherits all properties from .btn-toggle-hidden (text-link style).
    // Active state: filled accent pill.
    &.unrated-filter-active {
      display: inline-flex;
      align-items: center;
      padding: $space-1 $space-3;
      background: $color-primary;
      color: $color-white;
      border-radius: $radius-sm;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        background: darken($color-primary, 8%);
        text-decoration: none;
      }
    }
  }
}
```

Add the following block after the closing brace of `.keywords-table` (after line 380 of the current SCSS), still inside `.results-container .table-container`:

```scss
// Completion state row
.unrated-complete-state {
  td {
    padding: $space-16 $space-8;
    text-align: center;
    border: none;
  }

  .unrated-complete-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-4;
    color: $color-text-mid;

    svg {
      width: 48px;
      height: 48px;
      color: $color-easy; // green success colour already in the palette
    }

    h3 {
      font-size: $font-size-xl;
      color: $color-text-dark;
      margin: 0;
    }

    p {
      font-size: $font-size-sm;
      color: $color-text-muted;
      max-width: 420px;
      margin: 0;
    }
  }
}
```

### Button visual states

| Button state | Visual result |
|---|---|
| Inactive (default) | Inherits `btn-toggle-hidden`: no border, no background, `$color-primary` text, underline on hover |
| Active (`unrated-filter-active`) | Filled `$color-primary` background, white text, `$radius-sm` pill, no underline |
| Active, count reaches 0 | Active pill style with "(0)" label; `<tbody>` shows completion row, normal rows hidden |

---

## 5. Conditional Rendering Rules

| Condition | Result |
|---|---|
| `viewMode === 'blog-topics'` | Button not rendered (`.table-container` itself is hidden; `*ngIf` on wrapper is also false) |
| `!analysisComplete` | Button not rendered (`*ngIf` on wrapper is false) |
| `analysisComplete && viewMode !== 'blog-topics'` | Button rendered; count reflects unrated keywords in current view |
| `showUnratedOnly && unratedCount === 0` | Completion row shown; normal rows hidden via `[hidden]` |
| User switches view mode | `showUnratedOnly` resets to `false` (implemented in controller `setViewMode()`); button reverts to inactive state |

---

## 6. Controller Requirements (developer reference)

These additions are required in `competitor-analysis.component.ts`. This section is informational — the full implementation spec is in the developer's ticket.

| Addition | Type | Notes |
|---|---|---|
| `showUnratedOnly` | `boolean` property | Default `false`; reset to `false` inside `setViewMode()` before updating `viewMode` |
| `unratedCount` | `number` getter or property | Count of keywords in `getKeywordsForCurrentView()` where `keywordRatingService.getRating(k.keyword) === undefined` |
| `toggleShowUnratedOnly()` | method | Flips `showUnratedOnly`; calls `updateDisplayedKeywords()` and `cdr.detectChanges()` |
| `ratings$` subscription | `ngOnInit` | Subscribe to `keywordRatingService.ratings$`; call `updateDisplayedKeywords()` + `cdr.detectChanges()` on each emission so count and filter update in real time as the user rates keywords |
| `updateDisplayedKeywords()` filter | existing method | When `showUnratedOnly === true`, filter the keyword list to only items where `getRating() === undefined` before slicing for pagination |

---

## 7. Responsive Behaviour

`.unrated-keywords-toggle` is a block-level div and stacks naturally above `.scroll-hint` on all viewport sizes. No additional responsive rules are required for the initial implementation.

The mobile breakpoint block at line 423 of the current SCSS (`@media (max-width: $bp-md)`) does not need changes for this feature.

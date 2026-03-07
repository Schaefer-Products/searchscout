# UX Research Brief: Unrated Keywords Filter — Competitor Analysis (Feature 9)

**Baseline:** See /app/docs/ux-unrated-filter.md for the dashboard variant (Feature 8). This brief covers only the differences specific to the competitor analysis context.

---

## Key Differences from Feature 8 (Dashboard)

### 1. View-mode scoping

The competitor analysis has 5 view modes: `opportunities`, `all`, `shared`, `unique`, and `blog-topics`.

- The filter applies to **keyword table views only** (`opportunities`, `all`, `shared`, `unique`)
- The filter **must not appear** in `blog-topics` view — blog topics show generated titles, not rateable keyword rows
- The unrated count is **per current view** (from `getKeywordsForCurrentView()`), not across all views — each view has its own set of keywords

### 2. Filter resets on view-mode switch

When the user switches view modes, reset `showUnratedOnly` to `false`. Rationale:
- Each view (opportunities vs. all vs. shared vs. unique) has a different keyword population
- Preserving an active filter across a view switch would silently reduce results and confuse the user
- The cost of re-activating the filter is low (one click)

### 3. Count behaviour

`unratedCount` = count of keywords in the **current view** with `getRating() === undefined`.
This means the count changes when the user switches view modes — this is expected and correct.

### 4. No ratingsSub subscription exists in this component

Unlike the dashboard, `CompetitorAnalysisComponent` does not currently subscribe to `keywordRatingService.ratings$`. To make the count and filter update in real time as the user rates keywords, a subscription to `ratings$` must be added in `ngOnInit` that calls `updateDisplayedKeywords()` + `cdr.detectChanges()`.

### 5. Completion state

Same as Feature 8: when `showUnratedOnly && unratedCount === 0`, show an "All keywords rated" completion row in the table body. The colspan is variable (competitor analysis has a different column count depending on viewMode).

---

## Interaction Design (same as Feature 8)

- Button: `"Show unrated only (N)"` (inactive) → `"Showing unrated only (N)"` (active)
- Active state: filled accent colour (`#5568d8`, 4.8:1 contrast)
- `aria-pressed`, `focus-visible` outline — same accessibility requirements as Feature 8
- Placement: in the table toolbar, near any existing filter controls (e.g. the show-hidden toggle if present)
- Button not rendered when `viewMode === 'blog-topics'` or analysis not complete

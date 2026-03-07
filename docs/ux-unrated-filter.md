# UX Research Brief: Unrated Keywords Filter (Feature 8)

**Prepared by:** UX Research
**Date:** 2026-03-07
**For:** UI Designer (visual spec) + Frontend Developer (implementation)
**Status:** Ready for design

---

## 1. User Need Analysis

### Who is performing this task

SearchScout's primary user is a small business owner with limited SEO expertise. They are not a professional keyword analyst — they open the tool periodically (weekly or fortnightly) to work through their keyword list and decide which topics are worth writing about. A domain with active SEO history will surface 200–1,000 keywords; even a modest domain returns 100+.

### The core problem

The rating workflow is inherently batch-oriented. A user opening the dashboard after initial onboarding faces the full unfiltered keyword table. After rating a few rows in one session they return later to continue. At that point the table shows rated and unrated keywords interleaved, with no quick way to see what is left to do. The cognitive cost of scanning a mixed list for unrated rows grows linearly with table size and is the primary friction that causes users to abandon the rating workflow mid-way.

### Typical batch-rating workflow

1. User opens dashboard; keyword table loads (e.g. 347 keywords).
2. User works through rows top-to-bottom, assigning emoji ratings.
3. Session ends — perhaps 80 keywords rated, 267 unrated remaining.
4. On return visit, user wants to resume from where they stopped.
5. Without the filter, they must visually scan each row for the absent rating indicator — slow and error-prone.
6. With the filter active, the table immediately shows only the 267 unrated rows; the user resumes without friction.

---

## 2. UX Requirements

| # | Requirement | Rationale |
|---|-------------|-----------|
| R1 | Button is visible once keywords are loaded, regardless of unrated count | Discoverability |
| R2 | Count reflects all loaded keywords across all pagination pages, not just the visible page | A count that jumps when loading more would feel untrustworthy |
| R3 | Count updates in real time as the user rates keywords | Immediate feedback confirms that rating actions are reducing the backlog |
| R4 | Filter persists across sorting and "Load More" operations within the same domain session | The filter is a mode, not a one-shot action |
| R5 | Filter resets when the user analyzes a different domain | State from a previous domain must not contaminate a new context |
| R6 | When unrated count reaches 0 while active, show a positive completion state rather than a silent empty table | Silent empty tables read as errors; a completion message is a micro-reward |
| R7 | Filter is independent of the "Show hidden keywords" toggle; both can be active simultaneously | The two filters serve orthogonal needs |
| R8 | Button does not appear until `hasAnalyzed === true` and `keywords.length > 0` | Avoids layout shift |

---

## 3. Interaction Design Notes

### Toggle states

| State | Visual treatment | Label |
|-------|-----------------|-------|
| Inactive (default) | Neutral/grey outline — same style as the existing "Show hidden keywords" button | "Show unrated only (N)" |
| Active | Filled accent colour to match selected-state conventions elsewhere | "Showing unrated only (N)" |
| Count is 0, inactive | Visible and clickable | "Show unrated only (0)" |
| No keywords loaded | Button not rendered | — |

### Placement

Place the unrated filter button in the same toolbar container as the existing "Show hidden keywords" toggle. Both are table-view modifiers and grouping them reduces the scanning surface. On mobile they should stack vertically.

### Count format

Use an inline parenthetical count in the label — "Show unrated only (27)" — matching the "Show hidden keywords (N)" pattern already in the codebase.

---

## 4. Edge Cases

### 4a. unratedCount reaches 0 while the filter is active

Do not auto-deactivate the filter or show a silent empty table. Replace the table body with a completion state:
- Icon: SVG checkmark
- Heading: "All keywords rated"
- Body: "You have rated every keyword for this domain. Toggle off 'Showing unrated only' to see the full table."

### 4b. No keywords loaded yet

Do not render the button when `hasAnalyzed` is false or `keywords.length === 0`.

### 4c. Filter active and user clicks "Load more"

Pagination appends the next page of the already-filtered list. The count in the button label is derived from `this.keywords` (the full sorted array), not the paginated slice.

### 4d. Domain switch while filter is active

Reset `showUnratedOnly` to `false` in the same domain-switch block as `showHidden` (inside `analyzeDomain()` when `isDifferentDomain === true`).

---

## 5. Button Label Recommendation

**Recommended: "Show unrated only (N)" (inactive) / "Showing unrated only (N)" (active)**

Matches the lowercase style of the existing "Show hidden keywords (N)" button. The present-participle active label clearly communicates the current mode.

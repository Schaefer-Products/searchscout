# UI Design Spec: Opportunity Score Explanation Tooltip

**Date:** 2026-03-07
**Author:** UI Designer
**For:** Frontend Developer
**Source brief:** `docs/ux-opportunity-score-explanation.md`

---

## 1. Component Decision

**Decision: Inline within `competitor-analysis.component` — do not create a standalone component.**

Rationale:

- The ℹ tooltip is needed in exactly one place in the entire application: the "Opportunity Score" column header in the opportunities view. The UX brief explicitly states no tooltip is needed on individual score badges.
- A standalone `InfoTooltipComponent` would add a file, a selector, an `@Input` surface, and a host-listener boundary for a single usage. That overhead is not justified.
- The `@HostListener` for Escape key and the click-outside handler belong naturally to the parent component, which already manages `viewMode`, sort state, and other UI toggles. Keeping tooltip state colocated avoids cross-component event coordination.
- If a second usage ever emerges, extracting to a standalone component is a straightforward refactor.

---

## 2. TypeScript — Component Changes

Add to `CompetitorAnalysisComponent` class (no new files):

```typescript
// Add to imports at top of file
import { HostListener } from '@angular/core';

// Property — add alongside other UI state properties
tooltipOpen = false;
readonly tooltipId = 'opportunity-score-tooltip';

// Methods
toggleTooltip(event: MouseEvent): void {
  event.stopPropagation();
  this.tooltipOpen = !this.tooltipOpen;
}

@HostListener('document:keydown.escape')
closeTooltip(): void {
  this.tooltipOpen = false;
}

@HostListener('document:click')
closeTooltipOnOutsideClick(): void {
  // Closes whenever a click reaches the document (i.e., not stopped by toggleTooltip)
  this.tooltipOpen = false;
}
```

---

## 3. HTML Structure

### Exact Location in Template

The target `<th>` is at lines 421–429 of the current template (the `opportunityScore` sort header, inside `*ngIf="viewMode === 'opportunities'"`):

```html
<!-- BEFORE (current) -->
<th
  scope="col"
  class="sortable"
  [attr.aria-sort]="sortColumn === 'opportunityScore' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
  *ngIf="viewMode === 'opportunities'"
>
  <button type="button" (click)="sortBy('opportunityScore')">
    Opportunity Score <span aria-hidden="true">{{ getSortIcon("opportunityScore") }}</span>
  </button>
</th>
```

```html
<!-- AFTER (replace the entire <th> block) -->
<th
  scope="col"
  class="sortable opportunity-score-th"
  [attr.aria-sort]="sortColumn === 'opportunityScore' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
  [attr.aria-describedby]="tooltipId"
  *ngIf="viewMode === 'opportunities'"
>
  <div class="th-inner">
    <button type="button" (click)="sortBy('opportunityScore')">
      Opportunity Score <span aria-hidden="true">{{ getSortIcon("opportunityScore") }}</span>
    </button>
    <button
      type="button"
      class="info-icon-btn"
      [attr.aria-expanded]="tooltipOpen"
      [attr.aria-controls]="tooltipId"
      aria-label="What is Opportunity Score?"
      (click)="toggleTooltip($event)"
    >
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
    </button>
    <div
      class="info-tooltip"
      role="tooltip"
      [id]="tooltipId"
      [class.visible]="tooltipOpen"
    >
      <p class="info-tooltip__title">Opportunity Score</p>
      <p class="info-tooltip__body">A 0–100 score ranking how worthwhile this keyword is to target.</p>
      <p class="info-tooltip__subheading">How it's calculated:</p>
      <ul class="info-tooltip__list">
        <li><strong>Search volume (40%)</strong> — more monthly searches = higher score</li>
        <li><strong>Keyword difficulty (40%)</strong> — easier to rank = higher score</li>
        <li><strong>Competitor validation (20%)</strong> — more competitors ranking = more validated demand</li>
      </ul>
      <div class="info-tooltip__score-guide">
        <span class="score-chip high">70–100</span><span class="score-chip__label">Strong</span>
        <span class="score-chip medium">40–69</span><span class="score-chip__label">Moderate</span>
        <span class="score-chip low">0–39</span><span class="score-chip__label">Weak</span>
      </div>
    </div>
  </div>
</th>
```

### Structural Notes

- `.th-inner` is a flex wrapper that sits between the `<th>` and its two buttons. This is necessary because the existing `<th> button` reset styles (`background: none`, `width: 100%`) apply to all direct-child buttons via the existing SCSS rule at line 279. `.th-inner` isolates the sort button and info button side-by-side without fighting the existing reset.
- `[attr.aria-describedby]="tooltipId"` on the `<th>` connects the column header to the tooltip for screen readers regardless of open state (tooltip stays in DOM).
- `[attr.aria-expanded]` on the info button communicates open/closed state to assistive technology.
- `aria-label="What is Opportunity Score?"` gives the icon button a clear accessible name.

---

## 4. SCSS

Add the following block to the bottom of `competitor-analysis.component.scss`, after the existing `.blog-topics-container` block:

```scss
// Opportunity Score column — tooltip
.opportunity-score-th {
  position: relative; // establishes containing block for absolute tooltip

  .th-inner {
    display: flex;
    align-items: center;
    gap: $space-2;
    // The sort button keeps width: 100% from the th button reset, so we
    // override it here to let it shrink to its natural content width.
    > button:first-child {
      width: auto;
    }
  }
}

.info-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  border-radius: $radius-xs;
  color: $color-text-muted;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
  transition: color 0.15s;

  // Override the th button reset (width: 100%) for this button specifically
  width: auto;

  &:hover {
    color: $color-primary;
  }

  &:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: 2px;
    color: $color-primary;
  }
}

.info-tooltip {
  // Hidden state — kept in DOM for screen readers
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, visibility 0s linear 0.15s;

  // Positioning
  position: absolute;
  top: calc(100% + 6px); // 6px gap below the th bottom edge
  left: 0;
  z-index: 200; // above tbody rows (no stacking context on tr/td)

  // Sizing and appearance
  width: 280px;
  max-width: 280px;
  background: $color-white;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-hover-card;
  padding: $space-4;
  font-size: $font-size-xs;
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  color: $color-text-body;
  white-space: normal;
  cursor: default;

  // Visible state
  &.visible {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.15s ease, visibility 0s linear 0s;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: 700;
    color: $color-text-dark;
    margin: 0 0 $space-2 0;
  }

  &__body {
    margin: 0 0 $space-3 0;
    line-height: 1.5;
  }

  &__subheading {
    font-weight: 600;
    color: $color-text-dark;
    margin: 0 0 $space-1 0;
  }

  &__list {
    margin: 0 0 $space-3 $space-4;
    padding: 0;
    list-style: disc;
    line-height: 1.6;

    li {
      margin-bottom: $space-1;
    }
  }

  &__score-guide {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: $space-1 $space-2;
    padding-top: $space-3;
    border-top: 1px solid $color-border;
  }
}

// Score chips within the tooltip — reuse existing colour semantics
.score-chip {
  display: inline-block;
  padding: $space-1 $space-2;
  border-radius: $radius-xs;
  font-weight: 700;
  font-size: $font-size-xs;

  &.high   { background: $color-easy;     color: $color-white; }
  &.medium { background: $color-medium;   color: $color-white; }
  &.low    { background: $color-bg-subtle; color: $color-text-body; }

  &__label {
    font-size: $font-size-xs;
    color: $color-text-mid;
    margin-right: $space-2;
  }
}

// Mobile: ensure tooltip doesn't overflow viewport on narrow screens
@media (max-width: $bp-md) {
  .info-tooltip {
    // Shift left so it doesn't clip off the right edge when the table scrolls
    left: auto;
    right: 0;
    // Allow vertical scroll if content is taller than viewport space
    max-height: 60vh;
    overflow-y: auto;
  }
}
```

---

## 5. Interaction Specification

| Trigger | Behaviour |
|---|---|
| Click info button | Toggle `tooltipOpen` true/false; `stopPropagation()` prevents the document click handler from immediately closing it |
| Click anywhere outside | `@HostListener('document:click')` sets `tooltipOpen = false` |
| Escape key | `@HostListener('document:keydown.escape')` sets `tooltipOpen = false` |
| Hover / focus (desktop) | No hover-only trigger — click-toggle only, consistent with mobile. The UX brief allows hover; this spec uses click-toggle on all breakpoints for simplicity and to avoid dual-state complexity. If hover is added later, use CSS `:hover` on `.opportunity-score-th` to add `visibility: visible; opacity: 1` to `.info-tooltip` without JS. |
| Tab / focus navigation | The info button is naturally in tab order. Focus does not open the tooltip; the user must press Enter/Space (standard button activation). |
| Screen reader | `aria-describedby` on `<th>` causes the tooltip text to be read as part of the column header announcement. `aria-expanded` on the button reflects state. `role="tooltip"` identifies the popup semantically. |

---

## 6. Design Tokens Referenced

All tokens come from the existing SCSS variables file (`_variables.scss`) already imported via `@use 'variables' as *`:

| Token | Usage |
|---|---|
| `$color-text-muted` | Default info icon colour |
| `$color-primary` | Hover/focus colour for icon button; focus ring |
| `$color-white` | Tooltip background |
| `$color-border` | Tooltip border and score guide divider |
| `$shadow-hover-card` | Tooltip drop shadow |
| `$color-text-dark` | Tooltip title and subheading |
| `$color-text-body` | Tooltip body text |
| `$color-text-mid` | Score chip labels |
| `$color-easy` | High score chip background (green) |
| `$color-medium` | Moderate score chip background (amber) |
| `$color-bg-subtle` | Weak score chip background |
| `$radius-md`, `$radius-xs` | Border radii |
| `$space-1` through `$space-4` | Internal spacing |
| `$font-size-xs`, `$font-size-sm` | Tooltip typography |
| `$bp-md` | Mobile breakpoint for tooltip repositioning |

---

## 7. Accessibility Checklist

- [ ] `<button type="button">` — not a submit button, keyboard activatable
- [ ] `aria-label="What is Opportunity Score?"` — descriptive name for icon-only button
- [ ] `aria-expanded` reflects open state
- [ ] `aria-controls` points to tooltip `id`
- [ ] `role="tooltip"` on the popup element
- [ ] `[attr.aria-describedby]` on `<th>` — tooltip content announced with column header
- [ ] Tooltip stays in DOM when hidden (visibility/opacity, not `*ngIf`) — screen readers can find it
- [ ] Escape closes tooltip — WCAG 2.1 SC 1.4.13 (Content on Hover or Focus)
- [ ] Focus ring visible on info button (`:focus-visible` outline)
- [ ] Colour is not the only differentiator in the score guide — text labels accompany each chip

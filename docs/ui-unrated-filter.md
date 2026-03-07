# UI Design Specification: Unrated Keywords Filter

**Prepared by:** UI Designer
**Date:** 2026-03-07
**Implements:** UX brief `docs/ux-unrated-filter.md`
**Target file:** `src/app/components/dashboard/dashboard.component`

---

## 1. Component Structure — Toggle Button HTML

The new button follows the exact structural pattern of the existing `hidden-keywords-toggle` block. Place it immediately after the `hidden-keywords-toggle` div (line 179 in the current template). It uses its own wrapper div so the two toggles are independent siblings sharing the same toolbar strip.

```html
<!-- Unrated-only filter toggle -->
<div
  class="unrated-keywords-toggle"
  *ngIf="hasAnalyzed && keywords.length > 0"
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
- `*ngIf="hasAnalyzed && keywords.length > 0"` satisfies requirements R1 and R8 — button is only rendered after analysis completes with results.
- `[class.unrated-filter-active]="showUnratedOnly"` drives the filled/active visual state via a single modifier class.
- `[attr.aria-pressed]` communicates toggle state to assistive technology without additional ARIA roles.
- The label uses present-participle "Showing" in the active state, matching the UX brief recommendation exactly.
- `btn-toggle-hidden` is retained as a base class so the button inherits all existing text-link styling without duplication.

---

## 2. CSS Class Names

| Class | Element | Purpose |
|---|---|---|
| `unrated-keywords-toggle` | wrapper `<div>` | Scoping container; mirrors `.hidden-keywords-toggle` |
| `btn-toggle-unrated` | `<button>` | Modifier on top of `btn-toggle-hidden`; adds unrated-specific overrides |
| `unrated-filter-active` | `<button>` | Applied when `showUnratedOnly === true`; triggers filled accent style |
| `unrated-complete-state` | `<tr>` inside `<tbody>` | Full-width completion row shown when `unratedCount === 0` and `showUnratedOnly === true` |

No new base classes. `btn-toggle-hidden` remains the shared base for both toggle buttons.

---

## 3. SCSS Rules

Add the following block inside `.table-container` in `dashboard.component.scss`, directly after the closing brace of the `.hidden-keywords-toggle` rule (after line 221):

```scss
// Unrated-only filter toggle
.unrated-keywords-toggle {
  padding: $space-2 $space-4;
  border-bottom: 1px solid $color-border;
  background: $color-bg-page;

  // When both toggles are visible, collapse the top border of this one
  // so adjacent siblings share a single divider line.
  .hidden-keywords-toggle + & {
    border-top: none;
  }

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

// Completion state row (rendered inside <tbody> when unratedCount === 0 and showUnratedOnly === true)
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

State summary:

| Button state | Visual result |
|---|---|
| Inactive (default) | Inherits `btn-toggle-hidden`: no border, no background, `$color-primary` text, underline on hover |
| Active (`unrated-filter-active`) | Filled `$color-primary` background, white text, `$radius-sm` pill, no underline |
| Count is 0, inactive | Identical to inactive — "Show unrated only (0)" — fully clickable |
| Count is 0, active | Active pill style with "(0)" label; table body replaced by completion state |

---

## 4. Placement Specification

Exact insertion point in `dashboard.component.html`:

```
[line 159]  <div class="table-container">
[line 161]    <!-- Rating hint row -->
              <div class="rating-hint rating-hint-row" ...>
              </div>

[line 170]    <!-- Show-hidden toggle -->
              <div class="hidden-keywords-toggle" ...>
              </div>

              <!-- INSERT HERE -->
              <div class="unrated-keywords-toggle" ...>   ← new block
              </div>

[line 182]    <!-- Scroll hint -->
              <div class="scroll-hint" ...>
              </div>

[line 188]    <table class="keywords-table">
```

Rationale: Both filter toggles are logically paired table-view modifiers. Placing the unrated toggle immediately below the hidden-keywords toggle groups them visually without separator whitespace. The scroll hint and table follow beneath both.

---

## 5. Empty / Completion State HTML

When `showUnratedOnly === true` and `unratedCount === 0`, replace the normal `<tbody>` rows with a single spanning row. The Angular condition sits on a `<ng-container>` wrapping the `*ngFor` and on an additional `<tr>`:

```html
<tbody>
  <!-- Completion state: shown when filter is active and no unrated keywords remain -->
  <tr
    class="unrated-complete-state"
    *ngIf="showUnratedOnly && unratedCount === 0"
  >
    <td [attr.colspan]="keywords[0]?.etv ? 6 : 5">
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
        <p>You have rated every keyword for this domain. Toggle off "Showing unrated only" to see the full table.</p>
      </div>
    </td>
  </tr>

  <!-- Normal rows: hidden while completion state is showing -->
  <tr
    *ngFor="let keyword of displayedKeywords"
    [class.top-position]="keyword.position <= 3"
    [class.first-page]="keyword.position > 3 && keyword.position <= 10"
    [class.keyword-hidden]="keywordRatingService.getRating(keyword.keyword) === 0"
    [hidden]="showUnratedOnly && unratedCount === 0"
  >
    <!-- existing <td> cells unchanged -->
  </tr>
</tbody>
```

Notes:
- `colspan` is dynamic: 6 columns when `etv` data is present (matching the existing `*ngIf="keywords[0]?.etv"` guard on the ETV header), otherwise 5.
- `[hidden]` on normal rows instead of `*ngIf` avoids DOM thrash during the transition from N unrated to 0 unrated.
- The SVG uses the circle-check path (`M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z`) from the Heroicons outline set already used throughout the app.
- Body text matches the UX brief verbatim.

---

## 6. Responsive Behaviour

### Mobile breakpoint: `max-width: $bp-md`

The two toggle wrappers (`hidden-keywords-toggle` and `unrated-keywords-toggle`) are already block-level divs that stack naturally. No additional layout change is required for the basic stacking behaviour.

Add the following inside the existing `@media (max-width: $bp-md)` block in `dashboard.component.scss` (after line 468):

```scss
.unrated-keywords-toggle {
  // Inherits block stacking from the div. No extra rules needed
  // unless a future design calls for full-width buttons on mobile.
}
```

If full-width pill buttons on mobile are desired in a future iteration, add:

```scss
@media (max-width: $bp-md) {
  .unrated-keywords-toggle .btn-toggle-unrated.unrated-filter-active {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}
```

This is not required for the initial implementation but is noted here for reference.

### Toolbar visual order on mobile (top to bottom)

1. Rating hint row (when visible)
2. Show hidden keywords toggle (when `hiddenCount > 0` or `showHidden`)
3. Show unrated only toggle (when `hasAnalyzed && keywords.length > 0`)
4. Scroll hint
5. Table

No reordering logic is needed — natural DOM order matches the correct mobile stack.

---

## 7. Component Controller Requirements (for developer reference)

The template bindings above require these additions to `dashboard.component.ts`. This section is informational only — the full implementation spec is in the developer's ticket.

| Addition | Type | Notes |
|---|---|---|
| `showUnratedOnly` | `boolean` property | Default `false`; reset to `false` in domain-switch branch of `analyzeDomain()` alongside `showHidden` |
| `unratedCount` | `number` getter | Derived from `this.keywords` filtered by `keywordRatingService.getRating(k) === null \|\| getRating(k) === undefined` — counts across full keyword array, not paginated slice (R2) |
| `toggleShowUnratedOnly()` | method | Flips `showUnratedOnly`; triggers `detectChanges()` |
| `filteredKeywords` pipe | existing | Must incorporate `showUnratedOnly` filter in addition to existing `showHidden` logic (R7 — both filters independent and composable) |

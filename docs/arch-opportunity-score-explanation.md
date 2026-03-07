# Architecture Spec: Opportunity Score Explanation Tooltip

**Date:** 2026-03-07
**Author:** Angular Architect
**Implements:** `docs/ui-opportunity-score-explanation.md`
**Target implementer:** typescript-pro

---

## 1. Scope

All changes are confined to one component:

```
src/app/components/competitor-analysis/
  competitor-analysis.component.ts    ← TypeScript changes
  competitor-analysis.component.html  ← Template changes (delegated to UI spec)
  competitor-analysis.component.scss  ← SCSS changes (delegated to UI spec)
```

No new services, models, child components, or injection tokens are required.

---

## 2. ElementRef — Confirmation

**`ElementRef` is NOT currently injected** in `CompetitorAnalysisComponent`.

Current injections (lines 29–33 of the component):

```typescript
private analysisService = inject(CompetitorAnalysisService);
private blogTopicService = inject(BlogTopicGeneratorService);
private exportService = inject(ExportService);
keywordRatingService = inject(KeywordRatingService);
private cdr = inject(ChangeDetectorRef);
```

`ElementRef` must be added. See Section 4 for exact placement.

---

## 3. Click-Outside Strategy — Design Decision

The task brief specifies an `ElementRef` containment check for the click-outside handler. The UI spec (`docs/ui-opportunity-score-explanation.md`, Section 2) uses a simpler alternative: a bare `@HostListener('document:click')` that always closes the tooltip, relying on `stopPropagation()` inside `toggleTooltip()` to prevent the document handler from firing on the same click that opens it.

**This spec adopts the `ElementRef` containment approach** as requested in the task brief. This is more robust: it does not rely on event propagation order and handles edge cases such as clicks inside the tooltip content itself (which should not close it).

The containment check targets `.info-tooltip-wrapper` — the wrapper `<div>` that must wrap both the info button and the tooltip `<div>` in the template (see Section 6).

---

## 4. TypeScript Changes — Exact Diff

### 4.1 Import line (line 1)

**Before:**
```typescript
import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
```

**After:**
```typescript
import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
```

Added: `HostListener`, `ElementRef`.

### 4.2 New injection — add after `private cdr` (after line 33)

```typescript
private elementRef = inject(ElementRef);
```

Placement: immediately after `private cdr = inject(ChangeDetectorRef);`, keeping all injections grouped together at the top of the class body.

### 4.3 New state property — add in the "Display state" block (after line 50)

```typescript
// Tooltip state
tooltipOpen: boolean = false;
readonly tooltipId = 'opportunity-score-tooltip';
```

Placement: after `showUnratedOnly: boolean = false;` (line 50), inside the `// Display state` group. `tooltipId` is `readonly` because it is a static string used for `aria-controls` / `[id]` binding.

### 4.4 New methods — add after `getSortIcon()` (after line 285)

Add the following three members in this order, as a self-contained "Tooltip" section:

```typescript
// --- Tooltip ---

toggleTooltip(): void {
  this.tooltipOpen = !this.tooltipOpen;
  this.cdr.detectChanges();
}

closeTooltip(): void {
  this.tooltipOpen = false;
  this.cdr.detectChanges();
}

@HostListener('document:keydown.escape')
onEscapeKey(): void {
  this.closeTooltip();
}

@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  const wrapper = this.elementRef.nativeElement.querySelector('.info-tooltip-wrapper');
  if (wrapper && !wrapper.contains(event.target as Node)) {
    this.closeTooltip();
  }
}
```

**Notes on method design:**

- `toggleTooltip()` takes no arguments. `stopPropagation()` is called in the template binding (see Section 6), not inside the method, keeping the method pure and unit-testable without a MouseEvent mock.
- `closeTooltip()` is the single source of truth for closing. Both `@HostListener` methods delegate to it so there is exactly one call to `cdr.detectChanges()` per close.
- `onEscapeKey` is the `@HostListener` method name (not `closeTooltip`) so that the decorator and the delegated method remain distinct — this avoids Angular applying the host listener to `closeTooltip` itself if it were ever called `closeTooltip`.
- `onDocumentClick` checks containment against `.info-tooltip-wrapper`. If the tooltip is already closed, `closeTooltip()` still runs but is effectively a no-op (sets `false` to `false` and calls `detectChanges()`). This is acceptable; adding a guard (`if (!this.tooltipOpen) return;`) inside `closeTooltip()` is an optional micro-optimisation the implementer may add.
- `querySelector('.info-tooltip-wrapper')` returns `null` safely if the template element is absent (e.g. during server-side rendering or before view init); the `wrapper &&` guard handles that.

---

## 5. Complete Injection Block (final state for implementer reference)

```typescript
private analysisService = inject(CompetitorAnalysisService);
private blogTopicService = inject(BlogTopicGeneratorService);
private exportService = inject(ExportService);
keywordRatingService = inject(KeywordRatingService);
private cdr = inject(ChangeDetectorRef);
private elementRef = inject(ElementRef);
```

---

## 6. Template Binding Summary

Refer to `docs/ui-opportunity-score-explanation.md` Section 3 for the full HTML block. The following bindings must match the TypeScript exactly:

| Template expression | Connects to |
|---|---|
| `(click)="toggleTooltip(); $event.stopPropagation()"` | info `<button>` click handler |
| `[attr.aria-expanded]="tooltipOpen"` | info `<button>` ARIA state |
| `[attr.aria-controls]="tooltipId"` | info `<button>` ARIA relationship |
| `[id]="tooltipId"` | tooltip `<div>` id |
| `[class.visible]="tooltipOpen"` | tooltip `<div>` visibility class |
| `role="tooltip"` | tooltip `<div>` ARIA role |

The wrapper element used by the click-outside containment check must have class `info-tooltip-wrapper` and must enclose both the info button and the tooltip `<div>`. Example structure:

```html
<div class="info-tooltip-wrapper">
  <button type="button" class="info-icon-btn"
    [attr.aria-expanded]="tooltipOpen"
    [attr.aria-controls]="tooltipId"
    aria-label="What is Opportunity Score?"
    (click)="toggleTooltip(); $event.stopPropagation()"
  >
    <!-- SVG icon -->
  </button>
  <div class="info-tooltip"
    role="tooltip"
    [id]="tooltipId"
    [class.visible]="tooltipOpen"
  >
    <!-- tooltip content -->
  </div>
</div>
```

Note: The UI spec wraps using a `.th-inner` flex container. The `.info-tooltip-wrapper` div should be nested inside `.th-inner`, wrapping only the info button and tooltip (not the sort button), so the containment check is tight. Alternatively, `.th-inner` itself may serve as the wrapper if it is given the class `info-tooltip-wrapper` — either approach satisfies the containment check.

---

## 7. SCSS Changes

Fully specified in `docs/ui-opportunity-score-explanation.md` Section 4. No further architectural decisions required. The new SCSS block appends to the bottom of `competitor-analysis.component.scss` after `.blog-topics-container`.

---

## 8. No NgModule / Import Array Changes Required

`HostListener` and `ElementRef` are Angular core symbols — they do not appear in the component `imports: []` array. The `imports` array in the `@Component` decorator (CommonModule, FormsModule, KeywordRatingComponent, BlogTopicsStaleBannerComponent) is unchanged.

---

## 9. Change Detection Strategy Note

The component currently uses the default `ChangeDetectionStrategy` (not `OnPush`). All existing async operations already call `cdr.detectChanges()` explicitly. The new tooltip methods follow the same pattern — each calls `cdr.detectChanges()` after mutating `tooltipOpen`. No strategy migration is needed for this feature.

---

## 10. Unit Test Surface (for QA reference)

The following new behaviours require test coverage:

| Behaviour | Test approach |
|---|---|
| `toggleTooltip()` flips `tooltipOpen` true then false | Direct method call; assert property value |
| `closeTooltip()` sets `tooltipOpen = false` | Direct method call |
| Escape key calls `closeTooltip()` | Dispatch `keydown.escape` on `document`; assert `tooltipOpen` false |
| Click inside wrapper does NOT close | Dispatch click on wrapper child; assert `tooltipOpen` unchanged |
| Click outside wrapper closes | Dispatch click on `document.body`; assert `tooltipOpen` false |
| `cdr.detectChanges()` called on close | Spy on `cdr.detectChanges` |

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

import { KeywordRatingComponent } from './keyword-rating.component';

// ─── Type definitions mirrored from the feature spec ─────────────────────────

type RatingValue = 0 | 1 | 2 | 3 | 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retrieve all rating buttons from the fixture. */
function getRatingButtons(fixture: ComponentFixture<KeywordRatingComponent>): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('button[data-rating], button.rating-btn')
  ) as HTMLButtonElement[];
}

/** Click the button associated with a given rating value. */
function clickRatingButton(
  fixture: ComponentFixture<KeywordRatingComponent>,
  rating: RatingValue
): void {
  const buttons = getRatingButtons(fixture);
  // The component renders 5 buttons (ratings 0–4 in order)
  const btn = buttons[rating] as HTMLButtonElement;
  btn.click();
  fixture.detectChanges();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('KeywordRatingComponent', () => {
  let component: KeywordRatingComponent;
  let fixture: ComponentFixture<KeywordRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeywordRatingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(KeywordRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Rendering — button count
  // ---------------------------------------------------------------------------

  describe('rendering', () => {
    it('should render exactly 5 rating buttons', () => {
      const buttons = getRatingButtons(fixture);
      expect(buttons.length).toBe(5);
    });

    it('should render emoji content inside each button', () => {
      const buttons = getRatingButtons(fixture);
      buttons.forEach(btn => {
        expect(btn.textContent?.trim().length).toBeGreaterThan(0);
      });
    });

    it('should give the first button (rating 0) the rating-btn--hide class', () => {
      const buttons = getRatingButtons(fixture);
      expect(buttons[0].classList).toContain('rating-btn--hide');
    });

    it('should NOT give the non-hide buttons the rating-btn--hide class', () => {
      const buttons = getRatingButtons(fixture);
      [1, 2, 3, 4].forEach(i => {
        expect(buttons[i].classList).not.toContain('rating-btn--hide');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // No rating selected — neutral state
  // ---------------------------------------------------------------------------

  describe('when no rating is selected (currentRating is undefined)', () => {
    beforeEach(() => {
      component.currentRating = undefined;
      fixture.detectChanges();
    });

    it('should not apply is-selected to any button', () => {
      const buttons = getRatingButtons(fixture);
      buttons.forEach(btn => {
        expect(btn.classList).not.toContain('is-selected');
      });
    });

    it('should not apply is-not-selected to any button', () => {
      const buttons = getRatingButtons(fixture);
      buttons.forEach(btn => {
        expect(btn.classList).not.toContain('is-not-selected');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Selected state styling
  // ---------------------------------------------------------------------------

  describe('when a rating is selected', () => {
    beforeEach(() => {
      component.currentRating = 2;
      fixture.detectChanges();
    });

    it('should apply is-selected to the button whose rating matches currentRating', () => {
      const buttons = getRatingButtons(fixture);
      expect(buttons[2].classList).toContain('is-selected');
    });

    it('should apply is-not-selected to every button that is not the selected one', () => {
      const buttons = getRatingButtons(fixture);
      [0, 1, 3, 4].forEach(i => {
        expect(buttons[i].classList).toContain('is-not-selected');
      });
    });

    it('should NOT apply is-selected to unselected buttons', () => {
      const buttons = getRatingButtons(fixture);
      [0, 1, 3, 4].forEach(i => {
        expect(buttons[i].classList).not.toContain('is-selected');
      });
    });

    it('should NOT apply is-not-selected to the selected button', () => {
      const buttons = getRatingButtons(fixture);
      expect(buttons[2].classList).not.toContain('is-not-selected');
    });
  });

  // ---------------------------------------------------------------------------
  // Selected state for each rating value (boundary conditions)
  // ---------------------------------------------------------------------------

  describe('is-selected applied correctly for each rating value', () => {
    ([0, 1, 2, 3, 4] as RatingValue[]).forEach((rating) => {
      it(`should mark button index ${rating} as is-selected when currentRating is ${rating}`, () => {
        component.currentRating = rating;
        fixture.detectChanges();
        const buttons = getRatingButtons(fixture);
        expect(buttons[rating].classList).toContain('is-selected');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // ratingChanged output — clicking a new button
  // ---------------------------------------------------------------------------

  describe('ratingChanged output — clicking a button that is not selected', () => {
    it('should emit 0 when the first (hide) button is clicked and nothing is selected', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emitted: any = null;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 0);

      expect(emitted).toBe(0 as RatingValue);
    });

    it('should emit 1 when the rating-1 button is clicked', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emitted: any = null;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 1);

      expect(emitted).toBe(1 as RatingValue);
    });

    it('should emit 2 when the rating-2 button is clicked', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emitted: any = null;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 2);

      expect(emitted).toBe(2 as RatingValue);
    });

    it('should emit 3 when the rating-3 button is clicked', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emitted: any = null;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 3);

      expect(emitted).toBe(3 as RatingValue);
    });

    it('should emit 4 when the rating-4 button is clicked', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emitted: any = null;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 4);

      expect(emitted).toBe(4 as RatingValue);
    });
  });

  // ---------------------------------------------------------------------------
  // ratingChanged output — clicking the already-selected button (toggle off)
  // ---------------------------------------------------------------------------

  describe('ratingChanged output — clicking the currently selected button (clear)', () => {
    it('should emit undefined when clicking the already-selected button (rating 1)', () => {
      component.currentRating = 1;
      fixture.detectChanges();

      let emitted: RatingValue | undefined | null = 999 as any;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 1);

      expect(emitted).toBeUndefined();
    });

    it('should emit undefined when clicking the already-selected button (rating 2)', () => {
      component.currentRating = 2;
      fixture.detectChanges();

      let emitted: RatingValue | undefined | null = 999 as any;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 2);

      expect(emitted).toBeUndefined();
    });

    it('should emit undefined when clicking the already-selected button (rating 3)', () => {
      component.currentRating = 3;
      fixture.detectChanges();

      let emitted: RatingValue | undefined | null = 999 as any;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 3);

      expect(emitted).toBeUndefined();
    });

    it('should emit undefined when clicking the already-selected button (rating 4)', () => {
      component.currentRating = 4;
      fixture.detectChanges();

      let emitted: RatingValue | undefined | null = 999 as any;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 4);

      expect(emitted).toBeUndefined();
    });

    it('should emit undefined when clicking the already-selected hide button (rating 0)', () => {
      component.currentRating = 0;
      fixture.detectChanges();

      let emitted: RatingValue | undefined | null = 999 as any;
      component.ratingChanged.subscribe((v: RatingValue | undefined) => (emitted = v));

      clickRatingButton(fixture, 0);

      expect(emitted).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Output event emission count
  // ---------------------------------------------------------------------------

  describe('ratingChanged output — emission count', () => {
    it('should emit exactly once per button click', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      let count = 0;
      component.ratingChanged.subscribe(() => count++);

      clickRatingButton(fixture, 2);

      expect(count).toBe(1);
    });

    it('should not emit when no interaction occurs', () => {
      component.currentRating = undefined;
      fixture.detectChanges();

      let count = 0;
      component.ratingChanged.subscribe(() => count++);

      expect(count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Input binding reactivity
  // ---------------------------------------------------------------------------

  describe('currentRating input reactivity', () => {
    it('should update styling when currentRating input changes from 1 to 3', () => {
      component.currentRating = 1;
      fixture.detectChanges();

      component.currentRating = 3;
      fixture.detectChanges();

      const buttons = getRatingButtons(fixture);
      expect(buttons[3].classList).toContain('is-selected');
      expect(buttons[1].classList).toContain('is-not-selected');
    });

    it('should remove is-selected from all buttons when currentRating changes to undefined', () => {
      component.currentRating = 2;
      fixture.detectChanges();

      component.currentRating = undefined;
      fixture.detectChanges();

      const buttons = getRatingButtons(fixture);
      buttons.forEach(btn => {
        expect(btn.classList).not.toContain('is-selected');
      });
    });
  });
});

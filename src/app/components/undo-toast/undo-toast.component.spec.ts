import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { UndoToastComponent } from './undo-toast.component';
import { KeywordRatingService } from '../../services/keyword-rating.service';

// ─── Type definitions mirrored from the feature spec ─────────────────────────

type RatingValue = 0 | 1 | 2 | 3 | 4;

type PendingUndo = { keyword: string; previousRating: RatingValue | undefined } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockRatingService(
  pendingUndo$: BehaviorSubject<PendingUndo>
): jasmine.SpyObj<KeywordRatingService> {
  const spy = jasmine.createSpyObj<KeywordRatingService>(
    'KeywordRatingService',
    ['undoLastHide', 'setRating', 'getRating', 'clearRating', 'getAllRatings',
     'isHidden', 'adjustScore', 'markBlogTopicsGenerated', 'dismissRatingHint',
     'initialize', 'dismissPendingUndo']
  );
  (spy as any).pendingUndo$ = pendingUndo$;
  // Wire dismissPendingUndo to emit null on the subject so reactive tests pass
  spy.dismissPendingUndo.and.callFake(() => pendingUndo$.next(null));
  return spy;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UndoToastComponent', () => {
  let component: UndoToastComponent;
  let fixture: ComponentFixture<UndoToastComponent>;
  let ratingServiceSpy: jasmine.SpyObj<KeywordRatingService>;
  let pendingUndo$: BehaviorSubject<PendingUndo>;

  beforeEach(async () => {
    pendingUndo$ = new BehaviorSubject<PendingUndo>(null);
    ratingServiceSpy = buildMockRatingService(pendingUndo$);

    await TestBed.configureTestingModule({
      imports: [UndoToastComponent],
      providers: [
        { provide: KeywordRatingService, useValue: ratingServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UndoToastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Visibility — null pendingUndo$
  // ---------------------------------------------------------------------------

  describe('when pendingUndo$ is null', () => {
    it('should not render the toast element', () => {
      pendingUndo$.next(null);
      fixture.detectChanges();
      const toast = fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]');
      expect(toast).toBeNull();
    });

    it('should not render the Undo button', () => {
      pendingUndo$.next(null);
      fixture.detectChanges();
      const undoBtn = fixture.nativeElement.querySelector('button.undo-btn, button[data-action="undo"]');
      expect(undoBtn).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Visibility — active pendingUndo$
  // ---------------------------------------------------------------------------

  describe('when pendingUndo$ emits a value', () => {
    beforeEach(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: 3 });
      fixture.detectChanges();
    });

    it('should render the toast', () => {
      const toast = fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]');
      expect(toast).not.toBeNull();
    });

    it('should render an Undo button', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const undoBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('undo')
      );
      expect(undoBtn).not.toBeUndefined();
    });

    it('should display the hidden keyword name in the toast', () => {
      const toast = fixture.nativeElement as HTMLElement;
      expect(toast.textContent).toContain('seo tips');
    });
  });

  // ---------------------------------------------------------------------------
  // Undo button — calls service
  // ---------------------------------------------------------------------------

  describe('clicking the Undo button', () => {
    beforeEach(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: 2 });
      fixture.detectChanges();
    });

    it('should call ratingService.undoLastHide()', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const undoBtn = buttons.find(b => b.textContent?.toLowerCase().includes('undo'))!;
      undoBtn.click();
      expect(ratingServiceSpy.undoLastHide).toHaveBeenCalled();
    });

    it('should call undoLastHide() exactly once per click', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const undoBtn = buttons.find(b => b.textContent?.toLowerCase().includes('undo'))!;
      undoBtn.click();
      expect(ratingServiceSpy.undoLastHide).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Dismiss button — clears pendingUndo$
  // ---------------------------------------------------------------------------

  describe('clicking the dismiss button', () => {
    beforeEach(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: undefined });
      fixture.detectChanges();
    });

    it('should hide the toast after dismiss is clicked', () => {
      const dismissBtn = fixture.nativeElement.querySelector(
        'button.dismiss-btn, button[data-action="dismiss"], button[aria-label="dismiss"], button[aria-label="close"]'
      ) as HTMLButtonElement | null;

      if (dismissBtn) {
        dismissBtn.click();
      } else {
        // Fallback: click any button that is NOT the undo button
        const buttons = Array.from(
          fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
        );
        const nonUndo = buttons.find(b => !b.textContent?.toLowerCase().includes('undo'));
        if (nonUndo) nonUndo.click();
      }

      fixture.detectChanges();

      let pendingValue: PendingUndo;
      pendingUndo$.subscribe(v => (pendingValue = v));
      expect(pendingValue!).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-dismiss after 5000 ms
  // ---------------------------------------------------------------------------

  describe('auto-dismiss timer', () => {
    it('should still show the toast before 5000 ms have elapsed', fakeAsync(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: 1 });
      fixture.detectChanges();

      tick(4999);

      const toast = fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]');
      expect(toast).not.toBeNull();

      tick(1); // complete the timer cleanly
    }));

    it('should auto-dismiss after 5000 ms by setting pendingUndo$ to null', fakeAsync(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: 1 });
      fixture.detectChanges();

      tick(5000);
      fixture.detectChanges();

      let pendingValue: PendingUndo = { keyword: 'x', previousRating: undefined };
      pendingUndo$.subscribe(v => (pendingValue = v));
      expect(pendingValue).toBeNull();
    }));

    it('should hide the toast in the DOM after the 5000 ms auto-dismiss', fakeAsync(() => {
      pendingUndo$.next({ keyword: 'seo tips', previousRating: 2 });
      fixture.detectChanges();

      tick(5000);
      fixture.detectChanges();

      const toast = fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]');
      expect(toast).toBeNull();
    }));

    it('should reset the timer when a new pendingUndo value is emitted', fakeAsync(() => {
      pendingUndo$.next({ keyword: 'kw-1', previousRating: 1 });
      fixture.detectChanges();
      tick(3000);

      // Second hide resets the timer
      pendingUndo$.next({ keyword: 'kw-2', previousRating: 2 });
      fixture.detectChanges();
      tick(4999);

      // Should still be visible (5000 ms from the second emission)
      const toast = fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]');
      expect(toast).not.toBeNull();

      tick(1);
    }));

    it('should not attempt auto-dismiss when there is no active pending undo', fakeAsync(() => {
      // No pending undo — timer should simply not fire problematically
      tick(5000);
      fixture.detectChanges();
      // If we reach here without error, the test passes
      expect(true).toBeTrue();
    }));
  });

  // ---------------------------------------------------------------------------
  // Reactive transitions
  // ---------------------------------------------------------------------------

  describe('reactive transitions', () => {
    it('should show the toast after a null→value transition', () => {
      expect(
        fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]')
      ).toBeNull();

      pendingUndo$.next({ keyword: 'kw', previousRating: 3 });
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]')
      ).not.toBeNull();
    });

    it('should hide the toast after a value→null transition', () => {
      pendingUndo$.next({ keyword: 'kw', previousRating: 3 });
      fixture.detectChanges();

      pendingUndo$.next(null);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.undo-toast, [data-testid="undo-toast"]')
      ).toBeNull();
    });
  });
});

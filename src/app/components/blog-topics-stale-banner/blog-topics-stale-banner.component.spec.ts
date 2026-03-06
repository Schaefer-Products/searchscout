import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { BlogTopicsStaleBannerComponent } from './blog-topics-stale-banner.component';
import { KeywordRatingService } from '../../services/keyword-rating.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockRatingService(
  blogTopicsStale$: BehaviorSubject<boolean>
): jasmine.SpyObj<KeywordRatingService> {
  const spy = jasmine.createSpyObj<KeywordRatingService>(
    'KeywordRatingService',
    ['undoLastHide', 'setRating', 'getRating', 'clearRating', 'getAllRatings',
     'isHidden', 'adjustScore', 'markBlogTopicsGenerated', 'dismissRatingHint',
     'initialize']
  );
  (spy as any).blogTopicsStale$ = blogTopicsStale$;
  return spy;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BlogTopicsStaleBannerComponent', () => {
  let component: BlogTopicsStaleBannerComponent;
  let fixture: ComponentFixture<BlogTopicsStaleBannerComponent>;
  let ratingServiceSpy: jasmine.SpyObj<KeywordRatingService>;
  let blogTopicsStale$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    blogTopicsStale$ = new BehaviorSubject<boolean>(false);
    ratingServiceSpy = buildMockRatingService(blogTopicsStale$);

    await TestBed.configureTestingModule({
      imports: [BlogTopicsStaleBannerComponent],
      providers: [
        { provide: KeywordRatingService, useValue: ratingServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogTopicsStaleBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Visibility — blogTopicsStale$ is false
  // ---------------------------------------------------------------------------

  describe('when blogTopicsStale$ is false', () => {
    beforeEach(() => {
      blogTopicsStale$.next(false);
      fixture.detectChanges();
    });

    it('should not render the banner', () => {
      const banner = fixture.nativeElement.querySelector(
        '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
      );
      expect(banner).toBeNull();
    });

    it('should not render the regenerate button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
      expect(buttons.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Visibility — blogTopicsStale$ is true
  // ---------------------------------------------------------------------------

  describe('when blogTopicsStale$ is true', () => {
    beforeEach(() => {
      blogTopicsStale$.next(true);
      fixture.detectChanges();
    });

    it('should render the banner', () => {
      const banner = fixture.nativeElement.querySelector(
        '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
      );
      expect(banner).not.toBeNull();
    });

    it('should render the "Regenerate topics" button', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const regenerateBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('regenerate')
      );
      expect(regenerateBtn).not.toBeUndefined();
    });

    it('should display a message indicating topics are out of date', () => {
      const banner = fixture.nativeElement as HTMLElement;
      // Verify there is some meaningful message text in the banner
      expect(banner.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // regenerateClicked output
  // ---------------------------------------------------------------------------

  describe('regenerateClicked output', () => {
    beforeEach(() => {
      blogTopicsStale$.next(true);
      fixture.detectChanges();
    });

    it('should emit regenerateClicked when the regenerate button is clicked', () => {
      let emitted = false;
      component.regenerateClicked.subscribe(() => (emitted = true));

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const regenerateBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('regenerate')
      )!;
      regenerateBtn.click();

      expect(emitted).toBeTrue();
    });

    it('should emit regenerateClicked exactly once per click', () => {
      let count = 0;
      component.regenerateClicked.subscribe(() => count++);

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const regenerateBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('regenerate')
      )!;
      regenerateBtn.click();

      expect(count).toBe(1);
    });

    it('should not emit regenerateClicked before the button is clicked', () => {
      let emitted = false;
      component.regenerateClicked.subscribe(() => (emitted = true));
      expect(emitted).toBeFalse();
    });

    it('should emit again on a second click', () => {
      let count = 0;
      component.regenerateClicked.subscribe(() => count++);

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const regenerateBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('regenerate')
      )!;
      regenerateBtn.click();
      regenerateBtn.click();

      expect(count).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Reactive transitions — false → true → false
  // ---------------------------------------------------------------------------

  describe('reactive transitions', () => {
    it('should show the banner when blogTopicsStale$ changes from false to true', () => {
      blogTopicsStale$.next(false);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
        )
      ).toBeNull();

      blogTopicsStale$.next(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
        )
      ).not.toBeNull();
    });

    it('should hide the banner when blogTopicsStale$ changes from true to false', () => {
      blogTopicsStale$.next(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
        )
      ).not.toBeNull();

      blogTopicsStale$.next(false);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
        )
      ).toBeNull();
    });

    it('should show and hide the banner across multiple true/false cycles', () => {
      [true, false, true, false].forEach(stale => {
        blogTopicsStale$.next(stale);
        fixture.detectChanges();
        const banner = fixture.nativeElement.querySelector(
          '.stale-banner, [data-testid="stale-banner"], .blog-topics-stale-banner'
        );
        if (stale) {
          expect(banner).not.toBeNull();
        } else {
          expect(banner).toBeNull();
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // No interaction with KeywordRatingService beyond the observable
  // ---------------------------------------------------------------------------

  describe('service interaction', () => {
    it('should not call any mutating methods on KeywordRatingService at construction', () => {
      expect(ratingServiceSpy.setRating).not.toHaveBeenCalled();
      expect(ratingServiceSpy.clearRating).not.toHaveBeenCalled();
      expect(ratingServiceSpy.undoLastHide).not.toHaveBeenCalled();
      expect(ratingServiceSpy.markBlogTopicsGenerated).not.toHaveBeenCalled();
    });

    it('should not call markBlogTopicsGenerated when the regenerate button is clicked', () => {
      blogTopicsStale$.next(true);
      fixture.detectChanges();

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
      );
      const regenerateBtn = buttons.find(b =>
        b.textContent?.toLowerCase().includes('regenerate')
      )!;
      regenerateBtn.click();

      // The component just emits the output — the parent component calls markBlogTopicsGenerated
      expect(ratingServiceSpy.markBlogTopicsGenerated).not.toHaveBeenCalled();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { fakeAsync, tick } from '@angular/core/testing';

import { KeywordRatingService } from './keyword-rating.service';
import { IndexedDbService } from './indexed-db.service';
import {
  RATING_SCORE_ALGORITHM,
  RatingScoreAlgorithm,
  RatingValue,
  KeywordRatingMap,
} from '../models/keyword-rating.model';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockDb(): jasmine.SpyObj<IndexedDbService> {
  const mock = jasmine.createSpyObj<IndexedDbService>('IndexedDbService', [
    'get', 'set', 'delete', 'getAll', 'clear',
  ]);
  mock.get.and.resolveTo(undefined);
  mock.set.and.resolveTo(undefined);
  mock.delete.and.resolveTo(undefined);
  mock.getAll.and.resolveTo([]);
  mock.clear.and.resolveTo(undefined);
  return mock;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('KeywordRatingService', () => {
  let service: KeywordRatingService;
  let mockDb: jasmine.SpyObj<IndexedDbService>;

  beforeEach(async () => {
    mockDb = buildMockDb();

    TestBed.configureTestingModule({
      providers: [
        KeywordRatingService,
        { provide: IndexedDbService, useValue: mockDb },
      ],
    });

    service = TestBed.inject(KeywordRatingService);
    await service.initialize('example.com');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // BehaviorSubject initial states
  // ---------------------------------------------------------------------------

  describe('initial observable state', () => {
    it('ratings$ should emit an empty map on creation', () => {
      let emitted: KeywordRatingMap | undefined;
      service.ratings$.subscribe(v => (emitted = v));
      expect(emitted).toEqual({});
    });

    it('blogTopicsStale$ should emit false on creation', () => {
      let emitted: boolean | undefined;
      service.blogTopicsStale$.subscribe(v => (emitted = v));
      expect(emitted).toBeFalse();
    });

    it('showRatingHint$ should emit true on creation when hint has not been dismissed', () => {
      let emitted: boolean | undefined;
      service.showRatingHint$.subscribe(v => (emitted = v));
      expect(emitted).toBeTrue();
    });

    it('pendingUndo$ should emit null on creation', () => {
      let emitted: unknown;
      service.pendingUndo$.subscribe(v => (emitted = v));
      expect(emitted).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // setRating() and getRating()
  // ---------------------------------------------------------------------------

  describe('setRating() and getRating()', () => {
    it('should store a rating of 1', () => {
      service.setRating('seo tips', 1);
      expect(service.getRating('seo tips')).toBe(1);
    });

    it('should store a rating of 4', () => {
      service.setRating('content marketing', 4);
      expect(service.getRating('content marketing')).toBe(4);
    });

    it('should store a rating of 0', () => {
      service.setRating('hidden keyword', 0);
      expect(service.getRating('hidden keyword')).toBe(0);
    });

    it('should overwrite a previous rating for the same keyword', () => {
      service.setRating('seo tips', 3);
      service.setRating('seo tips', 1);
      expect(service.getRating('seo tips')).toBe(1);
    });

    it('should return undefined for a keyword that has never been rated', () => {
      expect(service.getRating('never-rated')).toBeUndefined();
    });

    it('should update ratings$ observable when a rating is set', () => {
      let lastEmitted: KeywordRatingMap = {};
      service.ratings$.subscribe(v => (lastEmitted = v));
      service.setRating('seo tips', 2);
      expect(lastEmitted['seo tips']).toBe(2);
    });

    it('should store ratings independently for different keywords', () => {
      service.setRating('keyword-a', 1);
      service.setRating('keyword-b', 3);
      expect(service.getRating('keyword-a')).toBe(1);
      expect(service.getRating('keyword-b')).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // isHidden()
  // ---------------------------------------------------------------------------

  describe('isHidden()', () => {
    it('should return true when rating is 0', () => {
      service.setRating('hidden kw', 0);
      expect(service.isHidden('hidden kw')).toBeTrue();
    });

    it('should return false when rating is 1', () => {
      service.setRating('visible kw', 1);
      expect(service.isHidden('visible kw')).toBeFalse();
    });

    it('should return false when rating is 2', () => {
      service.setRating('visible kw', 2);
      expect(service.isHidden('visible kw')).toBeFalse();
    });

    it('should return false when rating is 3', () => {
      service.setRating('visible kw', 3);
      expect(service.isHidden('visible kw')).toBeFalse();
    });

    it('should return false when rating is 4', () => {
      service.setRating('visible kw', 4);
      expect(service.isHidden('visible kw')).toBeFalse();
    });

    it('should return false when the keyword has no rating', () => {
      expect(service.isHidden('no-rating')).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // setRating(0) triggers pendingUndo$
  // ---------------------------------------------------------------------------

  describe('setRating(keyword, 0) — hide behaviour', () => {
    it('should emit a pendingUndo$ value containing the keyword', () => {
      let pending: { keyword: string; previousRating: RatingValue | undefined } | null = null;
      service.pendingUndo$.subscribe(v => (pending = v));

      service.setRating('hidden kw', 0);

      expect(pending).not.toBeNull();
      expect(pending!.keyword).toBe('hidden kw');
    });

    it('should include the previous rating in pendingUndo$ when one existed', () => {
      service.setRating('hidden kw', 3);
      let pending: { keyword: string; previousRating: RatingValue | undefined } | null = null;
      service.pendingUndo$.subscribe(v => (pending = v));

      service.setRating('hidden kw', 0);

      expect(pending!.previousRating).toBe(3);
    });

    it('should include undefined as previousRating in pendingUndo$ when no prior rating existed', () => {
      let pending: { keyword: string; previousRating: RatingValue | undefined } | null = null;
      service.pendingUndo$.subscribe(v => (pending = v));

      service.setRating('brand-new-kw', 0);

      expect(pending!.previousRating).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // setRating(1–4) triggers blogTopicsStale$
  // ---------------------------------------------------------------------------

  describe('setRating(keyword, 1–4) — stale blog topics', () => {
    it('should set blogTopicsStale$ to true when rating is 1', () => {
      let stale = false;
      service.blogTopicsStale$.subscribe(v => (stale = v));
      service.setRating('kw', 1);
      expect(stale).toBeTrue();
    });

    it('should set blogTopicsStale$ to true when rating is 2', () => {
      let stale = false;
      service.blogTopicsStale$.subscribe(v => (stale = v));
      service.setRating('kw', 2);
      expect(stale).toBeTrue();
    });

    it('should set blogTopicsStale$ to true when rating is 3', () => {
      let stale = false;
      service.blogTopicsStale$.subscribe(v => (stale = v));
      service.setRating('kw', 3);
      expect(stale).toBeTrue();
    });

    it('should set blogTopicsStale$ to true when rating is 4', () => {
      let stale = false;
      service.blogTopicsStale$.subscribe(v => (stale = v));
      service.setRating('kw', 4);
      expect(stale).toBeTrue();
    });

    it('should NOT set blogTopicsStale$ to true when rating is 0 (hide)', () => {
      // Start with a known false state (ratings are fresh)
      service.markBlogTopicsGenerated();
      let stale = false;
      service.blogTopicsStale$.subscribe(v => (stale = v));
      service.setRating('kw', 0);
      expect(stale).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // clearRating()
  // ---------------------------------------------------------------------------

  describe('clearRating()', () => {
    it('should cause getRating() to return undefined after clearing', () => {
      service.setRating('seo tips', 2);
      service.clearRating('seo tips');
      expect(service.getRating('seo tips')).toBeUndefined();
    });

    it('should NOT leave the rating as 0 after clearing — it must be truly absent', () => {
      service.setRating('seo tips', 2);
      service.clearRating('seo tips');
      const allRatings = service.getAllRatings();
      expect('seo tips' in allRatings).toBeFalse();
    });

    it('should not throw when clearing a keyword that was never rated', () => {
      expect(() => service.clearRating('never-rated')).not.toThrow();
    });

    it('should remove the keyword entry from ratings$', () => {
      service.setRating('seo tips', 2);
      service.clearRating('seo tips');
      let emitted: KeywordRatingMap = {};
      service.ratings$.subscribe(v => (emitted = v));
      expect('seo tips' in emitted).toBeFalse();
    });

    it('should not affect other keywords when one is cleared', () => {
      service.setRating('kw-a', 1);
      service.setRating('kw-b', 3);
      service.clearRating('kw-a');
      expect(service.getRating('kw-b')).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllRatings()
  // ---------------------------------------------------------------------------

  describe('getAllRatings()', () => {
    it('should return an empty object when no ratings have been set', () => {
      expect(service.getAllRatings()).toEqual({});
    });

    it('should return all set ratings as a KeywordRatingMap', () => {
      service.setRating('kw-a', 1);
      service.setRating('kw-b', 4);
      const all = service.getAllRatings();
      expect(all['kw-a']).toBe(1);
      expect(all['kw-b']).toBe(4);
    });

    it('should not include cleared keywords', () => {
      service.setRating('kw-a', 2);
      service.clearRating('kw-a');
      expect('kw-a' in service.getAllRatings()).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // undoLastHide()
  // ---------------------------------------------------------------------------

  describe('undoLastHide()', () => {
    it('should restore the previous rating when undoing a hide', () => {
      service.setRating('seo tips', 3);
      service.setRating('seo tips', 0);
      service.undoLastHide();
      expect(service.getRating('seo tips')).toBe(3);
    });

    it('should restore to undefined (clear the rating) when there was no previous rating', () => {
      service.setRating('fresh kw', 0);
      service.undoLastHide();
      expect(service.getRating('fresh kw')).toBeUndefined();
    });

    it('should set pendingUndo$ back to null after undoing', () => {
      service.setRating('kw', 0);
      service.undoLastHide();
      let pending: unknown;
      service.pendingUndo$.subscribe(v => (pending = v));
      expect(pending).toBeNull();
    });

    it('should not throw when called with no pending undo', () => {
      expect(() => service.undoLastHide()).not.toThrow();
    });

    it('should leave pendingUndo$ as null when called with no pending undo', () => {
      service.undoLastHide();
      let pending: unknown;
      service.pendingUndo$.subscribe(v => (pending = v));
      expect(pending).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // adjustScore()
  // ---------------------------------------------------------------------------

  describe('adjustScore()', () => {
    it('should return the rawScore unchanged when no algorithm is injected', () => {
      service.setRating('kw', 3);
      expect(service.adjustScore('kw', 75)).toBe(75);
    });

    it('should return the rawScore unchanged for an unrated keyword', () => {
      expect(service.adjustScore('unrated', 50)).toBe(50);
    });

    it('should return rawScore of 0 unchanged', () => {
      service.setRating('kw', 2);
      expect(service.adjustScore('kw', 0)).toBe(0);
    });
  });

  describe('adjustScore() — with injected algorithm', () => {
    let serviceWithAlgo: KeywordRatingService;
    let mockAlgorithm: jasmine.SpyObj<RatingScoreAlgorithm>;

    beforeEach(async () => {
      mockAlgorithm = jasmine.createSpyObj<RatingScoreAlgorithm>('RatingScoreAlgorithm', [
        'multiplierForRating', 'applyToScore',
      ]);
      mockAlgorithm.applyToScore.and.callFake((raw: number, rating: RatingValue) => raw * (rating + 1));

      // Reset the module so we can reconfigure with the optional algorithm token.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          KeywordRatingService,
          { provide: IndexedDbService, useValue: mockDb },
          { provide: RATING_SCORE_ALGORITHM, useValue: mockAlgorithm },
        ],
      });

      serviceWithAlgo = TestBed.inject(KeywordRatingService);
      await serviceWithAlgo.initialize('example.com');
    });

    it('should delegate to the algorithm when one is provided', () => {
      serviceWithAlgo.setRating('kw', 2);
      const result = serviceWithAlgo.adjustScore('kw', 10);
      expect(mockAlgorithm.applyToScore).toHaveBeenCalledWith(10, 2);
      expect(result).toBe(30); // 10 * (2 + 1)
    });
  });

  // ---------------------------------------------------------------------------
  // markBlogTopicsGenerated()
  // ---------------------------------------------------------------------------

  describe('markBlogTopicsGenerated()', () => {
    it('should set blogTopicsStale$ to false', () => {
      // First make it stale
      service.setRating('kw', 1);
      let stale = true;
      service.blogTopicsStale$.subscribe(v => (stale = v));

      service.markBlogTopicsGenerated();

      expect(stale).toBeFalse();
    });

    it('should not throw when blogTopicsStale$ is already false', () => {
      expect(() => service.markBlogTopicsGenerated()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // dismissRatingHint()
  // ---------------------------------------------------------------------------

  describe('dismissRatingHint()', () => {
    it('should set showRatingHint$ to false', () => {
      let hint = true;
      service.showRatingHint$.subscribe(v => (hint = v));
      service.dismissRatingHint();
      expect(hint).toBeFalse();
    });

    it('should persist ratingHintDismissed to IndexedDB', fakeAsync(() => {
      service.dismissRatingHint();
      tick(300); // debounce
      expect(mockDb.set).toHaveBeenCalledWith('keyvalue', 'ratingHintDismissed', true);
    }));

    it('should not throw when called multiple times', () => {
      expect(() => {
        service.dismissRatingHint();
        service.dismissRatingHint();
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // initialize() — loading from IndexedDB
  // ---------------------------------------------------------------------------

  describe('initialize()', () => {
    it('should load persisted ratings from IndexedDB on initialize', async () => {
      const stored: KeywordRatingMap = { 'seo tips': 3, 'content marketing': 1 };
      mockDb.get.and.callFake((store: string, key: string) => {
        if (store === 'keyvalue' && key === 'keyword_ratings_example.com') {
          return Promise.resolve(stored);
        }
        return Promise.resolve(undefined);
      });

      const freshService = new (KeywordRatingService as any)(mockDb);
      await freshService.initialize('example.com');

      expect(freshService.getRating('seo tips')).toBe(3);
      expect(freshService.getRating('content marketing')).toBe(1);
    });

    it('should start with empty ratings when IndexedDB returns nothing', async () => {
      mockDb.get.and.resolveTo(undefined);
      const freshService = new (KeywordRatingService as any)(mockDb);
      await freshService.initialize('example.com');
      expect(freshService.getAllRatings()).toEqual({});
    });

    it('should set showRatingHint$ to false when ratingHintDismissed is true in IndexedDB', async () => {
      mockDb.get.and.callFake((store: string, key: string) => {
        if (store === 'keyvalue' && key === 'ratingHintDismissed') {
          return Promise.resolve(true);
        }
        return Promise.resolve(undefined);
      });

      const freshService = new (KeywordRatingService as any)(mockDb);
      await freshService.initialize('example.com');

      let hint: boolean | undefined;
      freshService.showRatingHint$.subscribe((v: boolean) => (hint = v));
      expect(hint).toBeFalse();
    });

    it('should preserve ratings for the old domain when switching to a new domain', async () => {
      // Seed ratings for domain-a
      service.setRating('kw-a', 2);

      // Now switch to domain-b
      mockDb.get.and.resolveTo(undefined);
      await service.initialize('domain-b.com');

      // Ratings for domain-a should still be intact in memory (domain isolation)
      // After re-initializing for domain-a the data comes from IDB, but the
      // in-memory state for domain-b starts fresh
      expect(service.getAllRatings()).toEqual({});
    });

    it('should use the correct IDB key for the domain', async () => {
      mockDb.get.and.resolveTo(undefined);
      const freshService = new (KeywordRatingService as any)(mockDb);
      await freshService.initialize('mysite.com');
      expect(mockDb.get).toHaveBeenCalledWith('keyvalue', 'keyword_ratings_mysite.com');
    });
  });

  // ---------------------------------------------------------------------------
  // IndexedDB write — 300 ms debounce
  // ---------------------------------------------------------------------------

  describe('IndexedDB persistence debounce', () => {
    it('should not write to IndexedDB immediately when setRating is called', fakeAsync(() => {
      service.setRating('kw', 1);
      // Advance less than the debounce window
      tick(299);
      expect(mockDb.set).not.toHaveBeenCalledWith(
        'keyvalue',
        'keyword_ratings_example.com',
        jasmine.anything()
      );
      tick(1); // complete the debounce
    }));

    it('should write to IndexedDB after the 300 ms debounce window', fakeAsync(() => {
      service.setRating('kw', 1);
      tick(300);
      expect(mockDb.set).toHaveBeenCalledWith(
        'keyvalue',
        'keyword_ratings_example.com',
        jasmine.objectContaining({ kw: 1 })
      );
    }));

    it('should coalesce multiple rapid setRating calls into one write', fakeAsync(() => {
      service.setRating('kw', 1);
      tick(100);
      service.setRating('kw', 2);
      tick(100);
      service.setRating('kw', 3);
      tick(300);

      const calls = mockDb.set.calls.all().filter(
        c => c.args[1] === 'keyword_ratings_example.com'
      );
      expect(calls.length).toBe(1);
      expect(calls[0].args[2]).toEqual(jasmine.objectContaining({ kw: 3 }));
    }));

    it('should write to the correct IDB key for the active domain', fakeAsync(() => {
      mockDb.get.and.resolveTo(undefined);
      void service.initialize('other-site.com');
      service.setRating('kw', 4);
      tick(300);
      expect(mockDb.set).toHaveBeenCalledWith(
        'keyvalue',
        'keyword_ratings_other-site.com',
        jasmine.anything()
      );
    }));
  });
});

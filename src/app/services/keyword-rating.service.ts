import { Injectable, Optional, Inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import {
  KeywordRatingMap,
  RATING_SCORE_ALGORITHM,
  RatingScoreAlgorithm,
  RatingValue,
} from '../models/keyword-rating.model';
import { Logger } from '../utils/logger';
import { IndexedDbService } from './indexed-db.service';

@Injectable({ providedIn: 'root' })
export class KeywordRatingService implements OnDestroy {
  private readonly KEY_PREFIX = 'keyword_ratings_';
  private readonly HINT_KEY = 'ratingHintDismissed';

  /** In-memory authoritative copy of the current domain's ratings. */
  private ratingsMap: KeywordRatingMap = {};

  /** The domain whose data is currently loaded. */
  private currentDomain: string = '';

  /**
   * Emits the current ratings map (shallow copy) after every mutation.
   * Consumers should treat the emitted object as read-only.
   */
  private readonly _ratings$ = new BehaviorSubject<KeywordRatingMap>({});
  readonly ratings$ = this._ratings$.asObservable();

  /**
   * True when a rating change (value 1–4) has occurred since the last call to
   * markBlogTopicsGenerated().  Signals that any previously generated blog
   * topic list may no longer reflect the user's preferences.
   */
  private readonly _blogTopicsStale$ = new BehaviorSubject<boolean>(false);
  readonly blogTopicsStale$ = this._blogTopicsStale$.asObservable();

  /**
   * True when the first-time rating hint banner should be shown.
   * Permanently dismissed via dismissRatingHint().
   */
  private readonly _showRatingHint$ = new BehaviorSubject<boolean>(true);
  readonly showRatingHint$ = this._showRatingHint$.asObservable();

  /**
   * Non-null while an undo is available following a hide action (rating 0).
   * Cleared after undoLastHide() is called or a subsequent setRating() fires.
   */
  private readonly _pendingUndo$ = new BehaviorSubject<{
    keyword: string;
    previousRating: RatingValue | undefined;
  } | null>(null);
  readonly pendingUndo$ = this._pendingUndo$.asObservable();

  /**
   * Internal trigger stream for debounced IndexedDB writes.
   * Callers push a void signal; the subscriber handles the actual write.
   */
  private readonly writeQueue$ = new Subject<void>();

  /** Subscription for the debounced write pipeline — cleaned up in ngOnDestroy. */
  private writeSubscription: Subscription;

  // Constructor injection is used here so that unit tests can instantiate the
  // service directly with `new KeywordRatingService(mockDb)` and bypass the DI
  // container (see spec pattern: new (KeywordRatingService as any)(mockDb)).
  constructor(
    private readonly db: IndexedDbService,
    @Optional() @Inject(RATING_SCORE_ALGORITHM) private readonly algorithm: RatingScoreAlgorithm | null = null,
  ) {
    this.writeSubscription = this.writeQueue$.pipe(debounceTime(300)).subscribe(async () => {
      await this.persistRatings();
    });
    Logger.debug('[KeywordRatingService] debounced write subscription established');
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnDestroy(): void {
    this.writeQueue$.complete();
    this.writeSubscription.unsubscribe();
  }

  /**
   * Load ratings for `domain` from IndexedDB.
   */
  async initialize(domain: string): Promise<void> {
    const isDomainSwitch = this.currentDomain !== '' && this.currentDomain !== domain;

    if (isDomainSwitch) {
      Logger.debug(
        `[KeywordRatingService] domain switch from "${this.currentDomain}" to "${domain}": flushing pending write`
      );
      await this.persistRatings();
    }

    this.currentDomain = domain;
    Logger.debug(`[KeywordRatingService] initializing for domain "${domain}"`);

    // Reset reactive state for the new domain.
    this.ratingsMap = {};
    this._ratings$.next({});
    this._blogTopicsStale$.next(false);
    this._pendingUndo$.next(null);

    // Load persisted ratings and hint flag in parallel.
    try {
      const [stored, hintDismissed] = await Promise.all([
        this.db.get('keyvalue', this.idbKey(domain)),
        this.db.get('keyvalue', this.HINT_KEY),
      ]);

      // Load ratings
      if (
        stored !== null &&
        stored !== undefined &&
        typeof stored === 'object' &&
        !Array.isArray(stored)
      ) {
        this.ratingsMap = stored as KeywordRatingMap;
        Logger.debug(
          `[KeywordRatingService] loaded ${Object.keys(this.ratingsMap).length} ratings from IDB`
        );
      } else {
        this.ratingsMap = {};
        Logger.debug('[KeywordRatingService] no stored ratings — starting with empty map');
      }

      // Load hint dismissed flag
      this._showRatingHint$.next(!hintDismissed);
      Logger.debug(
        `[KeywordRatingService] rating hint ${hintDismissed ? 'already dismissed' : 'visible'}`
      );
    } catch (err) {
      Logger.error('[KeywordRatingService] failed to load data from IDB:', err);
      this.ratingsMap = {};
      this._showRatingHint$.next(true);
    }

    this._ratings$.next({ ...this.ratingsMap });
  }

  // ---------------------------------------------------------------------------
  // Ratings API
  // ---------------------------------------------------------------------------

  /**
   * Assign `rating` to `keyword` and emit the updated map.
   *
   * Rating 0 (hide): stores previous rating in pendingUndo$ for undo support.
   * Rating 1–4: sets blogTopicsStale$ to true.
   */
  setRating(keyword: string, rating: RatingValue): void {
    const previousRating = this.ratingsMap[keyword];

    // Immutable update.
    this.ratingsMap = { ...this.ratingsMap, [keyword]: rating };
    this._ratings$.next({ ...this.ratingsMap });

    if (rating === 0) {
      Logger.debug(
        `[KeywordRatingService] "${keyword}" hidden (rating 0); previous rating: ${previousRating}`
      );
      this._pendingUndo$.next({ keyword, previousRating });
    } else {
      Logger.debug(`[KeywordRatingService] "${keyword}" rated ${rating}; blog topics now stale`);
      this._blogTopicsStale$.next(true);
      // A new explicit rating supersedes any previous undo.
      if (this._pendingUndo$.value !== null) {
        this._pendingUndo$.next(null);
      }
    }

    this.scheduleWrite();
  }

  /** Return the rating stored for `keyword`, or `undefined` when never rated. */
  getRating(keyword: string): RatingValue | undefined {
    return this.ratingsMap[keyword];
  }

  /** Return a shallow copy of the entire ratings map for the current domain. */
  getAllRatings(): KeywordRatingMap {
    return { ...this.ratingsMap };
  }

  /**
   * Remove the rating entry for `keyword` entirely.
   * Semantically distinct from setRating(keyword, 0): clearRating leaves the
   * key absent (no opinion), whereas rating 0 explicitly marks as hidden.
   */
  clearRating(keyword: string): void {
    if (!(keyword in this.ratingsMap)) {
      Logger.debug(
        `[KeywordRatingService] clearRating: "${keyword}" has no rating — nothing to clear`
      );
      return;
    }

    // Immutable deletion via destructuring.
    const { [keyword]: _dropped, ...rest } = this.ratingsMap;
    this.ratingsMap = rest as KeywordRatingMap;
    this._ratings$.next({ ...this.ratingsMap });

    Logger.debug(`[KeywordRatingService] cleared rating for "${keyword}"`);
    this.scheduleWrite();
  }

  /**
   * Undo the most recent hide action stored in pendingUndo$.
   * When the keyword had a previous rating it is restored; otherwise the entry
   * is removed entirely.
   */
  undoLastHide(): void {
    const undo = this._pendingUndo$.value;
    if (undo === null) {
      Logger.warn('[KeywordRatingService] undoLastHide called but no undo is pending');
      return;
    }

    Logger.debug(
      `[KeywordRatingService] undoing hide for "${undo.keyword}"; restoring to ${undo.previousRating}`
    );

    if (undo.previousRating !== undefined) {
      // setRating(1-4) will clear _pendingUndo$ internally — no need to do it again.
      this.setRating(undo.keyword, undo.previousRating);
    } else {
      this.clearRating(undo.keyword);
      // clearRating does not touch _pendingUndo$, so we must clear it here.
      this._pendingUndo$.next(null);
    }
  }

  /**
   * Dismiss the pending undo toast without restoring the previous rating.
   */
  dismissPendingUndo(): void {
    Logger.debug('[KeywordRatingService] pending undo dismissed');
    this._pendingUndo$.next(null);
  }

  /**
   * Returns true only when the keyword has been explicitly rated 0 (hidden).
   * A keyword with no rating stored is NOT considered hidden.
   */
  isHidden(keyword: string): boolean {
    return this.ratingsMap[keyword] === 0;
  }

  /**
   * Apply the optional RatingScoreAlgorithm to `rawScore`.
   * Returns `rawScore` unchanged when no algorithm is provided or the keyword
   * has no stored rating.
   */
  adjustScore(keyword: string, rawScore: number): number {
    if (this.algorithm === null) {
      return rawScore;
    }

    const rating = this.ratingsMap[keyword];
    if (rating === undefined) {
      return rawScore;
    }

    const adjusted = this.algorithm.applyToScore(rawScore, rating);
    Logger.debug(
      `[KeywordRatingService] adjustScore "${keyword}": raw=${rawScore} rating=${rating} adjusted=${adjusted}`
    );
    return adjusted;
  }

  /**
   * Signal that the blog topic list has just been regenerated and is in sync
   * with the current ratings. Resets blogTopicsStale$ to false.
   */
  markBlogTopicsGenerated(): void {
    Logger.debug('[KeywordRatingService] blog topics marked as freshly generated');
    this._blogTopicsStale$.next(false);
  }

  /**
   * Permanently dismiss the first-time rating hint.
   * Persisted to IndexedDB immediately (no debounce).
   */
  dismissRatingHint(): void {
    Logger.debug('[KeywordRatingService] rating hint dismissed');
    this._showRatingHint$.next(false);
    void this.db.set('keyvalue', this.HINT_KEY, true);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private scheduleWrite(): void {
    this.writeQueue$.next();
  }

  private async persistRatings(): Promise<void> {
    if (this.currentDomain === '') {
      Logger.warn('[KeywordRatingService] persistRatings called before domain was initialised — skipping');
      return;
    }

    try {
      await this.db.set('keyvalue', this.idbKey(this.currentDomain), this.ratingsMap);
      Logger.debug(
        `[KeywordRatingService] persisted ${Object.keys(this.ratingsMap).length} ratings for "${this.currentDomain}"`
      );
    } catch (err) {
      Logger.error(
        `[KeywordRatingService] failed to persist ratings for "${this.currentDomain}":`,
        err
      );
    }
  }

  private idbKey(domain: string): string {
    return `${this.KEY_PREFIX}${domain}`;
  }
}

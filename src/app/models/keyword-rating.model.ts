import { InjectionToken } from '@angular/core';

/**
 * A numeric relevance rating a user assigns to a keyword.
 * 0 = hidden/never relevant, 1–4 = increasing relevance.
 */
export type RatingValue = 0 | 1 | 2 | 3 | 4;

/**
 * Display metadata for a single rating value.
 */
export interface RatingMeta {
  value: RatingValue;
  emoji: string;
  label: string;
  ariaLabel: string;
}

/**
 * Lookup table mapping every valid RatingValue to its display metadata.
 */
export const RATING_META: Record<RatingValue, RatingMeta> = {
  0: {
    value: 0,
    emoji: '🚫',
    label: 'Never relevant',
    ariaLabel: 'Never relevant — hide this keyword',
  },
  1: {
    value: 1,
    emoji: '😐',
    label: 'Unlikely',
    ariaLabel: 'Mark as unlikely to be relevant',
  },
  2: {
    value: 2,
    emoji: '🙂',
    label: 'Possibly relevant',
    ariaLabel: 'Mark as possibly relevant',
  },
  3: {
    value: 3,
    emoji: '😊',
    label: 'Relevant',
    ariaLabel: 'Mark as relevant',
  },
  4: {
    value: 4,
    emoji: '🤩',
    label: 'Write about this today!',
    ariaLabel: 'Mark as top priority — write about this today',
  },
};

/**
 * A map of keyword string → RatingValue stored per domain.
 * Keys are only present when the user has explicitly rated the keyword.
 * An absent key is distinct from a rating of 0 (hidden).
 */
export type KeywordRatingMap = Record<string, RatingValue>;

/**
 * Strategy for incorporating a user's relevance rating into an opportunity score.
 * Provide a concrete implementation via the RATING_SCORE_ALGORITHM token.
 */
export interface RatingScoreAlgorithm {
  /** Returns a multiplier to apply to the raw score for the given rating. */
  multiplierForRating(rating: RatingValue): number;

  /** Applies the algorithm to produce an adjusted score. */
  applyToScore(rawScore: number, rating: RatingValue): number;
}

/**
 * Optional DI token.  When provided, KeywordRatingService delegates score
 * adjustment to the bound RatingScoreAlgorithm.  When absent the raw score
 * is returned unchanged.
 */
export const RATING_SCORE_ALGORITHM = new InjectionToken<RatingScoreAlgorithm>(
  'RatingScoreAlgorithm'
);

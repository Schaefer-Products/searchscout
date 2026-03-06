import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { RatingValue, RATING_META } from '../../models/keyword-rating.model';
import { Logger } from '../../utils/logger';

@Component({
  selector: 'app-keyword-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keyword-rating.component.html',
  styleUrls: ['./keyword-rating.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordRatingComponent {
  @Input({ required: true }) keyword!: string;

  /**
   * The currently active rating. When a parent sets this via property binding
   * or a test mutates it directly, the setter marks the component for check so
   * that OnPush change detection re-evaluates the template bindings.
   */
  @Input()
  get currentRating(): RatingValue | undefined {
    return this._currentRating;
  }
  set currentRating(value: RatingValue | undefined) {
    this._currentRating = value;
    this.cdr.markForCheck();
  }
  private _currentRating: RatingValue | undefined = undefined;

  @Output() ratingChanged = new EventEmitter<RatingValue | undefined>();

  private cdr = inject(ChangeDetectorRef);

  readonly ratingValues: RatingValue[] = [0, 1, 2, 3, 4];
  readonly ratingValuesPositive: RatingValue[] = [1, 2, 3, 4];

  /** Colour custom properties for each rating, used in SCSS ring ::after. */
  readonly ratingColors: Record<RatingValue, string> = {
    0: '#DC2626',
    1: '#9CA3AF',
    2: '#F59E0B',
    3: '#10B981',
    4: '#8B5CF6',
  };

  getEmoji(value: RatingValue): string {
    return RATING_META[value].emoji;
  }

  getAriaLabel(value: RatingValue): string {
    const base = RATING_META[value].ariaLabel;
    return this.currentRating === value ? base + ' (currently selected — activate to clear)' : base;
  }

  getTooltip(value: RatingValue): string {
    return RATING_META[value].ariaLabel;
  }

  getRingStyle(value: RatingValue): string {
    return `--ring-color: ${this.ratingColors[value]}`;
  }

  onButtonClick(value: RatingValue): void {
    if (this._currentRating === value) {
      Logger.debug('[KeywordRatingComponent] Clearing rating for:', this.keyword);
      this.ratingChanged.emit(undefined);
    } else {
      Logger.debug('[KeywordRatingComponent] Setting rating for:', this.keyword, '->', value);
      this.ratingChanged.emit(value);
    }
  }
}

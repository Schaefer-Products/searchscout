import {
  Component,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { KeywordRatingService } from '../../services/keyword-rating.service';

@Component({
  selector: 'app-blog-topics-stale-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blog-topics-stale-banner.component.html',
  styleUrls: ['./blog-topics-stale-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogTopicsStaleBannerComponent {
  @Output() regenerateClicked = new EventEmitter<void>();

  private ratingService = inject(KeywordRatingService);

  isStale$ = this.ratingService.blogTopicsStale$;

  onRegenerate(): void {
    this.regenerateClicked.emit();
  }
}

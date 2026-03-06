import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { KeywordRatingService } from '../../services/keyword-rating.service';
import { RatingValue } from '../../models/keyword-rating.model';
import { Logger } from '../../utils/logger';

@Component({
  selector: 'app-undo-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './undo-toast.component.html',
  styleUrls: ['./undo-toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UndoToastComponent implements OnInit, OnDestroy {
  private ratingService = inject(KeywordRatingService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('undoBtn') undoBtn?: ElementRef<HTMLButtonElement>;

  pendingUndo: { keyword: string; previousRating: RatingValue | undefined } | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private sub: Subscription = Subscription.EMPTY;

  ngOnInit(): void {
    this.sub = this.ratingService.pendingUndo$.subscribe(value => {
      if (value !== null) {
        // Clear any existing dismiss timer before starting a new one
        this.clearTimer();

        this.pendingUndo = value;
        Logger.debug('[UndoToastComponent] Showing undo toast for:', value.keyword);

        this.dismissTimer = setTimeout(() => {
          Logger.debug('[UndoToastComponent] Auto-dismissing toast for:', value.keyword);
          this.ratingService.dismissPendingUndo();
        }, 5000);
      } else {
        this.clearTimer();
        this.pendingUndo = null;
        Logger.debug('[UndoToastComponent] Toast dismissed');
      }

      this.cdr.detectChanges();
      setTimeout(() => this.undoBtn?.nativeElement.focus(), 0);
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.sub.unsubscribe();
  }

  onUndo(): void {
    Logger.debug('[UndoToastComponent] Undo clicked');
    this.ratingService.undoLastHide();
  }

  onDismiss(): void {
    Logger.debug('[UndoToastComponent] Dismiss clicked');
    this.ratingService.dismissPendingUndo();
  }

  private clearTimer(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}

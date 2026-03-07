import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Competitor } from '../../models/competitor.model';
import { DomainKeywordRanking } from '../../models/keyword.model';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../../models/aggregated-keyword.model';
import { BlogTopic } from '../../models/blog-topic.model';
import { CompetitorAnalysisService } from '../../services/competitor-analysis.service';
import { BlogTopicGeneratorService } from '../../services/blog-topic-generator.service';
import { ExportService } from '../../services/export.service';
import { KeywordRatingService } from '../../services/keyword-rating.service';
import { RatingValue } from '../../models/keyword-rating.model';
import { KeywordRatingComponent } from '../keyword-rating/keyword-rating.component';
import { BlogTopicsStaleBannerComponent } from '../blog-topics-stale-banner/blog-topics-stale-banner.component';
import { Logger } from '../../utils/logger';
import { PaginatedList } from '../../utils/paginated-list';

type ViewMode = 'opportunities' | 'all' | 'shared' | 'unique' | 'blog-topics';

@Component({
  selector: 'app-competitor-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, KeywordRatingComponent, BlogTopicsStaleBannerComponent],
  templateUrl: './competitor-analysis.component.html',
  styleUrls: ['./competitor-analysis.component.scss']
})
export class CompetitorAnalysisComponent implements OnInit, OnDestroy {
  private analysisService = inject(CompetitorAnalysisService);
  private blogTopicService = inject(BlogTopicGeneratorService);
  private exportService = inject(ExportService);
  keywordRatingService = inject(KeywordRatingService);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);

  @Input() userDomain: string = '';
  @Input() userKeywords: DomainKeywordRanking[] = [];
  @Input() competitors: Competitor[] = [];

  // Analysis state
  isAnalyzing: boolean = false;
  analysisComplete: boolean = false;
  results: CompetitorAnalysisResults | null = null;
  errorMessage: string = '';

  // Blog topics
  blogTopics: BlogTopic[] = [];

  // Display state
  viewMode: ViewMode = 'opportunities';
  showUnratedOnly: boolean = false;

  // Tooltip state
  tooltipOpen: boolean = false;
  readonly tooltipId = 'opportunity-score-tooltip';
  keywordPagination = new PaginatedList<AggregatedKeyword>(50);
  topicPagination = new PaginatedList<BlogTopic>(20);

  get displayedKeywords(): AggregatedKeyword[] { return this.keywordPagination.displayed; }
  set displayedKeywords(v: AggregatedKeyword[]) { this.keywordPagination.displayed = v; }

  get displayedTopics(): BlogTopic[] { return this.topicPagination.displayed; }
  set displayedTopics(v: BlogTopic[]) { this.topicPagination.displayed = v; }

  get hasMoreKeywords(): boolean {
    if (this.showUnratedOnly) {
      const filteredCount = this.getKeywordsForCurrentView().filter(
        kw => this.keywordRatingService.getRating(kw.keyword) === undefined
      ).length;
      return this.keywordPagination.displayed.length < filteredCount;
    }
    return this.keywordPagination.displayed.length < this.getKeywordsForCurrentView().length;
  }

  get remainingCount(): number {
    return this.getKeywordsForCurrentView().length - this.keywordPagination.displayed.length;
  }

  get hasMoreTopics(): boolean {
    return this.topicPagination.displayed.length < this.blogTopics.length;
  }

  get remainingTopicsCount(): number {
    return this.blogTopics.length - this.topicPagination.displayed.length;
  }

  get unratedCount(): number {
    return this.getKeywordsForCurrentView().filter(
      kw => this.keywordRatingService.getRating(kw.keyword) === undefined
    ).length;
  }

  // Sorting
  sortColumn: keyof AggregatedKeyword = 'opportunityScore';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Cache state
  cacheMetadata: { timestamp: number; ageInDays: number } | null = null;

  // Pre-computed adjusted scores to avoid calling getAdjustedScore() multiple times per row
  adjustedScores: Record<string, number> = {};

  // Subscription for the analysis Observable — unsubscribed on destroy
  private analysisSubscription: Subscription = Subscription.EMPTY;
  private ratingsSub: Subscription | null = null;

  ngOnInit(): void {
    this.ratingsSub = this.keywordRatingService.ratings$.subscribe(() => {
      this.updateDisplayedKeywords();
      this.cdr.detectChanges();
    });

    // Auto-start analysis when component loads
    this.analyzeCompetitors();
  }

  ngOnDestroy(): void {
    this.analysisSubscription.unsubscribe();
    this.ratingsSub?.unsubscribe();
  }

  analyzeCompetitors(): void {
    if (!this.userDomain || this.competitors.length === 0) {
      this.errorMessage = 'Missing domain or competitors';
      return;
    }

    this.isAnalyzing = true;
    this.errorMessage = '';
    Logger.debug('Starting competitor keyword analysis');

    this.analysisSubscription = this.analysisService.analyzeCompetitors(
      this.userDomain,
      this.userKeywords,
      this.competitors
    ).subscribe({
      next: (results) => {
        Logger.debug('Analysis complete:', results);
        this.results = results;
        this.analysisComplete = true;
        this.isAnalyzing = false;

        // Generate blog topics from non-hidden opportunities
        if (results.opportunities.length > 0) {
          const visibleOpportunities = results.opportunities.filter(
            kw => !this.keywordRatingService.isHidden(kw.keyword)
          );
          this.blogTopics = this.blogTopicService.generateTopics(
            visibleOpportunities,
            visibleOpportunities.length
          );
          Logger.debug('Generated blog topics:', this.blogTopics.length);
        }

        this.cacheMetadata = this.analysisService.getCacheMetadata(
          this.userDomain,
          this.competitors
        );

        // Set initial display (opportunities)
        this.updateDisplayedKeywords();
        this.cdr.detectChanges();
      },
      error: (error) => {
        Logger.error('Analysis error:', error);
        this.isAnalyzing = false;
        this.errorMessage = error.error || 'Failed to analyze competitors';
        this.cdr.detectChanges();
      }
    });
  }

  refreshAnalysis(): void {
    this.analysisService.clearCache(this.userDomain, this.competitors);
    this.cacheMetadata = null;
    this.analysisComplete = false;
    this.analyzeCompetitors();
  }

  setViewMode(mode: ViewMode): void {
    this.showUnratedOnly = false;
    this.viewMode = mode;

    if (mode === 'blog-topics') {
      this.topicPagination.reset(this.blogTopics);
    } else {
      this.updateDisplayedKeywords();
    }
  }

  toggleShowUnratedOnly(): void {
    this.showUnratedOnly = !this.showUnratedOnly;
    this.updateDisplayedKeywords();
    this.cdr.detectChanges();
  }

  updateDisplayedKeywords(): void {
    if (!this.results || this.viewMode === 'blog-topics') return;

    let keywords = this.getKeywordsForCurrentView();

    if (this.showUnratedOnly) {
      keywords = keywords.filter(
        kw => this.keywordRatingService.getRating(kw.keyword) === undefined
      );
    }

    const sorted = this.sortKeywords(keywords);
    this.keywordPagination.reset(sorted);

    // Pre-compute adjusted scores for the full current view (filtered or not) to avoid repeated calls in the template
    this.adjustedScores = {};
    for (const kw of this.getKeywordsForCurrentView()) {
      this.adjustedScores[kw.keyword] = this.getAdjustedScore(kw.keyword, kw.opportunityScore);
    }
  }

  loadMore(): void {
    let keywords = this.getKeywordsForCurrentView();

    if (this.showUnratedOnly) {
      keywords = keywords.filter(
        kw => this.keywordRatingService.getRating(kw.keyword) === undefined
      );
    }

    const newLimit = this.keywordPagination.displayed.length + this.keywordPagination.chunk;
    this.keywordPagination.displayed = this.sortKeywords(keywords).slice(0, newLimit);
    // Ensure adjustedScores covers any newly loaded keywords
    for (const kw of this.keywordPagination.displayed) {
      if (!(kw.keyword in this.adjustedScores)) {
        this.adjustedScores[kw.keyword] = this.getAdjustedScore(kw.keyword, kw.opportunityScore);
      }
    }
    this.cdr.detectChanges();
  }

  sortBy(column: keyof AggregatedKeyword): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }

    this.updateDisplayedKeywords();
  }

  private getKeywordsForCurrentView(): AggregatedKeyword[] {
    if (!this.results) return [];
    switch (this.viewMode) {
      case 'opportunities': return this.results.opportunities;
      case 'all':           return this.results.allKeywords;
      case 'shared':        return this.results.shared;
      case 'unique':        return this.results.uniqueToUser;
      default:              return [];
    }
  }

  private sortKeywords(keywords: AggregatedKeyword[]): AggregatedKeyword[] {
    return [...keywords].sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      if (this.sortColumn === 'userRanking') {
        aVal = a.userRanking?.position ?? 999;
        bVal = b.userRanking?.position ?? 999;
      } else {
        aVal = a[this.sortColumn] as string | number | undefined;
        bVal = b[this.sortColumn] as string | number | undefined;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return this.sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });
  }

  getSortIcon(column: keyof AggregatedKeyword): string {
    if (this.sortColumn !== column) return '↕️';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

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

  loadMoreTopics(): void {
    this.topicPagination.displayed = this.blogTopics.slice(
      0, this.topicPagination.displayed.length + this.topicPagination.chunk
    );
    this.cdr.detectChanges();
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'how-to': 'How-to',
      'list': 'List',
      'best-of': 'Best Of',
      'guide': 'Guide',
      'tips': 'Tips',
      'comparison': 'Comparison',
      'ultimate': 'Ultimate'
    };
    return labels[category] || category;
  }

  exportCurrentView(): void {
    if (!this.results) return;
    const competitorDomains = this.competitors.map(c => c.domain);

    if (this.viewMode === 'blog-topics') {
      this.exportService.exportBlogTopics(this.blogTopics, this.userDomain, competitorDomains);
    } else if (this.viewMode === 'opportunities') {
      this.exportService.exportOpportunities(this.results.opportunities, this.userDomain, competitorDomains);
    } else {
      this.exportService.exportAllKeywords(this.results, this.userDomain, competitorDomains);
    }
  }

  get exportButtonLabel(): string {
    switch (this.viewMode) {
      case 'blog-topics': return 'Export Blog Topics';
      case 'opportunities': return 'Export Opportunities';
      default: return 'Export All Keywords';
    }
  }

  onKeywordRatingChanged(keyword: string, rating: RatingValue | undefined): void {
    if (rating === undefined) {
      this.keywordRatingService.clearRating(keyword);
    } else {
      this.keywordRatingService.setRating(keyword, rating);
    }
  }

  getAdjustedScore(keyword: string, rawScore: number | undefined): number {
    if (rawScore === undefined) return 0;
    return this.keywordRatingService.adjustScore(keyword, rawScore);
  }

  onRegenerateBlogTopics(): void {
    if (!this.results) return;
    Logger.debug('[CompetitorAnalysisComponent] Regenerating blog topics after rating changes');
    const visibleOpportunities = this.results.opportunities.filter(
      kw => !this.keywordRatingService.isHidden(kw.keyword)
    );
    this.blogTopics = this.blogTopicService.generateTopics(
      visibleOpportunities,
      visibleOpportunities.length
    );
    this.keywordRatingService.markBlogTopicsGenerated();
    this.topicPagination.reset(this.blogTopics);
    this.cdr.detectChanges();
  }
}
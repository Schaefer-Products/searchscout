import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Competitor } from '../../models/competitor.model';
import { DomainKeywordRanking } from '../../models/keyword.model';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../../models/aggregated-keyword.model';
import { BlogTopic } from '../../models/blog-topic.model';
import { CompetitorAnalysisService } from '../../services/competitor-analysis.service';
import { BlogTopicGeneratorService } from '../../services/blog-topic-generator.service';
import { Logger } from '../../utils/logger';

type ViewMode = 'opportunities' | 'all' | 'shared' | 'unique' | 'blog-topics';

@Component({
  selector: 'app-competitor-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitor-analysis.component.html',
  styleUrls: ['./competitor-analysis.component.scss']
})
export class CompetitorAnalysisComponent implements OnInit {
  private analysisService = inject(CompetitorAnalysisService);
  private blogTopicService = inject(BlogTopicGeneratorService);
  private cdr = inject(ChangeDetectorRef);

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
  displayedKeywords: AggregatedKeyword[] = [];
  displayedTopics: BlogTopic[] = [];
  displayLimit: number = 50;

  // Sorting
  sortColumn: keyof AggregatedKeyword = 'opportunityScore';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Cache state
  cacheMetadata: { timestamp: number; ageInDays: number } | null = null;

  ngOnInit(): void {
    // Auto-start analysis when component loads
    this.analyzeCompetitors();
  }

  analyzeCompetitors(): void {
    if (!this.userDomain || this.competitors.length === 0) {
      this.errorMessage = 'Missing domain or competitors';
      return;
    }

    this.isAnalyzing = true;
    this.errorMessage = '';
    Logger.debug('Starting competitor keyword analysis');

    this.analysisService.analyzeCompetitors(
      this.userDomain,
      this.userKeywords,
      this.competitors
    ).subscribe({
      next: (results) => {
        Logger.debug('Analysis complete:', results);
        this.results = results;
        this.analysisComplete = true;
        this.isAnalyzing = false;

        // Generate blog topics from opportunities
        if (results.opportunities.length > 0) {
          this.blogTopics = this.blogTopicService.generateTopics(results.opportunities, 20);
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
    this.viewMode = mode;

    if (mode === 'blog-topics') {
      this.displayedTopics = this.blogTopics.slice(0, 20);
    } else {
      this.updateDisplayedKeywords();
    }
  }

  updateDisplayedKeywords(): void {
    if (!this.results) return;

    let keywords: AggregatedKeyword[] = [];

    switch (this.viewMode) {
      case 'opportunities':
        keywords = this.results.opportunities;
        break;
      case 'all':
        keywords = this.results.allKeywords;
        break;
      case 'shared':
        keywords = this.results.shared;
        break;
      case 'unique':
        keywords = this.results.uniqueToUser;
        break;
      case 'blog-topics':
        // Handled separately
        return;
    }

    // Apply sorting
    keywords = this.sortKeywords(keywords);

    // Limit display
    this.displayedKeywords = keywords.slice(0, this.displayLimit);
  }

  loadMore(): void {
    const currentLength = this.displayedKeywords.length;
    const newLimit = currentLength + 50;

    let allKeywords: AggregatedKeyword[] = [];
    if (this.results) {
      switch (this.viewMode) {
        case 'opportunities': allKeywords = this.results.opportunities; break;
        case 'all': allKeywords = this.results.allKeywords; break;
        case 'shared': allKeywords = this.results.shared; break;
        case 'unique': allKeywords = this.results.uniqueToUser; break;
      }
    }

    this.displayedKeywords = this.sortKeywords(allKeywords).slice(0, newLimit);
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

  private sortKeywords(keywords: AggregatedKeyword[]): AggregatedKeyword[] {
    return [...keywords].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (this.sortColumn === 'userRanking') {
        aVal = a.userRanking?.position ?? 999;
        bVal = b.userRanking?.position ?? 999;
      } else {
        aVal = a[this.sortColumn];
        bVal = b[this.sortColumn];
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

  get hasMoreKeywords(): boolean {
    if (!this.results) return false;

    let totalCount = 0;
    switch (this.viewMode) {
      case 'opportunities': totalCount = this.results.opportunities.length; break;
      case 'all': totalCount = this.results.allKeywords.length; break;
      case 'shared': totalCount = this.results.shared.length; break;
      case 'unique': totalCount = this.results.uniqueToUser.length; break;
    }

    return this.displayedKeywords.length < totalCount;
  }

  get remainingCount(): number {
    if (!this.results) return 0;

    let totalCount = 0;
    switch (this.viewMode) {
      case 'opportunities': totalCount = this.results.opportunities.length; break;
      case 'all': totalCount = this.results.allKeywords.length; break;
      case 'shared': totalCount = this.results.shared.length; break;
      case 'unique': totalCount = this.results.uniqueToUser.length; break;
    }

    return totalCount - this.displayedKeywords.length;
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'how-to': 'How-to',
      'list': 'List',
      'best-of': 'Best Of',
      'guide': 'Guide',
      'tips': 'Tips',
      'comparison': 'Comparison',
      'ultimate': 'Ultimate',
      'vs': 'Versus'
    };
    return labels[category] || category;
  }
}
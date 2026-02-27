import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Competitor } from '../../models/competitor.model';
import { DomainKeywordRanking } from '../../models/keyword.model';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../../models/aggregated-keyword.model';
import { BlogTopic } from '../../models/blog-topic.model';
import { CompetitorAnalysisService } from '../../services/competitor-analysis.service';
import { BlogTopicGeneratorService } from '../../services/blog-topic-generator.service';
import { ExportService } from '../../services/export.service';
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
  private exportService = inject(ExportService);
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
          // Generate topics for ALL opportunities (no limit)
          // The service will handle scoring and sorting
          this.blogTopics = this.blogTopicService.generateTopics(
            results.opportunities,
            results.opportunities.length // Generate for all opportunities
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
    this.viewMode = mode;

    if (mode === 'blog-topics') {
      this.displayedTopics = this.blogTopics.slice(0, 20);
    } else {
      this.updateDisplayedKeywords();
    }
  }

  updateDisplayedKeywords(): void {
    if (!this.results || this.viewMode === 'blog-topics') return;
    this.displayedKeywords = this.sortKeywords(this.getKeywordsForCurrentView()).slice(0, this.displayLimit);
  }

  loadMore(): void {
    const newLimit = this.displayedKeywords.length + 50;
    this.displayedKeywords = this.sortKeywords(this.getKeywordsForCurrentView()).slice(0, newLimit);
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
    return this.displayedKeywords.length < this.getKeywordsForCurrentView().length;
  }

  get remainingCount(): number {
    return this.getKeywordsForCurrentView().length - this.displayedKeywords.length;
  }

  loadMoreTopics(): void {
    const currentLength = this.displayedTopics.length;
    const newLimit = Math.min(currentLength + 20, this.blogTopics.length);
    this.displayedTopics = this.blogTopics.slice(0, newLimit);
    this.cdr.detectChanges();
  }

  get hasMoreTopics(): boolean {
    return this.displayedTopics.length < this.blogTopics.length;
  }

  get remainingTopicsCount(): number {
    return this.blogTopics.length - this.displayedTopics.length;
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
}
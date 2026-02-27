import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataforseoService } from '../../services/dataforseo.service';
import { StorageService } from '../../services/storage.service';
import { DomainKeywordRanking } from '../../models/keyword.model';
import { Competitor } from '../../models/competitor.model';
import { CompetitorSelectionComponent } from '../competitor-selection/competitor-selection.component';
import { CompetitorAnalysisComponent } from '../competitor-analysis/competitor-analysis.component';
import { Logger } from '../../utils/logger';
import { cleanDomain, isValidDomain } from '../../utils/domain.utils';
import { PaginatedList } from '../../utils/paginated-list';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CompetitorSelectionComponent, CompetitorAnalysisComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private dataforseoService = inject(DataforseoService);
  private storageService = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);

  // Form state
  domain: string = '';
  isAnalyzing: boolean = false;
  errorMessage: string = '';

  // Results state
  keywords: DomainKeywordRanking[] = [];
  pagination = new PaginatedList<DomainKeywordRanking>(100);
  hasAnalyzed: boolean = false;

  get displayedKeywords(): DomainKeywordRanking[] { return this.pagination.displayed; }
  set displayedKeywords(v: DomainKeywordRanking[]) { this.pagination.displayed = v; }

  // Cache state
  cacheMetadata: { timestamp: number; ageInDays: number } | null = null;

  // Sorting state
  sortColumn: keyof DomainKeywordRanking = 'position';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Competitor state
  selectedCompetitors: Competitor[] = [];
  showCompetitorSelection: boolean = false;
  showCompetitorAnalysis: boolean = false;

  ngOnInit(): void {
    // Load saved domain and competitors on init
    const savedDomain = this.storageService.getCurrentDomain();
    if (savedDomain) {
      this.domain = savedDomain;
      Logger.debug('Restored domain from storage:', savedDomain);

      // Load saved competitors for this domain
      const savedCompetitors = this.storageService.getSelectedCompetitors(savedDomain);
      if (savedCompetitors && savedCompetitors.length > 0) {
        this.selectedCompetitors = savedCompetitors;
        Logger.debug('Restored competitors from storage:', savedCompetitors);
      }

      // Auto-analyze if we have cached data
      const cachedKeywords = this.dataforseoService.getDomainCacheMetadata(savedDomain);
      if (cachedKeywords) {
        Logger.debug('Found cached keywords, auto-analyzing...');
        this.analyzeDomain();
      }
    }
  }

  analyzeDomain(): void {
    this.errorMessage = '';

    // Validate domain
    const cleaned = cleanDomain(this.domain);
    if (!cleaned) {
      this.errorMessage = 'Please enter a valid domain (e.g., example.com)';
      return;
    }

    // Additional validation for garbage input
    if (!isValidDomain(cleaned)) {
      this.errorMessage = 'Invalid domain format. Please enter a valid domain like example.com';
      return;
    }

    // Check if this is a DIFFERENT domain than what's saved
    const savedDomain = this.storageService.getCurrentDomain();
    const isDifferentDomain = savedDomain !== cleaned;

    // Save current domain to storage (update to new domain)
    this.storageService.saveCurrentDomain(cleaned);

    // Load competitors for this domain (even if it's the same domain)
    const savedCompetitors = this.storageService.getSelectedCompetitors(cleaned);

    if (isDifferentDomain) {
      Logger.debug('Different domain detected, loading saved competitors for:', cleaned);

      // Load saved competitors for the new domain (or empty array if none)
      this.selectedCompetitors = savedCompetitors || [];
      this.showCompetitorSelection = false;
      this.showCompetitorAnalysis = false;

      Logger.debug('Loaded competitors:', this.selectedCompetitors);
    } else {
      Logger.debug('Same domain, keeping current competitor state');
    }

    this.isAnalyzing = true;
    this.hasAnalyzed = false;
    Logger.debug('Analyzing domain:', cleaned);

    this.dataforseoService.fetchDomainKeywords(cleaned).subscribe({
      next: (keywords) => {
        Logger.debug('Received keywords:', keywords.length);
        Logger.debug('First keyword:', keywords[0]);

        this.keywords = keywords;
        this.pagination.reset(keywords);
        this.hasAnalyzed = true;
        this.isAnalyzing = false;

        this.cacheMetadata = this.dataforseoService.getDomainCacheMetadata(cleaned);

        if (keywords.length === 0) {
          this.errorMessage = 'No ranking keywords found for this domain. This could mean the domain is new or not yet indexed.';
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        Logger.error('Error analyzing domain:', error);
        this.isAnalyzing = false;
        this.errorMessage = error.error || 'Failed to analyze domain';
        this.cdr.detectChanges();
      }
    });
  }

  onCompetitorsSelected(competitors: Competitor[]): void {
    this.selectedCompetitors = competitors;
    this.showCompetitorSelection = false;
    this.storageService.saveSelectedCompetitors(cleanDomain(this.domain), competitors);

    // Toggle *ngIf to destroy the old CompetitorAnalysisComponent and recreate it fresh.
    this.showCompetitorAnalysis = false;
    this.cdr.detectChanges();
    this.showCompetitorAnalysis = true;
  }

  refreshData(): void {
    if (!this.domain) return;

    const cleaned = cleanDomain(this.domain);
    if (!cleaned) return;

    // Clear cache and fetch fresh data
    this.dataforseoService.clearDomainCache(cleaned);
    this.cacheMetadata = null;
    this.analyzeDomain();
  }

  sortBy(column: keyof DomainKeywordRanking): void {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.keywords = [...this.keywords].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];

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

    this.pagination.reset(this.keywords);
    this.cdr.detectChanges();
  }

  loadMore(): void {
    this.pagination.loadMore();
    this.cdr.detectChanges();
  }

  get hasMoreKeywords(): boolean {
    return this.pagination.displayed.length < this.keywords.length;
  }

  getSortIcon(column: keyof DomainKeywordRanking): string {
    if (this.sortColumn !== column) return '↕️';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  get totalSearchVolume(): number {
    return this.keywords.reduce((sum, k) => sum + k.searchVolume, 0);
  }

  get averagePosition(): number {
    if (this.keywords.length === 0) return 0;
    const sum = this.keywords.reduce((sum, k) => sum + k.position, 0);
    return Math.round(sum / this.keywords.length * 10) / 10;
  }

  get topThreeCount(): number {
    return this.keywords.filter(k => k.position <= 3).length;
  }
}
import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Competitor } from '../../models/competitor.model';
import { DataforseoService } from '../../services/dataforseo.service';
import { Logger } from '../../utils/logger';

@Component({
  selector: 'app-competitor-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitor-selection.component.html',
  styleUrls: ['./competitor-selection.component.scss']
})
export class CompetitorSelectionComponent {
  private dataforseoService = inject(DataforseoService);
  private cdr = inject(ChangeDetectorRef);

  @Input() userDomain: string = '';
  @Output() competitorsSelected = new EventEmitter<Competitor[]>();

  // Discovery state
  isDiscovering: boolean = false;
  discoveryComplete: boolean = false;
  allCompetitors: Competitor[] = [];
  displayedCompetitors: Competitor[] = [];
  displayLimit: number = 20;
  selectedCompetitors: Set<string> = new Set();

  cacheMetadata: { timestamp: number; ageInDays: number } | null = null;

  // Manual entry
  manualDomain: string = '';
  manualError: string = '';

  // Error state
  errorMessage: string = '';

  discoverCompetitors(): void {
    if (!this.userDomain) {
      this.errorMessage = 'No domain provided';
      return;
    }

    this.isDiscovering = true;
    this.errorMessage = '';
    Logger.debug('Discovering competitors for:', this.userDomain);

    this.dataforseoService.discoverCompetitors(this.userDomain).subscribe({
      next: (competitors) => {
        Logger.debug('Discovered competitors:', competitors.length);
        this.allCompetitors = competitors;
        this.displayedCompetitors = competitors.slice(0, this.displayLimit);
        this.discoveryComplete = true;
        this.isDiscovering = false;

        this.cacheMetadata = this.dataforseoService.getCompetitorsCacheMetadata(this.userDomain);

        // Auto-select top 5 competitors
        competitors.slice(0, 5).forEach(comp => {
          this.selectedCompetitors.add(comp.domain);
        });

        if (competitors.length === 0) {
          this.errorMessage = 'No competitors found. Try adding competitors manually.';
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        Logger.error('Error discovering competitors:', error);
        this.isDiscovering = false;
        this.errorMessage = error.error || 'Failed to discover competitors';
        this.cdr.detectChanges();
      }
    });
  }

  refreshCompetitors(): void {
    if (!this.userDomain) return;

    // Clear cache and fetch fresh data
    this.dataforseoService.clearCompetitorsCache(this.userDomain);
    this.cacheMetadata = null;

    // Reset state
    this.discoveryComplete = false;
    this.allCompetitors = [];
    this.displayedCompetitors = [];
    this.selectedCompetitors.clear();

    // Re-discover
    this.discoverCompetitors();
  }

  // Load more competitors
  loadMore(): void {
    const currentLength = this.displayedCompetitors.length;
    const newLimit = Math.min(currentLength + 20, this.allCompetitors.length);
    this.displayedCompetitors = this.allCompetitors.slice(0, newLimit);
    this.cdr.detectChanges();
  }

  // Check if more competitors available to load
  get hasMoreCompetitors(): boolean {
    return this.displayedCompetitors.length < this.allCompetitors.length;
  }

  // Get count of remaining competitors
  get remainingCount(): number {
    return this.allCompetitors.length - this.displayedCompetitors.length;
  }

  toggleCompetitor(domain: string): void {
    if (this.selectedCompetitors.has(domain)) {
      this.selectedCompetitors.delete(domain);
    } else {
      this.selectedCompetitors.add(domain);
    }
  }

  isSelected(domain: string): boolean {
    return this.selectedCompetitors.has(domain);
  }

  addManualCompetitor(): void {
    this.manualError = '';

    if (!this.manualDomain.trim()) {
      this.manualError = 'Please enter a domain';
      return;
    }

    const cleanDomain = this.cleanDomain(this.manualDomain);

    if (!this.isValidDomain(cleanDomain)) {
      this.manualError = 'Invalid domain format';
      return;
    }

    // Check if already in list
    if (this.allCompetitors.some(c => c.domain === cleanDomain)) {
      this.manualError = 'This competitor is already in the list';
      return;
    }

    // Add manual competitor
    const manualCompetitor: Competitor = {
      domain: cleanDomain,
      keywordOverlap: 0, // Unknown until we analyze
      totalKeywords: 0,
      isManual: true
    };

    this.allCompetitors.push(manualCompetitor);
    this.displayedCompetitors.push(manualCompetitor);
    this.selectedCompetitors.add(cleanDomain);
    this.manualDomain = '';

    Logger.debug('Added manual competitor:', cleanDomain);
  }

  removeCompetitor(domain: string): void {
    this.allCompetitors = this.allCompetitors.filter(c => c.domain !== domain);
    this.displayedCompetitors = this.displayedCompetitors.filter(c => c.domain !== domain);
    this.selectedCompetitors.delete(domain);
  }

  confirmSelection(): void {
    const selected = this.allCompetitors.filter(c =>
      this.selectedCompetitors.has(c.domain)
    );

    Logger.debug('Confirmed competitors:', selected);
    this.competitorsSelected.emit(selected);
  }

  private cleanDomain(input: string): string {
    let cleaned = input.trim().toLowerCase();
    cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
    cleaned = cleaned.replace(/\/.*$/, '');
    return cleaned;
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  get selectedCount(): number {
    return this.selectedCompetitors.size;
  }

  // Get total count for display
  get totalCompetitorsCount(): number {
    return this.allCompetitors.length;
  }
}
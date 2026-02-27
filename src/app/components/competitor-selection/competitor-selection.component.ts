import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Competitor } from '../../models/competitor.model';
import { DataforseoService } from '../../services/dataforseo.service';
import { Logger } from '../../utils/logger';
import { cleanDomain, isValidDomain } from '../../utils/domain.utils';

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
  @Input() preSelectedCompetitors: Competitor[] = [];
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

  ngOnInit(): void {
    // Pre-select competitors if provided
    if (this.preSelectedCompetitors.length > 0) {
      Logger.debug('Pre-selecting competitors:', this.preSelectedCompetitors);

      // Add pre-selected competitors to the set
      this.preSelectedCompetitors.forEach(comp => {
        this.selectedCompetitors.add(comp.domain);
      });

      // If we have pre-selected competitors, auto-discover
      this.discoverCompetitors();
    }
  }

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

        // Separate pre-selected competitors from newly discovered
        const preSelectedDomains = new Set(this.preSelectedCompetitors.map(c => c.domain));

        // Pre-selected competitors that were discovered (with updated data)
        const preSelectedDiscovered = competitors.filter(c => preSelectedDomains.has(c.domain));

        // Pre-selected manual competitors that weren't discovered
        const preSelectedManual = this.preSelectedCompetitors.filter(
          pc => !competitors.some(c => c.domain === pc.domain)
        );

        // Newly discovered competitors (not pre-selected)
        const newlyDiscovered = competitors.filter(c => !preSelectedDomains.has(c.domain));

        // Combine: pre-selected first (both discovered and manual), then new ones
        this.allCompetitors = [
          ...preSelectedDiscovered,
          ...preSelectedManual,
          ...newlyDiscovered
        ];
        this.displayedCompetitors = this.allCompetitors.slice(0, this.displayLimit);
        this.discoveryComplete = true;
        this.isDiscovering = false;

        // Get cache metadata
        this.cacheMetadata = this.dataforseoService.getCompetitorsCacheMetadata(this.userDomain);

        // If no pre-selected competitors, auto-select top 5 discovered
        if (this.preSelectedCompetitors.length === 0) {
          competitors.slice(0, 5).forEach(comp => {
            this.selectedCompetitors.add(comp.domain);
          });
        }

        // Pre-selected competitors are already in the Set from ngOnInit
        if (this.allCompetitors.length === 0) {
          this.errorMessage = 'No competitors found. Try adding competitors manually.';
        }

        Logger.debug('Competitors ordered - Pre-selected:', preSelectedDiscovered.length + preSelectedManual.length, 'New:', newlyDiscovered.length);

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

    // Reset state but KEEP selected competitors
    this.discoveryComplete = false;
    this.allCompetitors = [];
    this.displayedCompetitors = [];
    // Don't clear selectedCompetitors - keep current selection

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

    const cleaned = cleanDomain(this.manualDomain);

    if (!isValidDomain(cleaned)) {
      this.manualError = 'Invalid domain format';
      return;
    }

    // Check if already in list
    if (this.allCompetitors.some(c => c.domain === cleaned)) {
      this.manualError = 'This competitor is already in the list';
      return;
    }

    // Add manual competitor
    const manualCompetitor: Competitor = {
      domain: cleaned,
      keywordOverlap: 0, // Unknown until we analyze
      totalKeywords: 0,
      isManual: true
    };

    this.allCompetitors.push(manualCompetitor);
    this.displayedCompetitors.push(manualCompetitor);
    this.selectedCompetitors.add(cleaned);
    this.manualDomain = '';

    Logger.debug('Added manual competitor:', cleaned);
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

  get selectedCount(): number {
    return this.selectedCompetitors.size;
  }

  // Get total count for display
  get totalCompetitorsCount(): number {
    return this.allCompetitors.length;
  }
}
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DataforseoService } from '../../services/dataforseo.service';
import { StorageService } from '../../services/storage.service';
import { Competitor } from '../../models/competitor.model';
import { DomainKeywordRanking } from '../../models/keyword.model';

// ─── Stub child components ────────────────────────────────────────────────────
// Prevents real child component services from being injected and calling APIs

@Component({ selector: 'app-competitor-selection', standalone: true, template: '' })
class MockCompetitorSelectionComponent {
  @Input() userDomain = '';
  @Input() preSelectedCompetitors: Competitor[] = [];
  @Output() competitorsSelected = new EventEmitter<Competitor[]>();
}

@Component({ selector: 'app-competitor-analysis', standalone: true, template: '' })
class MockCompetitorAnalysisComponent {
  @Input() userDomain = '';
  @Input() userKeywords: DomainKeywordRanking[] = [];
  @Input() competitors: Competitor[] = [];
}

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeKeyword(overrides: Partial<DomainKeywordRanking> = {}): DomainKeywordRanking {
  return { keyword: 'seo tools', searchVolume: 5000, difficulty: 40, position: 5, ...overrides };
}

function makeCompetitor(domain = 'rival.com'): Competitor {
  return { domain, keywordOverlap: 100, totalKeywords: 500 };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let dataforseoSpy: jasmine.SpyObj<DataforseoService>;
  let storageSpy: jasmine.SpyObj<StorageService>;

  beforeEach(async () => {
    dataforseoSpy = jasmine.createSpyObj('DataforseoService', [
      'fetchDomainKeywords', 'getDomainCacheMetadata', 'clearDomainCache',
    ]);
    storageSpy = jasmine.createSpyObj('StorageService', [
      'getCurrentDomain', 'getSelectedCompetitors', 'saveCurrentDomain', 'saveSelectedCompetitors',
    ]);

    // Safe defaults — no real network calls
    dataforseoSpy.fetchDomainKeywords.and.returnValue(of([]));
    dataforseoSpy.getDomainCacheMetadata.and.returnValue(null);
    storageSpy.getCurrentDomain.and.returnValue(null);
    storageSpy.getSelectedCompetitors.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DataforseoService, useValue: dataforseoSpy },
        { provide: StorageService, useValue: storageSpy },
      ],
    })
    .overrideComponent(DashboardComponent, {
      set: {
        imports: [CommonModule, FormsModule, MockCompetitorSelectionComponent, MockCompetitorAnalysisComponent],
      },
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    // detectChanges() deferred so each group controls when ngOnInit fires
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('should default domain to empty string', () => {
      expect(component.domain).toBe('');
    });

    it('should not be analyzing', () => {
      expect(component.isAnalyzing).toBeFalse();
    });

    it('should have no error message', () => {
      expect(component.errorMessage).toBe('');
    });

    it('should have no keywords', () => {
      expect(component.keywords).toEqual([]);
    });

    it('should have hasAnalyzed as false', () => {
      expect(component.hasAnalyzed).toBeFalse();
    });

    it('should default sortColumn to "position"', () => {
      expect(component.sortColumn).toBe('position');
    });

    it('should default sortDirection to "asc"', () => {
      expect(component.sortDirection).toBe('asc');
    });

    it('should have showCompetitorSelection as false', () => {
      expect(component.showCompetitorSelection).toBeFalse();
    });

    it('should have showCompetitorAnalysis as false', () => {
      expect(component.showCompetitorAnalysis).toBeFalse();
    });

    it('should have no selected competitors', () => {
      expect(component.selectedCompetitors).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // ngOnInit()
  // ---------------------------------------------------------------------------

  describe('ngOnInit()', () => {
    it('should do nothing when there is no saved domain', () => {
      storageSpy.getCurrentDomain.and.returnValue(null);
      spyOn(component, 'analyzeDomain');
      component.ngOnInit();
      expect(component.domain).toBe('');
      expect(component.analyzeDomain).not.toHaveBeenCalled();
    });

    it('should restore the saved domain', () => {
      storageSpy.getCurrentDomain.and.returnValue('mysite.com');
      component.ngOnInit();
      expect(component.domain).toBe('mysite.com');
    });

    it('should restore saved competitors when they exist', () => {
      const competitors = [makeCompetitor()];
      storageSpy.getCurrentDomain.and.returnValue('mysite.com');
      storageSpy.getSelectedCompetitors.and.returnValue(competitors);
      component.ngOnInit();
      expect(component.selectedCompetitors).toEqual(competitors);
    });

    it('should leave selectedCompetitors empty when none are saved', () => {
      storageSpy.getCurrentDomain.and.returnValue('mysite.com');
      storageSpy.getSelectedCompetitors.and.returnValue(null);
      component.ngOnInit();
      expect(component.selectedCompetitors).toEqual([]);
    });

    it('should auto-analyze when cached keyword data exists', () => {
      storageSpy.getCurrentDomain.and.returnValue('mysite.com');
      dataforseoSpy.getDomainCacheMetadata.and.returnValue({ timestamp: Date.now(), ageInDays: 1 });
      spyOn(component, 'analyzeDomain');
      component.ngOnInit();
      expect(component.analyzeDomain).toHaveBeenCalled();
    });

    it('should not auto-analyze when there is no cached data', () => {
      storageSpy.getCurrentDomain.and.returnValue('mysite.com');
      dataforseoSpy.getDomainCacheMetadata.and.returnValue(null);
      spyOn(component, 'analyzeDomain');
      component.ngOnInit();
      expect(component.analyzeDomain).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // analyzeDomain()
  // ---------------------------------------------------------------------------

  describe('analyzeDomain()', () => {
    it('should set errorMessage when domain is empty', () => {
      component.domain = '';
      component.analyzeDomain();
      expect(component.errorMessage).toBe('Please enter a valid domain (e.g., example.com)');
      expect(dataforseoSpy.fetchDomainKeywords).not.toHaveBeenCalled();
    });

    it('should set errorMessage when domain is whitespace only', () => {
      component.domain = '   ';
      component.analyzeDomain();
      expect(component.errorMessage).toBe('Please enter a valid domain (e.g., example.com)');
    });

    it('should set errorMessage for an invalid domain format', () => {
      component.domain = 'not a domain!!';
      component.analyzeDomain();
      expect(component.errorMessage).toBe(
        'Invalid domain format. Please enter a valid domain like example.com'
      );
      expect(dataforseoSpy.fetchDomainKeywords).not.toHaveBeenCalled();
    });

    it('should strip http://, www. and trailing path before fetching', () => {
      component.domain = 'https://www.example.com/some/path';
      component.analyzeDomain();
      expect(dataforseoSpy.fetchDomainKeywords).toHaveBeenCalledWith('example.com');
    });

    it('should save the cleaned domain to storage', () => {
      component.domain = 'https://www.mysite.com/page';
      component.analyzeDomain();
      expect(storageSpy.saveCurrentDomain).toHaveBeenCalledWith('mysite.com');
    });

    it('should reset competitor UI panels when the domain changes', () => {
      storageSpy.getCurrentDomain.and.returnValue('old-site.com');
      component.showCompetitorSelection = true;
      component.showCompetitorAnalysis = true;
      component.domain = 'new-site.com';
      component.analyzeDomain();
      expect(component.showCompetitorSelection).toBeFalse();
      expect(component.showCompetitorAnalysis).toBeFalse();
    });

    it('should load saved competitors for the new domain', () => {
      const competitors = [makeCompetitor()];
      storageSpy.getCurrentDomain.and.returnValue('old-site.com');
      storageSpy.getSelectedCompetitors.and.returnValue(competitors);
      component.domain = 'new-site.com';
      component.analyzeDomain();
      expect(component.selectedCompetitors).toEqual(competitors);
    });

    it('should set selectedCompetitors to [] when no competitors saved for new domain', () => {
      storageSpy.getCurrentDomain.and.returnValue('old-site.com');
      storageSpy.getSelectedCompetitors.and.returnValue(null);
      component.domain = 'new-site.com';
      component.analyzeDomain();
      expect(component.selectedCompetitors).toEqual([]);
    });

    it('should set isAnalyzing to true while the request is pending', () => {
      const pending$ = new Subject<DomainKeywordRanking[]>();
      dataforseoSpy.fetchDomainKeywords.and.returnValue(pending$.asObservable());
      component.domain = 'mysite.com';
      component.analyzeDomain();
      expect(component.isAnalyzing).toBeTrue();
    });

    describe('on success', () => {
      const keywords = [
        makeKeyword({ keyword: 'a', position: 1 }),
        makeKeyword({ keyword: 'b', position: 5 }),
      ];

      beforeEach(() => {
        component.domain = 'mysite.com';
        dataforseoSpy.fetchDomainKeywords.and.returnValue(of(keywords));
      });

      it('should store the returned keywords', () => {
        component.analyzeDomain();
        expect(component.keywords).toEqual(keywords);
      });

      it('should populate displayedKeywords up to displayLimit', () => {
        component.analyzeDomain();
        expect(component.displayedKeywords.length).toBe(keywords.length);
      });

      it('should set hasAnalyzed to true', () => {
        component.analyzeDomain();
        expect(component.hasAnalyzed).toBeTrue();
      });

      it('should set isAnalyzing to false', () => {
        component.analyzeDomain();
        expect(component.isAnalyzing).toBeFalse();
      });

      it('should fetch and store cache metadata', () => {
        const meta = { timestamp: Date.now(), ageInDays: 2 };
        dataforseoSpy.getDomainCacheMetadata.and.returnValue(meta);
        component.analyzeDomain();
        expect(component.cacheMetadata).toEqual(meta);
      });

      it('should set errorMessage when no keywords are returned', () => {
        dataforseoSpy.fetchDomainKeywords.and.returnValue(of([]));
        component.analyzeDomain();
        expect(component.errorMessage).toContain('No ranking keywords found');
      });

      it('should leave errorMessage empty when keywords are found', () => {
        component.errorMessage = 'Previous error';
        component.analyzeDomain();
        expect(component.errorMessage).toBe('');
      });
    });

    describe('on error', () => {
      beforeEach(() => {
        component.domain = 'mysite.com';
      });

      it('should set isAnalyzing to false', () => {
        dataforseoSpy.fetchDomainKeywords.and.returnValue(throwError(() => ({ error: 'API error' })));
        component.analyzeDomain();
        expect(component.isAnalyzing).toBeFalse();
      });

      it('should show error.error when present', () => {
        dataforseoSpy.fetchDomainKeywords.and.returnValue(throwError(() => ({ error: 'API error' })));
        component.analyzeDomain();
        expect(component.errorMessage).toBe('API error');
      });

      it('should show a generic message when error has no error property', () => {
        dataforseoSpy.fetchDomainKeywords.and.returnValue(throwError(() => ({})));
        component.analyzeDomain();
        expect(component.errorMessage).toBe('Failed to analyze domain');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // onCompetitorsSelected()
  // ---------------------------------------------------------------------------

  describe('onCompetitorsSelected()', () => {
    beforeEach(() => {
      component.domain = 'mysite.com';
      component.showCompetitorSelection = true;
    });

    it('should store the selected competitors', () => {
      const competitors = [makeCompetitor()];
      component.onCompetitorsSelected(competitors);
      expect(component.selectedCompetitors).toEqual(competitors);
    });

    it('should hide the competitor selection panel', () => {
      component.onCompetitorsSelected([makeCompetitor()]);
      expect(component.showCompetitorSelection).toBeFalse();
    });

    it('should show the competitor analysis panel', () => {
      component.onCompetitorsSelected([makeCompetitor()]);
      expect(component.showCompetitorAnalysis).toBeTrue();
    });

    it('should save selected competitors to storage with the cleaned domain', () => {
      const competitors = [makeCompetitor()];
      component.onCompetitorsSelected(competitors);
      expect(storageSpy.saveSelectedCompetitors).toHaveBeenCalledWith('mysite.com', competitors);
    });
  });

  // ---------------------------------------------------------------------------
  // refreshData()
  // ---------------------------------------------------------------------------

  describe('refreshData()', () => {
    it('should do nothing when domain is empty', () => {
      component.domain = '';
      component.refreshData();
      expect(dataforseoSpy.clearDomainCache).not.toHaveBeenCalled();
    });

    it('should clear the domain cache', () => {
      component.domain = 'mysite.com';
      spyOn(component, 'analyzeDomain');
      component.refreshData();
      expect(dataforseoSpy.clearDomainCache).toHaveBeenCalledWith('mysite.com');
    });

    it('should reset cacheMetadata to null', () => {
      component.domain = 'mysite.com';
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 1 };
      spyOn(component, 'analyzeDomain');
      component.refreshData();
      expect(component.cacheMetadata).toBeNull();
    });

    it('should trigger analyzeDomain', () => {
      component.domain = 'mysite.com';
      spyOn(component, 'analyzeDomain');
      component.refreshData();
      expect(component.analyzeDomain).toHaveBeenCalled();
    });

    it('should strip protocol and www when clearing cache', () => {
      component.domain = 'https://www.mysite.com/path';
      spyOn(component, 'analyzeDomain');
      component.refreshData();
      expect(dataforseoSpy.clearDomainCache).toHaveBeenCalledWith('mysite.com');
    });
  });

  // ---------------------------------------------------------------------------
  // sortBy()
  // ---------------------------------------------------------------------------

  describe('sortBy()', () => {
    beforeEach(() => {
      component.keywords = [
        makeKeyword({ keyword: 'b kw', searchVolume: 100, position: 5 }),
        makeKeyword({ keyword: 'a kw', searchVolume: 500, position: 2 }),
        makeKeyword({ keyword: 'c kw', searchVolume: 250, position: 10 }),
      ];
      component.displayedKeywords = [...component.keywords];
    });

    it('should toggle direction to desc when re-clicking the active column (was asc)', () => {
      component.sortColumn = 'position';
      component.sortDirection = 'asc';
      component.sortBy('position');
      expect(component.sortDirection).toBe('desc');
    });

    it('should toggle direction to asc when re-clicking the active column (was desc)', () => {
      component.sortColumn = 'position';
      component.sortDirection = 'desc';
      component.sortBy('position');
      expect(component.sortDirection).toBe('asc');
    });

    it('should set a new column with ascending direction', () => {
      component.sortColumn = 'position';
      component.sortBy('searchVolume');
      expect(component.sortColumn).toBe('searchVolume');
      expect(component.sortDirection).toBe('asc');
    });

    it('should sort numbers ascending', () => {
      component.sortColumn = 'searchVolume';
      component.sortBy('position'); // new column → asc
      expect(component.displayedKeywords[0].position).toBe(2);
      expect(component.displayedKeywords[2].position).toBe(10);
    });

    it('should sort numbers descending', () => {
      component.sortColumn = 'position';
      component.sortDirection = 'asc';
      component.sortBy('position'); // toggle → desc
      expect(component.displayedKeywords[0].position).toBe(10);
      expect(component.displayedKeywords[2].position).toBe(2);
    });

    it('should sort strings ascending via localeCompare', () => {
      component.sortColumn = 'position';
      component.sortBy('keyword'); // new column → asc
      expect(component.displayedKeywords[0].keyword).toBe('a kw');
      expect(component.displayedKeywords[2].keyword).toBe('c kw');
    });

    it('should sort strings descending via localeCompare', () => {
      component.sortColumn = 'keyword';
      component.sortDirection = 'asc';
      component.sortBy('keyword'); // toggle → desc
      expect(component.displayedKeywords[0].keyword).toBe('c kw');
      expect(component.displayedKeywords[2].keyword).toBe('a kw');
    });

    it('should update displayedKeywords after sorting', () => {
      component.sortBy('searchVolume');
      expect(component.displayedKeywords.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // loadMore()
  // ---------------------------------------------------------------------------

  describe('loadMore()', () => {
    it('should extend displayedKeywords by 100', () => {
      component.keywords = Array.from({ length: 250 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.pagination.reset(component.keywords);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(200);
    });

    it('should not exceed total keywords', () => {
      component.keywords = Array.from({ length: 120 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.pagination.reset(component.keywords);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(120);
    });
  });

  // ---------------------------------------------------------------------------
  // hasMoreKeywords
  // ---------------------------------------------------------------------------

  describe('hasMoreKeywords', () => {
    it('should return true when more keywords exist beyond displayedKeywords', () => {
      component.keywords = Array.from({ length: 150 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.displayedKeywords = component.keywords.slice(0, 100);
      expect(component.hasMoreKeywords).toBeTrue();
    });

    it('should return false when all keywords are already displayed', () => {
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [...component.keywords];
      expect(component.hasMoreKeywords).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // getSortIcon()
  // ---------------------------------------------------------------------------

  describe('getSortIcon()', () => {
    it('should return ↕️ for an inactive column', () => {
      component.sortColumn = 'position';
      expect(component.getSortIcon('searchVolume')).toBe('↕️');
    });

    it('should return ↑ for the active column when ascending', () => {
      component.sortColumn = 'position';
      component.sortDirection = 'asc';
      expect(component.getSortIcon('position')).toBe('↑');
    });

    it('should return ↓ for the active column when descending', () => {
      component.sortColumn = 'position';
      component.sortDirection = 'desc';
      expect(component.getSortIcon('position')).toBe('↓');
    });
  });

  // ---------------------------------------------------------------------------
  // Computed getters
  // ---------------------------------------------------------------------------

  describe('totalSearchVolume', () => {
    it('should sum all keyword search volumes', () => {
      component.keywords = [
        makeKeyword({ searchVolume: 1000 }),
        makeKeyword({ searchVolume: 2500 }),
        makeKeyword({ searchVolume: 500 }),
      ];
      expect(component.totalSearchVolume).toBe(4000);
    });

    it('should return 0 when there are no keywords', () => {
      component.keywords = [];
      expect(component.totalSearchVolume).toBe(0);
    });
  });

  describe('averagePosition', () => {
    it('should return the mean position rounded to one decimal place', () => {
      component.keywords = [
        makeKeyword({ position: 1 }),
        makeKeyword({ position: 2 }),
        makeKeyword({ position: 3 }),
      ];
      expect(component.averagePosition).toBe(2);
    });

    it('should handle non-integer averages correctly', () => {
      component.keywords = [
        makeKeyword({ position: 1 }),
        makeKeyword({ position: 2 }),
      ];
      expect(component.averagePosition).toBe(1.5);
    });

    it('should return 0 when there are no keywords', () => {
      component.keywords = [];
      expect(component.averagePosition).toBe(0);
    });
  });

  describe('topThreeCount', () => {
    it('should count only keywords with position <= 3', () => {
      component.keywords = [
        makeKeyword({ position: 1 }),
        makeKeyword({ position: 3 }),
        makeKeyword({ position: 4 }),
        makeKeyword({ position: 10 }),
      ];
      expect(component.topThreeCount).toBe(2);
    });

    it('should return 0 when no keywords are in the top 3', () => {
      component.keywords = [makeKeyword({ position: 5 }), makeKeyword({ position: 12 })];
      expect(component.topThreeCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Template / DOM
  // ---------------------------------------------------------------------------

  describe('template', () => {
    beforeEach(() => {
      // Prevent ngOnInit from triggering analyzeDomain side-effects
      spyOn(component, 'analyzeDomain');
      fixture.detectChanges();
    });

    it('should render the SearchScout heading', () => {
      expect((fixture.nativeElement.querySelector('h1') as HTMLElement).textContent)
        .toContain('SearchScout');
    });

    it('should disable the submit button when domain is empty', () => {
      component.domain = '';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should enable the submit button when domain is filled', () => {
      component.domain = 'mysite.com';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeFalse();
    });

    it('should disable the submit button while isAnalyzing is true', () => {
      component.domain = 'mysite.com';
      component.isAnalyzing = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should show "Analyzing..." when isAnalyzing is true', () => {
      component.isAnalyzing = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Analyzing...');
    });

    it('should show "Analyze Domain" when not analyzing', () => {
      component.isAnalyzing = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Analyze Domain');
    });

    it('should call analyzeDomain when the form is submitted', () => {
      (fixture.nativeElement.querySelector('.domain-form') as HTMLFormElement)
        .dispatchEvent(new Event('submit'));
      expect(component.analyzeDomain).toHaveBeenCalled();
    });

    it('should show error message when errorMessage is set and not analyzing', () => {
      component.errorMessage = 'Something failed';
      component.isAnalyzing = false;
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.error-message') as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.textContent).toContain('Something failed');
    });

    it('should hide error message while analyzing', () => {
      component.errorMessage = 'Something failed';
      component.isAnalyzing = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-message')).toBeNull();
    });

    it('should not show the results section before analysis', () => {
      component.hasAnalyzed = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.results-section')).toBeNull();
    });

    it('should show the results section after analysis with keywords', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.results-section')).not.toBeNull();
    });

    it('should show the empty state when hasAnalyzed and no keywords and no error', () => {
      component.hasAnalyzed = true;
      component.keywords = [];
      component.errorMessage = '';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    });

    it('should hide the empty state when there is an error message', () => {
      component.hasAnalyzed = true;
      component.keywords = [];
      component.errorMessage = 'API error';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('should show "Fresh data" badge when cacheMetadata is null', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.cacheMetadata = null;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cache-info.fresh')).not.toBeNull();
    });

    it('should show cache age when cacheMetadata is set', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 5 };
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.cache-info:not(.fresh)') as HTMLElement;
      expect(el.textContent).toContain('5');
    });

    it('should call refreshData when the refresh button is clicked', () => {
      spyOn(component, 'refreshData');
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-refresh') as HTMLButtonElement).click();
      expect(component.refreshData).toHaveBeenCalled();
    });

    it('should show the competitor prompt when no competitors are selected yet', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.showCompetitorSelection = false;
      component.showCompetitorAnalysis = false;
      component.selectedCompetitors = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.competitor-prompt')).not.toBeNull();
    });

    it('should hide the competitor prompt when competitors are already selected', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.selectedCompetitors = [makeCompetitor()];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.competitor-prompt')).toBeNull();
    });

    it('should set showCompetitorSelection to true when "Find Competitors" is clicked', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.showCompetitorSelection = false;
      component.showCompetitorAnalysis = false;
      component.selectedCompetitors = [];
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-discover-competitors') as HTMLButtonElement).click();
      expect(component.showCompetitorSelection).toBeTrue();
    });

    it('should show selected competitors section when competitors exist and hasAnalyzed', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.selectedCompetitors = [makeCompetitor('rival.com')];
      component.showCompetitorSelection = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.selected-competitors-section')).not.toBeNull();
    });

    it('should set showCompetitorSelection to true when "Change Selection" is clicked', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword()];
      component.displayedKeywords = [makeKeyword()];
      component.selectedCompetitors = [makeCompetitor()];
      component.showCompetitorSelection = false;
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-change') as HTMLButtonElement).click();
      expect(component.showCompetitorSelection).toBeTrue();
    });

    it('should show the load-more button when hasMoreKeywords is true', () => {
      component.hasAnalyzed = true;
      component.keywords = Array.from({ length: 150 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.displayedKeywords = component.keywords.slice(0, 100);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.btn-load-more')).not.toBeNull();
    });

    it('should call loadMore when the load-more button is clicked', () => {
      spyOn(component, 'loadMore');
      component.hasAnalyzed = true;
      component.keywords = Array.from({ length: 150 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.displayedKeywords = component.keywords.slice(0, 100);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-load-more') as HTMLButtonElement).click();
      expect(component.loadMore).toHaveBeenCalled();
    });

    it('should render a row in the keywords table for each displayed keyword', () => {
      component.hasAnalyzed = true;
      component.keywords = [makeKeyword({ keyword: 'alpha' }), makeKeyword({ keyword: 'beta' })];
      component.displayedKeywords = [...component.keywords];
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.keywords-table tbody tr');
      expect(rows.length).toBe(2);
    });
  });
});

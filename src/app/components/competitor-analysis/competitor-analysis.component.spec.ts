import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CompetitorAnalysisComponent } from './competitor-analysis.component';
import { CompetitorAnalysisService } from '../../services/competitor-analysis.service';
import { BlogTopicGeneratorService } from '../../services/blog-topic-generator.service';
import { ExportService } from '../../services/export.service';
import { Competitor } from '../../models/competitor.model';
import { DomainKeywordRanking } from '../../models/keyword.model';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../../models/aggregated-keyword.model';
import { BlogTopic } from '../../models/blog-topic.model';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeKeyword(overrides: Partial<AggregatedKeyword> = {}): AggregatedKeyword {
  return {
    keyword: 'seo tools',
    searchVolume: 5000,
    difficulty: 40,
    competitorRankings: [{ domain: 'rival.com', position: 3 }],
    competitorCount: 1,
    isOpportunity: true,
    opportunityScore: 65,
    ...overrides,
  };
}

function makeResults(overrides: Partial<CompetitorAnalysisResults> = {}): CompetitorAnalysisResults {
  return {
    allKeywords: [makeKeyword()],
    opportunities: [makeKeyword()],
    uniqueToUser: [makeKeyword({ isOpportunity: false, userRanking: { position: 5 }, competitorCount: 0 })],
    shared: [makeKeyword({ isOpportunity: false, userRanking: { position: 5 }, competitorCount: 2 })],
    totalKeywords: 3,
    analyzedCompetitors: ['rival.com'],
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeCompetitor(domain = 'rival.com'): Competitor {
  return { domain, keywordOverlap: 100, totalKeywords: 200 };
}

function makeTopic(overrides: Partial<BlogTopic> = {}): BlogTopic {
  return {
    title: 'How to Use SEO Tools',
    keyword: 'seo tools',
    templateCategory: 'how-to',
    searchVolume: 5000,
    difficulty: 40,
    opportunityScore: 65,
    competitorCount: 1,
    recommendationScore: 75,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CompetitorAnalysisComponent', () => {
  let component: CompetitorAnalysisComponent;
  let fixture: ComponentFixture<CompetitorAnalysisComponent>;
  let analysisSpy: jasmine.SpyObj<CompetitorAnalysisService>;
  let blogTopicSpy: jasmine.SpyObj<BlogTopicGeneratorService>;
  let exportSpy: jasmine.SpyObj<ExportService>;

  beforeEach(async () => {
    analysisSpy = jasmine.createSpyObj('CompetitorAnalysisService', [
      'analyzeCompetitors', 'getCacheMetadata', 'clearCache',
    ]);
    blogTopicSpy = jasmine.createSpyObj('BlogTopicGeneratorService', ['generateTopics']);
    exportSpy = jasmine.createSpyObj('ExportService', [
      'exportBlogTopics', 'exportOpportunities', 'exportAllKeywords',
    ]);

    // Safe defaults so ngOnInit doesn't explode
    analysisSpy.analyzeCompetitors.and.returnValue(of(makeResults()));
    analysisSpy.getCacheMetadata.and.returnValue(null);
    blogTopicSpy.generateTopics.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [CompetitorAnalysisComponent],
      providers: [
        { provide: CompetitorAnalysisService, useValue: analysisSpy },
        { provide: BlogTopicGeneratorService, useValue: blogTopicSpy },
        { provide: ExportService, useValue: exportSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompetitorAnalysisComponent);
    component = fixture.componentInstance;
    // detectChanges() is intentionally deferred so each group
    // can configure inputs / spies before ngOnInit fires.
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('should default userDomain to empty string', () => {
      expect(component.userDomain).toBe('');
    });

    it('should default competitors to empty array', () => {
      expect(component.competitors).toEqual([]);
    });

    it('should default viewMode to "opportunities"', () => {
      expect(component.viewMode).toBe('opportunities');
    });

    it('should default sortColumn to "opportunityScore"', () => {
      expect(component.sortColumn).toBe('opportunityScore');
    });

    it('should default sortDirection to "desc"', () => {
      expect(component.sortDirection).toBe('desc');
    });

    it('should not be analyzing', () => {
      expect(component.isAnalyzing).toBeFalse();
    });

    it('should have no error message', () => {
      expect(component.errorMessage).toBe('');
    });

    it('should have no results', () => {
      expect(component.results).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // ngOnInit
  // ---------------------------------------------------------------------------

  describe('ngOnInit()', () => {
    it('should call analyzeCompetitors on init', () => {
      spyOn(component, 'analyzeCompetitors');
      component.ngOnInit();
      expect(component.analyzeCompetitors).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // analyzeCompetitors()
  // ---------------------------------------------------------------------------

  describe('analyzeCompetitors()', () => {
    it('should set errorMessage and not call service when userDomain is empty', () => {
      component.userDomain = '';
      component.competitors = [makeCompetitor()];
      component.analyzeCompetitors();
      expect(component.errorMessage).toBe('Missing domain or competitors');
      expect(analysisSpy.analyzeCompetitors).not.toHaveBeenCalled();
    });

    it('should set errorMessage and not call service when competitors is empty', () => {
      component.userDomain = 'mysite.com';
      component.competitors = [];
      component.analyzeCompetitors();
      expect(component.errorMessage).toBe('Missing domain or competitors');
      expect(analysisSpy.analyzeCompetitors).not.toHaveBeenCalled();
    });

    it('should set isAnalyzing to true while the observable is pending', () => {
      const pending$ = new Subject<CompetitorAnalysisResults>();
      analysisSpy.analyzeCompetitors.and.returnValue(pending$.asObservable());
      component.userDomain = 'mysite.com';
      component.competitors = [makeCompetitor()];
      component.analyzeCompetitors();
      expect(component.isAnalyzing).toBeTrue();
    });

    it('should call the service with userDomain, userKeywords and competitors', () => {
      const userKeywords: DomainKeywordRanking[] = [];
      const competitors = [makeCompetitor()];
      component.userDomain = 'mysite.com';
      component.userKeywords = userKeywords;
      component.competitors = competitors;
      component.analyzeCompetitors();
      expect(analysisSpy.analyzeCompetitors).toHaveBeenCalledWith('mysite.com', userKeywords, competitors);
    });

    describe('on success', () => {
      let results: CompetitorAnalysisResults;

      beforeEach(() => {
        results = makeResults();
        analysisSpy.analyzeCompetitors.and.returnValue(of(results));
        component.userDomain = 'mysite.com';
        component.competitors = [makeCompetitor()];
      });

      it('should store results', () => {
        component.analyzeCompetitors();
        expect(component.results).toEqual(results);
      });

      it('should set analysisComplete to true', () => {
        component.analyzeCompetitors();
        expect(component.analysisComplete).toBeTrue();
      });

      it('should set isAnalyzing to false', () => {
        component.analyzeCompetitors();
        expect(component.isAnalyzing).toBeFalse();
      });

      it('should generate blog topics when opportunities exist', () => {
        const topics = [makeTopic()];
        blogTopicSpy.generateTopics.and.returnValue(topics);
        component.analyzeCompetitors();
        expect(blogTopicSpy.generateTopics).toHaveBeenCalledWith(
          results.opportunities, results.opportunities.length
        );
        expect(component.blogTopics).toEqual(topics);
      });

      it('should not call generateTopics when there are no opportunities', () => {
        analysisSpy.analyzeCompetitors.and.returnValue(of(makeResults({ opportunities: [] })));
        component.analyzeCompetitors();
        expect(blogTopicSpy.generateTopics).not.toHaveBeenCalled();
      });

      it('should fetch and store cache metadata', () => {
        const meta = { timestamp: Date.now(), ageInDays: 2 };
        analysisSpy.getCacheMetadata.and.returnValue(meta);
        component.analyzeCompetitors();
        expect(component.cacheMetadata).toEqual(meta);
      });

      it('should populate displayedKeywords after analysis', () => {
        component.analyzeCompetitors();
        expect(component.displayedKeywords.length).toBeGreaterThan(0);
      });

      it('should leave errorMessage empty', () => {
        component.analyzeCompetitors();
        expect(component.errorMessage).toBe('');
      });
    });

    describe('on error', () => {
      beforeEach(() => {
        component.userDomain = 'mysite.com';
        component.competitors = [makeCompetitor()];
      });

      it('should set isAnalyzing to false', () => {
        analysisSpy.analyzeCompetitors.and.returnValue(throwError(() => ({ error: 'API failure' })));
        component.analyzeCompetitors();
        expect(component.isAnalyzing).toBeFalse();
      });

      it('should show error.error when the thrown value has an error property', () => {
        analysisSpy.analyzeCompetitors.and.returnValue(throwError(() => ({ error: 'API failure' })));
        component.analyzeCompetitors();
        expect(component.errorMessage).toBe('API failure');
      });

      it('should show a generic message when the thrown value has no error property', () => {
        analysisSpy.analyzeCompetitors.and.returnValue(throwError(() => ({})));
        component.analyzeCompetitors();
        expect(component.errorMessage).toBe('Failed to analyze competitors');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // refreshAnalysis()
  // ---------------------------------------------------------------------------

  describe('refreshAnalysis()', () => {
    beforeEach(() => {
      component.userDomain = 'mysite.com';
      component.competitors = [makeCompetitor()];
    });

    it('should clear the cache via the service', () => {
      component.refreshAnalysis();
      expect(analysisSpy.clearCache).toHaveBeenCalledWith('mysite.com', component.competitors);
    });

    it('should reset cacheMetadata to null', () => {
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 1 };
      component.refreshAnalysis();
      expect(component.cacheMetadata).toBeNull();
    });

    it('should reset analysisComplete to false', () => {
      spyOn(component, 'analyzeCompetitors'); // prevent re-trigger from setting it back to true
      component.analysisComplete = true;
      component.refreshAnalysis();
      expect(component.analysisComplete).toBeFalse();
    });

    it('should re-trigger analyzeCompetitors', () => {
      spyOn(component, 'analyzeCompetitors');
      component.refreshAnalysis();
      expect(component.analyzeCompetitors).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // setViewMode()
  // ---------------------------------------------------------------------------

  describe('setViewMode()', () => {
    beforeEach(() => {
      component.results = makeResults();
      component.blogTopics = Array.from({ length: 25 }, () => makeTopic());
    });

    it('should update viewMode', () => {
      component.setViewMode('shared');
      expect(component.viewMode).toBe('shared');
    });

    it('should fill displayedTopics (capped at 20) when switching to blog-topics', () => {
      component.setViewMode('blog-topics');
      expect(component.displayedTopics.length).toBe(20);
    });

    it('should call updateDisplayedKeywords for non-blog-topics modes', () => {
      spyOn(component, 'updateDisplayedKeywords');
      component.setViewMode('all');
      expect(component.updateDisplayedKeywords).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateDisplayedKeywords()
  // ---------------------------------------------------------------------------

  describe('updateDisplayedKeywords()', () => {
    it('should do nothing when results is null', () => {
      component.results = null;
      component.displayedKeywords = [];
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords).toEqual([]);
    });

    it('should display opportunities when viewMode is "opportunities"', () => {
      component.results = makeResults();
      component.viewMode = 'opportunities';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(component.results!.opportunities.length);
    });

    it('should display allKeywords when viewMode is "all"', () => {
      component.results = makeResults();
      component.viewMode = 'all';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(component.results!.allKeywords.length);
    });

    it('should display shared when viewMode is "shared"', () => {
      component.results = makeResults();
      component.viewMode = 'shared';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(component.results!.shared.length);
    });

    it('should display uniqueToUser when viewMode is "unique"', () => {
      component.results = makeResults();
      component.viewMode = 'unique';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(component.results!.uniqueToUser.length);
    });

    it('should not update displayedKeywords when viewMode is "blog-topics"', () => {
      component.results = makeResults();
      component.viewMode = 'blog-topics';
      component.displayedKeywords = [];
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords).toEqual([]);
    });

    it('should cap displayed results at displayLimit (50)', () => {
      const manyKeywords = Array.from({ length: 100 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ opportunities: manyKeywords });
      component.viewMode = 'opportunities';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // sortBy()
  // ---------------------------------------------------------------------------

  describe('sortBy()', () => {
    beforeEach(() => {
      component.results = makeResults();
    });

    it('should toggle direction to asc when re-clicking the active column (was desc)', () => {
      component.sortColumn = 'searchVolume';
      component.sortDirection = 'desc';
      component.sortBy('searchVolume');
      expect(component.sortDirection).toBe('asc');
    });

    it('should toggle direction to desc when re-clicking the active column (was asc)', () => {
      component.sortColumn = 'searchVolume';
      component.sortDirection = 'asc';
      component.sortBy('searchVolume');
      expect(component.sortDirection).toBe('desc');
    });

    it('should set a new column and reset direction to desc', () => {
      component.sortColumn = 'searchVolume';
      component.sortDirection = 'asc';
      component.sortBy('difficulty');
      expect(component.sortColumn).toBe('difficulty');
      expect(component.sortDirection).toBe('desc');
    });

    it('should call updateDisplayedKeywords after changing sort', () => {
      spyOn(component, 'updateDisplayedKeywords');
      component.sortBy('keyword');
      expect(component.updateDisplayedKeywords).toHaveBeenCalled();
    });

    it('should sort numeric keywords in descending order by default', () => {
      const keywords = [
        makeKeyword({ keyword: 'a', searchVolume: 100 }),
        makeKeyword({ keyword: 'b', searchVolume: 500 }),
        makeKeyword({ keyword: 'c', searchVolume: 250 }),
      ];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.sortColumn = 'opportunityScore';
      component.sortBy('searchVolume'); // new column → desc
      expect(component.displayedKeywords[0].searchVolume).toBe(500);
    });

    it('should sort by keyword string ascending (localeCompare)', () => {
      const keywords = [
        makeKeyword({ keyword: 'zebra keyword' }),
        makeKeyword({ keyword: 'apple keyword' }),
        makeKeyword({ keyword: 'mango keyword' }),
      ];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.sortColumn = 'keyword';
      component.sortDirection = 'asc';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords[0].keyword).toBe('apple keyword');
      expect(component.displayedKeywords[2].keyword).toBe('zebra keyword');
    });

    it('should sort by keyword string descending (localeCompare)', () => {
      const keywords = [
        makeKeyword({ keyword: 'apple keyword' }),
        makeKeyword({ keyword: 'zebra keyword' }),
        makeKeyword({ keyword: 'mango keyword' }),
      ];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.sortColumn = 'keyword';
      component.sortDirection = 'desc';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords[0].keyword).toBe('zebra keyword');
      expect(component.displayedKeywords[2].keyword).toBe('apple keyword');
    });

    it('should sort by userRanking position (desc), treating null as position 999', () => {
      const keywords = [
        makeKeyword({ keyword: 'a', userRanking: { position: 3 } }),
        makeKeyword({ keyword: 'b', userRanking: null }),
        makeKeyword({ keyword: 'c', userRanking: { position: 10 } }),
      ];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.sortColumn = 'searchVolume';
      component.sortBy('userRanking'); // new column → desc (999 first)
      expect(component.displayedKeywords[0].keyword).toBe('b'); // null → 999
      expect(component.displayedKeywords[1].keyword).toBe('c'); // 10
      expect(component.displayedKeywords[2].keyword).toBe('a'); // 3
    });

    it('should return stable order when values are neither string nor number', () => {
      // isOpportunity is boolean → hits the return 0 fallback branch
      const keywords = [
        makeKeyword({ keyword: 'first', isOpportunity: true }),
        makeKeyword({ keyword: 'second', isOpportunity: false }),
      ];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.sortColumn = 'isOpportunity' as keyof AggregatedKeyword;
      component.sortDirection = 'desc';
      component.updateDisplayedKeywords();
      expect(component.displayedKeywords.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getSortIcon()
  // ---------------------------------------------------------------------------

  describe('getSortIcon()', () => {
    it('should return ↕️ for a column that is not active', () => {
      component.sortColumn = 'searchVolume';
      expect(component.getSortIcon('difficulty')).toBe('↕️');
    });

    it('should return ↑ for the active column when direction is asc', () => {
      component.sortColumn = 'searchVolume';
      component.sortDirection = 'asc';
      expect(component.getSortIcon('searchVolume')).toBe('↑');
    });

    it('should return ↓ for the active column when direction is desc', () => {
      component.sortColumn = 'searchVolume';
      component.sortDirection = 'desc';
      expect(component.getSortIcon('searchVolume')).toBe('↓');
    });
  });

  // ---------------------------------------------------------------------------
  // hasMoreKeywords / remainingCount
  // ---------------------------------------------------------------------------

  describe('hasMoreKeywords', () => {
    it('should return false when results is null', () => {
      component.results = null;
      expect(component.hasMoreKeywords).toBeFalse();
    });

    it('should return true when fewer than the total keywords are displayed', () => {
      const many = Array.from({ length: 60 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ opportunities: many });
      component.viewMode = 'opportunities';
      component.displayedKeywords = many.slice(0, 50);
      expect(component.hasMoreKeywords).toBeTrue();
    });

    it('should return false when all keywords are already displayed', () => {
      const keywords = [makeKeyword()];
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.displayedKeywords = keywords;
      expect(component.hasMoreKeywords).toBeFalse();
    });

    it('should use allKeywords total when viewMode is "all"', () => {
      const many = Array.from({ length: 60 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ allKeywords: many });
      component.viewMode = 'all';
      component.displayedKeywords = many.slice(0, 50);
      expect(component.hasMoreKeywords).toBeTrue();
    });

    it('should use shared total when viewMode is "shared"', () => {
      const many = Array.from({ length: 60 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ shared: many });
      component.viewMode = 'shared';
      component.displayedKeywords = many.slice(0, 50);
      expect(component.hasMoreKeywords).toBeTrue();
    });

    it('should use uniqueToUser total when viewMode is "unique"', () => {
      const many = Array.from({ length: 60 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ uniqueToUser: many });
      component.viewMode = 'unique';
      component.displayedKeywords = many.slice(0, 50);
      expect(component.hasMoreKeywords).toBeTrue();
    });
  });

  describe('remainingCount', () => {
    it('should return 0 when results is null', () => {
      component.results = null;
      expect(component.remainingCount).toBe(0);
    });

    it('should return total minus displayed count', () => {
      const keywords = Array.from({ length: 10 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.displayedKeywords = keywords.slice(0, 6);
      expect(component.remainingCount).toBe(4);
    });

    it('should use allKeywords total when viewMode is "all"', () => {
      const keywords = Array.from({ length: 10 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ allKeywords: keywords });
      component.viewMode = 'all';
      component.displayedKeywords = keywords.slice(0, 6);
      expect(component.remainingCount).toBe(4);
    });

    it('should use shared total when viewMode is "shared"', () => {
      const keywords = Array.from({ length: 10 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ shared: keywords });
      component.viewMode = 'shared';
      component.displayedKeywords = keywords.slice(0, 6);
      expect(component.remainingCount).toBe(4);
    });

    it('should use uniqueToUser total when viewMode is "unique"', () => {
      const keywords = Array.from({ length: 10 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ uniqueToUser: keywords });
      component.viewMode = 'unique';
      component.displayedKeywords = keywords.slice(0, 6);
      expect(component.remainingCount).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // loadMore()
  // ---------------------------------------------------------------------------

  describe('loadMore()', () => {
    it('should extend displayedKeywords by 50', () => {
      const keywords = Array.from({ length: 120 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.displayedKeywords = keywords.slice(0, 50);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(100);
    });

    it('should not exceed the total available keywords', () => {
      const keywords = Array.from({ length: 60 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ opportunities: keywords });
      component.viewMode = 'opportunities';
      component.displayedKeywords = keywords.slice(0, 50);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(60);
    });

    it('should load more from allKeywords when viewMode is "all"', () => {
      const keywords = Array.from({ length: 120 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ allKeywords: keywords });
      component.viewMode = 'all';
      component.displayedKeywords = keywords.slice(0, 50);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(100);
    });

    it('should load more from shared when viewMode is "shared"', () => {
      const keywords = Array.from({ length: 120 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ shared: keywords });
      component.viewMode = 'shared';
      component.displayedKeywords = keywords.slice(0, 50);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(100);
    });

    it('should load more from uniqueToUser when viewMode is "unique"', () => {
      const keywords = Array.from({ length: 120 }, (_, i) => makeKeyword({ keyword: `kw ${i}` }));
      component.results = makeResults({ uniqueToUser: keywords });
      component.viewMode = 'unique';
      component.displayedKeywords = keywords.slice(0, 50);
      component.loadMore();
      expect(component.displayedKeywords.length).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Blog topic pagination
  // ---------------------------------------------------------------------------

  describe('blog topic pagination', () => {
    const totalTopics = 50;
    let allTopics: BlogTopic[];

    beforeEach(() => {
      allTopics = Array.from({ length: totalTopics }, (_, i) => makeTopic({ title: `Topic ${i}` }));
      component.blogTopics = allTopics;
      component.displayedTopics = allTopics.slice(0, 20);
    });

    it('hasMoreTopics should be true when more topics exist', () => {
      expect(component.hasMoreTopics).toBeTrue();
    });

    it('hasMoreTopics should be false when all topics are displayed', () => {
      component.displayedTopics = allTopics;
      expect(component.hasMoreTopics).toBeFalse();
    });

    it('remainingTopicsCount should equal total minus displayed', () => {
      expect(component.remainingTopicsCount).toBe(30);
    });

    it('loadMoreTopics should add the next 20 topics', () => {
      component.loadMoreTopics();
      expect(component.displayedTopics.length).toBe(40);
    });

    it('loadMoreTopics should not exceed the total topics', () => {
      component.displayedTopics = allTopics.slice(0, 45);
      component.loadMoreTopics();
      expect(component.displayedTopics.length).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // getCategoryLabel()
  // ---------------------------------------------------------------------------

  describe('getCategoryLabel()', () => {
    const cases: [string, string][] = [
      ['how-to', 'How-to'],
      ['list', 'List'],
      ['best-of', 'Best Of'],
      ['guide', 'Guide'],
      ['tips', 'Tips'],
      ['comparison', 'Comparison'],
      ['ultimate', 'Ultimate'],
      ['vs', 'vs'], // 'vs' removed from valid categories; falls back to raw value
    ];

    cases.forEach(([input, expected]) => {
      it(`should return "${expected}" for "${input}"`, () => {
        expect(component.getCategoryLabel(input)).toBe(expected);
      });
    });

    it('should return the raw category string for unknown values', () => {
      expect(component.getCategoryLabel('mystery-category')).toBe('mystery-category');
    });
  });

  // ---------------------------------------------------------------------------
  // exportCurrentView()
  // ---------------------------------------------------------------------------

  describe('exportCurrentView()', () => {
    let results: CompetitorAnalysisResults;

    beforeEach(() => {
      results = makeResults();
      component.results = results;
      component.userDomain = 'mysite.com';
      component.competitors = [makeCompetitor('comp-a.com'), makeCompetitor('comp-b.com')];
      component.blogTopics = [makeTopic()];
    });

    it('should do nothing when results is null', () => {
      component.results = null;
      component.exportCurrentView();
      expect(exportSpy.exportBlogTopics).not.toHaveBeenCalled();
      expect(exportSpy.exportOpportunities).not.toHaveBeenCalled();
      expect(exportSpy.exportAllKeywords).not.toHaveBeenCalled();
    });

    it('should call exportBlogTopics when viewMode is "blog-topics"', () => {
      component.viewMode = 'blog-topics';
      component.exportCurrentView();
      expect(exportSpy.exportBlogTopics).toHaveBeenCalledWith(
        component.blogTopics, 'mysite.com', ['comp-a.com', 'comp-b.com']
      );
    });

    it('should call exportOpportunities when viewMode is "opportunities"', () => {
      component.viewMode = 'opportunities';
      component.exportCurrentView();
      expect(exportSpy.exportOpportunities).toHaveBeenCalledWith(
        results.opportunities, 'mysite.com', ['comp-a.com', 'comp-b.com']
      );
    });

    it('should call exportAllKeywords when viewMode is "all"', () => {
      component.viewMode = 'all';
      component.exportCurrentView();
      expect(exportSpy.exportAllKeywords).toHaveBeenCalledWith(
        results, 'mysite.com', ['comp-a.com', 'comp-b.com']
      );
    });

    it('should call exportAllKeywords when viewMode is "shared"', () => {
      component.viewMode = 'shared';
      component.exportCurrentView();
      expect(exportSpy.exportAllKeywords).toHaveBeenCalledWith(
        results, 'mysite.com', ['comp-a.com', 'comp-b.com']
      );
    });

    it('should call exportAllKeywords when viewMode is "unique"', () => {
      component.viewMode = 'unique';
      component.exportCurrentView();
      expect(exportSpy.exportAllKeywords).toHaveBeenCalledWith(
        results, 'mysite.com', ['comp-a.com', 'comp-b.com']
      );
    });
  });

  // ---------------------------------------------------------------------------
  // exportButtonLabel getter
  // ---------------------------------------------------------------------------

  describe('exportButtonLabel', () => {
    it('should return "Export Blog Topics" for blog-topics', () => {
      component.viewMode = 'blog-topics';
      expect(component.exportButtonLabel).toBe('Export Blog Topics');
    });

    it('should return "Export Opportunities" for opportunities', () => {
      component.viewMode = 'opportunities';
      expect(component.exportButtonLabel).toBe('Export Opportunities');
    });

    it('should return "Export All Keywords" for all, shared, and unique', () => {
      (['all', 'shared', 'unique'] as const).forEach(mode => {
        component.viewMode = mode;
        expect(component.exportButtonLabel).toBe('Export All Keywords');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Template / DOM
  // ---------------------------------------------------------------------------

  describe('template', () => {
    // Prevent ngOnInit→analyzeCompetitors side-effects from polluting DOM state
    beforeEach(() => {
      spyOn(component, 'analyzeCompetitors');
    });

    it('should show the loading spinner while isAnalyzing is true', () => {
      component.isAnalyzing = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();
    });

    it('should hide the loading spinner when not analyzing', () => {
      component.isAnalyzing = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.loading-state')).toBeNull();
    });

    it('should show the error message when errorMessage is set and not analyzing', () => {
      component.errorMessage = 'Something went wrong';
      component.isAnalyzing = false;
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.error-message') as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.textContent).toContain('Something went wrong');
    });

    it('should not show the error message while isAnalyzing is true', () => {
      component.errorMessage = 'Something went wrong';
      component.isAnalyzing = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-message')).toBeNull();
    });

    it('should not render the results panel when analysisComplete is false', () => {
      component.analysisComplete = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.results-container')).toBeNull();
    });

    it('should render the results panel when analysisComplete is true and results exist', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.results-container')).not.toBeNull();
    });

    it('should show "Fresh data" badge when cacheMetadata is null', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      component.cacheMetadata = null;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cache-info.fresh')).not.toBeNull();
    });

    it('should show cache age when cacheMetadata is set', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 3 };
      fixture.detectChanges();
      const cacheEl = fixture.nativeElement.querySelector('.cache-info:not(.fresh)') as HTMLElement;
      expect(cacheEl).not.toBeNull();
      expect(cacheEl.textContent).toContain('3');
    });

    it('should call refreshAnalysis when the refresh button is clicked', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      spyOn(component, 'refreshAnalysis');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-refresh') as HTMLButtonElement).click();
      expect(component.refreshAnalysis).toHaveBeenCalled();
    });

    it('should call exportCurrentView when the export button is clicked', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      spyOn(component, 'exportCurrentView');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-export') as HTMLButtonElement).click();
      expect(component.exportCurrentView).toHaveBeenCalled();
    });

    it('should highlight the active tab with the "active" class', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      component.viewMode = 'opportunities';
      fixture.detectChanges();
      const tabs = fixture.nativeElement.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
      const activeTab = Array.from(tabs).find(t => t.classList.contains('active'));
      expect(activeTab?.textContent).toContain('Opportunities');
    });

    it('should show empty state when there are no keywords to display', () => {
      component.analysisComplete = true;
      component.results = makeResults({ opportunities: [] });
      component.viewMode = 'opportunities';
      component.displayedKeywords = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    });

    it('should show the keywords table when displayedKeywords has items', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      component.viewMode = 'opportunities';
      component.displayedKeywords = [makeKeyword()];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.keywords-table')).not.toBeNull();
    });

    it('should call setViewMode when a tab is clicked', () => {
      component.analysisComplete = true;
      component.results = makeResults();
      spyOn(component, 'setViewMode');
      fixture.detectChanges();
      const tabs = fixture.nativeElement.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
      tabs[0].click();
      expect(component.setViewMode).toHaveBeenCalled();
    });
  });
});

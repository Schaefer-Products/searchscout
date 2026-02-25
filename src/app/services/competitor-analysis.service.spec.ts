import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CompetitorAnalysisService } from './competitor-analysis.service';
import { DataforseoService } from './dataforseo.service';
import { CacheService } from './cache.service';
import { Competitor } from '../models/competitor.model';
import { DomainKeywordRanking } from '../models/keyword.model';
import { CompetitorAnalysisResults } from '../models/aggregated-keyword.model';

describe('CompetitorAnalysisService', () => {
  let service: CompetitorAnalysisService;
  let mockDataforseo: jasmine.SpyObj<DataforseoService>;
  let mockCache: jasmine.SpyObj<CacheService>;

  const userDomain = 'mysite.com';

  const competitors: Competitor[] = [
    { domain: 'competitor.com', keywordOverlap: 10, totalKeywords: 100 }
  ];

  const userKeywords: DomainKeywordRanking[] = [
    { keyword: 'seo tools', searchVolume: 5000, difficulty: 40, position: 5, etv: 100 }
  ];

  const competitorKeywords: DomainKeywordRanking[] = [
    { keyword: 'keyword research', searchVolume: 3000, difficulty: 30, position: 3, etv: 80 }
  ];

  beforeEach(() => {
    mockDataforseo = jasmine.createSpyObj('DataforseoService', ['fetchDomainKeywords', 'hasCredentials']);
    mockCache = jasmine.createSpyObj('CacheService', ['get', 'save', 'remove', 'getMetadata', 'getConfig']);

    mockCache.get.and.returnValue(null);
    mockCache.getConfig.and.returnValue({ expirationDays: 7 });
    mockDataforseo.fetchDomainKeywords.and.returnValue(of(competitorKeywords));

    TestBed.configureTestingModule({
      providers: [
        { provide: DataforseoService, useValue: mockDataforseo },
        { provide: CacheService, useValue: mockCache }
      ]
    });
    service = TestBed.inject(CompetitorAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── analyzeCompetitors() ──────────────────────────────────────────────────

  describe('analyzeCompetitors()', () => {
    it('should return cached results without fetching when cache hit', (done) => {
      const cachedResults: CompetitorAnalysisResults = {
        allKeywords: [], opportunities: [], shared: [], uniqueToUser: [],
        totalKeywords: 0, analyzedCompetitors: [], timestamp: Date.now()
      };
      mockCache.get.and.returnValue(cachedResults);

      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        expect(results).toBe(cachedResults);
        expect(mockDataforseo.fetchDomainKeywords).not.toHaveBeenCalled();
        done();
      });
    });

    it('should fetch keywords for each competitor on cache miss', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(() => {
        expect(mockDataforseo.fetchDomainKeywords).toHaveBeenCalledWith('competitor.com');
        done();
      });
    });

    it('should fetch from all competitors when multiple are provided', (done) => {
      const multipleCompetitors: Competitor[] = [
        { domain: 'comp1.com', keywordOverlap: 10, totalKeywords: 100 },
        { domain: 'comp2.com', keywordOverlap: 5, totalKeywords: 80 }
      ];
      service.analyzeCompetitors(userDomain, userKeywords, multipleCompetitors).subscribe(() => {
        expect(mockDataforseo.fetchDomainKeywords).toHaveBeenCalledTimes(2);
        done();
      });
    });

    it('should save results to cache after fetching', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(() => {
        expect(mockCache.save).toHaveBeenCalled();
        done();
      });
    });

    it('should mark user-only keywords as not opportunities', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        const seoTools = results.allKeywords.find(k => k.keyword.toLowerCase() === 'seo tools');
        expect(seoTools).toBeTruthy();
        expect(seoTools!.isOpportunity).toBeFalse();
        done();
      });
    });

    it('should mark competitor-only keywords as opportunities', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        const kwResearch = results.allKeywords.find(k => k.keyword.toLowerCase() === 'keyword research');
        expect(kwResearch).toBeTruthy();
        expect(kwResearch!.isOpportunity).toBeTrue();
        done();
      });
    });

    it('should place user-only keywords in uniqueToUser', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        const unique = results.uniqueToUser.map(k => k.keyword.toLowerCase());
        expect(unique).toContain('seo tools');
        done();
      });
    });

    it('should place opportunity keywords in the opportunities array', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        const opportunities = results.opportunities.map(k => k.keyword.toLowerCase());
        expect(opportunities).toContain('keyword research');
        done();
      });
    });

    it('should calculate an opportunityScore for each opportunity keyword', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        results.opportunities.forEach(k => {
          expect(k.opportunityScore).toBeDefined();
          expect(k.opportunityScore!).toBeGreaterThanOrEqual(0);
          expect(k.opportunityScore!).toBeLessThanOrEqual(100);
        });
        done();
      });
    });

    it('should include both user and competitor keyword counts in totalKeywords', (done) => {
      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        // 1 user keyword + 1 competitor keyword = 2 total
        expect(results.totalKeywords).toBe(2);
        done();
      });
    });

    it('should handle competitor fetch errors gracefully and still complete', (done) => {
      mockDataforseo.fetchDomainKeywords.and.returnValue(throwError(() => new Error('Network error')));

      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe({
        next: results => {
          // Should still return results with at least the user's keywords
          expect(results).toBeTruthy();
          expect(results.allKeywords.length).toBeGreaterThan(0);
          done();
        },
        error: () => fail('should not emit an error')
      });
    });

    it('should merge shared keywords (user + competitor) into the shared array', (done) => {
      const sharedKeyword: DomainKeywordRanking = {
        keyword: 'seo tools', searchVolume: 5000, difficulty: 40, position: 3
      };
      mockDataforseo.fetchDomainKeywords.and.returnValue(of([sharedKeyword]));

      service.analyzeCompetitors(userDomain, userKeywords, competitors).subscribe(results => {
        const shared = results.shared.map(k => k.keyword.toLowerCase());
        expect(shared).toContain('seo tools');
        done();
      });
    });
  });

  // ─── getCacheMetadata() ───────────────────────────────────────────────────

  describe('getCacheMetadata()', () => {
    it('should delegate to the cache service', () => {
      const meta = { timestamp: Date.now(), ageInDays: 0 };
      mockCache.getMetadata.and.returnValue(meta);
      const result = service.getCacheMetadata(userDomain, competitors);
      expect(result).toBe(meta);
      expect(mockCache.getMetadata).toHaveBeenCalled();
    });

    it('should return null when no cached metadata exists', () => {
      mockCache.getMetadata.and.returnValue(null);
      expect(service.getCacheMetadata(userDomain, competitors)).toBeNull();
    });
  });

  // ─── clearCache() ─────────────────────────────────────────────────────────

  describe('clearCache()', () => {
    it('should call cache.remove() with the correct cache key', () => {
      service.clearCache(userDomain, competitors);
      expect(mockCache.remove).toHaveBeenCalledWith(
        `competitor_analysis_${userDomain}_${competitors[0].domain}`
      );
    });
  });
});

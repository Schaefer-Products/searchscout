import { TestBed } from '@angular/core/testing';

import { BlogTopicGeneratorService } from './blog-topic-generator.service';
import { AggregatedKeyword } from '../models/aggregated-keyword.model';

/** Build a minimal AggregatedKeyword for testing */
function makeOpportunity(keyword: string, overrides: Partial<AggregatedKeyword> = {}): AggregatedKeyword {
  return {
    keyword,
    searchVolume: 1000,
    difficulty: 40,
    competitorRankings: [],
    competitorCount: 3,
    isOpportunity: true,
    opportunityScore: 60,
    ...overrides
  };
}

describe('BlogTopicGeneratorService', () => {
  let service: BlogTopicGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlogTopicGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateTopics()', () => {
    it('should return an empty array when given no opportunities', () => {
      expect(service.generateTopics([])).toEqual([]);
    });

    it('should generate one topic per opportunity keyword', () => {
      const opportunities = [makeOpportunity('seo tips'), makeOpportunity('content marketing')];
      expect(service.generateTopics(opportunities).length).toBe(2);
    });

    it('should respect the limit parameter', () => {
      const opportunities = Array.from({ length: 30 }, (_, i) => makeOpportunity(`keyword ${i}`));
      expect(service.generateTopics(opportunities, 5).length).toBe(5);
    });

    it('should default to a limit of 20', () => {
      const opportunities = Array.from({ length: 25 }, (_, i) => makeOpportunity(`keyword ${i}`));
      expect(service.generateTopics(opportunities).length).toBe(20);
    });

    it('should sort topics by recommendation score in descending order', () => {
      const opportunities = [
        makeOpportunity('low scorer', { opportunityScore: 10, difficulty: 80, searchVolume: 100, competitorCount: 1 }),
        makeOpportunity('high scorer', { opportunityScore: 90, difficulty: 10, searchVolume: 10000, competitorCount: 5 })
      ];
      const topics = service.generateTopics(opportunities);
      expect(topics[0].recommendationScore).toBeGreaterThanOrEqual(topics[1].recommendationScore);
    });

    it('should preserve the source keyword on each topic', () => {
      const topics = service.generateTopics([makeOpportunity('angular testing')]);
      expect(topics[0].keyword).toBe('angular testing');
    });

    it('should embed the keyword in the generated title (case-insensitive)', () => {
      const topics = service.generateTopics([makeOpportunity('angular testing')]);
      expect(topics[0].title.toLowerCase()).toContain('angular testing');
    });

    it('should populate all required blog topic fields', () => {
      const opp = makeOpportunity('test keyword', {
        searchVolume: 5000,
        difficulty: 25,
        opportunityScore: 75,
        competitorCount: 4
      });
      const topic = service.generateTopics([opp])[0];
      expect(topic.title).toBeTruthy();
      expect(topic.keyword).toBe('test keyword');
      expect(topic.templateCategory).toBeTruthy();
      expect(topic.searchVolume).toBe(5000);
      expect(topic.difficulty).toBe(25);
      expect(topic.opportunityScore).toBe(75);
      expect(topic.competitorCount).toBe(4);
      expect(topic.recommendationScore).toBeGreaterThanOrEqual(0);
      expect(topic.recommendationScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── Template selection ────────────────────────────────────────────────────

  describe('template selection', () => {
    it('should use a how-to template for keywords containing action verbs', () => {
      const topics = service.generateTopics([makeOpportunity('create a website')]);
      expect(topics[0].templateCategory).toBe('how-to');
    });

    it('should use comparison or guide templates for definition-type keywords', () => {
      const topics = service.generateTopics([makeOpportunity('what is seo')]);
      expect(['comparison', 'guide']).toContain(topics[0].templateCategory);
    });

    it('should NOT use a how-to template when keyword already starts with "how to"', () => {
      const topics = service.generateTopics([makeOpportunity('how to optimize images')]);
      expect(topics[0].templateCategory).not.toBe('how-to');
    });

    it('should use a comparison template for versus/or keywords', () => {
      const topics = service.generateTopics([makeOpportunity('react vs vue')]);
      expect(topics[0].templateCategory).toBe('comparison');
    });

    it('should use a best-of template for keywords starting with "best"', () => {
      const topics = service.generateTopics([makeOpportunity('best seo tools')]);
      expect(topics[0].templateCategory).toBe('best-of');
    });
  });

  // ─── Recommendation score ─────────────────────────────────────────────────

  describe('recommendation score', () => {
    it('should be higher for high search volume keywords', () => {
      const base = { difficulty: 40, opportunityScore: 50, competitorCount: 2 };
      const [low] = service.generateTopics([makeOpportunity('kw', { ...base, searchVolume: 100 })]);
      const [high] = service.generateTopics([makeOpportunity('kw', { ...base, searchVolume: 10000 })]);
      expect(high.recommendationScore).toBeGreaterThan(low.recommendationScore);
    });

    it('should be higher for low difficulty keywords', () => {
      const base = { searchVolume: 1000, opportunityScore: 50, competitorCount: 2 };
      const [hard] = service.generateTopics([makeOpportunity('kw', { ...base, difficulty: 70 })]);
      const [easy] = service.generateTopics([makeOpportunity('kw', { ...base, difficulty: 20 })]);
      expect(easy.recommendationScore).toBeGreaterThan(hard.recommendationScore);
    });

    it('should be higher when more competitors rank for the keyword', () => {
      const base = { searchVolume: 1000, difficulty: 40, opportunityScore: 50 };
      const [few] = service.generateTopics([makeOpportunity('kw', { ...base, competitorCount: 1 })]);
      const [many] = service.generateTopics([makeOpportunity('kw', { ...base, competitorCount: 5 })]);
      expect(many.recommendationScore).toBeGreaterThan(few.recommendationScore);
    });

    it('should stay within the 0-100 range', () => {
      const extremes = [
        makeOpportunity('low-end kw', { searchVolume: 0, difficulty: 100, opportunityScore: 0, competitorCount: 0 }),
        makeOpportunity('high-end kw', { searchVolume: 100000, difficulty: 0, opportunityScore: 100, competitorCount: 10 })
      ];
      service.generateTopics(extremes).forEach(topic => {
        expect(topic.recommendationScore).toBeGreaterThanOrEqual(0);
        expect(topic.recommendationScore).toBeLessThanOrEqual(100);
      });
    });
  });
});

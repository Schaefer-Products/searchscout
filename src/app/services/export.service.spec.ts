import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../models/aggregated-keyword.model';
import { BlogTopic } from '../models/blog-topic.model';

describe('ExportService', () => {
  let service: ExportService;

  /** Spy on the private downloadCSV method and return the captured [content, filename] args. */
  function captureDownload(fn: () => void): { content: string; filename: string } {
    let content = '';
    let filename = '';
    spyOn(service as any, 'downloadCSV').and.callFake((c: string, f: string) => {
      content = c;
      filename = f;
    });
    fn();
    return { content, filename };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Test-data factories
  // ---------------------------------------------------------------------------

  const makeKeyword = (overrides: Partial<AggregatedKeyword> = {}): AggregatedKeyword => ({
    keyword: 'test keyword',
    searchVolume: 1000,
    difficulty: 50,
    cpc: 1.5,
    userRanking: null,
    competitorRankings: [{ domain: 'rival.com', position: 3 }],
    competitorCount: 1,
    isOpportunity: true,
    opportunityScore: 75,
    ...overrides,
  });

  const makeTopic = (overrides: Partial<BlogTopic> = {}): BlogTopic => ({
    title: 'How to Test Your Code',
    keyword: 'unit testing',
    templateCategory: 'how-to',
    searchVolume: 5000,
    difficulty: 40,
    opportunityScore: 80,
    competitorCount: 3,
    recommendationScore: 85,
    ...overrides,
  });

  const makeResults = (overrides: Partial<CompetitorAnalysisResults> = {}): CompetitorAnalysisResults => ({
    allKeywords: [makeKeyword()],
    opportunities: [makeKeyword()],
    uniqueToUser: [],
    shared: [],
    totalKeywords: 1,
    analyzedCompetitors: ['rival.com'],
    timestamp: Date.now(),
    ...overrides,
  });

  // ---------------------------------------------------------------------------
  // downloadCSV() — DOM behaviour
  // ---------------------------------------------------------------------------

  describe('downloadCSV() DOM behaviour', () => {
    let fakeLink: { href: string; download: string; click: jasmine.Spy };

    beforeEach(() => {
      fakeLink = { href: '', download: '', click: jasmine.createSpy('click') };
      spyOn(document, 'createElement').and.returnValue(fakeLink as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url');
      spyOn(URL, 'revokeObjectURL');
    });

    it('should set the anchor href to the blob URL', () => {
      service.exportOpportunities([makeKeyword()], 'example.com', []);
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(fakeLink.href).toBe('blob:test-url');
    });

    it('should set the anchor download attribute to the expected filename', () => {
      service.exportOpportunities([makeKeyword()], 'example.com', []);
      expect(fakeLink.download).toMatch(/^opportunities_example-com_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should click the anchor to trigger the download', () => {
      service.exportOpportunities([makeKeyword()], 'example.com', []);
      expect(fakeLink.click).toHaveBeenCalled();
    });

    it('should revoke the object URL after clicking', () => {
      service.exportOpportunities([makeKeyword()], 'example.com', []);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });
  });

  // ---------------------------------------------------------------------------
  // exportOpportunities()
  // ---------------------------------------------------------------------------

  describe('exportOpportunities()', () => {
    it('should use a filename matching opportunities_<slug>_<date>.csv', () => {
      const today = new Date().toISOString().split('T')[0];
      const { filename } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'my-site.com', [])
      );
      expect(filename).toBe(`opportunities_my-site-com_${today}.csv`);
    });

    it('should include the "Keyword Opportunities Report" title in the metadata header', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', [])
      );
      expect(content).toContain('Keyword Opportunities Report');
    });

    it('should include the user domain in the metadata header', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', [])
      );
      expect(content).toContain('Domain: example.com');
    });

    it('should include competitors in the metadata header', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', ['rival.com', 'other.com'])
      );
      expect(content).toContain('Competitors: rival.com, other.com');
    });

    it('should include the row count in the metadata header', () => {
      const kws = [makeKeyword(), makeKeyword({ keyword: 'second kw' })];
      const { content } = captureDownload(() =>
        service.exportOpportunities(kws, 'example.com', [])
      );
      expect(content).toContain('Total Opportunities: 2');
    });

    it('should include the column header row', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', [])
      );
      expect(content).toContain('Keyword,Search Volume,Difficulty,Opportunity Score,Competitor Count,Competitors,CPC (USD)');
    });

    it('should include a data row with all keyword fields', () => {
      const kw = makeKeyword({
        keyword: 'seo tool',
        searchVolume: 2000,
        difficulty: 60,
        opportunityScore: 90,
        competitorCount: 2,
        competitorRankings: [
          { domain: 'a.com', position: 1 },
          { domain: 'b.com', position: 4 },
        ],
        cpc: 3.5,
      });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      expect(content).toContain('seo tool,2000,60,90,2,a.com (#1); b.com (#4),3.50');
    });

    it('should format CPC to 2 decimal places', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword({ cpc: 1.1 })], 'example.com', [])
      );
      expect(content).toContain('1.10');
    });

    it('should output an empty string for a null CPC', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword({ cpc: undefined })], 'example.com', [])
      );
      const lines = content.split('\n');
      const dataLine = lines[lines.length - 1];
      // last column (CPC) should be empty
      expect(dataLine.endsWith(',')).toBeTrue();
    });

    it('should output an empty string for a missing opportunityScore', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([makeKeyword({ opportunityScore: undefined })], 'example.com', [])
      );
      // opportunityScore column value is '' when undefined
      expect(content).toContain('test keyword,1000,50,,');
    });

    it('should produce an empty row set when passed an empty array', () => {
      const { content } = captureDownload(() =>
        service.exportOpportunities([], 'example.com', [])
      );
      expect(content).toContain('Total Opportunities: 0');
    });
  });

  // ---------------------------------------------------------------------------
  // exportBlogTopics()
  // ---------------------------------------------------------------------------

  describe('exportBlogTopics()', () => {
    it('should use a filename matching blog-topics_<slug>_<date>.csv', () => {
      const today = new Date().toISOString().split('T')[0];
      const { filename } = captureDownload(() =>
        service.exportBlogTopics([makeTopic()], 'my-blog.com', [])
      );
      expect(filename).toBe(`blog-topics_my-blog-com_${today}.csv`);
    });

    it('should include the "Blog Topic Recommendations Report" title in the metadata header', () => {
      const { content } = captureDownload(() =>
        service.exportBlogTopics([makeTopic()], 'example.com', [])
      );
      expect(content).toContain('Blog Topic Recommendations Report');
    });

    it('should include the row count in the metadata header', () => {
      const topics = [makeTopic(), makeTopic({ title: 'Second' })];
      const { content } = captureDownload(() =>
        service.exportBlogTopics(topics, 'example.com', [])
      );
      expect(content).toContain('Total Topics: 2');
    });

    it('should include the column header row', () => {
      const { content } = captureDownload(() =>
        service.exportBlogTopics([makeTopic()], 'example.com', [])
      );
      expect(content).toContain(
        'Rank,Title,Keyword,Category,Recommendation Score,Search Volume,Difficulty,Competitor Count'
      );
    });

    it('should number rows starting at 1', () => {
      const topics = [makeTopic({ title: 'First' }), makeTopic({ title: 'Second' })];
      const { content } = captureDownload(() =>
        service.exportBlogTopics(topics, 'example.com', [])
      );
      const lines = content.split('\n');
      // Find data lines (after the column header)
      const colHeaderIdx = lines.findIndex(l => l.startsWith('Rank,'));
      expect(lines[colHeaderIdx + 1]).toMatch(/^1,/);
      expect(lines[colHeaderIdx + 2]).toMatch(/^2,/);
    });

    it('should include all topic fields in a data row', () => {
      const topic = makeTopic({
        title: 'Best SEO Tools',
        keyword: 'seo tools',
        templateCategory: 'best-of',
        recommendationScore: 90,
        searchVolume: 8000,
        difficulty: 55,
        competitorCount: 4,
      });
      const { content } = captureDownload(() =>
        service.exportBlogTopics([topic], 'example.com', [])
      );
      expect(content).toContain('1,Best SEO Tools,seo tools,best-of,90,8000,55,4');
    });

    it('should produce an empty row set when passed an empty array', () => {
      const { content } = captureDownload(() =>
        service.exportBlogTopics([], 'example.com', [])
      );
      expect(content).toContain('Total Topics: 0');
    });
  });

  // ---------------------------------------------------------------------------
  // exportAllKeywords()
  // ---------------------------------------------------------------------------

  describe('exportAllKeywords()', () => {
    it('should use a filename matching all-keywords_<slug>_<date>.csv', () => {
      const today = new Date().toISOString().split('T')[0];
      const { filename } = captureDownload(() =>
        service.exportAllKeywords(makeResults(), 'example.com', [])
      );
      expect(filename).toBe(`all-keywords_example-com_${today}.csv`);
    });

    it('should include the "All Keywords Report" title in the metadata header', () => {
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults(), 'example.com', [])
      );
      expect(content).toContain('All Keywords Report');
    });

    it('should include the keyword count in the metadata header', () => {
      const results = makeResults({ allKeywords: [makeKeyword(), makeKeyword({ keyword: 'second' })] });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(results, 'example.com', [])
      );
      expect(content).toContain('Total Keywords: 2');
    });

    it('should include the column header row with a Type column', () => {
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults(), 'example.com', [])
      );
      expect(content).toContain(
        'Keyword,Type,Search Volume,Difficulty,Opportunity Score,Your Position,Competitor Count,Competitors,CPC (USD)'
      );
    });

    it('should label a keyword as "Opportunity" when isOpportunity is true', () => {
      const kw = makeKeyword({ isOpportunity: true, userRanking: null });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      expect(content).toContain(',Opportunity,');
    });

    it('should label a keyword as "Shared" when the user ranks and competitors rank too', () => {
      const kw = makeKeyword({
        isOpportunity: false,
        userRanking: { position: 5 },
        competitorCount: 2,
      });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      expect(content).toContain(',Shared,');
    });

    it('should label a keyword as "Your Unique" when the user ranks but no competitors do', () => {
      const kw = makeKeyword({
        isOpportunity: false,
        userRanking: { position: 2 },
        competitorCount: 0,
        competitorRankings: [],
      });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      expect(content).toContain(',Your Unique,');
    });

    it('should label a keyword as "Other" when no one ranks', () => {
      const kw = makeKeyword({
        isOpportunity: false,
        userRanking: null,
        competitorCount: 0,
        competitorRankings: [],
      });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      expect(content).toContain(',Other,');
    });

    it('should include the user ranking position when present', () => {
      const kw = makeKeyword({
        isOpportunity: false,
        userRanking: { position: 7 },
        competitorCount: 1,
      });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      expect(content).toContain(',7,');
    });

    it('should output an empty position when userRanking is null', () => {
      const kw = makeKeyword({ isOpportunity: true, userRanking: null });
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [kw] }), 'example.com', [])
      );
      // The Your Position column appears between Opportunity Score and Competitor Count
      // i.e. ...opportunityScore,,competitorCount,...
      expect(content).toMatch(/\d+,,\d+,/);
    });

    it('should produce an empty row set when allKeywords is empty', () => {
      const { content } = captureDownload(() =>
        service.exportAllKeywords(makeResults({ allKeywords: [] }), 'example.com', [])
      );
      expect(content).toContain('Total Keywords: 0');
    });
  });

  // ---------------------------------------------------------------------------
  // escapeCSV() — exercised via exported content
  // ---------------------------------------------------------------------------

  describe('escapeCSV() — special character handling', () => {
    it('should wrap a value containing a comma in double-quotes', () => {
      const kw = makeKeyword({ keyword: 'buy, sell, trade' });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      expect(content).toContain('"buy, sell, trade"');
    });

    it('should escape internal double-quotes by doubling them', () => {
      const kw = makeKeyword({ keyword: 'the "best" tool' });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      expect(content).toContain('"the ""best"" tool"');
    });

    it('should wrap a value containing a newline in double-quotes', () => {
      const kw = makeKeyword({ keyword: 'line1\nline2' });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      expect(content).toContain('"line1\nline2"');
    });

    it('should output an empty string for a null-like value', () => {
      // opportunityScore undefined → empty cell; CPC undefined → empty cell
      const kw = makeKeyword({ opportunityScore: undefined, cpc: undefined });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      // two consecutive commas indicate an empty cell
      expect(content).toContain(',,');
    });

    it('should convert numeric values to strings without quoting', () => {
      const kw = makeKeyword({ searchVolume: 9999 });
      const { content } = captureDownload(() =>
        service.exportOpportunities([kw], 'example.com', [])
      );
      expect(content).toContain('9999');
    });
  });

  // ---------------------------------------------------------------------------
  // getDomainSlug() — exercised via filenames
  // ---------------------------------------------------------------------------

  describe('getDomainSlug() — filename slug generation', () => {
    it('should replace dots with dashes', () => {
      const { filename } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', [])
      );
      expect(filename).toContain('example-com');
    });

    it('should strip characters that are not alphanumeric or dashes', () => {
      const { filename } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'my_site.co.uk', [])
      );
      // underscores are stripped, dots become dashes
      expect(filename).toContain('mysite-co-uk');
    });

    it('should preserve existing dashes', () => {
      const { filename } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'my-blog.com', [])
      );
      expect(filename).toContain('my-blog-com');
    });
  });

  // ---------------------------------------------------------------------------
  // getDateString() — exercised via filenames
  // ---------------------------------------------------------------------------

  describe('getDateString() — date in filename', () => {
    it('should embed today\'s date in YYYY-MM-DD format in the filename', () => {
      const today = new Date().toISOString().split('T')[0];
      const { filename } = captureDownload(() =>
        service.exportOpportunities([makeKeyword()], 'example.com', [])
      );
      expect(filename).toContain(today);
    });
  });
});

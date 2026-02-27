import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DataforseoService } from './dataforseo.service';
import { StorageService, ApiCredentials } from './storage.service';
import { CacheService } from './cache.service';
import { environment } from '../../environments/environment';

describe('DataforseoService', () => {
  let service: DataforseoService;
  let httpMock: HttpTestingController;
  let storageSpy: jasmine.SpyObj<StorageService>;
  let cacheSpy: jasmine.SpyObj<CacheService>;

  const TEST_LOGIN = 'test@example.com';
  const TEST_PASSWORD = 'test-password';
  const TEST_DOMAIN = 'example.com';

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('StorageService', [
      'getCredentials', 'saveCredentials', 'clearCredentials', 'hasCredentials',
    ]);
    cacheSpy = jasmine.createSpyObj('CacheService', [
      'get', 'save', 'remove', 'getMetadata',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storageSpy },
        { provide: CacheService, useValue: cacheSpy },
      ],
    });

    service = TestBed.inject(DataforseoService);
    httpMock = TestBed.inject(HttpTestingController);

    // Default: no cache hit, credentials available
    cacheSpy.get.and.returnValue(null);
    storageSpy.getCredentials.and.returnValue({ login: TEST_LOGIN, password: TEST_PASSWORD });
    storageSpy.hasCredentials.and.returnValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // getStoredCredentials()
  // ---------------------------------------------------------------------------

  describe('getStoredCredentials()', () => {
    it('should delegate to StorageService.getCredentials()', () => {
      const creds: ApiCredentials = { login: 'a@b.com', password: 'pw' };
      storageSpy.getCredentials.and.returnValue(creds);
      expect(service.getStoredCredentials()).toEqual(creds);
      expect(storageSpy.getCredentials).toHaveBeenCalled();
    });

    it('should return null when no credentials are stored', () => {
      storageSpy.getCredentials.and.returnValue(null);
      expect(service.getStoredCredentials()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // saveCredentials()
  // ---------------------------------------------------------------------------

  describe('saveCredentials()', () => {
    it('should delegate to StorageService.saveCredentials()', () => {
      const creds: ApiCredentials = { login: 'a@b.com', password: 'pw' };
      service.saveCredentials(creds);
      expect(storageSpy.saveCredentials).toHaveBeenCalledWith(creds);
    });
  });

  // ---------------------------------------------------------------------------
  // clearCredentials()
  // ---------------------------------------------------------------------------

  describe('clearCredentials()', () => {
    it('should delegate to StorageService.clearCredentials()', () => {
      service.clearCredentials();
      expect(storageSpy.clearCredentials).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // hasCredentials()
  // ---------------------------------------------------------------------------

  describe('hasCredentials()', () => {
    it('should return true when storage has credentials', () => {
      storageSpy.hasCredentials.and.returnValue(true);
      expect(service.hasCredentials()).toBeTrue();
    });

    it('should return false when storage has no credentials', () => {
      storageSpy.hasCredentials.and.returnValue(false);
      expect(service.hasCredentials()).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // getAuthHeaders()
  // ---------------------------------------------------------------------------

  describe('getAuthHeaders()', () => {
    it('should return null when no credentials are stored', () => {
      storageSpy.getCredentials.and.returnValue(null);
      expect(service.getAuthHeaders()).toBeNull();
    });

    it('should return HttpHeaders with Basic auth when credentials are stored', () => {
      const headers = service.getAuthHeaders();
      expect(headers).not.toBeNull();
      const expectedAuth = `Basic ${btoa(`${TEST_LOGIN}:${TEST_PASSWORD}`)}`;
      expect(headers!.get('Authorization')).toBe(expectedAuth);
    });

    it('should include Content-Type: application/json in the headers', () => {
      const headers = service.getAuthHeaders();
      expect(headers!.get('Content-Type')).toBe('application/json');
    });
  });

  // ---------------------------------------------------------------------------
  // validateCredentials()
  // ---------------------------------------------------------------------------

  describe('validateCredentials()', () => {
    const url = `${environment.dataforSeoApiUrl}/serp/google/locations`;

    it('should return { isValid: true } when status_code is 20000', () => {
      let result: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 20000 });

      expect(result).toEqual({ isValid: true });
    });

    it('should send a GET request to the locations endpoint', () => {
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush({ status_code: 20000 });
    });

    it('should use a Basic auth header built from the supplied login and password', () => {
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe();
      const req = httpMock.expectOne(url);
      const expectedAuth = `Basic ${btoa(`${TEST_LOGIN}:${TEST_PASSWORD}`)}`;
      expect(req.request.headers.get('Authorization')).toBe(expectedAuth);
      req.flush({ status_code: 20000 });
    });

    it('should return isValid: false with an "Invalid login" message for status_code 40100', () => {
      let result: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 40100 });

      expect(result.isValid).toBeFalse();
      expect(result.error).toContain('Invalid login or password');
    });

    it('should return isValid: false with status info for any other status_code', () => {
      let result: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 50000, status_message: 'Internal Error' });

      expect(result.isValid).toBeFalse();
      expect(result.error).toContain('50000');
      expect(result.error).toContain('Internal Error');
    });

    it('should throw with a network error message when HTTP status is 0', () => {
      let error: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).error(new ProgressEvent('error'), { status: 0 });

      expect(error.error).toBe('Network error. Please check your internet connection.');
    });

    it('should throw using error.error.status_message when it is present on the HTTP error', () => {
      let error: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush(
        { status_message: 'Bad request' },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(error.error).toBe('Bad request');
    });

    it('should throw with a generic message for unrecognised HTTP error shapes', () => {
      let error: any;
      service.validateCredentials(TEST_LOGIN, TEST_PASSWORD).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(error.error).toBe('Failed to validate credentials');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchDomainKeywords()
  // ---------------------------------------------------------------------------

  describe('fetchDomainKeywords()', () => {
    const url = `${environment.dataforSeoApiUrl}/dataforseo_labs/google/ranked_keywords/live`;
    const cacheKey = `domain_keywords_${TEST_DOMAIN}`;

    /** Build a minimal well-formed API response */
    const makeSuccessResponse = (items: any[] = []) => ({
      status_code: 20000,
      tasks: [{ result: [{ items }] }],
    });

    /** Build a well-formed keyword item */
    const makeItem = (
      keyword = 'test keyword',
      volume = 1000,
      competition = 0.5,
      rankAbsolute = 3,
      etv = 500,
      cpc = 1.5
    ) => ({
      keyword_data: {
        keyword,
        keyword_info: { search_volume: volume, competition, cpc },
      },
      ranked_serp_element: { serp_item: { rank_absolute: rankAbsolute, etv } },
    });

    it('should return cached keywords without making an HTTP call when cache hits', () => {
      const cached = [{ keyword: 'cached kw', searchVolume: 100, difficulty: 50, position: 1 }];
      cacheSpy.get.and.returnValue(cached);

      let result: any;
      service.fetchDomainKeywords(TEST_DOMAIN).subscribe(r => (result = r));

      httpMock.expectNone(url);
      expect(result).toEqual(cached);
      expect(cacheSpy.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should bypass cache and make an HTTP call when useCache is false', () => {
      const cached = [{ keyword: 'cached kw', searchVolume: 100, difficulty: 50, position: 1 }];
      cacheSpy.get.and.returnValue(cached);

      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe();

      httpMock.expectOne(url).flush(makeSuccessResponse());
    });

    it('should throw immediately with "No API credentials found" when there are no stored credentials', () => {
      storageSpy.getCredentials.and.returnValue(null);

      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectNone(url);
      expect(error.error).toBe('No API credentials found');
    });

    it('should POST to the ranked_keywords/live endpoint', () => {
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('POST');
      req.flush(makeSuccessResponse());
    });

    it('should include the target domain in the POST body', () => {
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.body[0].target).toBe(TEST_DOMAIN);
      req.flush(makeSuccessResponse());
    });

    it('should parse a successful response into DomainKeywordRanking objects', () => {
      const item = makeItem('seo tool', 2000, 0.6, 5, 300, 2.5);
      let result: any[];
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush(makeSuccessResponse([item]));

      expect(result!.length).toBe(1);
      expect(result![0].keyword).toBe('seo tool');
      expect(result![0].searchVolume).toBe(2000);
      expect(result![0].difficulty).toBe(60); // Math.round(0.6 * 100)
      expect(result![0].position).toBe(5);
      expect(result![0].etv).toBe(300);
      expect(result![0].cpc).toBe(2.5);
    });

    it('should cache the results after a successful API call', () => {
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe();
      httpMock.expectOne(url).flush(makeSuccessResponse([makeItem()]));
      expect(cacheSpy.save).toHaveBeenCalledWith(cacheKey, jasmine.any(Array));
    });

    it('should return [] when the tasks array in the response is empty', () => {
      let result: any[];
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 20000, tasks: [] });

      expect(result!).toEqual([]);
    });

    it('should return [] when the task result is null', () => {
      let result: any[];
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 20000, tasks: [{ result: null }] });

      expect(result!).toEqual([]);
    });

    it('should return [] when the result items array is null', () => {
      let result: any[];
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 20000, tasks: [{ result: [{ items: null }] }] });

      expect(result!).toEqual([]);
    });

    it('should throw when the top-level response status_code is not 20000', () => {
      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush({ status_code: 40000, status_message: 'Bad request' });

      expect(error).toBeTruthy();
    });

    it('should silently drop items that fail to parse rather than returning a sentinel', () => {
      const badItem = { keyword_data: null }; // accessing .keyword on null throws
      let result: any[];
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush(makeSuccessResponse([badItem]));

      expect(result!.length).toBe(0);
    });

    it('should throw with an "Invalid API credentials" message for HTTP 401', () => {
      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error.error).toBe('Invalid API credentials. Please update them in settings.');
    });

    it('should throw with a network error message for HTTP status 0', () => {
      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).error(new ProgressEvent('error'), { status: 0 });

      expect(error.error).toBe('Network error. Please check your internet connection.');
    });

    it('should throw using error.error.status_message when it is present on the HTTP error', () => {
      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush(
        { status_message: 'Rate limit exceeded' },
        { status: 429, statusText: 'Too Many Requests' }
      );

      expect(error.error).toBe('Rate limit exceeded');
    });

    it('should throw with a generic message for unrecognised HTTP errors', () => {
      let error: any;
      service.fetchDomainKeywords(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(error.error).toBe('Failed to fetch keywords');
    });
  });

  // ---------------------------------------------------------------------------
  // getDomainCacheMetadata()
  // ---------------------------------------------------------------------------

  describe('getDomainCacheMetadata()', () => {
    it('should delegate to CacheService.getMetadata() using the correct cache key', () => {
      const meta = { timestamp: Date.now(), ageInDays: 2 };
      cacheSpy.getMetadata.and.returnValue(meta);

      const result = service.getDomainCacheMetadata(TEST_DOMAIN);

      expect(cacheSpy.getMetadata).toHaveBeenCalledWith(`domain_keywords_${TEST_DOMAIN}`);
      expect(result).toEqual(meta);
    });

    it('should return null when the cache has no metadata for the domain', () => {
      cacheSpy.getMetadata.and.returnValue(null);
      expect(service.getDomainCacheMetadata(TEST_DOMAIN)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearDomainCache()
  // ---------------------------------------------------------------------------

  describe('clearDomainCache()', () => {
    it('should call CacheService.remove() with the correct cache key', () => {
      service.clearDomainCache(TEST_DOMAIN);
      expect(cacheSpy.remove).toHaveBeenCalledWith(`domain_keywords_${TEST_DOMAIN}`);
    });
  });

  // ---------------------------------------------------------------------------
  // discoverCompetitors()
  // ---------------------------------------------------------------------------

  describe('discoverCompetitors()', () => {
    const url = `${environment.dataforSeoApiUrl}/dataforseo_labs/google/competitors_domain/live`;
    const cacheKey = `competitors_${TEST_DOMAIN}`;

    /** Build a minimal well-formed competitor item */
    const makeItem = (
      domain: string,
      intersections: number,
      count = 500,
      etv = 1000,
      avgPosition = 5
    ) => ({
      domain,
      metrics: { organic: { intersections, count, etv } },
      avg_position: avgPosition,
    });

    /** Build a full success response with an optional task-level status_code */
    const makeSuccessResponse = (items: any[] = [], taskStatusCode = 20000) => ({
      status_code: 20000,
      tasks: [{ status_code: taskStatusCode, result: [{ items }] }],
    });

    it('should return cached competitors without making an HTTP call when cache hits', () => {
      const cached = [{ domain: 'rival.com', keywordOverlap: 100, totalKeywords: 500, etv: 1000, averagePosition: 5, isManual: false }];
      cacheSpy.get.and.returnValue(cached);

      let result: any;
      service.discoverCompetitors(TEST_DOMAIN).subscribe(r => (result = r));

      httpMock.expectNone(url);
      expect(result).toEqual(cached);
      expect(cacheSpy.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should bypass cache and make an HTTP call when useCache is false', () => {
      const cached = [{ domain: 'rival.com', keywordOverlap: 100, totalKeywords: 500, etv: 1000, averagePosition: 5, isManual: false }];
      cacheSpy.get.and.returnValue(cached);

      service.discoverCompetitors(TEST_DOMAIN, false).subscribe();

      httpMock.expectOne(url).flush(makeSuccessResponse());
    });

    it('should throw immediately with "No API credentials found" when there are no stored credentials', () => {
      storageSpy.getCredentials.and.returnValue(null);

      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectNone(url);
      expect(error.error).toBe('No API credentials found');
    });

    it('should POST to the competitors_domain/live endpoint', () => {
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('POST');
      req.flush(makeSuccessResponse());
    });

    it('should include the target domain in the POST body', () => {
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.body[0].target).toBe(TEST_DOMAIN);
      req.flush(makeSuccessResponse());
    });

    it('should parse a successful response into Competitor objects', () => {
      const item = makeItem('competitor.com', 200, 1000, 5000, 3);
      let result: any[];
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush(makeSuccessResponse([item]));

      expect(result!.length).toBe(1);
      expect(result![0].domain).toBe('competitor.com');
      expect(result![0].keywordOverlap).toBe(200);
      expect(result![0].totalKeywords).toBe(1000);
      expect(result![0].etv).toBe(5000);
      expect(result![0].averagePosition).toBe(3);
      expect(result![0].isManual).toBeFalse();
    });

    it('should sort competitors by keywordOverlap descending', () => {
      const items = [
        makeItem('low.com', 50),
        makeItem('high.com', 300),
        makeItem('mid.com', 150),
      ];
      let result: any[];
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush(makeSuccessResponse(items));

      expect(result![0].domain).toBe('high.com');
      expect(result![1].domain).toBe('mid.com');
      expect(result![2].domain).toBe('low.com');
    });

    it('should cache the results after a successful API call', () => {
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe();
      httpMock.expectOne(url).flush(makeSuccessResponse([makeItem('a.com', 100)]));
      expect(cacheSpy.save).toHaveBeenCalledWith(cacheKey, jasmine.any(Array));
    });

    it('should return [] when the tasks array in the response is empty', () => {
      let result: any[];
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({ status_code: 20000, tasks: [] });

      expect(result!).toEqual([]);
    });

    it('should return [] when the task result is null', () => {
      let result: any[];
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe(r => (result = r));

      httpMock.expectOne(url).flush({
        status_code: 20000,
        tasks: [{ status_code: 20000, result: null }],
      });

      expect(result!).toEqual([]);
    });

    it('should throw when the top-level response status_code is not 20000', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush({ status_code: 40000, status_message: 'Bad request' });

      expect(error).toBeTruthy();
    });

    it('should throw when the task-level status_code is not 20000', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush({
        status_code: 20000,
        tasks: [{ status_code: 40400, status_message: 'Domain not found' }],
      });

      expect(error).toBeTruthy();
    });

    it('should throw with an "Invalid API credentials" message for HTTP 401', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error.error).toBe('Invalid API credentials. Please update them in settings.');
    });

    it('should throw with a network error message for HTTP status 0', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).error(new ProgressEvent('error'), { status: 0 });

      expect(error.error).toBe('Network error. Please check your internet connection.');
    });

    it('should throw using error.error.status_message when it is present on the HTTP error', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush(
        { status_message: 'Rate limit exceeded' },
        { status: 429, statusText: 'Too Many Requests' }
      );

      expect(error.error).toBe('Rate limit exceeded');
    });

    it('should throw with a generic message for unrecognised HTTP errors', () => {
      let error: any;
      service.discoverCompetitors(TEST_DOMAIN, false).subscribe({ error: e => (error = e) });

      httpMock.expectOne(url).flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(error.error).toBe('Failed to discover competitors');
    });
  });

  // ---------------------------------------------------------------------------
  // getCompetitorsCacheMetadata()
  // ---------------------------------------------------------------------------

  describe('getCompetitorsCacheMetadata()', () => {
    it('should delegate to CacheService.getMetadata() using the correct cache key', () => {
      const meta = { timestamp: Date.now(), ageInDays: 1 };
      cacheSpy.getMetadata.and.returnValue(meta);

      const result = service.getCompetitorsCacheMetadata(TEST_DOMAIN);

      expect(cacheSpy.getMetadata).toHaveBeenCalledWith(`competitors_${TEST_DOMAIN}`);
      expect(result).toEqual(meta);
    });

    it('should return null when no metadata is cached', () => {
      cacheSpy.getMetadata.and.returnValue(null);
      expect(service.getCompetitorsCacheMetadata(TEST_DOMAIN)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearCompetitorsCache()
  // ---------------------------------------------------------------------------

  describe('clearCompetitorsCache()', () => {
    it('should call CacheService.remove() with the correct cache key', () => {
      service.clearCompetitorsCache(TEST_DOMAIN);
      expect(cacheSpy.remove).toHaveBeenCalledWith(`competitors_${TEST_DOMAIN}`);
    });
  });
});

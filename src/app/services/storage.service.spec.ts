import { TestBed } from '@angular/core/testing';

import { StorageService } from './storage.service';
import { Competitor } from '../models/competitor.model';

describe('StorageService', () => {
  let service: StorageService;

  const sampleCredentials = { login: 'user@example.com', password: 'secret123' };
  const sampleCompetitors: Competitor[] = [
    { domain: 'competitor1.com', keywordOverlap: 50, totalKeywords: 200 },
    { domain: 'competitor2.com', keywordOverlap: 30, totalKeywords: 150 }
  ];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── Credentials ──────────────────────────────────────────────────────────

  describe('saveCredentials() / getCredentials()', () => {
    it('should save and retrieve credentials', () => {
      service.saveCredentials(sampleCredentials);
      expect(service.getCredentials()).toEqual(sampleCredentials);
    });

    it('should return null when no credentials are stored', () => {
      expect(service.getCredentials()).toBeNull();
    });

    it('should return null when stored credentials are malformed JSON', () => {
      localStorage.setItem('searchscout_api_credentials', 'not-valid-json');
      expect(service.getCredentials()).toBeNull();
    });
  });

  describe('hasCredentials()', () => {
    it('should return true when credentials are stored', () => {
      service.saveCredentials(sampleCredentials);
      expect(service.hasCredentials()).toBeTrue();
    });

    it('should return false when no credentials are stored', () => {
      expect(service.hasCredentials()).toBeFalse();
    });
  });

  describe('clearCredentials()', () => {
    it('should remove stored credentials', () => {
      service.saveCredentials(sampleCredentials);
      service.clearCredentials();
      expect(service.getCredentials()).toBeNull();
      expect(service.hasCredentials()).toBeFalse();
    });

    it('should not throw when no credentials are stored', () => {
      expect(() => service.clearCredentials()).not.toThrow();
    });
  });

  // ─── Selected Competitors ─────────────────────────────────────────────────

  describe('saveSelectedCompetitors() / getSelectedCompetitors()', () => {
    it('should save and retrieve competitors for a domain', () => {
      service.saveSelectedCompetitors('example.com', sampleCompetitors);
      expect(service.getSelectedCompetitors('example.com')).toEqual(sampleCompetitors);
    });

    it('should return null when no competitors stored for the domain', () => {
      expect(service.getSelectedCompetitors('unknown.com')).toBeNull();
    });

    it('should store competitors independently per domain', () => {
      service.saveSelectedCompetitors('domain1.com', sampleCompetitors);
      service.saveSelectedCompetitors('domain2.com', [sampleCompetitors[0]]);
      expect(service.getSelectedCompetitors('domain1.com')).toEqual(sampleCompetitors);
      expect(service.getSelectedCompetitors('domain2.com')).toEqual([sampleCompetitors[0]]);
    });

    it('should handle malformed JSON gracefully and return null', () => {
      const key = 'searchscout_selected_competitors_bad.com';
      localStorage.setItem(key, 'not-json');
      expect(service.getSelectedCompetitors('bad.com')).toBeNull();
    });
  });

  describe('clearSelectedCompetitors()', () => {
    it('should remove competitors for the given domain', () => {
      service.saveSelectedCompetitors('example.com', sampleCompetitors);
      service.clearSelectedCompetitors('example.com');
      expect(service.getSelectedCompetitors('example.com')).toBeNull();
    });

    it('should not affect competitors stored for other domains', () => {
      service.saveSelectedCompetitors('domain1.com', sampleCompetitors);
      service.saveSelectedCompetitors('domain2.com', [sampleCompetitors[0]]);
      service.clearSelectedCompetitors('domain1.com');
      expect(service.getSelectedCompetitors('domain2.com')).toEqual([sampleCompetitors[0]]);
    });
  });

  // ─── Current Domain ───────────────────────────────────────────────────────

  describe('saveCurrentDomain() / getCurrentDomain()', () => {
    it('should save and retrieve the current domain', () => {
      service.saveCurrentDomain('example.com');
      expect(service.getCurrentDomain()).toBe('example.com');
    });

    it('should return null when no domain is stored', () => {
      expect(service.getCurrentDomain()).toBeNull();
    });

    it('should overwrite the previous domain', () => {
      service.saveCurrentDomain('first.com');
      service.saveCurrentDomain('second.com');
      expect(service.getCurrentDomain()).toBe('second.com');
    });
  });

  describe('clearCurrentDomain()', () => {
    it('should remove the stored domain', () => {
      service.saveCurrentDomain('example.com');
      service.clearCurrentDomain();
      expect(service.getCurrentDomain()).toBeNull();
    });
  });
});

import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataforseoService } from './dataforseo.service';
import { CacheService } from './cache.service';
import { Competitor } from '../models/competitor.model';
import { DomainKeywordRanking } from '../models/keyword.model';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../models/aggregated-keyword.model';
import { Logger } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class CompetitorAnalysisService {
  private dataforseoService = inject(DataforseoService);
  private cache = inject(CacheService);

  /**
   * Analyze keywords for user domain and selected competitors
   */
  analyzeCompetitors(
    userDomain: string,
    userKeywords: DomainKeywordRanking[],
    competitors: Competitor[]
  ): Observable<CompetitorAnalysisResults> {
    Logger.debug('Starting competitor analysis for:', userDomain);
    Logger.debug('Analyzing competitors:', competitors.map(c => c.domain));

    // Check cache first
    const cacheKey = this.getCacheKey(userDomain, competitors);
    const cached = this.cache.get<CompetitorAnalysisResults>(cacheKey);
    if (cached) {
      Logger.debug('Using cached competitor analysis');
      return of(cached);
    }

    // Fetch keywords for all competitors
    const competitorFetches = competitors.map(competitor =>
      this.dataforseoService.fetchDomainKeywords(competitor.domain).pipe(
        map(keywords => ({
          domain: competitor.domain,
          keywords: keywords
        })),
        catchError(error => {
          Logger.error(`Error fetching keywords for ${competitor.domain}:`, error);
          // Return empty array on error so analysis can continue
          return of({
            domain: competitor.domain,
            keywords: [] as DomainKeywordRanking[]
          });
        })
      )
    );

    return forkJoin(competitorFetches).pipe(
      map(competitorData => {
        const results = this.aggregateKeywords(
          userDomain,
          userKeywords,
          competitorData,
          competitors.map(c => c.domain)
        );

        // Cache the results
        this.cache.save(cacheKey, results);
        Logger.debug('Cached competitor analysis results');

        return results;
      })
    );
  }

  /**
   * Aggregate keywords from user and competitors
   */
  private aggregateKeywords(
    userDomain: string,
    userKeywords: DomainKeywordRanking[],
    competitorData: Array<{ domain: string; keywords: DomainKeywordRanking[] }>,
    competitorDomains: string[]
  ): CompetitorAnalysisResults {
    Logger.debug('Aggregating keywords...');

    // Create a map of all unique keywords
    const keywordMap = new Map<string, AggregatedKeyword>();

    // Add user's keywords
    userKeywords.forEach(keyword => {
      keywordMap.set(keyword.keyword.toLowerCase(), {
        keyword: keyword.keyword,
        searchVolume: keyword.searchVolume,
        difficulty: keyword.difficulty,
        cpc: keyword.cpc,
        userRanking: {
          position: keyword.position,
          etv: keyword.etv
        },
        competitorRankings: [],
        competitorCount: 0,
        isOpportunity: false
      });
    });

    // Add competitor keywords
    competitorData.forEach(({ domain, keywords }) => {
      keywords.forEach(keyword => {
        const key = keyword.keyword.toLowerCase();
        const existing = keywordMap.get(key);

        if (existing) {
          // Keyword already exists, add competitor ranking
          existing.competitorRankings.push({
            domain,
            position: keyword.position,
            etv: keyword.etv
          });
          existing.competitorCount++;
        } else {
          // New keyword not in user's list
          keywordMap.set(key, {
            keyword: keyword.keyword,
            searchVolume: keyword.searchVolume,
            difficulty: keyword.difficulty,
            cpc: keyword.cpc,
            userRanking: null,
            competitorRankings: [{
              domain,
              position: keyword.position,
              etv: keyword.etv
            }],
            competitorCount: 1,
            isOpportunity: true // User doesn't rank, but competitors do
          });
        }
      });
    });

    // Convert map to array
    const allKeywords = Array.from(keywordMap.values());

    // Calculate opportunity scores
    allKeywords.forEach(keyword => {
      if (keyword.isOpportunity) {
        keyword.opportunityScore = this.calculateOpportunityScore(keyword);
      }
    });

    // Categorize keywords
    const opportunities = allKeywords
      .filter(k => k.isOpportunity)
      .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));

    const shared = allKeywords.filter(k => k.userRanking && k.competitorCount > 0);

    const uniqueToUser = allKeywords.filter(k => k.userRanking && k.competitorCount === 0);

    Logger.debug('Aggregation complete:', {
      total: allKeywords.length,
      opportunities: opportunities.length,
      shared: shared.length,
      uniqueToUser: uniqueToUser.length
    });

    return {
      allKeywords,
      opportunities,
      shared,
      uniqueToUser,
      totalKeywords: allKeywords.length,
      analyzedCompetitors: competitorDomains,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate opportunity score using weighted formula from Feature 2
   */
  private calculateOpportunityScore(keyword: AggregatedKeyword): number {
    // Normalize search volume (0-100)
    const maxVolume = 100000; // Assume max of 100k searches/month
    const normalizedVolume = Math.min((keyword.searchVolume / maxVolume) * 100, 100);

    // Invert difficulty (lower difficulty = higher score)
    const invertedDifficulty = 100 - keyword.difficulty;

    // Competitor gap bonus (multiple competitors ranking = higher score)
    const competitorGapScore = Math.min((keyword.competitorCount / 5) * 100, 100);

    // Weighted score: 40% volume, 40% difficulty, 20% competitor count
    const score = (
      (0.4 * normalizedVolume) +
      (0.4 * invertedDifficulty) +
      (0.2 * competitorGapScore)
    );

    return Math.round(score);
  }

  /**
   * Generate cache key based on user domain and competitors
   */
  private getCacheKey(userDomain: string, competitors: Competitor[]): string {
    const competitorDomains = competitors
      .map(c => c.domain)
      .sort()
      .join(',');
    return `competitor_analysis_${userDomain}_${competitorDomains}`;
  }

  /**
   * Get cache metadata for competitor analysis
   */
  getCacheMetadata(userDomain: string, competitors: Competitor[]): { timestamp: number; ageInDays: number } | null {
    const cacheKey = this.getCacheKey(userDomain, competitors);
    return this.cache.getMetadata(cacheKey);
  }

  /**
   * Clear cache for competitor analysis
   */
  clearCache(userDomain: string, competitors: Competitor[]): void {
    const cacheKey = this.getCacheKey(userDomain, competitors);
    this.cache.remove(cacheKey);
  }
}
import { DomainKeywordRanking } from './keyword.model';

/**
 * Keyword data aggregated across user domain and competitors
 * Shows who ranks for each keyword and at what position
 */
export interface AggregatedKeyword {
    /** The keyword/search term */
    keyword: string;

    /** Monthly search volume */
    searchVolume: number;

    /** Keyword difficulty 0-100 */
    difficulty: number;

    /** Cost per click in USD */
    cpc?: number;

    /** User's ranking data (null if user doesn't rank) */
    userRanking?: {
        position: number;
        etv?: number;
    } | null;

    /** Competitor ranking data */
    competitorRankings: Array<{
        domain: string;
        position: number;
        etv?: number;
    }>;

    /** Number of competitors ranking for this keyword */
    competitorCount: number;

    /** Whether this is a keyword gap (competitors rank but user doesn't) */
    isOpportunity: boolean;

    /** Calculated opportunity score (0-100) */
    opportunityScore?: number;
}

/**
 * Analysis results for competitor keywords
 */
export interface CompetitorAnalysisResults {
    /** All aggregated keywords */
    allKeywords: AggregatedKeyword[];

    /** Keywords only competitors rank for (gaps/opportunities) */
    opportunities: AggregatedKeyword[];

    /** Keywords user ranks for but competitors don't */
    uniqueToUser: AggregatedKeyword[];

    /** Keywords both user and competitors rank for */
    shared: AggregatedKeyword[];

    /** Total keywords analyzed */
    totalKeywords: number;

    /** Analysis metadata */
    analyzedCompetitors: string[];
    timestamp: number;
}
/**
 * General keyword search metrics from DataForSEO
 * Not tied to any specific domain's rankings
 */
export interface KeywordMetrics {
    /** The search term/phrase (e.g., "best coffee makers") */
    keyword: string;

    /** Monthly search volume (how many people search this) */
    searchVolume: number;

    /** Keyword difficulty score 0-100 (higher = harder to rank for) */
    difficulty: number;

    /** Cost per click for paid ads in USD (optional) */
    cpc?: number;
}

/**
 * A specific domain's ranking for a keyword
 * Combines general keyword metrics with domain-specific position data
 */
export interface DomainKeywordRanking extends KeywordMetrics {
    /** This domain's current ranking position on Google (1 = top result, lower is better) */
    position: number;

    /** Estimated monthly traffic value in USD for this domain/keyword combo */
    etv?: number;
}

/**
 * Raw response from DataForSEO /ranked_keywords/live endpoint
 * Documentation: https://docs.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live/
 */
export interface DataForSeoRankedKeywordsResponse {
    version: string;
    status_code: number;
    status_message: string;
    tasks: Array<{
        result: Array<{
            total_count: number;
            items_count: number;
            items: Array<{
                keyword_data: {
                    keyword: string;
                    keyword_info: {
                        search_volume: number;
                        competition?: number;
                        cpc?: number;
                    };
                };
                ranked_serp_element: {
                    serp_item: {
                        rank_absolute: number;
                        etv?: number;
                    };
                };
            }>;
        }>;
    }>;
}
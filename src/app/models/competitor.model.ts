/**
 * Competitor domain with metrics from DataForSEO
 */
export interface Competitor {
  /** Competitor's domain name */
  domain: string;

  /** Number of keywords that overlap with user's domain */
  keywordOverlap: number;

  /** Total organic keywords the competitor ranks for */
  totalKeywords: number;

  /** Estimated traffic value in USD */
  etv?: number;

  /** Average SERP position across all keywords */
  averagePosition?: number;

  /** Whether this competitor was manually added by user */
  isManual?: boolean;
}

/**
 * Raw response from DataForSEO /competitors_domain/live endpoint
 * Documentation: https://docs.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live/
 */
export interface DataForSeoCompetitorsResponse {
  version: string;
  status_code: number;
  status_message: string;
  tasks: Array<{
    status_code?: number;
    status_message?: string;
    result: Array<{
      /** The domain we searched competitors for */
      target: string;

      /** Total competitors found */
      total_count: number;

      /** Array of competitor data */
      items: Array<{
        /** Competitor domain */
        domain: string;

        /** Average ranking position */
        avg_position: number;

        /** Sum of all positions */
        sum_position: number;

        /** Number of overlapping keywords */
        intersections: number;

        /** Competitor metrics */
        metrics: {
          organic: {
            /** Total organic keywords */
            count: number;

            /** Estimated traffic value */
            etv: number;

            /** Number of overlapping keywords (same as intersections) */
            intersections: number;

            /** Keywords in position 1 */
            pos_1: number;

            /** Keywords in positions 2-3 */
            pos_2_3: number;

            /** Keywords in positions 4-10 */
            pos_4_10: number;
          };
        };
      }>;
    }>;
  }>;
}
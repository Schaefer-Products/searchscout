import { AggregatedKeyword } from './aggregated-keyword.model';

/**
 * Generated blog topic recommendation
 */
export interface BlogTopic {
    /** Generated blog post title */
    title: string;

    /** The keyword this topic is based on */
    keyword: string;

    /** Template category used */
    templateCategory: string;

    /** Search volume for the keyword */
    searchVolume: number;

    /** Keyword difficulty */
    difficulty: number;

    /** Opportunity score (from AggregatedKeyword) */
    opportunityScore: number;

    /** Number of competitors ranking for this keyword */
    competitorCount: number;

    /** Combined recommendation score (0-100) */
    recommendationScore: number;
}

/**
 * Template for generating blog titles
 */
export interface TitleTemplate {
    /** Template string with {keyword} placeholder */
    template: string;

    /** Category of this template */
    category: 'how-to' | 'list' | 'best-of' | 'comparison' | 'guide' | 'vs' | 'tips' | 'ultimate';

    /** Description of what this template is good for */
    description?: string;
}
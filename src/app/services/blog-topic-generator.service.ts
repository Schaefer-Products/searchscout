import { Injectable } from '@angular/core';
import { AggregatedKeyword } from '../models/aggregated-keyword.model';
import { BlogTopic, TitleTemplate } from '../models/blog-topic.model';
import { Logger } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class BlogTopicGeneratorService {

  private titleTemplates: TitleTemplate[] = [
    // How-to templates
    { template: 'How to {keyword}', category: 'how-to' },
    { template: 'How to {keyword} in {year}', category: 'how-to' },
    { template: 'How to {keyword}: A Complete Guide', category: 'how-to' },
    { template: 'How to {keyword} (Step-by-Step Guide)', category: 'how-to' },
    { template: 'How to {keyword} Like a Pro', category: 'how-to' },

    // List templates
    { template: '{number} Ways to {keyword}', category: 'list' },
    { template: '{number} Tips for {keyword}', category: 'list' },
    { template: '{number} Best Practices for {keyword}', category: 'list' },
    { template: '{number} Things You Need to Know About {keyword}', category: 'list' },
    { template: '{number} Common Mistakes in {keyword}', category: 'list' },

    // Best-of templates
    { template: 'Best {keyword} in {year}', category: 'best-of' },
    { template: 'Top {number} {keyword}', category: 'best-of' },
    { template: 'Best {keyword} for Beginners', category: 'best-of' },
    { template: 'The Ultimate {keyword}', category: 'best-of' },
    { template: 'Best {keyword} You Should Try', category: 'best-of' },

    // Guide templates
    { template: '{keyword}: Everything You Need to Know', category: 'guide' },
    { template: 'Getting Started with {keyword}', category: 'guide' },
    { template: 'A Complete Guide to {keyword}', category: 'guide' },

    // Tips templates
    { template: '{number} {keyword} Tips That Actually Work', category: 'tips' },
    { template: 'Expert Tips for {keyword}', category: 'tips' },
    { template: '{keyword} Tips and Tricks', category: 'tips' },
    { template: 'Pro Tips for {keyword}', category: 'tips' },

    // Comparison templates
    { template: 'What is {keyword}?', category: 'comparison' },
    { template: '{keyword}: Definition and Examples', category: 'comparison' },
    { template: '{keyword}: A Simple Explanation', category: 'comparison' },
    { template: 'Understanding {keyword}: A Complete Overview', category: 'comparison' },

    // Ultimate templates
    { template: 'The Ultimate {keyword} Guide for {year}', category: 'ultimate' },
    { template: 'Everything About {keyword}', category: 'ultimate' },
    { template: 'The Only {keyword} Guide You\'ll Ever Need', category: 'ultimate' }
  ];

  /**
   * Generate blog topic recommendations from opportunity keywords
   */
  generateTopics(opportunities: AggregatedKeyword[], limit: number = 20): BlogTopic[] {
    Logger.debug('Generating blog topics from', opportunities.length, 'opportunities');

    const topics: BlogTopic[] = [];

    // Generate topics for each opportunity keyword
    opportunities.forEach(keyword => {
      // Pick best template for this keyword
      const template = this.selectBestTemplate(keyword.keyword);
      const title = this.fillTemplate(template, keyword.keyword);

      const topic: BlogTopic = {
        title: title,
        keyword: keyword.keyword,
        templateCategory: template.category,
        searchVolume: keyword.searchVolume,
        difficulty: keyword.difficulty,
        opportunityScore: keyword.opportunityScore || 0,
        competitorCount: keyword.competitorCount,
        recommendationScore: this.calculateRecommendationScore(keyword)
      };

      topics.push(topic);
    });

    // Sort by recommendation score (highest first)
    const sortedTopics = topics.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Return top N
    const topTopics = sortedTopics.slice(0, limit);

    Logger.debug('Generated', topTopics.length, 'blog topic recommendations');
    return topTopics;
  }

  /**
   * Select the best template for a keyword based on keyword structure
   */
  private selectBestTemplate(keyword: string): TitleTemplate {
    const lowerKeyword = keyword.toLowerCase();
    const words = lowerKeyword.split(' ');

    // Skip problematic patterns - use simple guide/explanation templates
    const problematicPatterns = [
      'define', 'definition', 'meaning', 'means', 'what is', 'what are',
      'who is', 'who are', 'when is', 'where is', 'why is'
    ];

    const hasProblematicPattern = problematicPatterns.some(pattern =>
      lowerKeyword.includes(pattern)
    );

    if (hasProblematicPattern) {
      // For definition-type keywords, use simple explanation templates
      const definitionTemplates = this.titleTemplates.filter(t =>
        t.category === 'comparison' ||
        t.category === 'guide'
      );
      return definitionTemplates[this.hashKeyword(keyword) % definitionTemplates.length];
    }

    // Check for "how to" already in keyword → Don't add another "how to"
    if (lowerKeyword.startsWith('how to') || lowerKeyword.startsWith('how do')) {
      // Use templates that don't add "how to" again
      const nonHowToTemplates = this.titleTemplates.filter(t =>
        t.category !== 'how-to'
      );
      return nonHowToTemplates[this.hashKeyword(keyword) % nonHowToTemplates.length];
    }

    // Check for verbs/actions → Good for how-to
    const actionVerbs = [
      'create', 'build', 'make', 'get', 'start', 'learn', 'find', 'choose',
      'use', 'implement', 'setup', 'install', 'configure', 'optimize', 'improve'
    ];

    const hasActionVerb = actionVerbs.some(verb => lowerKeyword.includes(verb));
    if (hasActionVerb) {
      return this.getRandomTemplate('how-to', keyword);
    }

    // Check for comparison/versus keywords
    if (lowerKeyword.includes(' vs ') || lowerKeyword.includes(' versus ') ||
      lowerKeyword.includes(' or ') || lowerKeyword.includes('difference between')) {
      return this.getRandomTemplate('comparison', keyword);
    }

    // Check for "best" keywords
    if (lowerKeyword.startsWith('best ') || lowerKeyword.includes('top ')) {
      return this.getRandomTemplate('best-of', keyword);
    }

    // Check for plural nouns (likely lists)
    const listIndicators = ['tips', 'ways', 'ideas', 'examples', 'tools', 'strategies', 'methods'];
    if (listIndicators.some(indicator => lowerKeyword.includes(indicator))) {
      return this.getRandomTemplate('list', keyword);
    }

    // Check for guides/tutorials
    if (lowerKeyword.includes('guide') || lowerKeyword.includes('tutorial')) {
      return this.getRandomTemplate('guide', keyword);
    }

    // Check for tool/product names (proper nouns) → Best-of or Guide
    const hasCapitalizedWord = keyword.split(' ').some(word =>
      word.length > 0 && word[0] === word[0].toUpperCase()
    );

    if (hasCapitalizedWord) {
      // For proper nouns (Coinbase, Astronomer, etc.), prefer guide or best-of
      const properNounCategories: Array<TitleTemplate['category']> = ['guide', 'best-of', 'ultimate'];
      const category = properNounCategories[this.hashKeyword(keyword) % properNounCategories.length];
      return this.getRandomTemplate(category, keyword);
    }

    // Check for job titles/roles → Guide templates work best
    const jobTitleIndicators = ['engineer', 'developer', 'manager', 'designer', 'analyst', 'specialist'];
    if (jobTitleIndicators.some(indicator => lowerKeyword.includes(indicator))) {
      return this.getRandomTemplate('guide', keyword);
    }

    // For generic keywords, prefer simple templates
    // Avoid "how to" for nouns, prefer guides and best-of
    if (words.length <= 2) {
      // Short keywords → Simple templates
      const simpleCategories: Array<TitleTemplate['category']> = ['guide', 'best-of', 'ultimate'];
      const category = simpleCategories[this.hashKeyword(keyword) % simpleCategories.length];
      return this.getRandomTemplate(category, keyword);
    }

    // Default: Mix of templates, but avoid how-to for complex keywords
    const defaultCategories: Array<TitleTemplate['category']> = ['guide', 'best-of', 'list', 'ultimate'];
    const category = defaultCategories[this.hashKeyword(keyword) % defaultCategories.length];
    return this.getRandomTemplate(category, keyword);
  }

  /**
   * Stable numeric hash derived from a keyword string.
   * Same keyword always produces the same value, distributing evenly across template pools.
   */
  private hashKeyword(keyword: string): number {
    return keyword.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  /**
   * Pick a template from a category deterministically based on the keyword.
   */
  private getRandomTemplate(category: TitleTemplate['category'], keyword: string): TitleTemplate {
    const categoryTemplates = this.titleTemplates.filter(t => t.category === category);
    return categoryTemplates[this.hashKeyword(keyword) % categoryTemplates.length];
  }

  /**
   * Fill template placeholders with actual values
   */
  private fillTemplate(template: TitleTemplate, keyword: string): string {
    let title = template.template;

    // Replace {keyword} - capitalize first letter
    const capitalizedKeyword = this.capitalizeFirst(keyword);
    title = title.replace(/{keyword}/g, capitalizedKeyword);

    // Replace {number} with a stable number 5-10 derived from the keyword
    const randomNumber = (this.hashKeyword(keyword) % 6) + 5;
    title = title.replace(/{number}/g, randomNumber.toString());

    // Replace {year} with current year
    const currentYear = new Date().getFullYear();
    title = title.replace(/{year}/g, currentYear.toString());

    return title;
  }

  /**
  * Convert string to title case (capitalize first letter of each word)
  */
  private capitalizeFirst(str: string): string {
    if (!str) return str;

    // Words that should stay lowercase in titles (unless first word)
    const lowercaseWords = new Set([
      'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of',
      'on', 'or', 'the', 'to', 'with', 'vs', 'versus'
    ]);

    return str
      .toLowerCase()
      .split(' ')
      .map((word, index) => {
        // Always capitalize first word, even if it's normally lowercase
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }

        // Keep certain words lowercase (unless they're the first word)
        if (lowercaseWords.has(word)) {
          return word;
        }

        // Capitalize all other words
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Calculate recommendation score
   * Based on opportunity score but also considers keyword length and difficulty
   */
  private calculateRecommendationScore(keyword: AggregatedKeyword): number {
    let score = keyword.opportunityScore || 0;

    // Bonus for higher search volume
    if (keyword.searchVolume > 1000) score += 5;
    if (keyword.searchVolume > 5000) score += 5;

    // Bonus for lower difficulty
    if (keyword.difficulty < 30) score += 10;
    else if (keyword.difficulty < 50) score += 5;

    // Bonus for more competitors (validates demand)
    if (keyword.competitorCount >= 3) score += 5;
    if (keyword.competitorCount >= 5) score += 5;

    // Penalty for very long keywords (harder to rank)
    const wordCount = keyword.keyword.split(' ').length;
    if (wordCount > 5) score -= 5;

    // Keep within 0-100 range
    return Math.min(Math.max(score, 0), 100);
  }
}
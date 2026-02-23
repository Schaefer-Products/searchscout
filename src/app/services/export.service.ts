import { Injectable } from '@angular/core';
import { AggregatedKeyword, CompetitorAnalysisResults } from '../models/aggregated-keyword.model';
import { BlogTopic } from '../models/blog-topic.model';
import { Logger } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  private escapeCSV(value: string | number | undefined | null): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getDomainSlug(domain: string): string {
    return domain.replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    Logger.debug(`Exported CSV: ${filename}`);
  }

  private buildMetadataHeader(
    title: string,
    userDomain: string,
    competitors: string[],
    rowCount: number,
    rowLabel: string
  ): string {
    const now = new Date().toLocaleString();
    const competitorList = competitors.join(', ');
    return [
      `SearchScout - ${title}`,
      `Domain: ${userDomain}`,
      `Competitors: ${competitorList}`,
      `Generated: ${now}`,
      `${rowLabel}: ${rowCount}`,
      '',
    ].join('\n');
  }

  exportOpportunities(
    opportunities: AggregatedKeyword[],
    userDomain: string,
    competitors: string[]
  ): void {
    const header = this.buildMetadataHeader(
      'Keyword Opportunities Report',
      userDomain,
      competitors,
      opportunities.length,
      'Total Opportunities'
    );

    const columns = 'Keyword,Search Volume,Difficulty,Opportunity Score,Competitor Count,Competitors,CPC (USD)';

    const rows = opportunities.map(kw => {
      const competitorStr = kw.competitorRankings
        .map(c => `${c.domain} (#${c.position})`)
        .join('; ');
      return [
        this.escapeCSV(kw.keyword),
        this.escapeCSV(kw.searchVolume),
        this.escapeCSV(kw.difficulty),
        this.escapeCSV(kw.opportunityScore ?? ''),
        this.escapeCSV(kw.competitorCount),
        this.escapeCSV(competitorStr),
        this.escapeCSV(kw.cpc != null ? kw.cpc.toFixed(2) : ''),
      ].join(',');
    });

    const content = header + columns + '\n' + rows.join('\n');
    const filename = `opportunities_${this.getDomainSlug(userDomain)}_${this.getDateString()}.csv`;
    this.downloadCSV(content, filename);
  }

  exportBlogTopics(
    topics: BlogTopic[],
    userDomain: string,
    competitors: string[]
  ): void {
    const header = this.buildMetadataHeader(
      'Blog Topic Recommendations Report',
      userDomain,
      competitors,
      topics.length,
      'Total Topics'
    );

    const columns = 'Rank,Title,Keyword,Category,Recommendation Score,Search Volume,Difficulty,Competitor Count';

    const rows = topics.map((topic, index) => [
      this.escapeCSV(index + 1),
      this.escapeCSV(topic.title),
      this.escapeCSV(topic.keyword),
      this.escapeCSV(topic.templateCategory),
      this.escapeCSV(topic.recommendationScore),
      this.escapeCSV(topic.searchVolume),
      this.escapeCSV(topic.difficulty),
      this.escapeCSV(topic.competitorCount),
    ].join(','));

    const content = header + columns + '\n' + rows.join('\n');
    const filename = `blog-topics_${this.getDomainSlug(userDomain)}_${this.getDateString()}.csv`;
    this.downloadCSV(content, filename);
  }

  exportAllKeywords(
    results: CompetitorAnalysisResults,
    userDomain: string,
    competitors: string[]
  ): void {
    const header = this.buildMetadataHeader(
      'All Keywords Report',
      userDomain,
      competitors,
      results.allKeywords.length,
      'Total Keywords'
    );

    const columns = 'Keyword,Type,Search Volume,Difficulty,Opportunity Score,Your Position,Competitor Count,Competitors,CPC (USD)';

    const getType = (kw: AggregatedKeyword): string => {
      if (kw.isOpportunity) return 'Opportunity';
      if (kw.userRanking && kw.competitorCount > 0) return 'Shared';
      if (kw.userRanking) return 'Your Unique';
      return 'Other';
    };

    const rows = results.allKeywords.map(kw => {
      const competitorStr = kw.competitorRankings
        .map(c => `${c.domain} (#${c.position})`)
        .join('; ');
      return [
        this.escapeCSV(kw.keyword),
        this.escapeCSV(getType(kw)),
        this.escapeCSV(kw.searchVolume),
        this.escapeCSV(kw.difficulty),
        this.escapeCSV(kw.opportunityScore ?? ''),
        this.escapeCSV(kw.userRanking?.position ?? ''),
        this.escapeCSV(kw.competitorCount),
        this.escapeCSV(competitorStr),
        this.escapeCSV(kw.cpc != null ? kw.cpc.toFixed(2) : ''),
      ].join(',');
    });

    const content = header + columns + '\n' + rows.join('\n');
    const filename = `all-keywords_${this.getDomainSlug(userDomain)}_${this.getDateString()}.csv`;
    this.downloadCSV(content, filename);
  }
}

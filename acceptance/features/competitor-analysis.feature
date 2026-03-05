Feature: Competitor Keyword Analysis and Opportunity Detection
  As a small business owner
  I want to compare my keyword rankings against my competitors
  So that I can discover keyword gaps I should be targeting

  Rule: Analysing competitors and viewing results

    Background:
      Given I am authenticated with valid DataForSEO API credentials
      And I have analyzed my domain "example.com"
      And I have discovered competitors
      And I have selected 3 competitors for analysis

    Scenario: Running an analysis for the first time
      When the competitor analysis starts
      Then keywords are fetched for all 3 competitors in parallel
      And the results are aggregated across my domain and all competitors
      And I see a count of opportunities, shared keywords, unique keywords, and total keywords
      And the full analysis is saved to the cache

    Scenario: Viewing keyword opportunities
      Given the competitor analysis is complete
      When I am on the "Opportunities" tab
      Then I see keywords that competitors rank for but I do not
      And each keyword shows its search volume, difficulty, competitor count, and opportunity score
      And the keywords are sorted by opportunity score descending by default

    Scenario: Switching between keyword views
      Given the competitor analysis is complete
      When I click the "Shared" tab
      Then I see only keywords that both I and my competitors rank for
      When I click the "Your Unique" tab
      Then I see only keywords I rank for that none of my competitors rank for
      When I click the "All Keywords" tab
      Then I see all keywords from the combined analysis

    Scenario: Sorting keywords by a column
      Given I am viewing the "Opportunities" tab
      When I click the "Difficulty" column header
      Then opportunities are sorted by difficulty descending
      When I click the "Difficulty" column header again
      Then opportunities are sorted by difficulty ascending

    Scenario: Loading more keywords
      Given there are more than 50 opportunity keywords
      When I view the "Opportunities" tab
      Then I see the first 50 keywords
      When I click "Load More Keywords"
      Then the next 50 keywords are appended to the list

    Scenario: Viewing the blog topics generated from opportunities
      Given the competitor analysis is complete and there are keyword opportunities
      When I click the "Blog Topics" tab
      Then I see a grid of ready-to-use blog post title cards
      And each card shows a title, keyword, category, recommendation score, search volume, difficulty, and competitor count
      And the cards are sorted by recommendation score descending

  Rule: Cache and data freshness

    Background:
      Given I am authenticated with valid DataForSEO API credentials
      And I have analyzed my domain "example.com"
      And I have previously completed a competitor analysis

    Scenario: Refreshing a cached analysis
      Given I am viewing cached competitor analysis results
      When I click "Refresh"
      Then the cache for this analysis is cleared
      And a fresh analysis is performed against the DataForSEO API
      And the results display updates with the latest data

    Scenario: Analysis refreshes when competitor selection changes
      Given I have selected competitors:
        | domain           |
        | competitor-a.com |
        | competitor-b.com |
        | competitor-c.com |
      And I have clicked "Analyze 3 Competitors"
      And the competitor analysis has completed
      When I click "Change Selection"
      And I deselect "competitor-c.com"
      And I select "competitor-d.com"
      And I click "Analyze 3 Competitors"
      Then the analysis refreshes with new data
      And the opportunities reflect the updated competitor set
      And the blog topics regenerate based on the new opportunities

    Scenario: Cached data is not reused for a different competitor set
      Given I have analyzed with competitors "competitor-a.com, competitor-b.com"
      And the analysis results are cached
      When I change to competitors "competitor-c.com, competitor-d.com"
      And I start the analysis
      Then the system fetches fresh data for the new competitor set
      And the cached data from the previous competitor set is not used

Feature: Domain Keyword Analysis
  As a small business owner
  I want to analyze my domain's keyword rankings
  So that I can understand my current SEO performance

  Background:
    Given I am authenticated with valid API credentials
    And I am on the dashboard

  Scenario: Analyzing a domain for the first time
    When I enter "example.com" in the domain input
    And I click "Analyze Domain"
    Then the app fetches up to 1000 keywords from the DataForSEO API
    And I see a table of keywords with columns: Keyword, Search Volume, Difficulty, Position
    And I see summary stats for total keywords, total search volume, average position, and top 3 rankings
    And the results are marked as "Fresh data"
    And the results are saved to the cache

  Scenario: Loading results from cache on repeat analysis
    Given "example.com" has been analyzed within the last 90 days
    When I enter "example.com" in the domain input
    And I click "Analyze Domain"
    Then the results load from cache without calling the DataForSEO API
    And I see "Data from cache" with the number of days since the last fetch

  Scenario: Refreshing stale cached results
    Given I am viewing cached results for "example.com"
    When I click "Refresh"
    Then a fresh API call is made to DataForSEO
    And the cache is updated with the new results
    And the display changes to "Fresh data"

  Scenario: Analyzing a domain with no ranking keywords
    When I enter a newly registered domain with no keyword rankings
    And I click "Analyze Domain"
    Then I see an empty state message explaining no keywords were found
    And I do not see the keyword table or stats cards

  Scenario: Sorting the keyword table
    Given I am viewing keyword results for "example.com"
    When I click the "Search Volume" column header
    Then keywords are sorted by search volume descending
    When I click the "Search Volume" column header again
    Then keywords are sorted by search volume ascending

  Scenario: Paginating through keyword results
    Given my domain has more than 100 ranking keywords
    When I view the keyword results
    Then I see the first 100 keywords
    And I see a "Load More Keywords" button showing the remaining count
    When I click "Load More Keywords"
    Then the next 100 keywords are appended below the existing results

  Scenario: Previously saved competitors are not shown before domain analysis runs
    Given I have previously analyzed "example.com" and saved a competitor selection
    And my API credentials have expired and I have re-entered them
    When I arrive at the dashboard
    Then the domain input is pre-filled with "example.com"
    But the selected competitors section is not visible
    When I click "Analyze Domain"
    Then the keyword results appear
    And the selected competitors section becomes visible

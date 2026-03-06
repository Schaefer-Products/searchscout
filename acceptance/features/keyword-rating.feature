Feature: Keyword Rating
  As a small business owner using SearchScout
  I want to rate keywords with emoji ratings
  So I can track which keywords I care about and hide irrelevant ones

  Background:
    Given I have valid API credentials seeded in IndexedDB
    And I have "example.com" set as my current domain
    And I have cached domain keywords for "example.com"
    And I navigate to the dashboard

  # ---------------------------------------------------------------------------
  # Rating a keyword
  # ---------------------------------------------------------------------------

  Scenario: Rating a keyword saves the rating visually
    When I click the rating emoji for "seo tools" with rating 3
    Then the rating control for "seo tools" shows rating 3 as selected

  Scenario: Rating persists after page reload
    When I click the rating emoji for "seo tools" with rating 2
    And I reload the page
    Then the rating control for "seo tools" shows rating 2 as selected

  Scenario: Rating appears on the same keyword across tabs in competitor analysis
    Given I have selected competitors seeded in IndexedDB
    And I have cached competitor analysis results
    And I have rated "seo tools" with rating 3 seeded in IndexedDB
    When I start the competitor analysis
    And I navigate to the "Shared" tab in competitor analysis
    Then the rating control for "seo tools" shows rating 3 as selected

  # ---------------------------------------------------------------------------
  # Rating 0 — hidden keywords
  # ---------------------------------------------------------------------------

  Scenario: Rating a keyword 0 removes it from the visible table
    When I click the rating emoji for "seo tools" with rating 0
    Then "seo tools" is not visible in the keyword table

  Scenario: Hidden keywords count increments when a keyword is rated 0
    When I click the rating emoji for "seo tools" with rating 0
    Then the show hidden toggle displays a count of 1

  Scenario: Show hidden keywords toggle reveals the hidden row with distinct styling
    When I click the rating emoji for "seo tools" with rating 0
    And I click the show hidden keywords toggle
    Then "seo tools" is visible in the keyword table
    And "seo tools" is rendered with hidden styling

  Scenario: Re-rating a hidden keyword from the hidden view restores it to the table
    When I click the rating emoji for "seo tools" with rating 0
    And I click the show hidden keywords toggle
    And I click the rating emoji for "seo tools" with rating 2
    Then "seo tools" is visible in the keyword table without hidden styling

  Scenario: Rating 0 triggers an undo toast notification
    When I click the rating emoji for "seo tools" with rating 0
    Then the undo toast is visible

  Scenario: Clicking Undo in the toast restores the keyword to the table
    When I click the rating emoji for "seo tools" with rating 0
    And I click the undo button in the toast
    Then "seo tools" is visible in the keyword table

  # ---------------------------------------------------------------------------
  # Persistence
  # ---------------------------------------------------------------------------

  Scenario: Ratings survive a full page reload
    Given I have rated "seo tools" with rating 4 seeded in IndexedDB
    When I reload the page
    Then the rating control for "seo tools" shows rating 4 as selected

  Scenario: Ratings are domain-scoped and do not bleed across domains
    Given I have rated "seo tools" with rating 4 seeded in IndexedDB for "example.com"
    And I have cached domain keywords for "other.com"
    When I change the current domain to "other.com"
    Then the rating control for "seo tools" shows no rating selected

  Scenario: Ratings for a domain are preserved in IDB when switching domains
    Given I have rated "seo tools" with rating 4 seeded in IndexedDB for "example.com"
    When I switch to "other.com" and then back to "example.com"
    Then the rating control for "seo tools" shows rating 4 as selected

  # ---------------------------------------------------------------------------
  # Blog Topics stale banner
  # ---------------------------------------------------------------------------

  Scenario: Changing a rating shows the blog topics stale banner
    Given I have selected competitors seeded in IndexedDB
    And I have cached competitor analysis results
    And I start the competitor analysis
    And I navigate to the "Blog Topics" tab in competitor analysis
    When I navigate to the "Opportunities" tab in competitor analysis
    And I click the rating emoji for "link building" with rating 2
    Then the blog topics stale banner is visible

  Scenario: Clicking Regenerate topics hides the stale banner
    Given I have selected competitors seeded in IndexedDB
    And I have cached competitor analysis results
    And I start the competitor analysis
    And I navigate to the "Opportunities" tab in competitor analysis
    And I click the rating emoji for "link building" with rating 2
    When I click Regenerate topics on the stale banner
    Then the blog topics stale banner is not visible

  # ---------------------------------------------------------------------------
  # Hint row (first-visit guidance)
  # ---------------------------------------------------------------------------

  Scenario: Hint row appears on first visit with no ratings
    Then the rating hint row is visible

  Scenario: Hint row disappears after the first rating action
    When I click the rating emoji for "seo tools" with rating 1
    Then the rating hint row is not visible

  Scenario: Hint row does not reappear after page reload once dismissed
    When I click the rating emoji for "seo tools" with rating 1
    And I reload the page
    Then the rating hint row is not visible

  # ---------------------------------------------------------------------------
  # Show hidden keywords
  # ---------------------------------------------------------------------------

  Scenario: Toggle shows hidden keywords that were rated 0
    When I click the rating emoji for "seo tools" with rating 0
    And I click the show hidden keywords toggle
    Then "seo tools" is visible in the keyword table

  Scenario: Hidden keywords render with strikethrough or greyed-out styling
    When I click the rating emoji for "seo tools" with rating 0
    And I click the show hidden keywords toggle
    Then "seo tools" is rendered with hidden styling

  Scenario: Pagination total count excludes hidden keywords
    Given I have 110 domain keywords cached for "example.com"
    And I have rated keyword number 1 with rating 0
    Then the keyword table shows 100 rows on the first page
    And the load more button shows 9 remaining

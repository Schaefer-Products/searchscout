Feature: Unrated Keywords Filter — Competitor Analysis
  As a small business owner using SearchScout
  I want to filter competitor analysis keyword tables to show only unrated keywords
  So I can efficiently work through rating all keywords without losing my place

  Background:
    Given I have valid API credentials seeded in IndexedDB
    And I have "example.com" set as my current domain
    And I have cached domain keywords for "example.com"
    And I have selected competitors seeded in IndexedDB
    And I have cached competitor analysis results for "example.com"
    And I navigate to the dashboard and start the competitor analysis

  # ---------------------------------------------------------------------------
  # Rule 1: Button label and count per view
  # ---------------------------------------------------------------------------

  Scenario: Button shows "Show unrated only (N)" with all keywords unrated in opportunities view
    Then the unrated filter button shows a count of 2
    And the unrated filter button label reads "Show unrated only"

  Scenario: Count reflects only truly unrated keywords when some are pre-rated in opportunities view
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    Then the unrated filter button shows a count of 1

  Scenario: Button label changes to "Showing unrated only (N)" while filter is active
    When I click the unrated filter button
    Then the unrated filter button label reads "Showing unrated only"

  Scenario: Unrated count reflects keywords in the current view (all keywords tab)
    When I navigate to the "All Keywords" tab in competitor analysis
    Then the unrated filter button shows a count of 4

  Scenario: Unrated count reflects keywords in the shared tab
    When I navigate to the "Shared" tab in competitor analysis
    Then the unrated filter button shows a count of 1

  Scenario: Unrated count reflects keywords in the unique tab
    When I navigate to the "Your Unique" tab in competitor analysis
    Then the unrated filter button shows a count of 1

  # ---------------------------------------------------------------------------
  # Rule 2: Button visibility per view mode
  # ---------------------------------------------------------------------------

  Scenario: Button is NOT visible in the blog-topics view
    When I navigate to the "Blog Topics" tab in competitor analysis
    Then the unrated filter button is not visible

  Scenario: Button IS visible in the opportunities view
    Then the unrated filter button is visible

  Scenario: Button IS visible in the all keywords view
    When I navigate to the "All Keywords" tab in competitor analysis
    Then the unrated filter button is visible

  Scenario: Button IS visible in the shared view
    When I navigate to the "Shared" tab in competitor analysis
    Then the unrated filter button is visible

  Scenario: Button IS visible in the unique-to-user view
    When I navigate to the "Your Unique" tab in competitor analysis
    Then the unrated filter button is visible

  # ---------------------------------------------------------------------------
  # Rule 3: Filtering behaviour — show only unrated
  # ---------------------------------------------------------------------------

  Scenario: Clicking the button filters the opportunities table to unrated keywords only
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    Then "backlink checker" is visible in the keyword table
    And "link building" is not visible in the keyword table
    And the unrated filter button shows active state

  Scenario: Clicking the button filters the all keywords table to unrated keywords only
    Given I have rated "link building" with rating 3 seeded in IndexedDB
    When I navigate to the "All Keywords" tab in competitor analysis
    And I click the unrated filter button
    Then "backlink checker" is visible in the keyword table
    And "link building" is not visible in the keyword table

  Scenario: Button carries the active modifier class when filter is on
    When I click the unrated filter button
    Then the unrated filter button shows active state

  Scenario: Button does not have the active modifier class when filter is off
    Then the unrated filter button shows inactive state

  # ---------------------------------------------------------------------------
  # Rule 4: Real-time count decrement while filter is active
  # ---------------------------------------------------------------------------

  Scenario: Rating a keyword while filter is active removes it from view and decrements count
    When I click the unrated filter button
    And I click the rating emoji for "link building" with rating 3
    Then the unrated filter button shows a count of 1
    And "link building" is not visible in the keyword table
    And "backlink checker" is visible in the keyword table

  Scenario: Unrated count on the button decrements for every keyword rated while filter is inactive
    When I click the rating emoji for "link building" with rating 1
    Then the unrated filter button shows a count of 1
    When I click the rating emoji for "backlink checker" with rating 2
    Then the unrated filter button shows a count of 0

  # ---------------------------------------------------------------------------
  # Rule 5: Deactivating the filter
  # ---------------------------------------------------------------------------

  Scenario: Clicking the active button deactivates the filter and shows all keywords
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    And I click the unrated filter button again
    Then "link building" is visible in the keyword table
    And "backlink checker" is visible in the keyword table
    And the unrated filter button shows inactive state

  Scenario: Button label reverts to "Show unrated only" after deactivation
    When I click the unrated filter button
    And I click the unrated filter button again
    Then the unrated filter button label reads "Show unrated only"

  # ---------------------------------------------------------------------------
  # Rule 6: Completion state when all keywords in current view are rated
  # ---------------------------------------------------------------------------

  Scenario: Completion state appears when filter is active and all keywords are already rated
    Given I have rated "link building" with rating 1 seeded in IndexedDB
    And I have rated "backlink checker" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    Then the unrated completion state is visible
    And the unrated filter button shows a count of 0

  Scenario: Completion state appears after rating the last unrated keyword while filter is active
    When I click the unrated filter button
    And I click the rating emoji for "link building" with rating 1
    And I click the rating emoji for "backlink checker" with rating 2
    Then the unrated completion state is visible

  Scenario: Completion state is not visible when filter is inactive even if all keywords are rated
    Given I have rated "link building" with rating 1 seeded in IndexedDB
    And I have rated "backlink checker" with rating 2 seeded in IndexedDB
    Then the unrated completion state is not visible

  # ---------------------------------------------------------------------------
  # Rule 7: Switching view mode deactivates the filter
  # ---------------------------------------------------------------------------

  Scenario: Switching from opportunities to all keywords resets the filter to inactive
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    And I navigate to the "All Keywords" tab in competitor analysis
    Then the unrated filter button shows inactive state

  Scenario: Switching from all keywords to shared resets the filter to inactive
    When I navigate to the "All Keywords" tab in competitor analysis
    And I click the unrated filter button
    And I navigate to the "Shared" tab in competitor analysis
    Then the unrated filter button shows inactive state

  Scenario: After filter resets on view switch, all keywords in new view are visible
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    And I navigate to the "All Keywords" tab in competitor analysis
    Then "link building" is visible in the keyword table
    And "backlink checker" is visible in the keyword table

  # ---------------------------------------------------------------------------
  # Rule 8: Filter persists through sorting within same view
  # ---------------------------------------------------------------------------

  Scenario: Filter remains active after clicking a sortable column header in opportunities view
    Given I have rated "link building" with rating 2 seeded in IndexedDB
    When I click the unrated filter button
    And I click the difficulty column header to sort
    Then the unrated filter button shows active state
    And "link building" is not visible in the keyword table
    And "backlink checker" is visible in the keyword table

  Scenario: Filter remains active after clicking a second column header
    When I click the unrated filter button
    And I click the volume column header to sort
    And I click the difficulty column header to sort
    Then the unrated filter button shows active state

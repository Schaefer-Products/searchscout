Feature: Opportunity Score Explanation Tooltip
  As a user viewing competitor analysis results
  I want to understand how the Opportunity Score is calculated
  So that I can make informed decisions about which keywords to target

  Background:
    Given I have valid credentials stored in IndexedDB
    And I have "example.com" set as my current domain
    And domain keyword cache is pre-seeded for "example.com"
    And competitor analysis cache is pre-seeded with opportunities for "example.com"
    And I have selected competitors seeded in IndexedDB

  # ---------------------------------------------------------------------------
  # Scenario 1: Info icon visibility after analysis loads
  # ---------------------------------------------------------------------------

  Scenario: Info icon button is visible in the Opportunity Score column header when analysis is complete
    Given I navigate to the dashboard and start competitor analysis
    When the analysis results are displayed on the Opportunities tab
    Then the info icon button is visible in the Opportunity Score column header

  # ---------------------------------------------------------------------------
  # Scenario 2: Info icon not visible before analysis
  # ---------------------------------------------------------------------------

  Scenario: Info icon is not visible before competitor analysis has started
    Given I navigate to the dashboard
    When the domain keyword results are displayed but no competitor analysis has been run
    Then the info icon button is not present on the page

  # ---------------------------------------------------------------------------
  # Scenario 3: Clicking info icon opens the tooltip
  # ---------------------------------------------------------------------------

  Scenario: Clicking the info icon opens the tooltip
    Given I navigate to the dashboard and start competitor analysis
    And the analysis results are displayed on the Opportunities tab
    When I click the info icon button next to "Opportunity Score"
    Then the tooltip becomes visible

  # ---------------------------------------------------------------------------
  # Scenario 4: Tooltip content — title and key terms
  # ---------------------------------------------------------------------------

  Scenario: Tooltip contains the score explanation with expected content
    Given I navigate to the dashboard and start competitor analysis
    And I click the info icon button to open the tooltip
    Then the tooltip title reads "Opportunity Score"
    And the tooltip body mentions "Search Volume" or "search volume"
    And the tooltip body mentions "Difficulty" or "difficulty"
    And the tooltip body mentions "Competitor" or "competitor"

  # ---------------------------------------------------------------------------
  # Scenario 5: Clicking the info icon again closes the tooltip
  # ---------------------------------------------------------------------------

  Scenario: Clicking the info icon a second time closes the tooltip
    Given I navigate to the dashboard and start competitor analysis
    And I click the info icon button to open the tooltip
    When I click the info icon button again
    Then the tooltip is no longer visible

  # ---------------------------------------------------------------------------
  # Scenario 6: Pressing Escape closes the tooltip
  # ---------------------------------------------------------------------------

  Scenario: Pressing the Escape key closes the tooltip
    Given I navigate to the dashboard and start competitor analysis
    And I click the info icon button to open the tooltip
    When I press the Escape key
    Then the tooltip is no longer visible

  # ---------------------------------------------------------------------------
  # Scenario 7: Clicking outside closes the tooltip
  # ---------------------------------------------------------------------------

  Scenario: Clicking outside the tooltip closes it
    Given I navigate to the dashboard and start competitor analysis
    And I click the info icon button to open the tooltip
    When I click somewhere outside the tooltip
    Then the tooltip is no longer visible

  # ---------------------------------------------------------------------------
  # Scenario 8: Info icon not visible on non-opportunities tabs
  # ---------------------------------------------------------------------------

  Scenario: Info icon is not visible in the All Keywords tab where Opportunity Score column is absent
    Given I navigate to the dashboard and start competitor analysis
    When I switch to the "All Keywords" tab
    Then the info icon button is not visible

  Scenario: Info icon is not visible in the Shared tab
    Given I navigate to the dashboard and start competitor analysis
    When I switch to the "Shared" tab
    Then the info icon button is not visible

  Scenario: Info icon is not visible in the Your Unique tab
    Given I navigate to the dashboard and start competitor analysis
    When I switch to the "Your Unique" tab
    Then the info icon button is not visible

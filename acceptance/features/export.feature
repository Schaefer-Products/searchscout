Feature: Export Analysis Results to CSV
  As a small business owner
  I want to export my keyword analysis data to a CSV file
  So that I can use the results in spreadsheets and content planning tools

  Background:
    Given I am authenticated with valid API credentials
    And I have completed a competitor analysis for "example.com"
    And my selected competitors are "competitor1.com" and "competitor2.com"

  Scenario: Exporting keyword opportunities
    Given I am on the "Opportunities" tab
    When I click "Export Opportunities"
    Then a CSV file named "opportunities_example-com_<today>.csv" is downloaded
    And the file begins with a metadata header containing:
      | Field               | Value                                  |
      | Report title        | SearchScout - Keyword Opportunities Report |
      | Domain              | example.com                            |
      | Competitors         | competitor1.com, competitor2.com       |
      | Generated timestamp | today's date and time                  |
      | Total Opportunities | the count of opportunity keywords      |
    And the data rows contain columns: Keyword, Search Volume, Difficulty, Opportunity Score, Competitor Count, Competitors, CPC (USD)

  Scenario: Exporting blog topic recommendations
    Given I am on the "Blog Topics" tab
    When I click "Export Blog Topics"
    Then a CSV file named "blog-topics_example-com_<today>.csv" is downloaded
    And the file begins with a metadata header for the blog topics report
    And the data rows contain columns: Rank, Title, Keyword, Category, Recommendation Score, Search Volume, Difficulty, Competitor Count

  Scenario: Exporting all keywords
    Given I am on the "All Keywords" tab
    When I click "Export All Keywords"
    Then a CSV file named "all-keywords_example-com_<today>.csv" is downloaded
    And the data rows contain a "Type" column with values "Opportunity", "Shared", or "Your Unique"
    And every keyword from the analysis is present in the file

  Scenario: Export button label reflects the active tab
    Given the competitor analysis is complete
    When I am on the "Opportunities" tab
    Then the export button is labelled "Export Opportunities"
    When I switch to the "Blog Topics" tab
    Then the export button is labelled "Export Blog Topics"
    When I switch to the "Shared" tab
    Then the export button is labelled "Export All Keywords"

  Scenario: Keywords with special characters are exported correctly
    Given some opportunity keywords contain commas or quotation marks
    When I export the opportunities
    Then the special characters in the CSV are properly escaped with double-quote wrapping
    And the exported file can be opened in a spreadsheet application without data corruption

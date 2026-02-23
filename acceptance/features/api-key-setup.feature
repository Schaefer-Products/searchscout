Feature: API Key Setup
  As a small business owner
  I want to set up my DataForSEO API credentials
  So that I can access keyword data for my SEO analysis

  Background:
    Given I am on the API key setup page

  Scenario: Successfully saving valid credentials
    When I enter a valid DataForSEO login email
    And I enter a valid DataForSEO password
    And I click "Validate & Save"
    Then my credentials are validated against the DataForSEO API
    And my credentials are encrypted and stored in the browser
    And I am redirected to the dashboard

  Scenario: Attempting to save invalid credentials
    When I enter an invalid DataForSEO login email
    And I enter an incorrect password
    And I click "Validate & Save"
    Then I see an error message indicating the credentials are invalid
    And I remain on the API key setup page

  Scenario: Bypassing setup when credentials are already saved
    Given I have previously saved valid API credentials
    When I navigate to the application
    Then I am taken directly to the dashboard
    And the API key setup page is not shown

  Scenario: Returning to setup to update credentials
    Given I am authenticated with valid API credentials
    When I navigate to the API key setup page directly
    Then I see the setup form pre-filled with my existing login email
    When I enter a new password and click "Validate & Save"
    Then my credentials are updated and I am redirected to the dashboard

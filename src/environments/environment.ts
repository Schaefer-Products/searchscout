export const environment = {
  production: false,
  dataforSeoApiUrl: 'https://api.dataforseo.com/v3',
  dataforSeoSandboxUrl: 'https://sandbox.dataforseo.com/v3',
  cacheExpirationDays: 90,
  maxCacheSize: 5 * 1024 * 1024, // 5MB
  excludedCompetitorDomains: [
    // Major platforms
    'wikipedia.org',
    'youtube.com',
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'reddit.com',
    'pinterest.com',
    'quora.com',
    'medium.com',

    // E-commerce giants
    'amazon.com',
    'ebay.com',
    'walmart.com',
    'target.com',
    'etsy.com',

    // Review/listing sites
    'yelp.com',
    'tripadvisor.com',
    'glassdoor.com',
    'indeed.com',

    // News/media
    'forbes.com',
    'businessinsider.com',
    'huffpost.com',
    'techcrunch.com',

    // Directories
    'yellowpages.com',
    'whitepages.com',
    'bbb.org'
  ]
};
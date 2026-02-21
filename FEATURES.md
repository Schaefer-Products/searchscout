# SearchScout - Feature Requirements Document

## Project Overview

**Product Name:** SearchScout
**Description:** SEO keyword opportunity finder that helps small business owners discover blog topics to attract customers through search engines
**Target Users:** Small business owners without SEO expertise
**Tech Stack:** Angular 21, TypeScript, SCSS, Docker (dev container)
**Deployment:** Netlify (auto-deploy from GitHub main branch)
**Live URL:** https://searchscout.netlify.app/

---

## Core Value Proposition

SearchScout analyzes competitor keywords using the DataForSEO API and identifies keyword gaps (keywords competitors rank for but you don't). It then generates ready-to-use blog post titles from these opportunities, giving users actionable content ideas based on real SEO data.

---

## Architecture & Technical Decisions

### Tech Stack
- **Framework:** Angular 21 (standalone components)
- **Language:** TypeScript
- **Styling:** SCSS
- **API:** DataForSEO v3 REST API
- **Storage:** Browser localStorage (encrypted credentials, plain JSON for data)
- **Development:** Docker dev container (VSCode Remote Containers)
- **Deployment:** Netlify (CI/CD via GitHub)

### Key Patterns
- **Dependency Injection:** Use `inject()` function instead of constructor injection
- **Logging:** Always use `Logger.debug()`, `Logger.error()` instead of `console.*`
- **Change Detection:** Inject `ChangeDetectorRef` and call `detectChanges()` after async operations
- **Standalone Components:** All components are standalone (no NgModules)
- **Routing:** Use `app.routes.ts` with functional route guards
- **HTTP:** Use `provideHttpClient()` in `main.ts`

### File Structure
```
src/app/
├── components/           # UI components
│   ├── api-key-setup/
│   ├── dashboard/
│   ├── competitor-selection/
│   └── competitor-analysis/
├── services/            # Business logic & API calls
│   ├── dataforseo.service.ts
│   ├── storage.service.ts
│   ├── cache.service.ts
│   ├── competitor-analysis.service.ts
│   ├── blog-topic-generator.service.ts
│   └── export.service.ts
├── models/              # TypeScript interfaces
│   ├── keyword.model.ts
│   ├── competitor.model.ts
│   ├── aggregated-keyword.model.ts
│   └── blog-topic.model.ts
├── guards/              # Route protection
│   └── api-key.guard.ts
└── utils/               # Utilities
    └── logger.ts
```

### Environment Configuration
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  dataforSeoApiUrl: 'https://api.dataforseo.com/v3',
  dataforSeoSandboxUrl: 'https://sandbox.dataforseo.com/v3',
  cacheExpirationDays: 90,
  maxCacheSize: 5 * 1024 * 1024, // 5MB
  excludedCompetitorDomains: [
    'wikipedia.org', 'youtube.com', 'amazon.com',
    'reddit.com', 'pinterest.com', 'facebook.com',
    // ... (full list in environment file)
  ]
};
```

---

## Completed Features (MVP)

### Feature 1: API Key Management ✅

**Purpose:** Securely store DataForSEO API credentials
**Status:** Complete

**Implementation:**
- Onboarding flow with API key validation
- AES encryption via crypto-js
- Stored in localStorage as encrypted JSON
- Validation using free `/serp/google/locations` endpoint
- Route guard protects authenticated routes

**Key Files:**
- `components/api-key-setup/`
- `services/encryption.service.ts`
- `services/storage.service.ts`
- `services/dataforseo.service.ts`
- `guards/api-key.guard.ts`

**User Flow:**
1. User enters DataForSEO login & password
2. App validates via free endpoint
3. Credentials encrypted and stored in localStorage
4. Redirects to dashboard

---

### Feature 2: User Domain Setup & Current Keyword Analysis ✅

**Purpose:** Analyze user's domain to see current keyword rankings
**Status:** Complete

**Implementation:**
- Domain input with validation
- Fetch up to 1000 keywords via DataForSEO `/ranked_keywords/live`
- Display with pagination (100 keywords at a time with "Load More")
- Cache results for 90 days
- Show stats: Total keywords, search volume, avg position, top 3 rankings
- Sortable table with visual indicators

**Key Files:**
- `components/dashboard/`
- `models/keyword.model.ts` (DomainKeywordRanking interface)
- `services/dataforseo.service.ts` (fetchDomainKeywords method)
- `services/cache.service.ts`

**DataForSEO API Call:**
```typescript
POST /dataforseo_labs/google/ranked_keywords/live
Body: [{
  target: "example.com",
  location_name: "United States",
  language_name: "English",
  limit: 1000
}]
```

**User Flow:**
1. User enters domain
2. App fetches keywords from API (or cache)
3. Displays keywords in sortable table
4. Shows aggregate stats
5. Domain & keywords persist in localStorage

---

### Feature 3: Automatic Competitor Discovery ✅

**Purpose:** Find competitor domains based on keyword overlap
**Status:** Complete

**Implementation:**
- Fetch up to 1000 competitors via DataForSEO `/competitors_domain/live`
- Filter: Must have 10+ overlapping keywords
- Sort by keyword overlap (descending)
- Exclude top domains (Wikipedia, Amazon, etc.) via `exclude_top_domains: true`
- Display with pagination (20 at a time with "Load More")
- Manual competitor entry option
- Pre-select previously selected competitors
- Selected competitors persist per domain in localStorage

**Key Files:**
- `components/competitor-selection/`
- `models/competitor.model.ts`
- `services/dataforseo.service.ts` (discoverCompetitors method)
- `services/storage.service.ts` (saveSelectedCompetitors, getSelectedCompetitors)

**DataForSEO API Call:**
```typescript
POST /dataforseo_labs/google/competitors_domain/live
Body: [{
  target: "example.com",
  location_name: "United States",
  language_name: "English",
  limit: 1000,
  filters: [['intersections', '>=', 10]],
  order_by: ['intersections,desc'],
  exclude_top_domains: true,
  exclude_domains: environment.excludedCompetitorDomains
}]
```

**User Flow:**
1. User clicks "Find Competitors" after analyzing domain
2. App discovers competitors via API
3. Top 5 auto-selected
4. User can add/remove competitors manually
5. Clicks "Analyze X Competitors"
6. Selection saved to localStorage (keyed by domain)

---

### Feature 4: Competitor Keyword Analysis & Opportunity Detection ✅

**Purpose:** Identify keyword gaps (keywords competitors rank for but you don't)
**Status:** Complete

**Implementation:**
- Fetch keywords for each selected competitor (parallel using forkJoin)
- Aggregate all keywords from user + competitors
- Identify opportunities (user doesn't rank, but competitors do)
- Calculate opportunity score using weighted formula
- Display 4 view modes: Opportunities, All, Shared, Your Unique
- Pagination (50 keywords at a time)
- Full analysis cached for 90 days

**Opportunity Score Formula:**
```
(0.4 × Normalized Volume) + (0.4 × Inverted Difficulty) + (0.2 × Competitor Gap)
```

**Key Files:**
- `components/competitor-analysis/`
- `models/aggregated-keyword.model.ts`
- `services/competitor-analysis.service.ts`

**User Flow:**
1. User selects competitors and clicks "Start Analysis"
2. App fetches keywords for all competitors in parallel
3. Aggregates and scores opportunities
4. Displays results with 4 view modes
5. User can switch views, sort, and load more

---

### Feature 5: Blog Topic Recommendations ✅

**Purpose:** Generate actionable blog post titles from keyword opportunities
**Status:** Complete

**Implementation:**
- 30+ title templates across 7 categories
- Smart template selection based on keyword structure
- Title case conversion (capitalize each word)
- Recommendation scoring (enhanced opportunity score)
- Display in card grid (20 at a time with "Load More")
- Color-coded by category and score

**Template Categories:**
- How-to (purple)
- List (orange)
- Best Of (green)
- Guide (light purple)
- Tips (teal)
- Comparison (red)
- Ultimate (yellow)

**Key Files:**
- `models/blog-topic.model.ts`
- `services/blog-topic-generator.service.ts`
- Updated `components/competitor-analysis/` (new view mode)

**Template Selection Logic:**
- "define X" → Explanation templates
- "how to X" → Guide templates (avoid duplicate "how to")
- Action verbs → How-to templates
- Proper nouns → Guide/Best-of templates
- Job titles → Guide templates

**User Flow:**
1. After competitor analysis completes, blog topics auto-generate
2. User clicks "Blog Topics" tab
3. Sees cards with titles, scores, metadata
4. Can load more topics (20 at a time)

---

### Feature 6: Export & Download ✅

**Purpose:** Export analysis results to CSV for use in spreadsheets/planning tools
**Status:** Complete

**Implementation:**
- Export current view (Opportunities, Blog Topics, or All Keywords)
- Professional CSV format with metadata header
- Proper CSV escaping (commas, quotes, newlines)
- Client-side download via Blob API
- Filename includes domain and date

**Export Types:**
1. **Opportunities CSV:** Keyword, Volume, Difficulty, Score, Competitors
2. **Blog Topics CSV:** Rank, Title, Keyword, Category, Score, Metrics
3. **All Keywords CSV:** All categories combined (Opportunities, Shared, Unique)

**Key Files:**
- `services/export.service.ts`
- Updated `components/competitor-analysis/` (export buttons)

**CSV Format:**
```csv
SearchScout - Keyword Opportunities Report
Domain: example.com
Competitors: competitor1.com, competitor2.com
Generated: 2/21/2025, 3:45:00 PM
Total Opportunities: 47

Keyword,Search Volume,Difficulty,Opportunity Score,Competitor Count,Competitors,CPC (USD)
"best seo tools",12000,45,87,3,"comp1.com (#2); comp2.com (#5)",3.50
```

**User Flow:**
1. User clicks "Export Opportunities" (or other export button)
2. CSV file downloads immediately
3. Filename: `opportunities_example-com_2025-02-21.csv`

---

## Data Models

### Keyword Models
```typescript
// Base keyword metrics (not domain-specific)
interface KeywordMetrics {
  keyword: string;
  searchVolume: number;
  difficulty: number;  // 0-100
  cpc?: number;
}

// User's or competitor's ranking for a keyword
interface DomainKeywordRanking extends KeywordMetrics {
  position: number;  // Google ranking position (1 = top)
  etv?: number;      // Estimated traffic value
}

// Aggregated across user + competitors
interface AggregatedKeyword extends KeywordMetrics {
  userRanking?: { position: number; etv?: number } | null;
  competitorRankings: Array<{ domain: string; position: number; etv?: number }>;
  competitorCount: number;
  isOpportunity: boolean;  // True if user doesn't rank but competitors do
  opportunityScore?: number;  // 0-100
}
```

### Competitor Model
```typescript
interface Competitor {
  domain: string;
  keywordOverlap: number;      // Number of shared keywords with user
  totalKeywords: number;        // Total keywords competitor ranks for
  etv?: number;
  averagePosition?: number;
  isManual?: boolean;           // True if manually added by user
}
```

### Blog Topic Model
```typescript
interface BlogTopic {
  title: string;                    // Generated blog post title
  keyword: string;                  // Source keyword
  templateCategory: string;         // Template type used
  searchVolume: number;
  difficulty: number;
  opportunityScore: number;
  competitorCount: number;
  recommendationScore: number;      // Enhanced score for ranking topics
}
```

---

## API Integration

### DataForSEO Endpoints Used

**1. Credential Validation (Free)**
```
GET /serp/google/locations
Cost: $0.00
```

**2. Domain Keywords**
```
POST /dataforseo_labs/google/ranked_keywords/live
Cost: ~$0.01 per 1000 keywords
Max: 1000 keywords per call
```

**3. Competitor Discovery**
```
POST /dataforseo_labs/google/competitors_domain/live
Cost: ~$0.01 per call
Max: 1000 competitors per call
```

### Cost Estimate
- User domain analysis: $0.01
- 5 competitors × $0.01 each: $0.05
- **Total per full analysis: ~$0.06**
- **With 90-day caching: ~$0.02/month average**

---

## Caching Strategy

**What's Cached:**
- User domain keywords (90 days)
- Competitor discovery results (90 days)
- Full competitor analysis results (90 days)

**Cache Keys:**
- `searchscout_domain_keywords_{domain}`
- `searchscout_competitors_{domain}`
- `searchscout_competitor_analysis_{domain}_{competitors}`

**Cache Service:**
- Configurable expiration (0, 7, 14, 30, 60, 90 days)
- Auto-cleanup when quota exceeded
- Metadata tracking (timestamp, age)
- Manual refresh capability

---

## User Data Persistence

**localStorage Keys:**
- `searchscout_api_credentials` - Encrypted API credentials
- `searchscout_encryption_key` - AES encryption key
- `searchscout_current_domain` - Last analyzed domain
- `searchscout_selected_competitors_{domain}` - Selected competitors per domain
- `searchscout_cache_config` - Cache settings
- `searchscout_domain_keywords_{domain}` - Cached keyword data
- `searchscout_competitors_{domain}` - Cached competitor data
- `searchscout_competitor_analysis_{domain}_{competitors}` - Cached analysis

**Per-Domain State:**
- Each domain remembers its own competitor selection
- Switching domains loads appropriate competitors from storage
- Fresh domain starts with empty competitor selection

---

## UI/UX Guidelines

### Design System

**Colors:**
- Primary: #667eea (purple gradient)
- Success: #48bb78 (green)
- Warning: #ed8936 (orange)
- Danger: #f56565 (red)
- Neutral: #718096 (gray)

**Components:**
- Cards with rounded corners (12px border-radius)
- Hover effects (translateY, box-shadow)
- Gradient backgrounds on primary actions
- Color-coded badges for scores and categories

**Responsive Breakpoints:**
- Desktop: >768px
- Mobile: ≤768px
- Tables scroll horizontally on mobile
- Cards stack vertically on mobile
- Tabs wrap to multiple rows on mobile

### Loading States
- Show spinner with descriptive text
- Disable buttons during operations
- Preserve user input during loading

### Error Handling
- Display user-friendly error messages
- Provide actionable next steps
- Log technical details with Logger.error()

---

## Development Workflow

### Local Development
```bash
# Dev container is already running
ng serve --host 0.0.0.0

# Generate components
ng g c components/my-component --standalone

# Generate services
ng g s services/my-service

# Install packages
npm install package-name
```

### Git Workflow
```bash
# Commit with conventional commits
git add .
git commit -m "feat: add new feature"
git push origin main
```

### Deployment
- Push to GitHub main branch
- Netlify auto-builds and deploys
- Build command: `npm run build`
- Publish directory: `dist/searchscout/browser`
- Live at: https://searchscout.netlify.app/

---

## Testing Guidelines

### Manual Testing Checklist Pattern
Each feature includes a testing checklist covering:
- Basic flow (happy path)
- Edge cases (empty states, errors)
- Data validation
- Visual indicators
- Mobile responsiveness
- Cache behavior
- Persistence across sessions

### Common Test Scenarios
- Invalid/garbage input → Shows appropriate error
- Network failure → Shows error, doesn't break app
- No data found → Shows empty state with helpful message
- Large datasets (1000+ items) → Pagination works correctly
- Cache hit vs miss → Shows appropriate indicator
- Refresh page → State persists correctly

---

## Known Patterns & Conventions

### Component Structure
```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-component.component.html',
  styleUrls: ['./my-component.component.scss']
})
export class MyComponent implements OnInit {
  private myService = inject(MyService);
  private cdr = inject(ChangeDetectorRef);

  // Properties
  isLoading = false;
  errorMessage = '';

  // Lifecycle
  ngOnInit(): void {
    // Initialize
  }

  // Methods
  doSomething(): void {
    Logger.debug('Doing something');
    // ... async operation ...
    this.cdr.detectChanges();
  }
}
```

### Service Pattern
```typescript
@Injectable({
  providedIn: 'root'
})
export class MyService {
  private http = inject(HttpClient);
  private cache = inject(CacheService);

  fetchData(id: string, useCache = true): Observable<Data> {
    const cacheKey = `my_data_${id}`;

    if (useCache) {
      const cached = this.cache.get<Data>(cacheKey);
      if (cached) {
        Logger.debug('Using cached data');
        return of(cached);
      }
    }

    return this.http.post<ApiResponse>(url, body).pipe(
      map(response => this.parseResponse(response)),
      tap(data => this.cache.save(cacheKey, data)),
      catchError(error => {
        Logger.error('Error fetching data:', error);
        return throwError(() => ({ error: 'User-friendly message' }));
      })
    );
  }
}
```

### Logging Pattern
```typescript
// Always use Logger instead of console
import { Logger } from '../utils/logger';

Logger.debug('Informational message', data);
Logger.error('Error occurred:', error);
Logger.warn('Warning message');
```

---

## Future Enhancements (Not in MVP)

### Phase 2 Features
- User accounts and authentication
- Team collaboration (share analyses)
- Historical tracking (see opportunity trends over time)
- Content calendar integration
- Automated content brief generation
- AI-powered content outline creation

### Technical Improvements
- Unit tests (Jasmine/Karma)
- E2E tests (Cypress)
- Error tracking (Sentry)
- Analytics (Google Analytics)
- A/B testing framework
- Performance monitoring

---

## Support & Resources

### Documentation Links
- DataForSEO API Docs: https://docs.dataforseo.com/v3/
- Angular Docs: https://angular.dev/
- Netlify Docs: https://docs.netlify.com/

### Project Links
- Live App: https://searchscout.netlify.app/
- GitHub Repo: [Your repo URL]
- Netlify Dashboard: [Your Netlify dashboard]

---

**Last Updated:** February 21, 2025
**Version:** 1.0.0 (MVP Complete)
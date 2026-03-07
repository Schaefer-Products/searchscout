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
- **Storage:** Browser IndexedDB (`searchscout` DB, `keyvalue` + `cache` object stores; `idb` library)
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
│   ├── indexed-db.service.ts
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
- Credentials stored as plain JSON in IndexedDB (`keyvalue` store)
- Validation using free `/serp/google/locations` endpoint
- Route guard protects authenticated routes

**Key Files:**
- `components/api-key-setup/`
- `services/storage.service.ts`
- `services/indexed-db.service.ts`
- `services/dataforseo.service.ts`
- `guards/api-key.guard.ts`

**User Flow:**
1. User enters DataForSEO login & password
2. App validates via free endpoint
3. Credentials stored in IndexedDB
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
5. Domain & keywords persist in IndexedDB

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
- Selected competitors persist per domain in IndexedDB

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
6. Selection saved to IndexedDB (keyed by domain)

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

### Feature 7: Keyword Relevance Rating ✅

**Purpose:** Let users mark keywords as relevant or irrelevant to personalise blog topic recommendations and hide noise from their workflow
**Status:** Complete

**Implementation:**
- Emoji-based 0–4 rating scale applied to every keyword row across all tables
- Rating 0 (🚫 Never relevant) hides the keyword from the default table view
- Ratings 1–4 (😐🙂😊🤩) signal relevance level for future scoring integration
- Hidden keywords excluded from blog topic generation; regenerating re-filters the list
- "Show hidden keywords" toggle reveals hidden rows with greyed-out styling
- Undo toast appears after hiding a keyword with a 5-second auto-dismiss window
- Blog Topics stale banner prompts regeneration whenever any rating changes (including hide)
- Ratings persisted to IndexedDB per domain with 300ms debounced writes
- First-visit hint row with one-time dismissal (persisted to IDB)
- Rating column included in all CSV exports

**Rating Scale:**
| Value | Emoji | Label | Behaviour |
|---|---|---|---|
| 0 | 🚫 | Never relevant | Hides keyword; excludes from blog topics |
| 1 | 😐 | Unlikely | Visible; low priority for future scoring |
| 2 | 🙂 | Possibly relevant | Visible |
| 3 | 😊 | Relevant | Visible; higher priority |
| 4 | 🤩 | Write about this today | Visible; top priority |

**Key Files:**
- `models/keyword-rating.model.ts` — `RatingValue`, `RATING_META`, `KeywordRatingMap`, `RATING_SCORE_ALGORITHM` token
- `services/keyword-rating.service.ts` — ratings state, IDB persistence, undo, stale signalling
- `components/keyword-rating/` — inline emoji button group
- `components/undo-toast/` — fixed-position undo notification
- `components/blog-topics-stale-banner/` — amber banner prompting regeneration
- Updated `components/dashboard/` — rating column, hidden filter, hint row
- Updated `components/competitor-analysis/` — rating column on all tabs, stale banner, regenerate
- Updated `services/export.service.ts` — Rating column in all CSVs

**IndexedDB keys added:**
- `keyvalue` / `keyword_ratings_<domain>` — `Record<string, 0|1|2|3|4>`
- `keyvalue` / `ratingHintDismissed` — `true` when hint has been dismissed

**Architecture notes:**
- `KeywordRatingService` exposes four read-only Observables (`ratings$`, `blogTopicsStale$`, `showRatingHint$`, `pendingUndo$`) backed by private BehaviorSubjects
- Debounced IDB writes (300 ms) wired in constructor; subscription torn down via `OnDestroy`
- Blog topic generation filters out hidden keywords at display/regeneration time, not inside `CompetitorAnalysisService`, so cached analysis results remain clean
- `RATING_SCORE_ALGORITHM` InjectionToken (optional) is the extension point for Track B — weighted scoring based on rating — not yet implemented

**User Flow:**
1. User analyses domain keywords — Rating column appears as leftmost column
2. User clicks an emoji to rate a keyword; rating saved to IDB after 300 ms
3. Rating 0: keyword disappears; undo toast appears for 5 s
4. Rating 1–4: Blog Topics stale banner appears if topics have been generated
5. User navigates to Blog Topics tab; clicks "Regenerate topics"
6. Hidden keywords are excluded; stale banner dismisses

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
  position: number;      // Google ranking position (1 = top)
  etv?: number;          // Estimated traffic value
  relevanceRating?: RatingValue;  // 0–4, set by user
}

// Aggregated across user + competitors
interface AggregatedKeyword extends KeywordMetrics {
  userRanking?: { position: number; etv?: number } | null;
  competitorRankings: Array<{ domain: string; position: number; etv?: number }>;
  competitorCount: number;
  isOpportunity: boolean;  // True if user doesn't rank but competitors do
  opportunityScore?: number;  // 0-100
  relevanceRating?: RatingValue;  // 0–4, set by user
}
```

### Rating Model
```typescript
type RatingValue = 0 | 1 | 2 | 3 | 4;

type KeywordRatingMap = Record<string, RatingValue>;  // keyed by keyword string

interface RatingScoreAlgorithm {
  multiplierForRating(rating: RatingValue): number;
  applyToScore(rawScore: number, rating: RatingValue): number;
}

// InjectionToken — provide a RatingScoreAlgorithm to weight opportunity
// scores by rating. Optional; passthrough (no adjustment) when absent.
const RATING_SCORE_ALGORITHM = new InjectionToken<RatingScoreAlgorithm>('RatingScoreAlgorithm');
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
  relevanceRating?: RatingValue;    // Inherited from source keyword rating
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
- `domain_keywords_{domain}`
- `competitors_{domain}`
- `competitor_analysis_{domain}_{competitors}`

**Cache Service:**
- Two-tier architecture: in-memory Map (sync reads) + IndexedDB `cache` store (async persistence)
- `APP_INITIALIZER` pre-loads all non-expired entries into memory before first render
- Configurable expiration (0, 7, 14, 30, 60, 90 days)
- Expired entries evicted from IDB on startup
- Metadata tracking (timestamp, age)
- Manual refresh capability

---

## User Data Persistence

**IndexedDB Database:** `searchscout` (v1)

**`keyvalue` object store:**
- `credentials` - API login & password
- `currentDomain` - Last analyzed domain
- `competitors_{domain}` - Selected competitors per domain
- `cache_config` - Cache expiration settings

**`cache` object store:**
- `domain_keywords_{domain}` - Cached keyword data
- `competitors_{domain}` - Cached competitor discovery results
- `competitor_analysis_{domain}_{competitors}` - Cached full analysis

**Startup behaviour:**
- `APP_INITIALIZER` runs `StorageService.initialize()` and `CacheService.initialize()` in parallel before the root component renders
- Both services read all data from IDB into memory; subsequent reads are fully synchronous
- On first run, any legacy localStorage keys are migrated into IDB and then removed

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

### Feature 8: Unrated Keywords Filter (In Development)

**Purpose:** Help users focus on keywords they haven't yet rated by filtering the keywords table to show only unrated keywords
**Status:** In Development

**Implementation:**
- Add toggle button to keywords table toolbar labeled "Show Unrated Only" (or similar)
- Display count of unrated keywords on the button (e.g., "Show Unrated (27)")
- When active, filter displays only keywords where `getRating() === undefined`
- Exclude all rated keywords (ratings 0–4) from the filtered view
- Filter is independent of the existing "Show hidden keywords" toggle
- Both filters can be combined (e.g., show unrated AND hidden keywords)
- Filter state resets when switching to a different domain
- Filter persists while analyzing the same domain (survives sorting, load-more, and rating changes)

**Key Files:**
- `components/dashboard/` — Add filter toggle button and unrated count calculation
- `services/keyword-rating.service.ts` — Existing `getRating()` method returns undefined for unrated keywords

**User Flow:**
1. User analyzes domain; keywords table displays all non-hidden keywords
2. User clicks "Show Unrated (27)" to filter to only unrated keywords
3. Table updates to show only keywords where `getRating() === undefined`
4. User rates keywords; if a keyword is rated, it disappears from the unrated filter view
5. User can toggle "Show Unrated" back off to see all keywords again
6. User can combine "Show Unrated" with "Show Hidden" toggle to see hidden + unrated keywords
7. When user switches to a different domain, both filter toggles reset

**Acceptance Criteria:**
1. Unrated keywords filter toggle button appears in the keywords table toolbar
2. Button displays count of unrated keywords (e.g., "Show Unrated (27)")
3. When inactive, button appears in default/grey state; when active, button is highlighted (e.g., blue or accent color)
4. Clicking the button toggles the filter on/off
5. When filter is active, only keywords with `getRating() === undefined` are displayed
6. All rated keywords (ratings 0–4) are excluded from the filtered view, including hidden keywords (rating 0)
7. Unrated filter is independent of "Show Hidden" toggle; both can be used together
8. Unrated count updates in real-time when user rates keywords on the same domain
9. If all keywords are rated, button displays "Show Unrated (0)" and clicking it shows empty state
10. Filter state resets when user switches to a different domain
11. Filter persists across sorting, pagination, and other table operations
12. Filter works correctly with pagination (page size 100); unrated count reflects all unrated keywords, not just displayed page

**Out of Scope:**
- Persisting filter state across browser sessions (stateless toggle within current session)
- Adding unrated filter to CompetitorAnalysisComponent tabs (feature applies only to DashboardComponent keyword table)
- Changing the unrated count dynamically via URL parameters or external state
- Combining unrated filter with other future filters (e.g., difficulty range) — each filter independent

---

### Feature 9: Unrated Keywords Filter (Competitor Analysis) ✅

**Purpose:** Help users focus on keywords they haven't yet rated within the competitor analysis results, enabling efficient workflow for rating competitor keywords
**Status:** Backlog

**Implementation:**
- Add toggle button to keywords table toolbar in CompetitorAnalysisComponent labeled "Show Unrated Only" (or similar)
- Display count of unrated keywords on the button (e.g., "Show Unrated (53)")
- When active, filter displays only keywords where `getRating() === undefined`
- Exclude all rated keywords (ratings 0–4) from the filtered view
- Filter is independent of the existing "Show hidden keywords" toggle (Feature 7)
- Both filters can be combined (e.g., show unrated AND hidden keywords)
- Filter applies to all keyword table view modes: 'opportunities', 'all', 'shared', 'unique'
- Filter does NOT apply to 'blog-topics' view (which displays generated blog titles, not keywords)
- Filter state resets when switching to a different domain
- Filter persists while analyzing the same domain (survives sorting, load-more, and rating changes)
- Unrated count reflects full keyword array across all pages, not just paginated slice

**Key Files:**
- `components/competitor-analysis/` — Add filter toggle button, unrated count calculation, filter logic
- `services/keyword-rating.service.ts` — Existing `getRating()` method returns undefined for unrated keywords

**User Flow:**
1. User analyzes competitors; keywords table displays all keywords (non-hidden by default)
2. User clicks "Show Unrated (53)" to filter to only unrated keywords
3. Table updates to show only keywords where `getRating() === undefined`
4. User rates keywords; if a keyword is rated, it disappears from the unrated filter view
5. User can toggle "Show Unrated" back off to see all keywords again
6. User can combine "Show Unrated" with "Show Hidden" toggle to see hidden + unrated keywords
7. When user switches to a different domain, both filter toggles reset

**Acceptance Criteria:**
1. Unrated keywords filter toggle button appears in the keywords table toolbar (above the table) in CompetitorAnalysisComponent
2. Button displays count of unrated keywords (e.g., "Show Unrated (53)")
3. When inactive, button appears in default/grey state; when active, button is highlighted (e.g., blue or accent color)
4. Clicking the button toggles the filter on/off
5. When filter is active, only keywords with `getRating() === undefined` are displayed
6. All rated keywords (ratings 0–4) are excluded from the filtered view, including hidden keywords (rating 0)
7. Unrated filter is independent of "Show Hidden" toggle (if/when implemented for competitor analysis); both can be used together
8. Unrated count updates in real-time when user rates keywords on the same domain
9. If all keywords are rated, button displays "Show Unrated (0)" and clicking it shows empty state with appropriate message
10. Filter state resets when user switches to a different domain via dashboard navigation
11. Filter persists across sorting, pagination, and other table operations (survives `sortBy()`, `loadMore()`, rating changes)
12. Filter applies only to keyword table views: 'opportunities', 'all', 'shared', 'unique'
13. Filter does NOT appear or affect the 'blog-topics' view (which shows blog titles, not keywords)
14. Unrated count reflects all unrated keywords across all pages, calculated from `getKeywordsForCurrentView()` array, not just displayed page
15. Filter works correctly with pagination (page size 50); unrated keyword count includes all pages

**View Mode Applicability:**
| View Mode | Filter Applies? | Reason |
|---|---|---|
| opportunities | Yes | Shows keyword rows; users rate opportunities |
| all | Yes | Shows keyword rows; users rate any keyword |
| shared | Yes | Shows keyword rows; users rate shared keywords |
| unique | Yes | Shows keyword rows; users rate unique-to-user keywords |
| blog-topics | No | Shows generated blog titles, not keywords; no rating interaction |

**Out of Scope:**
- Persisting filter state across browser sessions (stateless toggle within current session only)
- Adding unrated count to the stat cards at the top of the component (filter count only in toolbar button)
- Changing the unrated count dynamically via URL parameters or external state
- Combining unrated filter with other future filters (e.g., difficulty range) — each filter independent
- Persisting filter toggle state to IndexedDB (resets on domain switch)

---

---

### Feature 10: Opportunity Score Explanation Tooltip ✅

**Purpose:** Educate users on how the Opportunity Score is calculated and what factors influence it, reducing confusion and building confidence in the algorithm
**Status:** Backlog

**Implementation:**
- Add interactive tooltip/popover on Opportunity Score column header explaining the score
- Display score breakdown inline (percentage contribution of each factor)
- Show real-world example: "For this keyword: 40% search volume (3k/month), 40% inverted difficulty (45/100), 20% competitor gap (3 competitors)"
- Tooltip accessible via info icon next to "Opportunity Score" header or as hover tooltip
- Mobile-friendly: tap/click info icon to show explanation modal instead of hover
- Explanation includes 0-100 scale context and color-coding reference (high≥70, medium≥40, low<40)

**Score Calculation Details (for tooltip copy):**
```
Opportunity Score = (0.4 × Normalized Volume) + (0.4 × Inverted Difficulty) + (0.2 × Competitor Gap)

Where:
- Normalized Volume = (Search Volume / 100,000) × 100, capped at 100
- Inverted Difficulty = 100 - Keyword Difficulty (lower difficulty = higher score)
- Competitor Gap = (Competitor Count / 5) × 100, capped at 100
```

**Key Files:**
- `components/competitor-analysis/` — Add info icon + tooltip/modal near column header
- `components/opportunity-score-tooltip/` (new) — Reusable tooltip component showing score breakdown
- `services/competitor-analysis.service.ts` — Optional: expose scoring breakdown method for display

**User Flow:**
1. User views Opportunities tab with Opportunity Score column
2. User hovers over (desktop) or taps (mobile) info icon next to "Opportunity Score" header
3. Tooltip/modal appears explaining the score formula and factors
4. User can also hover over individual score badges to see a mini-breakdown for that specific keyword
5. User gains understanding of what makes a keyword a strong opportunity

**Acceptance Criteria:**
1. Info icon (help/question mark) appears next to "Opportunity Score" column header
2. On desktop, hovering over icon shows tooltip with full explanation
3. On mobile, tapping icon opens modal with explanation (dismiss via close button or outside click)
4. Explanation includes the 0-100 scale, the three weighted factors, and the formula
5. Explanation mentions real-world context: "40% search volume, 40% difficulty, 20% competitor gap"
6. Color-coding legend included: high (70+), medium (40-69), low (<40)
7. Optional: individual score cells show mini-explanation on hover ("40% volume + 40% difficulty + 20% competitors")
8. Tooltip content is consistent across all keyword views (opportunities, shared, all, unique)
9. No blocking UI elements; tooltip/modal does not prevent table interaction
10. Accessible: tooltip content available via screen reader; keyboard navigation supported (Tab to icon, Enter/Space to open)

**Out of Scope:**
- Modifying the scoring algorithm itself (calculation logic unchanged)
- Personalization of weightings (40/40/20 split is fixed)
- Per-keyword score adjustment UI (explanation only, not manipulation)
- Saving or exporting tooltip explanations to CSV
- Animated score breakdowns or interactive formula visualizers
- Storing explanation dismissal state (shown every time user views header)

**Design Notes:**
- Tooltip should use consistent design language (see DS in FEATURE-REQUIREMENTS.md)
- Info icon color: secondary/neutral (#718096 gray)
- Tooltip background: light gray/white with dark text for contrast
- Modal on mobile: centered, 90vw width max 500px, semi-transparent backdrop

---

**Last Updated:** March 7, 2026
**Version:** 1.0.0 (MVP Complete) + Feature 8, 9 & 10 (Backlog)
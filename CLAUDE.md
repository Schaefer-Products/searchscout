# SearchScout — Claude Code Instructions

## Project Overview

SearchScout is an Angular 21 SEO keyword opportunity finder. It helps small business owners discover blog topics by analyzing competitor keywords via the DataForSEO API.

## Commands

```bash
npm start          # Dev server at http://localhost:4200
npm test           # Run unit tests in watch mode
npm run test:ci    # Run unit tests once (no watch)
npm run build      # Production build
npm run e2e        # Run all Playwright acceptance tests
npm run e2e:ui     # Playwright interactive UI mode
npm run e2e:debug  # Playwright step-through debugger
npm run e2e:report # Open last HTML test report
ng generate service services/<name>              # New service
ng generate component --standalone components/<name>  # New component
```

## Architecture

```
src/app/
  components/       # Standalone UI components
  services/         # Business logic and API integration
  models/           # TypeScript interfaces
  guards/           # Functional route guards
  utils/            # Logger, domain validation, pagination
```

### Key Services

| Service | Responsibility |
|---|---|
| `indexed-db.service` | Low-level IndexedDB wrapper (`keyvalue` + `cache` stores) |
| `storage.service` | Persists credentials, current domain, competitor selections |
| `cache.service` | Two-tier cache (in-memory Map + IndexedDB); configurable expiration |
| `dataforseo.service` | DataForSEO API integration; credential validation; keyword fetching |
| `competitor-analysis.service` | Aggregates keywords; identifies opportunities; calculates scores |
| `blog-topic-generator.service` | Generates blog titles from keyword opportunities (30+ templates) |
| `export.service` | Exports analysis results to CSV |

## Code Conventions

- **Dependency injection:** Use `inject()` function, not constructor injection
- **Logging:** Always use `Logger.debug()` / `Logger.error()` / `Logger.warn()` — never `console.*`
- **Change detection:** Inject `ChangeDetectorRef` and call `detectChanges()` after async operations
- **Components:** All standalone — explicit imports required, no NgModules
- **Guards:** Functional guards only (no class-based)
- **Error handling:** Use `.pipe(catchError())` for Observables; map HTTP errors to user-friendly messages
- **Immutability:** Use immutable patterns for state updates (see sorting/keyword logic)

## Commit Messages

- All lowercase
- Present tense, verb-first (e.g. `adds`, `fixes`, `removes`, `updates`)
- No period at the end
- Examples: `adds playwright framework for acceptance tests`, `prevents Manual badge overflow on long competitor domain names`

## Key Models (`src/app/models/`)

| Model | Purpose |
|---|---|
| `DomainKeywordRanking` | A keyword the user's domain ranks for (keyword, searchVolume, difficulty, position, etv, cpc) |
| `Competitor` | A discovered or manually added competitor (domain, keywordOverlap, totalKeywords, isManual) |
| `AggregatedKeyword` | Keyword merged across user + competitors (userRanking, competitorRankings, isOpportunity, opportunityScore) |
| `CompetitorAnalysisResults` | Full analysis output (allKeywords, opportunities, shared, uniqueToUser, analyzedCompetitors) |
| `BlogTopic` | Generated blog recommendation (title, keyword, templateCategory, recommendationScore) |

## Routing

- `''` → redirects to `/dashboard`
- `/setup` → `ApiKeySetupComponent` (unguarded)
- `/dashboard` → `DashboardComponent` (guarded by `apiKeyGuard`)
- `apiKeyGuard` redirects to `/setup` when credentials are absent

## IndexedDB Schema

Database: `searchscout` (v1) — two object stores:

| Store | Key pattern | Contents |
|---|---|---|
| `keyvalue` | `credentials` | `{ login, password }` |
| `keyvalue` | `currentDomain` | `"example.com"` |
| `keyvalue` | `competitors_<domain>` | `Competitor[]` |
| `cache` | `domain_keywords_<domain>` | `CacheEntry<DomainKeywordRanking[]>` |
| `cache` | `competitor_analysis_<domain>_<sorted-competitors>` | `CacheEntry<CompetitorAnalysisResults>` |

`CacheEntry` shape: `{ key, data, timestamp, expiresAt }`. Cache is two-tier: in-memory Map + IndexedDB. Expiry is configurable via `environment.cacheExpirationDays`.

## Unit Testing

- Framework: Jasmine + Karma (ChromeHeadless)
- Every service has a corresponding `*.spec.ts`
- VS Code task: **test (no watch)** runs `test:ci`

## Acceptance Testing (Playwright)

Tests live in `acceptance/` and follow the Page Object Model pattern.

**Structure:**
```
acceptance/
  features/      # Gherkin feature files (source of truth for scenarios)
  fixtures/      # JSON API response fixtures (mirror DataForSEO structure)
  pages/         # Page objects (locators + action helpers)
  support/       # idb-helpers.ts, api-stubs.ts
  tests/         # Numbered spec files (01–07)
```

**Spec files:**
| File | Coverage |
|---|---|
| `01-credential-setup.spec.ts` | API key setup and authentication |
| `02-domain-analysis.spec.ts` | Domain keyword fetching, caching, pagination |
| `03-competitor-discovery.spec.ts` | Competitor discovery via API |
| `04-competitor-add-remove.spec.ts` | Manual competitor management |
| `05-persistence.spec.ts` | State persistence and route guards |
| `06-competitor-analysis.spec.ts` | Competitor analysis, tabs, sorting, cache |
| `07-export.spec.ts` | CSV export for all views |

**`idb-helpers.ts`** — seed IndexedDB state *before* `page.goto()` (uses `addInitScript`):
- `clearIndexedDb`, `seedCredentials`, `seedCurrentDomain`, `seedSelectedCompetitors`
- `seedDomainCache(page, domain, keywords, ageInDays?)` — accepts optional age
- `seedCompetitorAnalysisCache(page, domain, competitors, results, ageInDays?)`
- `readCredentialsFromIdb(page)` — read back after navigation (for assertions)

**`api-stubs.ts`** — intercept `page.route()` before navigation:
- `stubValidCredentials` / `stubInvalidCredentials`
- `stubDomainKeywords(page, 'example' | 'empty' | 'many')` — `'many'` = 110 keywords (pagination)
- `stubCompetitorDiscovery`
- `stubCompetitorKeywords(page, 'standard' | 'many')` — `'many'` = 55 keywords

**CSV download testing** (`07-export.spec.ts`): patches `document.createElement('a')` via `addInitScript` to capture blob downloads synchronously into `window.__capturedDownloads` before `URL.revokeObjectURL` fires. Use `getLastDownload(page)` helper to retrieve `{ name, content }`.

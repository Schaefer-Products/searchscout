# SearchScout — Claude Code Instructions

## Project Overview

SearchScout is an Angular 21 SEO keyword opportunity finder. It helps small business owners discover blog topics by analyzing competitor keywords via the DataForSEO API.

## Commands

```bash
npm start          # Dev server at http://localhost:4200
npm test           # Run tests in watch mode
npm run test:ci    # Run tests once (no watch)
npm run build      # Production build
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

## Testing

- Framework: Jasmine + Karma (ChromeHeadless)
- Every service has a corresponding `*.spec.ts`
- VS Code task: **test (no watch)** runs `test:ci`

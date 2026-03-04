# SearchScout — Agent Workflow Guide

This document describes which Claude Code subagents are most relevant to the SearchScout project and how they work together across common development workflows.

SearchScout is an **Angular 21 / TypeScript** SEO keyword opportunity finder that integrates with the DataForSEO API, stores state in IndexedDB, and is tested with Jasmine/Karma (unit) and Playwright (acceptance).

---

## Relevant Agents

### Primary Development
| Agent | When to Use |
|---|---|
| `angular-architect` | Component architecture, routing, change detection, standalone component patterns |
| `typescript-pro` | Advanced types, generics, type safety across models and services |
| `frontend-developer` | UI implementation, SCSS, template logic |
| `api-designer` | DataForSEO API integration, HTTP client patterns, error mapping |

### Testing & Quality
| Agent | When to Use |
|---|---|
| `qa-expert` | Test strategy, coverage gaps, Jasmine/Karma test design |
| `test-automator` | Playwright acceptance tests, page object models, Gherkin scenarios |
| `code-reviewer` | Pre-merge code review for quality and maintainability |
| `accessibility-tester` | WCAG compliance, ARIA attributes, keyboard navigation |
| `performance-engineer` | Bundle size, change detection cycles, caching efficiency |
| `security-auditor` | API key handling, credential storage in IndexedDB, XSS risks |
| `debugger` | Diagnosing runtime errors, Observable chains, IndexedDB issues |
| `error-detective` | Tracing root causes from stack traces and error logs |

### Domain Expertise
| Agent | When to Use |
|---|---|
| `seo-specialist` | Validating keyword scoring logic, opportunity detection heuristics |
| `competitive-analyst` | Reviewing competitor analysis logic and ranking algorithms |
| `data-analyst` | Keyword aggregation logic, opportunity score calculations |

### Documentation & UX
| Agent | When to Use |
|---|---|
| `technical-writer` | User-facing docs, onboarding guides |
| `documentation-engineer` | Code-level docs, JSDoc, API references |
| `api-documenter` | DataForSEO integration docs, endpoint references |
| `ux-researcher` | Evaluating dashboard UX, blog topic generator flow |

### Developer Experience
| Agent | When to Use |
|---|---|
| `refactoring-specialist` | Improving service structure, reducing duplication |
| `build-engineer` | Angular build config, Playwright CI setup |
| `dependency-manager` | npm dependency audits and upgrades |

### Planning & Coordination
| Agent | When to Use |
|---|---|
| `product-manager` | Feature scoping and prioritization against FEATURE-REQUIREMENTS.md |
| `architect-reviewer` | Reviewing architectural decisions (caching strategy, routing, guards) |
| `workflow-orchestrator` | Coordinating multi-agent sessions for large features |

---

## Workflows

### 1. New Feature Development

```
product-manager         → Define scope, acceptance criteria, update FEATURE-REQUIREMENTS.md
  └─ ux-researcher      → Research user needs, validate feature concept, define UX requirements
       └─ ui-designer   → Design UI layout, component visuals, interaction patterns
            └─ angular-architect     → Translate designs into component/service structure, routing changes
                 └─ qa-expert        → Write failing Jasmine unit tests (red) before implementation
                 └─ test-automator   → Write failing Playwright acceptance tests + Gherkin scenarios (red)
                      └─ typescript-pro       → Implement models, interfaces, service logic (make unit tests green)
                      └─ frontend-developer   → Build components, templates, SCSS (make acceptance tests green)
                      └─ api-designer         → Integrate new DataForSEO endpoints if needed
                           └─ code-reviewer        → Review before merge
                           └─ accessibility-tester → Verify WCAG compliance against ui-designer specs
```

### 2. Bug Investigation & Fix (TDD)

```
error-detective         → Analyse stack trace / error logs from Logger output
  └─ debugger           → Trace through Observable chains, IndexedDB operations to isolate the defect
       └─ qa-expert     → Write failing Jasmine unit test that reproduces the bug (red)
       └─ test-automator → Write failing Playwright acceptance test that reproduces the bug (red)
            └─ angular-architect    → Identify root cause (change detection, DI, lifecycle)
            └─ typescript-pro       → Implement the fix (make tests green)
                 └─ code-reviewer   → Review fix and confirm both test suites pass before merge
```

### 3. Performance Optimisation

```
performance-engineer    → Profile bundle size, change detection cycles, cache hit rates
  └─ angular-architect  → Refactor OnPush change detection, lazy loading
  └─ database-optimizer → Review IndexedDB access patterns, cache expiration strategy
  └─ refactoring-specialist  → Eliminate redundant computations in keyword aggregation
       └─ test-automator      → Verify no regressions in acceptance tests
```

### 4. Security Review

```
security-auditor        → Audit credential storage (IndexedDB keyvalue store), API key exposure
  └─ penetration-tester → Test for XSS, CSRF, data leakage via URL params
  └─ compliance-auditor → Review against relevant standards (OWASP, GDPR for user data)
       └─ code-reviewer → Verify fixes and harden error handling
```

### 5. SEO Logic Validation

```
seo-specialist          → Review opportunity scoring heuristics and keyword gap logic
  └─ competitive-analyst → Validate competitor ranking aggregation approach
  └─ data-analyst        → Verify keyword scoring formulas in competitor-analysis.service
       └─ qa-expert      → Ensure edge cases are covered in unit tests
```

### 6. Refactoring & Technical Debt

```
architect-reviewer      → Assess current structure against Angular best practices
  └─ refactoring-specialist  → Plan and execute refactoring (services, utils, models)
  └─ typescript-pro          → Strengthen type safety, remove `any` usage
       └─ dependency-manager → Audit and upgrade stale npm packages
       └─ build-engineer     → Optimise Angular build config, CI pipeline
            └─ test-automator → Confirm all Playwright tests pass post-refactor
```

### 7. Documentation Update

```
technical-writer        → Update user-facing guides and onboarding docs
  └─ documentation-engineer  → Update code-level JSDoc and architecture notes
  └─ api-documenter          → Refresh DataForSEO endpoint references
       └─ seo-specialist     → Validate accuracy of SEO terminology in docs
```

---

## Agent Invocation Tips

- **Start every new feature with `ux-researcher` → `ui-designer`** before any code is written. UX research validates the concept; UI design produces the layout and interaction spec that `angular-architect` and `frontend-developer` implement against.
- **Follow TDD for all feature work and bug fixes.** `qa-expert` writes failing Jasmine unit tests and `test-automator` writes failing Playwright acceptance tests *before* implementation begins. Code is only written to make those tests pass.
- **Start with `angular-architect`** for any structural change — it understands Angular 21 standalone components, the `inject()` pattern, and functional guards used throughout this project.
- **Pair `typescript-pro` with `angular-architect`** when working on models (`src/app/models/`) or service logic to maintain strict type safety.
- **Invoke `seo-specialist` and `competitive-analyst` together** when modifying `competitor-analysis.service` or `blog-topic-generator.service` — domain knowledge matters here.
- **Use `workflow-orchestrator`** to coordinate multi-agent sessions when tackling large epics that span feature dev, testing, and documentation in one session.

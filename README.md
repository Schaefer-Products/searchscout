# Searchscout

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


## TODO
### Development and CI/CD
- [x] git in dev container
- [x] deployment to netlify

### Bugs
- [x] Switching domains doesn't clear competitors
- [x] "Find Your Competitors" section doesn't show cache age
- [x] Changing competitors doesn't refresh the data
- [x] Given I have to re-enter credentials, when the "Analyze Your Domain" section appears, then the selected competitors section should not appear until I've clicked "Analyze Domain"
- [ ] When the competitor domain name is long (e.g. newsletter.pragmaticengineer.com), the "Manual" label spills over outside the card

### Features
- [x] Persist competitor selection
- [ ] Estimated cost tracking
- [x] Click "Change Selection" should pre-populate the competitors list
- [ ] Allow user to explicitly select relevant keywords and exclude irrelevant keywords
      - Persist the selection
      - Prioritize relevant keywords in the "Blog Topics" generator
      - Star the relevant keywords

## Tech Debt
- [x] unit tests
- [x] unit test coverage
- [ ] refactoring/consolidation of scss
- [ ] refactoring of some business logic ("top 3" logic)
- [ ] merge environment files with default
- [ ] save competitor keywords in separate files
- [ ] establish acceptance tests framework
- [ ] increase cache storage capacity
      - [x] implement lz-string for immediate gains
      - [ ] switch cache storage to IndexDB
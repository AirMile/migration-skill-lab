# Target Angular Testing Conventions

Read this reference only when a run compares current React testing
conventions (Vitest, Testing Library) against a possible Angular target, or
reports on Angular testing/CI quality-gate conventions.

## Approval Status

This reference summarizes Angular guidance and code patterns found across
other Lely repositories on 4 September 2026. It has **not** been confirmed by
Bernhard or a representative Angular team. Treat every item below as
evidence-based research, not an approved target standard, until that review
happens.

## Confirmed Documented Guidance

- Minimum 70% test coverage is required for new/changed code; methods should
  be short and single-responsibility with a low branch count; each unit test
  verifies one behavior with Arrange/Act/Assert; no unrelated multi-assertion
  tests.
  Source: `C:\Project\lely-angular-research\horizon-documentation\Development\HorizonUICodeReview.md:256-262`.
- This guideline names a coverage percentage and test-writing style, but
  does **not** name a required test framework (Jasmine, Jest, or other), a
  required component-test harness (`TestBed`, `ComponentFixture`), or an
  E2E tool.
- The backend `ComponentTest/README.md` document describes "component
  testing" for **backend .NET modules** (`WebApplicationFactory<Program>`,
  Testcontainers with SQL Server, xUnit), using "component" to mean a
  backend module such as `Horizon.Modules.Pairing`, not an Angular UI
  component. It is not Angular/frontend guidance and must not be treated as
  an Angular component-testing strategy.
  Source: `C:\Project\lely-angular-research\horizon-documentation\ComponentTest\README.md` (delegated review; classification confirmed by repeated backend-specific terminology in the summarized citations, not re-opened line-by-line in this pass).
- `TestAutomation/README.md` in the same documentation repository points
  exclusively to an external GitLab wiki
  (`https://gitlab.lelyonline.com/pd/horizon/test/horizon-cucumber-bdd-automation/-/wikis/home`)
  for E2E/API test guidelines. That wiki is not present in this local
  snapshot and its content cannot be verified.
  Source: `C:\Project\lely-angular-research\horizon-documentation\TestAutomation\README.md:3,5-16`.

## Confirmed CI Template Defaults (Shared Templates, Not App-Specific)

- The shared GitLab CI templates repository's SonarQube job defaults assume
  Angular's own CLI test runner: `TS_TEST_COMMAND` runs
  `xvfb-run -a node --max_old_space_size=8192 node_modules/@angular/cli/bin/ng test --no-watch --code-coverage`,
  i.e. Karma/Jasmine via `ng test`, not Jest.
  Source: `C:\Project\lely-angular-research\horizon-gitlabci-templates\jobs\sonarqube.yml:148`.
- The same job sets `TEMPLATE_MIN_COVERAGE_PERCENT: "70"` (matches the
  documented 70% rule) but `TEMPLATE_HTML_COVERAGE_ENABLED: "false"` and
  `CONTROL_FLOW_GUARD_ENFORCE: "false"` by default, i.e. HTML-template
  coverage and the Angular control-flow coverage guard are both
  **opt-in**, not enforced unless a project explicitly enables them.
  Source: `sonarqube.yml:139,143,147`.
- These are shared-template defaults; do not assume every consuming Angular
  project uses `ng test`/Karma just because the shared template defaults to
  it. See the contradicting real-project evidence below.

## Confirmed Observed Practice Overrides the Shared Template Default

- Hub Dashboard UI (Angular 19, production app) does **not** use the shared
  template's default `ng test` command. Its own pipeline defines a
  `test-library` job that runs `npm run test` (which invokes Jest, see
  below) instead, and a separate `test-e2e` job that runs Playwright.
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\gitlab-ci\stages\test.yml:6-40` (`test-library` job, `npm run test`),
  `test.yml:64-109` (`test-e2e` job, `npx playwright test`).
- Hub Dashboard UI's `package.json` wires `"test": "jest --coverage"`, and
  its Jest config uses `jest-preset-angular` with a coverage threshold of
  exactly 70% on statements, branches, functions, and lines, matching the
  documented rule precisely.
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\package.json:12` (`"test": "jest --coverage"`),
  `C:\Project\lely-angular-research\hub-dashboard-ui\jest.config.js:1-2` (`jest-preset-angular`),
  `jest.config.js:22-29` (70% threshold, all 4 metrics).
- Hub Dashboard UI's Jest coverage explicitly excludes Playwright specs,
  page objects, mocks, config files, and the app bootstrap/DTO models from
  its coverage calculation.
  Source: `hub-dashboard-ui\gitlab-ci\stages\test.yml:44-52` (Sonar exclusions:
  `**/*.pw.ts,**/*.po.ts,**/testing/**,scripts/**,**/*.config.ts,**/*.config.js,src/main.ts,**/models/**`).
- Hub Dashboard UI uses Playwright with a Page Object pattern (`.po.ts`
  files) and private helper packages `@lely/jest` (devDependency `^0.0.4`)
  and `@lely/playwright` (devDependency `^0.0.2`), plus
  `@lely/ng-components-po` (devDependency `^0.0.10`, likely page objects for
  the `@lely/ng-components` design-system library).
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\package.json:49-51`.
- Horizon Architecture Demo (Angular 17, reference/demo app) uses Karma +
  Jasmine for unit tests (via `angular.json` project test builders) and
  Playwright for E2E with its own Page Object pattern and Storybook
  interaction tests, i.e. the older app matches the shared template's
  Karma-based default, while the newer production app overrides it with
  Jest.
  Source: `C:\Project\lely-angular-research\horizon-architecture-demo\package.json:78-84` (`jasmine-core`, `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine` present).
- Horizon Architecture Demo's `package.json` also lists `"jest": "^29.7.0"`
  as a devDependency, but its own root `"test"` script is
  `"test": "playwright test"`, not a Jest invocation. Its actual unit-test
  runner is wired at the per-project level (Karma, per `angular.json`), so
  the presence of the `jest` package here should not be read as evidence
  that Jest is the unit-test runner for this app.
  Source: `C:\Project\lely-angular-research\horizon-architecture-demo\package.json:25,79`.

## Open Questions

- Whether Jest (as in Hub Dashboard UI) or Karma/Jasmine (as in Horizon
  Architecture Demo and the shared CI template default) is the intended
  target unit-test framework for new Angular applications is unresolved.
  Only 2 example apps were available, of differing Angular versions and
  purposes; this is not enough to establish a project-wide convention.
- `@lely/jest` and `@lely/playwright` are private packages whose internal
  configuration/helpers (custom matchers, fixtures, base Playwright config)
  are not inspectable locally (`node_modules` absent from this workspace).
  Ask for their authoritative source before assuming their contents.
- The Test Automation Wiki referenced by `TestAutomation/README.md` is an
  external GitLab wiki not present in this local snapshot; its E2E/API test
  guidelines cannot be verified until it is fetched or its content is
  otherwise made available.
- No AI Playbook or AI-agent instruction document was found in any of the
  five workspace roots inspected across this research (Route Assistant
  Frontend, Horizon Documentation, Horizon Architecture Demo, Hub Dashboard
  UI, Horizon GitLab CI Templates). If an AI Playbook exists, its location
  is unknown and should be asked for explicitly rather than assumed absent
  from the company entirely.

# Obaidul Mentor Lab — AI Product Roadmap & Build Instructions

Status: living product specification
Repository: obaidhqbd/obaid_web_lab
Primary branch: main

## 1. Product goal

Obaidul Mentor Lab is a browser-first learning platform for students learning web development through real project files. The long-term product should reduce mentor workload while making the student learning path clearer, measurable, reusable and easy to maintain.

Core loop:
Content upload → automatic classification → ranked curriculum → student workspace → guided task → automated validation → progress → export/review.

Do not turn the product into a generic website builder. It should remain a learning system first.

## 2. Current architecture audit

### What is already strong
- Static GitHub Pages architecture is simple and low-maintenance.
- Class and blog packages are encrypted during build.
- Browser-side Web Crypto is already integrated.
- Students can edit real source files in Monaco or the fallback editor.
- Live preview can resolve local project assets and internal project links.
- Class ZIP download and edited ZIP export exist.
- Homework checks support several check types and nested all/any logic.
- Local persistence avoids requiring an account/database.
- Ranked nested class/subtopic support now exists in the build pipeline.
- Service-worker versioning is in place.

### Main weaknesses to solve
1. Authoring still depends heavily on manually prepared metadata.json files.
2. There is no dedicated mentor authoring/validation interface for classes, modules, tasks and hints.
3. There is no persistent teacher analytics or student submission workflow.
4. Progress is browser-local only, so the mentor cannot see student progress remotely.
5. Browser testing is not yet a strong automated gate for the interactive UI.
6. Deployment depends on CLASS_ACCESS_PASSWORD being present and the build currently fails hard when it is missing, which is secure but operationally fragile.
7. The current markdown documentation is useful but should evolve into a formal content schema and authoring handbook.
8. Accessibility, content validation, link validation and runtime regression tests should become first-class CI checks.
9. The homepage and workspace are visually stronger now, but the product needs a clearer information architecture as the class library grows.
10. Static hosting limits server-side features; future collaboration, analytics and submissions should be added through an explicit backend integration rather than hidden complexity in the static shell.

## 3. Non-negotiable compatibility rules

- Existing flat classes must continue to work without metadata changes.
- Existing class ZIPs must remain downloadable.
- Existing homework syntax must remain supported.
- Existing class IDs must remain stable unless a migration is explicitly required.
- Existing local progress keys must not be invalidated accidentally.
- Do not force every class into a nested structure.
- Asset directories such as assets, images, media, public, static and src must not be auto-detected as learning topics.
- Raw class content must never be copied into dist.
- Never weaken production encryption or hard-code a real password.
- Do not add allow-same-origin to the preview sandbox without a separate security redesign and review.
- Prefer additive schema changes with backward-compatible defaults.

## 4. Target curriculum model

Hierarchy:
Course library → Class → Module/Subclass → Topic → Activity/Task → Check.

Recommended class package:
Classes/
  02-css-layout/
    metadata.json
    README.md
    index.html
    styles.css
    01-foundations/
      metadata.json
      index.html
      styles.css
    02-flexbox/
      metadata.json
      index.html
      styles.css
    03-grid/
      metadata.json
      index.html
      styles.css

Supported topic aliases:
- subclasses
- subtopics
- modules
- children

Every topic may have:
- id
- path
- title
- description
- summary
- rank or order
- tags
- duration
- prerequisites
- objectives
- hints
- tasks
- resources
- challenge level
- optional nested subclasses

## 5. Recommended metadata evolution

Keep the current schema valid. Add fields gradually:

```json
{
  id: "css-layout",
  title: "CSS Layout Masterclass",
  version: 1,
  order: 2,
  level: "Beginner",
  tags: ["CSS", "Layout"],
  objectives: ["Understand flow", "Use Flexbox", "Use Grid"],
  prerequisites: [],
  subclasses: [
    {
      id: "foundations",
      path: "01-foundations",
      title: "Layout Foundations",
      rank: 1,
      duration: "30 min",
      objectives: ["Understand normal flow"],
      homework: {
        hints: [],
        tasks: []
      }
    }
  ]
}
```

Do not make these fields mandatory immediately. The builder should infer sensible defaults.

## 6. Feature roadmap

### Phase 0 — Reliability foundation
Priority: immediate

Goals:
- Make every content upload validate before deployment.
- Catch broken links, invalid paths, duplicate IDs and bad homework references before publishing.
- Add automated syntax checks for app.js and build scripts.
- Add a lightweight browser smoke test.
- Add a build manifest containing version, commit, class count and topic count.
- Make deployment failure messages understandable to the mentor.

Acceptance criteria:
- Invalid content fails build with the exact file and reason.
- A class with no metadata still builds.
- A class with nested topics still builds.
- Existing flat classes still build.
- No raw Classes/ or Blogs/ files appear in dist.

### Phase 1 — Mentor authoring automation
Priority: highest productivity gain

Build an Authoring Assistant that can:
- scan a new class folder or ZIP;
- infer title, description, tags and level;
- detect modules/topics;
- infer ranking from numeric prefixes;
- generate metadata.json;
- generate starter homework tasks;
- validate homework checks;
- produce a content report;
- show exactly what will appear to students before commit;
- optionally generate a ready-to-upload ZIP.

Target workflow:
Drop ZIP → automatic scan → preview → fix warnings → generate metadata → publish.

Long-term goal: preparing a class should take minutes, not repeated manual JSON editing.

### Phase 2 — Student learning experience
Priority: high

Add:
- class roadmap with progress per module;
- breadcrumbs such as Class / Flexbox / Alignment;
- Resume learning button;
- completed/remaining topic indicators;
- objectives at the start of each module;
- estimated duration;
- prerequisites;
- module completion celebration;
- bookmark/favorite task;
- keyboard shortcuts;
- accessible focus states and screen-reader labels;
- richer empty/error states;
- optional glossary/tooltips for unfamiliar terms.

### Phase 3 — Better assessment engine
Priority: high

Expand task checks:
- contains
- not_contains
- regex
- min_length
- html_elements
- css_property
- files_exist
- file_size
- selector_exists
- attribute_exists
- computed_style
- DOM relationship checks
- nested all/any groups
- weighted rubric items.

Add task states:
- not_started
- in_progress
- passed
- manually_review
- locked.

Add partial credit later instead of making every task binary.

### Phase 4 — Mentor dashboard
Priority: high

A backend should become optional rather than required for the core static site.

Dashboard ideas:
- active classes;
- total modules;
- completion rates;
- common failed tasks;
- students who are stuck;
- recent submissions;
- average time per module;
- frequently requested hints;
- class-level progress heatmap;
- export CSV.

Recommended architecture:
Keep GitHub Pages as the public student shell. Add a separate lightweight backend only when remote progress or submissions are needed.

### Phase 5 — Submission and feedback
Priority: medium/high

Allow a student to:
- submit a snapshot of their project;
- attach a note;
- receive automated checks;
- optionally request mentor review;
- receive mentor comments;
- resubmit improved work.

Mentor should be able to:
- open submitted ZIP;
- inspect changed files;
- see task results;
- leave targeted comments;
- mark a submission reviewed.

### Phase 6 — AI mentor layer
Priority: medium

Add AI only after the deterministic learning system is reliable.

Useful AI actions:
- explain the error without solving the whole task;
- give a hint based on the current file;
- explain why a check failed;
- suggest the next concept;
- summarize what the student has learned;
- generate practice questions from a module;
- create a teacher draft of tasks from a class folder.

AI must respect the learning mode. A student asking for a hint should not automatically receive the complete assignment solution.

### Phase 7 — Content intelligence
Priority: medium

Add structured reusable resources:
- lessons;
- examples;
- challenges;
- quizzes;
- mini projects;
- reference cards;
- glossary entries;
- prerequisite maps;
- learning paths.

Then support different paths such as:
Beginner Web → HTML → Forms → Validation → CSS Forms → Responsive Forms.

### Phase 8 — Scale and operations
Priority: later

Add:
- multiple course tracks;
- versioned class content;
- scheduled publishing;
- draft/private classes;
- archive states;
- content migration tools;
- rollback;
- release notes;
- automatic changelog generation;
- health dashboard for deployments.

## 7. Mentor productivity features to prioritize

These features directly reduce repetitive work:

1. Folder/ZIP scanner with automatic metadata generation.
2. Visual curriculum builder that writes metadata.json for the mentor.
3. Task builder with reusable check templates.
4. Class preview before publish.
5. Content validator with one-click fixes for safe issues.
6. Bulk rename/ordering assistant.
7. Reusable lesson templates.
8. Reusable homework templates.
9. Clone class/module feature.
10. Release checklist generated automatically.
11. Build report after every deployment.
12. Optional student analytics dashboard.

## 8. Student features that improve learning quality

Prioritize learning clarity over visual novelty:
- clear objective before coding;
- small progressive tasks;
- immediate preview;
- immediate automated feedback;
- hints before answers;
- visible progress;
- resume where the student stopped;
- examples that connect concept to code;
- a clear difference between practice and assessment;
- accessible, readable UI on mobile;
- downloadable work at every stage.

## 9. Content authoring standards

Every new class should ideally contain:
- a clear title;
- learning objectives;
- recommended duration;
- difficulty level;
- topic order;
- starter files;
- at least one practice task;
- at least one automated check where practical;
- at least one hint per difficult task;
- a README or metadata description;
- a clean ZIP structure.

Avoid:
- absolute file paths;
- hidden dependencies;
- unnecessary build tools inside student packages;
- huge binary files;
- duplicate IDs;
- tasks that can only be judged manually when an objective automated check is possible.

## 10. CI/CD roadmap

Every push should eventually run:
1. syntax validation;
2. content schema validation;
3. duplicate ID validation;
4. nested topic validation;
5. homework reference validation;
6. internal link validation;
7. build;
8. encrypted resource verification;
9. browser smoke test;
10. accessibility smoke test;
11. artifact publication;
12. GitHub Pages deployment.

Build should produce a concise machine-readable report:
build-info.json
content-report.json
release-report.json

## 11. Testing strategy

### Unit tests
Test:
- ID normalization;
- ranking inference;
- topic discovery;
- path normalization;
- homework normalization;
- nested all/any checks;
- encryption/decryption;
- ZIP integrity.

### Browser tests
At minimum verify:
- Home loads;
- navigation works;
- class unlock works;
- class card opens;
- topic roadmap appears when topics exist;
- topic switching changes file scope;
- editor loads;
- preview loads;
- local assets render;
- internal HTML links do not produce unexpected external navigation;
- task check works;
- ZIP export works;
- theme switch works;
- mobile layout has no horizontal overflow.

## 12. Accessibility requirements

Target a strong WCAG-oriented baseline:
- semantic buttons and links;
- keyboard navigation;
- visible focus;
- sufficient color contrast;
- labels for inputs;
- no information conveyed by color alone;
- reduced motion support;
- readable text sizes;
- touch targets appropriate for mobile.

## 13. Security requirements

- Never commit the production class password.
- Never publish raw private course material in a public repository.
- Keep encrypted distribution separate from private raw source when confidentiality matters.
- Keep preview sandbox isolated.
- Do not add allow-same-origin casually.
- Treat the browser password as access control for teaching resources, not user identity.
- Validate all uploaded metadata and paths.
- Reject path traversal and unsafe archive entries.

## 14. Recommended long-term repository structure

```text
app.js
styles.css
index.html
site-config.json
SECURITY.md
README.md
ROADMAP.md
scripts/
  build.mjs
  clean.mjs
  verify-build.mjs
  validate-content.mjs
  validate-links.mjs
  generate-report.mjs
tests/
  unit/
  browser/
Classes/
Blogs/
assets/
.github/workflows/
```

Keep the public site shell small. Put validation and authoring intelligence in scripts rather than making the browser responsible for content compilation.

## 15. Definition of done for a mature release

A release is considered production-ready when:
- existing classes remain compatible;
- new nested classes build automatically;
- content errors are caught before deployment;
- all student-facing routes work;
- automated homework checks are deterministic;
- browser smoke tests pass;
- accessibility smoke tests pass;
- the deployment workflow succeeds;
- the service worker cache is versioned;
- the release report is generated;
- the mentor can add a new class without hand-editing the site UI.

## 16. AI agent execution rules

When an AI agent is asked to modify this repository:
1. Read this file first.
2. Inspect the existing code before changing architecture.
3. Preserve backward compatibility.
4. Prefer additive migrations.
5. Never delete working functionality just to simplify implementation.
6. Validate the real repository after edits.
7. Add or update tests for new logic.
8. Update documentation when schema or workflow changes.
9. Do not claim deployment success unless the workflow actually succeeds.
10. For content features, provide a sample package and verify that it builds end-to-end.
11. For visual features, check desktop and mobile behavior.
12. For security changes, update SECURITY.md and re-check the threat model.

## 17. Suggested implementation order

Phase 0 reliability
→ Phase 1 mentor authoring automation
→ Phase 2 student learning UX
→ Phase 3 assessment engine
→ Phase 4 mentor dashboard
→ Phase 5 submissions
→ Phase 6 AI mentor
→ Phase 7 content intelligence
→ Phase 8 scale/operations.

The most important strategic rule is simple: reduce mentor manual work first, then improve student intelligence, then add analytics and AI.
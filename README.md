# Obaid Web Lab

A lightweight student-support library for class folders, practical files and study notes. Built for GitHub Pages with no package manager or external runtime dependencies.

## How publishing works

1. Add your class folder or files under content/classes/.
2. Add a Markdown note, HTML article, or a folder of blog assets under content/blogs/.
3. Commit or upload to the main branch. GitHub Actions scans the new content, generates a searchable catalogue, checks the build and deploys the site.

The website uses a progressive fallback chain: generated catalogue, the last valid catalogue saved in the visitor's browser, the backup catalogue, then the bundled starter catalogue. A single malformed item is logged and skipped rather than stopping the catalogue build. A broken build cannot replace the last deployed Pages version.

## Content examples

Class collection:

    content/classes/HTML-Basics/
      README.md
      index.html
      style.css
      metadata.json   (optional)

Study note:

    content/blogs/css-specificity.md

Folder names and Markdown headings are used as fallback titles. The builder also reads HTML title tags, Markdown front matter and optional metadata files. Individual Markdown, HTML, text and PDF documents can be uploaded directly. ZIP archives inside either content area are extracted safely during the build and included in the published artifact; the ZIP itself stays unchanged in the repository. Every indexed class also gets its own downloadable ZIP, automatically regenerated on each build.

## Optional metadata

Add metadata.json to a folder:

    {
      "title": "HTML Basics",
      "description": "Learn the structure of a web page.",
      "category": "Web Development",
      "tags": ["HTML", "Beginner"],
      "date": "2026-10-17"
    }

Metadata is optional. Invalid or missing metadata falls back to the folder name, headings, file titles and a generic but useful description.

Markdown notes may also start with simple front matter:

    ---
    title: CSS Selectors
    description: A practical guide to selector patterns.
    category: Web Development
    tags: CSS, Beginner
    ---

## GitHub setup

The workflow at .github/workflows/pages.yml deploys from main using GitHub Pages' Actions deployment. It runs checks for pushes and pull requests, and supports manual runs through the Actions tab.

On the first deployment, confirm that Settings → Pages → Build and deployment → Source is set to GitHub Actions if GitHub requests it. The workflow needs Pages write and OIDC permissions.

See docs/publishing-and-recovery.md for a fuller publishing and troubleshooting guide.

## Interface features

- Responsive Apple-inspired layout, light/dark theme, accessible navigation and reduced-motion support.
- Search across titles, descriptions, categories, tags and file names.
- Filter and sort resources, save favourites and remember recently opened materials on the current device.
- VS Code-inspired class editor with an Explorer, tabs, syntax highlighting when its optional editor library loads, local draft autosave, reset/download controls and sandboxed live HTML preview. Browser edits are not pushed to GitHub.
- Each class card and class workspace offers a prebuilt ZIP download; ZIPs include the discovered files and preserve their relative folder structure.
- Class workspace with downloadable files and in-page previews for HTML, PDF, images, Markdown, text and code.
- Static-file hosting: no database, server, secrets, build package or third-party CDN is needed.

## Privacy-first Google Analytics

The optional GA4 integration uses measurement ID `G-430L3RWFVF` and loads Google Analytics only after a visitor selects **Allow analytics**. Visitors can decline and keep using the site, or change their choice from the footer settings link. See [Privacy & Analytics](privacy.html) and [the owner setup/reporting guide](docs/google-analytics.md).

Tracked interactions include section/page views, class and note opens, search usage and result counts (never the search words), selected file types, downloads, editor actions, and coarse 50%/90% scroll milestones. Search terms, filenames, form values, editor contents, and typed code are not sent. Google Signals and advertising personalization are disabled. This is aggregate/pseudonymous usage measurement, not a reliable identity list.

## Important boundary

GitHub Pages is a static host. Catalogue creation and deployment are automated, but files still need to be committed to the repository. Browser-side saved items and recent history are per-device, not shared accounts or cross-device progress tracking.
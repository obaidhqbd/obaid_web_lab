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

Folder names and Markdown headings are used as fallback titles. The builder also reads HTML title tags, Markdown front matter and optional metadata files. Individual Markdown, HTML, text and PDF documents can be uploaded directly. ZIP archives inside either content area are extracted safely during the build and included in the published artifact; the ZIP itself stays unchanged in the repository.

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
- Class workspace with downloadable files and in-page previews for HTML, PDF, images, Markdown, text and code.
- Static-file hosting: no database, server, secrets, build package or third-party CDN is needed.

## Important boundary

GitHub Pages is a static host. Catalogue creation and deployment are automated, but files still need to be committed to the repository. Browser-side saved items and recent history are per-device, not shared accounts or cross-device progress tracking.
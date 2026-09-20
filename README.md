# Obaidul Mentor Lab

A static, GitHub Pages-friendly premium support portal for HTML + CSS students.

## What it does

- Upload classes into `Classes/` as folders or ZIP files.
- Upload mentor articles into `Blogs/` as folders or ZIP files.
- `metadata.json` is the preferred content schema. `README.md` / `article.md` is used as a fallback for title and description when metadata is missing.
- GitHub Actions detects content, generates the catalog, packages each item as ZIP, encrypts every package, generates a sitemap, and deploys `dist/` to GitHub Pages.
- Students unlock the library in-browser with a password. The password is never sent to a server.
- Monaco Editor provides a VS Code-style coding experience with HTML/CSS/JSON IntelliSense and validation. A textarea editor is used automatically if Monaco cannot load.
- Student edits and homework progress are saved locally in the browser. No account/database is required.
- Students can download the original provided ZIP or their edited ZIP.
- Live preview runs inside a sandboxed iframe. Local image assets are converted to data URLs for previewing.
- A service worker adds a cache layer for the static shell and already-fetched encrypted catalog/packages.

## Content schema

### `Classes/<class-folder>/metadata.json`

```json
{
  "id": "css-layout-masterclass",
  "title": "CSS Layout Masterclass",
  "description": "Learn how modern web layouts work using normal flow, Flexbox and CSS Grid.",
  "summary": "A practical CSS layout course with guided projects and automated homework.",
  "version": 1,

  "order": 2,
  "rank": 2,

  "level": "Beginner",
  "category": "CSS",
  "difficulty": "Beginner",

  "duration": "3 hours",

  "tags": [
    "CSS",
    "Layout",
    "Flexbox",
    "Grid",
    "Responsive Design"
  ],

  "author": "Obaidul",
  "type": "class",
  "featured": true,

  "objectives": [
    "Understand normal document flow",
    "Understand Flexbox",
    "Understand CSS Grid",
    "Build responsive layouts",
    "Choose the correct layout system"
  ],

  "prerequisites": [
    "Basic HTML",
    "Basic CSS selectors",
    "Basic CSS properties"
  ],

  "resources": [
    {
      "title": "MDN CSS Layout",
      "type": "reference",
      "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout"
    }
  ],

  "homework": {
    "title": "CSS Layout Practice",
    "description": "Complete the exercises from the current class section.",
    "hints": [
      "Read the requirement before changing code.",
      "Use the live preview after every major change.",
      "Try solving the task before checking a hint."
    ],

    "tasks": [
      {
        "id": "layout-foundation",
        "title": "Create the basic layout",
        "description": "Create a semantic page structure using HTML.",

        "status": "practice",

        "checks": [
          {
            "type": "contains",
            "file": "index.html",
            "value": "<main"
          },
          {
            "type": "contains",
            "file": "index.html",
            "value": "<section"
          }
        ]
      },

      {
        "id": "responsive-layout",
        "title": "Make the layout responsive",
        "description": "Create a layout that changes appropriately on smaller screens.",

        "status": "practice",

        "checks": [
          {
            "type": "contains",
            "file": "style.css",
            "value": "@media"
          }
        ]
      }
    ]
  },

  "subclasses": [
    {
      "id": "layout-foundations",
      "path": "01-foundations",
      "title": "Layout Foundations",
      "description": "Understand normal flow and basic layout concepts.",
      "summary": "Learn how elements naturally flow on a page.",

      "rank": 1,
      "order": 1,

      "duration": "30 minutes",
      "level": "Beginner",

      "tags": [
        "CSS",
        "Layout",
        "Flow"
      ],

      "objectives": [
        "Understand normal flow",
        "Understand block and inline elements",
        "Understand box dimensions"
      ],

      "prerequisites": [
        "Basic HTML"
      ],

      "resources": [],

      "homework": {
        "title": "Layout Foundations Challenge",
        "description": "Build a simple page layout.",

        "hints": [
          "Start with semantic HTML.",
          "Inspect the page in the live preview."
        ],

        "tasks": [
          {
            "id": "foundation-structure",
            "title": "Build the page structure",
            "description": "Create the required HTML structure.",

            "checks": [
              {
                "type": "contains",
                "file": "index.html",
                "value": "<main"
              }
            ]
          }
        ]
      }
    },

    {
      "id": "flexbox",
      "path": "02-flexbox",
      "title": "Flexbox",
      "description": "Learn one-dimensional layout with Flexbox.",

      "rank": 2,
      "duration": "45 minutes",

      "tags": [
        "CSS",
        "Flexbox"
      ],

      "objectives": [
        "Create a flex container",
        "Align items",
        "Control spacing"
      ],

      "prerequisites": [
        "layout-foundations"
      ],

      "homework": {
        "title": "Flexbox Challenge",
        "description": "Create a responsive Flexbox layout.",

        "hints": [
          "Start with display: flex.",
          "Then experiment with justify-content.",
          "Finally check align-items."
        ],

        "tasks": [
          {
            "id": "flex-container",
            "title": "Create a flex container",
            "description": "Use Flexbox on the parent element.",

            "checks": [
              {
                "type": "css_property",
                "file": "style.css",
                "property": "display",
                "value": "flex"
              }
            ]
          }
        ]
      }
    },

    {
      "id": "grid",
      "path": "03-grid",
      "title": "CSS Grid",
      "description": "Build two-dimensional layouts using CSS Grid.",

      "rank": 3,
      "duration": "60 minutes",

      "tags": [
        "CSS",
        "Grid",
        "Responsive Design"
      ],

      "objectives": [
        "Create a grid container",
        "Define columns",
        "Build responsive grids"
      ],

      "prerequisites": [
        "flexbox"
      ],

      "homework": {
        "title": "CSS Grid Challenge",
        "description": "Create a responsive grid layout.",

        "hints": [
          "Start with display: grid.",
          "Define the columns next.",
          "Use a media query for small screens."
        ],

        "tasks": [
          {
            "id": "grid-container",
            "title": "Create the grid",
            "description": "Turn the parent element into a grid.",

            "checks": [
              {
                "type": "css_property",
                "file": "style.css",
                "property": "display",
                "value": "grid"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

Supported homework checks include `contains`, `not_contains`, `regex`, `min_length`, `html_elements`, `css_property`, `files_exist`, and nested `all` / `any` groups.

### Blogs

Use the same metadata fields where useful. Put the article in `article.md`. `README.md` also works.

## Nested class / subtopic system

A class can contain a ranked learning roadmap. The system supports automatic folder discovery and an explicit metadata manifest.

Recommended structure:
Classes / 02-css-layout / metadata.json, index.html, styles.css, then topic folders such as 01-foundations, 02-flexbox and 03-grid.

Each topic folder is detected when it contains metadata.json, README.md, index.html, or HTML/CSS/Markdown files. Common asset folders such as assets, images, media, public, static and src are ignored as topics.

Parent metadata accepts subclasses, subtopics, modules, or children arrays. Each entry can use id, path, title, description, rank or order, and its own homework.hints and homework.tasks.

Example topic entry:
subclasses: [{ id: flexbox, path: 02-flexbox, title: Flexbox, rank: 2 }]

The build normalizes these entries into subclasses, sorts them by rank/order, supports nested topics, and automatically scopes a topic's homework file checks to that topic folder.

The student workspace shows a Class roadmap above the file explorer. Students can switch between Class overview and ranked topics. Each topic can have its own files, tasks, hints and progress. The full class ZIP and edited ZIP continue to include the complete original package.
## GitHub setup

1. Put this project in your repository.
2. Put classes in `Classes/` and blog folders in `Blogs/`.
3. In **Settings → Secrets and variables → Actions → New repository secret**, create:

`CLASS_ACCESS_PASSWORD`

Use a strong password. The workflow uses it only during the build to encrypt the catalog and packages. GitHub Actions secrets are encrypted in GitHub and are only exposed to a workflow when the workflow references them.

4. Optional: create an Actions variable named `SITE_URL` with your Pages URL. If omitted, the build uses a placeholder URL in the generated sitemap.
5. In **Settings → Pages**, set the publishing source to **GitHub Actions**. The workflow uses GitHub's Pages deployment actions to build and publish the generated `dist/` directory.
6. Push to `main`. The workflow builds and deploys automatically.

## Security reality you should know

The published website does not expose the plaintext class files. It only publishes encrypted catalog/package blobs. However, if this repository is public, the original files inside the Git repository are still public. GitHub Pages is static hosting and does not provide a server-side password wall. Repository visibility and Pages availability also depend on your GitHub plan.

For **true confidentiality of the source material**, keep the content repository private and have the build workflow read that private repository using a narrowly scoped credential (or use a plan/setup that supports a private Pages source). Do not put the raw class repository in public Git history and assume the browser password hides it.

## Local testing

Run:

```bash
CLASS_ACCESS_PASSWORD=demo-only-change-me node scripts/build.mjs
python -m http.server 4173 -d dist
```

Open `http://localhost:4173` and use `demo-only-change-me`. Never use that password for real students.

## Design principles

Minimal interface, subtle infinite-loop motion, restrained mentor branding, keyboard-friendly controls, responsive layout, progressive enhancement, local-first persistence and graceful fallbacks.

# Mentor Obaidul Web Lab

A GitHub Pages-ready, file-driven Web Development learning and coding lab.

## How the system works

The repository has three important areas:

```text
classes/                  ← teacher content: add/edit classes here
src/                      ← website source code
.github/workflows/        ← automatic GitHub Pages deployment
site.config.json          ← personal branding and site settings
```

A class is simply a folder inside `classes/`.

```text
classes/
└── 003-css-grid/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    ├── assets/
    │   ├── image.webp
    │   └── demo.mp4
    └── class.json         # optional
```

`class.json` is optional. If it is missing, the build system creates sensible defaults from the folder name and available files.

## Add a class from GitHub.com

1. Open the repository on GitHub.
2. Open `classes/`.
3. Upload the complete new class folder and its assets.
4. Commit the change to `main`.
5. GitHub Actions automatically validates, builds and deploys the site.

You do not need to create a new HTML page for the class.

## Optional `class.json`

```json
{
  "id": "003-css-grid",
  "title": "CSS Grid",
  "description": "Build responsive layouts with CSS Grid.",
  "category": "CSS",
  "level": "Beginner",
  "duration": "45 min",
  "tags": ["CSS", "Grid", "Responsive"],
  "entry": "index.html"
}
```

## Student workflow

Students can:

- browse and search classes
- read lesson notes from a class `README.md` when provided
- open the project file tree
- edit supported text source files in the browser
- use syntax highlighting, completion, folding, search and shortcuts
- preview the project in a sandboxed live preview
- autosave edits locally in the browser
- reset back to the teacher's original files
- create additional text source files for experiments
- download the original project as ZIP
- download their edited version as ZIP

Student edits are local to their browser. They are not written back to the teacher's GitHub repository.

## GitHub Pages setup

Repository → **Settings** → **Pages** → **Build and deployment** → **Source** → **GitHub Actions**.

After a successful Actions run, GitHub shows the live Pages URL in the deployment/environment details.

## Branding

Edit `site.config.json` to change your name, brand, role, tagline, social links, logo and other public-facing settings.

## Important architecture rule

`dist/` is generated output. Do not manually edit it. GitHub Actions recreates it on every deployment.

# Obaidul Mentor Lab

Student-first HTML and CSS learning platform.

## Your workflow

Put a class project **folder or ZIP** in `Classes/`. You do not need to build the catalog manually.

On every push to main, GitHub Actions:
1. scans Classes and Blogs;
2. reads metadata.json when present;
3. falls back to README/article/index.html when metadata is missing;
4. infers common tags from folder and file names;
5. packages each class/blog as a ZIP;
6. generates a searchable catalog with tags and levels;
7. verifies every generated ZIP;
8. deploys the generated `dist/` site to GitHub Pages.

## Student experience

Students can:
- browse Classes and Blogs;
- search classes;
- filter classes by automatically inferred or supplied tags and level;
- open a real project file tree;
- edit HTML/CSS/JS with Monaco or the fallback editor;
- see an immediate sandboxed live preview;
- complete automated homework checks;
- use mentor hints;
- download the original project ZIP or their edited ZIP.

## Class folder structure

A typical class can look like:

`Classes/02-css-flexbox/`
- `index.html`
- `styles.css`
- `assets/`
- optional `metadata.json`
- optional `README.md`

A ZIP with the same internal structure is supported. The build system preserves that structure inside the generated class ZIP.

## Metadata

`metadata.json` is optional.

Supported fields include:
- `id`
- `title`
- `description`
- `summary`
- `level`
- `duration`
- `tags`
- `order`
- `featured`
- `homework.hints`
- `homework.tasks` with automated checks

When fields are omitted, the builder derives sensible defaults from filenames, README headings and HTML titles/headings.

## Owner editor

Open `editor.html` from the footer to:
- edit footer and branding values;
- download a new `site-config.json`;
- select a local class folder;
- infer a title and tags;
- generate `metadata.json`;
- generate a ready-to-upload class ZIP.

Commit the generated files/folders to `Classes/` and the normal GitHub Actions pipeline publishes them.

## Deployment

GitHub Pages is deployed from the generated `dist/` directory by GitHub Actions. No repository secret is required for the public content pipeline.

## Source privacy

Because the repository is public, files committed under `Classes/` and `Blogs/` are publicly visible on GitHub. The generated Pages site also exposes the learning content by design. Use a private content repository and a deployment setup with appropriate access if the class source must remain private.

## Local usage

Serve the repository through localhost or GitHub Pages. Monaco and browser file APIs work most reliably over HTTP(S) rather than opening the HTML file directly from disk.
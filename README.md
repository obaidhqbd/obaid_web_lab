# Obaidul Mentor Lab

Student-first HTML and CSS learning platform.

## Your workflow

Put a class project **folder or ZIP** in `Classes/`. You do not need to manually build a web catalog.

On every push to main, GitHub Actions:
1. scans Classes and Blogs;
2. reads metadata when present;
3. automatically falls back to README/title/index.html when metadata is missing;
4. infers common tags from folder and file names;
5. packages each class/blog as ZIP;
6. encrypts the catalog/packages during the build;
7. generates the searchable tag/level catalog;
8. verifies the generated resources;
9. deploys dist/ to GitHub Pages.

## Student experience

Students can:
- browse Classes, search and filter by tags/level;
- unlock the class library in the browser;
- open the real project file tree;
- edit HTML/CSS/JS with Monaco or the fallback editor;
- see an immediate sandboxed live preview;
- complete automatic homework checks;
- use mentor hints;
- download the original project ZIP or their edited ZIP;
- read mentor Blogs.

## Owner editor

Open editor.html from the footer to edit the footer/branding and download a new site-config.json. The same panel can scan a local class folder and generate metadata.json or a ready-to-upload class ZIP.

## Required GitHub setup

Create an Actions repository secret named CLASS_ACCESS_PASSWORD. Optionally create an Actions variable named SITE_URL. Set GitHub Pages publishing to GitHub Actions.

## Security reality

The built Pages artifact contains encrypted catalog/package blobs, but a public GitHub repository still contains raw source files under Classes/ and Blogs/. If the raw source must be private, keep the content repository private and use a deployment setup that can read it.
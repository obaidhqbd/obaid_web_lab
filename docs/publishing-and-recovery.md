# Publishing and recovery guide

## Add a class

Put a folder inside content/classes/. Its files are indexed automatically. You do not need to edit the website JavaScript or catalogue.

Recommended structure:

    content/classes/JavaScript-Foundations/
      README.md
      index.html
      style.css
      examples/
        variables.js

README.md or index.md becomes the human-readable overview when present. index.html, main.html and build.html can be selected in the file list for a live preview. The catalogue scans nested folders and shows them as subtopics.

## Add a study note

Add a Markdown, HTML or text file directly under content/blogs/, or make a folder with an overview file and any images/assets beside it. A heading, HTML title or filename supplies a title if metadata is omitted.

Optional folder metadata belongs in metadata.json. Use valid JSON with title, description, category, tags and an optional YYYY-MM-DD date.

## Upload a ZIP archive

A ZIP placed anywhere under content/classes/ or content/blogs/ is extracted in the build workspace and indexed alongside regular folders. Source archives are never changed. The builder ignores hidden paths and parent-directory traversal, limits archive entry counts and skips oversized entries.

## If a resource is missing

1. Confirm the files were committed to the main branch and are under content/classes/ or content/blogs/.
2. Give folders at least one real file. Git does not track empty folders, and the catalogue skips empty collections.
3. Open the latest Build and deploy student library workflow in Actions. A bad individual item is logged as a warning; a failed site check prevents the new artifact from deploying.
4. If the primary generated catalogue is unavailable, the site tries the visitor's last saved catalogue, the backup catalogue and the bundled starter catalogue. The fallback keeps the interface usable, though a stale fallback may not contain your newest upload.

## First Pages setup

The workflow deploys the main branch using GitHub Actions. If the repository has never published with Actions, select Settings, then Pages, then Build and deployment, then GitHub Actions as the source. The workflow needs Pages write and OIDC permissions.

The website is static. Saved items and recently opened resources are stored separately in each student's browser; this build does not create student accounts or shared progress tracking.
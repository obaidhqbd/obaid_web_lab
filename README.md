# Obaid Web Lab — Student OS + Portfolio

A browser-first, automation-first personal workspace for Mohammed Obaidul Hoque, combining study, coding, class resources, analytics, marketing, projects and a professional portfolio in one site.

## Main modules

- Command Center with live daily queue, deadlines and automation feed
- Study System with subject priorities, automatic daily planning, focus timer, streaks and study analytics
- **Class Files / Class Vault** with multi-file upload for PDF, DOC/DOCX, PPT/PPTX, spreadsheet, ZIP/RAR/7Z, images, text and video
- Class-file search, subject filters, type filters, preview/download/delete actions
- IndexedDB storage for uploaded binary files so they do not depend on localStorage
- Source-first Web Lab with separate HTML/CSS/JS files, autosave, isolated preview, snapshots, imports and standalone project download
- Assignments & Tasks linked to daily planning
- Notes & Knowledge
- Projects
- Digital Marketing console and SEO checklist
- Analytics and weekly review
- Resource library
- Automation Center
- **Integrated personal workspace portfolio**
- **Public portfolio page** at portfolio.html
- PWA shell and offline cache
- Dark/light theme and responsive mobile navigation
- GitHub Pages deployment
- CI syntax/JSON validation workflow

## Class Vault data model

Uploaded files are stored in the browser's IndexedDB database ObaidWebLabClassVault. File metadata includes original filename, MIME type, size, subject, class title, tags and upload date.

This means the current static version does not upload private class files to a server. Files remain on the device/browser that uploaded them. Use the workspace backup/export separately for the app's structured data; binary class files remain in the browser vault.

## Automation

Local browser automations connect the workflow:

1. Inputs -> subjects, priorities and deadlines.
2. Planner -> generates today's study blocks and tasks.
3. Focus timer -> logs completed sessions.
4. Analytics -> recalculates streaks and study activity.
5. Deadline Watch -> detects urgent deadlines.
6. Smart Capture -> routes quick text into tasks, notes, ideas or learning items.
7. Backup routine -> exports workspace data or a standalone Web Lab project.
8. Notifications -> optional browser reminders while the app is open.
9. Webhook -> optional external event delivery; keep private secrets on a server.

## Portfolio

The public portfolio is designed to present:

- Mohammed Obaidul Hoque
- Web development
- Data analytics
- Digital marketing
- Selected projects
- Skills
- GitHub link
- Entry back into the Student OS

## Deploy

Enable GitHub Pages with **GitHub Actions** as the publishing source. The included workflow deploys the static site on pushes to main.

## Local usage

Open index.html directly or serve the repository from a local/static web server. Some browser APIs, especially PWA installation, service workers and notification behavior, work best under HTTPS or localhost.
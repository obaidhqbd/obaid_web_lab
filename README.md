# Obaid Web Lab — Student OS

A browser-first, automation-first personal workspace built around Mohammed Obaidul Hoque's recurring workflows: HSC study, web development, data analytics, digital marketing and project building.

## Core product

- Command Center with live daily queue, deadlines and automation feed
- Study System with subject priorities, automatic daily planning, focus timer, streaks and study analytics
- Source-first Web Lab with separate HTML/CSS/JS files, autosave, isolated live preview, snapshots, import and standalone project download
- Assignments & Tasks linked to the daily planner
- Notes & Knowledge with quick capture and instant search
- Project portfolio
- Digital Marketing console
- Curated resources
- Automation Center with planner, deadline watch, study logging, smart capture, backup and notifications
- Optional webhook event delivery
- PWA shell and offline cache
- Dark/light mode and responsive mobile navigation
- GitHub Pages deployment on every push to main

## Automation model

The browser owns the user's workspace state. Repetitive actions are automated locally:
1. Inputs -> subjects, priorities, deadlines and daily minutes.
2. Planner -> creates today's study blocks and tasks.
3. Focus timer -> logs completed sessions automatically.
4. Analytics -> recalculates streaks, completion and activity.
5. Deadline watch -> detects urgent items and surfaces them.
6. Smart capture -> routes natural notes into tasks / ideas / study notes.
7. Backup -> exports workspace JSON or a standalone Web Lab build.

Browser notification permissions are optional. A webhook can be configured for external workflow tools, but secrets should never be stored in the client.

## Deploy

Enable GitHub Pages with **GitHub Actions** as the publishing source. The included workflow follows GitHub's current custom workflow pattern for Pages deployment.
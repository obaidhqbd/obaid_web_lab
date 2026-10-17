---
title: CSS Specificity, Made Simple
description: Learn how the browser chooses which CSS rule wins, with student-friendly examples.
category: Web Development
tags: CSS, Beginner, Study Notes
date: 2026-10-17
---

# CSS Specificity, Made Simple

When more than one CSS rule targets the same element, the browser compares **specificity** to decide which declaration wins. Specificity is not simply based on which rule appears last.

## The usual order

For normal author CSS, compare the selector's specificity in this order:

1. **ID selectors** — such as #header.
2. **Class, attribute and pseudo-class selectors** — such as .card, [disabled] and :hover.
3. **Element and pseudo-element selectors** — such as h1 and ::before.

A selector can be thought of as a three-part score: IDs, classes/attributes/pseudo-classes, then elements/pseudo-elements. Compare from left to right; a larger number in an earlier column takes priority. For example, #page .card is more specific than .card h2 because the first selector contains an ID.

## Example

    p { color: #555; }
    .notice { color: #176b44; }
    #welcome { color: #275ac7; }

If one paragraph has both class notice and ID welcome, the ID selector wins among these normal rules.

## Important reminders

- The universal selector (*) and combinators do not add specificity by themselves.
- A comma-separated selector list calculates specificity separately for each selector.
- Inline styles generally outrank normal selector rules; important declarations have their own cascade priority.
- !important is not an infinite specificity score. It changes cascade priority, and should be used sparingly.
- When specificity is equal, the rule that wins later in the cascade is applied, with source order being a common tie-breaker.

## Quick practice

Which selector is more specific: .note strong or #main strong?

The second one wins because it contains an ID selector. Count the selector components, compare the ID column first, and only then compare the other columns.

Keep practising by changing the selectors in your own class files and observing which declaration takes effect.
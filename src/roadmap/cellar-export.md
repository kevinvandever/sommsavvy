---
name: Cellar Export
status: planned
effort: quick
description: Export your full cellar as a beautiful editorial PDF or a clean CSV — ready to archive, share with a wine merchant, or import elsewhere.
---

Your cellar is yours. The export gives users a complete copy of their data in two forms: a beautifully typeset PDF that looks like a private cellar list from a serious collector, and a clean CSV for anyone who wants to work with their data elsewhere.

## What it looks like

- A single "Export" option in the profile page under the cellar section.
- Two format buttons: "Export as PDF" and "Export as CSV."
- The PDF is an editorial document: Rowan headers, clean table rows with all fields, the user's taste summary as a preface, and a generation date. It should look like something a wine merchant would hand over, not a spreadsheet export.
- The CSV includes all fields: name, kind, producer, region, vintage, ABV, tasted date, saved date, source, and notes.
- On mobile, the download triggers the native share sheet. On desktop, a direct file download.

## Key details

- Both formats include all of the user's cellar entries, unfiltered. Future versions may allow filtered exports (e.g., "export only wines").
- The PDF uses server-side rendering — consistent look regardless of the user's device or browser.
- Exports are generated on demand, not cached. For large cellars (200+ entries) a brief "Preparing your cellar" spinner is shown.
- Photo URLs are referenced in the PDF but images are not embedded (keeps file sizes manageable).

~~~
New method: exportCellar({ format: 'pdf' | 'csv', userId }). Requires auth. Reads all of the user's cellar entries via listCellar (no filters, high limit). For CSV: builds a plain text response with proper headers. For PDF: uses a server-side template (either a headless HTML-to-PDF approach via a mindstudio integration, or a structured template with the platform's document generation capability). Returns a signed temporary URL to the generated file. The frontend polls or awaits the URL and triggers the download.
~~~

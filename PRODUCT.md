# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML + CSS + vanilla JavaScript (ES modules), no build step. Only allowed libraries, as local copies in `vendor/`: Chart.js (charts), SheetJS CE 0.20.3 (xlsx export) and, added later with the user's approval, Tesseract.js 7.0.0 (reads the tablet photo on the device, about 6 MB downloaded once per device). Installable PWA hosted on Cloudflare Pages (own domain, published from the Mac with `npm run pubblica`), data in IndexedDB. Decided in `prompt_app_interventi_118.md`.

## Users

A single user: a 118 emergency nurse (Piemonte, Italy) who logs their own ambulance and helicopter missions. They register each mission right after it closes, one at a time, in the ambulance or back at base, usually one-handed on an iPhone and often at night. They also use a Mac (Safari) to review, export and back up.

## Product Purpose

Replaces the Excel workbook `Report Interventi 118 2026 v3.xlsx` as the personal log of missions. Success: entering a mission takes seconds from the phone, no record is ever lost, and the statistics match the Excel ones exactly.

## Positioning

Personal, offline, private: the data never leaves the device except through an explicit backup file the user saves to iCloud Drive. No account. The only network call, made only when the user asks a question in "Fai una domanda", sends the question text, the list values and the distinct municipality names to the app's Cloudflare Worker, which has Claude translate it into a query; the answer is computed on the device and no record ever leaves it.

## Operating Context

- One record = one mission/patient, with the fields of the Excel "Interventi" sheet (date, alert time, mission code, municipality, vehicle, India/Mike type, dispatch code/pathology/place, age, sex, outcome, hospital, on-scene code/pathology/place, free-again time).
- Colour codes VERDE < GIALLO < ROSSO (NERO only on scene) are the core vocabulary of 118 triage.
- Data moves between iPhone and Mac through JSON files on iCloud Drive, merged by record id. Files have a fixed name per device (interventi118_iPhone.json, interventi118_Mac.json) so they overwrite instead of piling up; there is deliberately no automatic or cloud backup, because the app will be used by other nurses and no shared storage is acceptable.
- Pseudonymised health data: no names, no identifiers beyond the mission code.

## Capabilities and Constraints

- Quick entry form, chronological list with search and filters, live statistics (6 KPIs, 12 tables, 6 charts) on a selectable period, settings with editable lists, JSON backup/merge, xlsx export.
- "Foto tablet" on the new-mission form: a photo of the SaveOnBoard "Missione" screen is read on the device and fills the fields it can read (highlighted "dalla foto", the rest listed as "Non letti"); nothing is guessed, the photo is never saved and never leaves the device.
- "Fai una domanda" at the top of Statistics: a free question in Italian becomes a JSON query (Claude via the Worker, protected by a passphrase kept in Cloudflare secrets), executed on the device with the Statistics definitions; one clarifying question at most, no history saved.
- Must work fully offline after first load (questions excepted: they need the network and say so); no other network calls, analytics, external fonts or CDNs.
- Italian UI, mobile-first (~390px), usable at 1440px, dark mode.
- Out of scope: login, accounts, a backend holding data, notifications, extra features.

## Evidence on Hand

- 212 real missions (Jan–Oct 2026) in the Excel file, kept out of git in `data/`. Screenshots and demos must use invented data.
- The Excel "Statistiche" sheet is the reference for every statistic.

## Product Principles

1. Speed of entry beats completeness: no field is mandatory except DATA or MISSIONE.
2. Never lose data: local persistence, logical deletion, backup reminders, merge instead of overwrite.
3. Same numbers as the Excel: definitions are copied, not reinterpreted.
4. Privacy by default: nothing leaves the device unless the user exports it; a question sends only its own text, list values and municipality names.

## Accessibility & Inclusion

One-handed thumb use, large touch targets, readable in a dark ambulance at night (dark mode), colour codes always paired with their text label.

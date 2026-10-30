# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML + CSS + vanilla JavaScript (ES modules), no build step. Only allowed libraries, as local copies in `vendor/`: Chart.js (charts) and SheetJS CE 0.20.3 (xlsx export). Installable PWA hosted on GitHub Pages, data in IndexedDB. Decided in `prompt_app_interventi_118.md`.

## Users

A single user: a 118 emergency nurse (Piemonte, Italy) who logs their own ambulance and helicopter missions. They register each mission right after it closes, one at a time, in the ambulance or back at base, usually one-handed on an iPhone and often at night. They also use a Mac (Safari) to review, export and back up.

## Product Purpose

Replaces the Excel workbook `Report Interventi 118 2026 v3.xlsx` as the personal log of missions. Success: entering a mission takes seconds from the phone, no record is ever lost, and the statistics match the Excel ones exactly.

## Positioning

Personal, offline, private: the data never leaves the device except through an explicit backup file the user saves to iCloud Drive. No account, no server.

## Operating Context

- One record = one mission/patient, with the fields of the Excel "Interventi" sheet (date, alert time, mission code, municipality, vehicle, India/Mike type, dispatch code/pathology/place, age, sex, outcome, hospital, on-scene code/pathology/place, free-again time).
- Colour codes VERDE < GIALLO < ROSSO (NERO only on scene) are the core vocabulary of 118 triage.
- Data moves between iPhone and Mac through JSON files on iCloud Drive, merged by record id.
- Pseudonymised health data: no names, no identifiers beyond the mission code.

## Capabilities and Constraints

- Quick entry form, chronological list with search and filters, live statistics (6 KPIs, 12 tables, 6 charts) on a selectable period, settings with editable lists, JSON backup/merge, xlsx export.
- Must work fully offline after first load; no network calls, analytics, external fonts or CDNs.
- Italian UI, mobile-first (~390px), usable at 1440px, dark mode.
- Out of scope: login, accounts, backend, notifications, extra features.

## Evidence on Hand

- 212 real missions (Jan–Oct 2026) in the Excel file, kept out of git in `data/`. Screenshots and demos must use invented data.
- The Excel "Statistiche" sheet is the reference for every statistic.

## Product Principles

1. Speed of entry beats completeness: no field is mandatory except DATA or MISSIONE.
2. Never lose data: local persistence, logical deletion, backup reminders, merge instead of overwrite.
3. Same numbers as the Excel: definitions are copied, not reinterpreted.
4. Privacy by default: nothing leaves the device unless the user exports it.

## Accessibility & Inclusion

One-handed thumb use, large touch targets, readable in a dark ambulance at night (dark mode), colour codes always paired with their text label.

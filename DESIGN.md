---
name: Interventi 118
description: Personal offline log of 118 emergency missions, built as a stack of triage tags.
colors:
  stock: "#eeece6"
  stock-2: "#e3e0d7"
  carta: "#fbfaf7"
  inchiostro: "#17140f"
  inchiostro-2: "#4d473b"
  linea: "#cbc5b7"
  linea-forte: "#8f877a"
  banda: "#15130f"
  banda-2: "#2a2620"
  banda-testo: "#f4f1ea"
  banda-testo-2: "#b4ad9f"
  chip-fondo: "#dedad0"
  chip-fondo-hover: "#d4cfc3"
  avviso-fondo: "#f3e3c4"
  avviso-testo: "#6b4300"
  errore-fondo: "#f6d9d5"
  errore-testo: "#8e1612"
  verde: "#1b7a3e"
  verde-testo: "#ffffff"
  verde-strappo: "#1b7a3e"
  giallo: "#f2c230"
  giallo-testo: "#1d1705"
  giallo-strappo: "#765600"
  rosso: "#c8201e"
  rosso-testo: "#ffffff"
  rosso-strappo: "#b01c1a"
  nero: "#15130f"
  nero-testo: "#f4f1ea"
  nero-strappo: "#15130f"
  stock-notte: "#151310"
  stock-2-notte: "#1d1a16"
  carta-notte: "#221f1a"
  inchiostro-notte: "#f1ece2"
  inchiostro-2-notte: "#b8af9f"
  linea-notte: "#3a352d"
  linea-forte-notte: "#6b6457"
  banda-notte: "#0a0907"
  banda-2-notte: "#1f1c17"
  banda-testo-notte: "#f1ece2"
  banda-testo-2-notte: "#9c9485"
  chip-fondo-notte: "#302b24"
  chip-fondo-hover-notte: "#3a342c"
  avviso-fondo-notte: "#3a2c12"
  avviso-testo-notte: "#f0c97a"
  errore-fondo-notte: "#3d1714"
  errore-testo-notte: "#ffb4ab"
  verde-notte: "#26914d"
  verde-strappo-notte: "#5cc283"
  rosso-notte: "#d93a33"
  rosso-strappo-notte: "#ff8a80"
  nero-notte: "#000000"
  nero-strappo-notte: "#f1ece2"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.08em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.4
  code-word:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 800
    letterSpacing: "0.07em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.07em"
  label-small:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  raggio: "8px"
  segmento: "6px"
  mini: "4px"
  cod: "3px"
  dialogo: "12px"
spacing:
  gutter: "16px"
  gutter-schermo: "32px"
  campo: "14px"
  colonne: "48px"
  rail: "232px"
  h-schede: "58px"
components:
  button-primary:
    backgroundColor: "{colors.banda}"
    textColor: "{colors.banda-testo}"
    rounded: "{rounded.raggio}"
    height: "48px"
    padding: "0 16px"
  button-primary-salva:
    backgroundColor: "{colors.banda}"
    textColor: "{colors.banda-testo}"
    rounded: "{rounded.raggio}"
    height: "54px"
  button-secondary:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    height: "48px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.stock-2}"
  input:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    height: "48px"
    padding: "0 12px"
  chip:
    backgroundColor: "{colors.chip-fondo}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    height: "44px"
    padding: "8px 14px"
  chip-hover:
    backgroundColor: "{colors.chip-fondo-hover}"
  chip-selected:
    backgroundColor: "{colors.banda}"
    textColor: "{colors.banda-testo}"
  striscia-verde:
    backgroundColor: "{colors.verde}"
    textColor: "{colors.verde-testo}"
    typography: "{typography.code-word}"
    height: "58px"
  striscia-giallo:
    backgroundColor: "{colors.giallo}"
    textColor: "{colors.giallo-testo}"
    typography: "{typography.code-word}"
    height: "58px"
  striscia-rosso:
    backgroundColor: "{colors.rosso}"
    textColor: "{colors.rosso-testo}"
    typography: "{typography.code-word}"
    height: "58px"
  striscia-nero:
    backgroundColor: "{colors.nero}"
    textColor: "{colors.nero-testo}"
    typography: "{typography.code-word}"
    height: "58px"
  mini-strappo-rientro:
    typography: "{typography.label-small}"
    rounded: "{rounded.mini}"
    padding: "4px 7px 3px"
  cod:
    typography: "{typography.label-small}"
    rounded: "{rounded.cod}"
    padding: "3px 6px 2px"
  banda:
    backgroundColor: "{colors.banda}"
    textColor: "{colors.banda-testo}"
    padding: "12px 16px"
  scheda:
    backgroundColor: "{colors.banda}"
    textColor: "{colors.banda-testo-2}"
    height: "{spacing.h-schede}"
  scheda-active:
    textColor: "{colors.banda-testo}"
---

# Design System: Interventi 118

## Overview

**Creative North Star: "The Triage Tag"**

Every record is a printed triage tag. The ground is tag stock: a warm, slightly yellowed card by day (stock) and a warm charcoal at night (stock-notte). The tag's black band is the app shell: the header and the tab bar (a left rail on screens) are one solid band of near-black ink. On that stock, the four START colours VERDE, GIALLO, ROSSO and NERO are the only saturated colours that carry meaning, and each always appears with its word printed on it. The colour code is the fastest thing to set and the first thing read back.

The world is dense and practical. Labels are bold, uppercase, tracked system sans, like the printed field names on a tag; times, ages, mission codes and every statistic use tabular numerals. The one ornament is the perforation: dashed rules that separate the tag's sections and the joints of the code strips. There are no cards, no illustrations and no decorative colour. It replaces the generic white medical form with one blue accent and rounded cards.

Night is a first-class mode, not an inversion afterthought: the stock darkens, primary plates flip to light ink on dark, and code colours shift to brighter, legible tear-off tones.

**Key Characteristics:**
- Warm tag stock ground, black band shell, no neutral grey.
- Four START colours as the only meaningful saturated colours, always with their word.
- Bold uppercase tracked labels; tabular numerals for every number.
- Dashed perforations as the only ornament and the main separator.
- The tear-off code strip as the signature, at full size in the form and in miniature everywhere else.

## Colors

A warm, tinted neutral stock and ink pair, a black band, and four triage colours that are the only saturation on screen.

### Primary
- **Banda Black** (banda): the shell. Header, tab bar and desktop rail, the primary "Salva" plate, selected chips and open filter toggles. At night the shell darkens further (banda-notte) while primary plates and selected chips invert to light ink (inchiostro-notte) with stock text, so the reversed plate stays the brightest object.

### Secondary: the four START colours
- **Verde** (verde): VERDE code, minor urgency.
- **Giallo** (giallo): GIALLO code, medium urgency. Takes dark text (giallo-testo).
- **Rosso** (rosso): ROSSO code, high urgency.
- **Nero** (nero): NERO code, only on scene. At night it gets a linea-forte outline so it stays visible on the charcoal stock.
- Each colour has three roles: the fill, the text on that fill (`-testo`), and the text used when the strip is torn off and only its outline remains (`-strappo`). Giallo's tear-off text darkens to a bronze (giallo-strappo) by day so the word stays readable on stock; at night the tear-off tones brighten (verde-strappo-notte, rosso-strappo-notte, nero-strappo-notte).

### Neutral
- **Tag Stock** (stock): the page ground on every screen, also the KPI and chart ground and the colour that perforation dashes are cut with.
- **Pressed Stock** (stock-2): hover and active fill for rows and secondary buttons, the segmented-control track, loading placeholders.
- **Paper** (carta): inside text inputs, secondary buttons, the segmented control's selected segment, dialogs, computed-value grids.
- **Ink** (inchiostro): body text, focus ring, chart bars.
- **Faded Ink** (inchiostro-2): field labels, secondary text, chart axes and legends.
- **Rule** (linea): input outlines, row dividers, dashed perforations, chart gridlines.
- **Strong Rule** (linea-forte): secondary button outline, table header and footer rules, the NERO outline at night.
- **Chip Card** (chip-fondo, chip-fondo-hover): the filled ground of unselected choice chips.
- **Band Text** (banda-testo, banda-testo-2): text on the band; the dimmer one for inactive tabs and subtitles.
- **Notice and error tints** (avviso-fondo/avviso-testo, errore-fondo/errore-testo): backup reminder strip, warnings, validation errors and destructive buttons.

### Named Rules
**The Word With The Colour Rule.** A START colour never appears without its word (VERDE, GIALLO, ROSSO, NERO) printed on or beside it. Charts that use the colours label each bar with the code name.

**The Four Colours Only Rule.** VERDE, GIALLO, ROSSO and NERO are the only saturated colours that carry meaning. Everything else is tinted from the stock or the band; never introduce a brand accent or a neutral grey.

**The Chiaro Invio, Pieno Rientro Rule.** Wherever invio and rientro appear together, invio is light (a tint of its colour) and rientro is full colour. This holds in the mini strip and in every invio/rientro chart.

## Typography

**Display Font:** none; the system sans carries every role.
**Body Font:** system sans (-apple-system, SF Pro Text, system-ui, Segoe UI, Roboto, sans-serif)

**Character:** One family at heavy weights, like the print on a field tag: 800 for headings and code words, 700 for labels, 400 for what the user typed. Offline by constraint: no web fonts.

### Hierarchy
- **Numeral** (800, 2rem, 1.1, -0.02em, tabular): KPI values. The list's day number uses the same voice at 1.375rem.
- **Headline** (800, 1.25rem, 1.15, -0.01em): the screen title in the band; empty-state titles.
- **Title** (800, 1.0625rem, 0.08em, uppercase): form section headings (IDENTIFICAZIONE, MEZZO, INVIO CO). Settings blocks, month headings and the tables heading use a smaller tracked variant (800, 0.8125rem, 0.1 to 0.12em, uppercase). Chart and table titles are 800, 0.9375rem, sentence case.
- **Body** (400, 1.0625rem, 1.4): inputs and running text; explanatory paragraphs capped at 65ch.
- **Code Word** (800, 0.9375rem, 0.07em, uppercase): the words on the code strip.
- **Label** (700, 0.75rem, 0.07em, uppercase): field labels above every input.
- **Label Small** (800, 0.6875rem, 0.06em, uppercase): mini strip, code tags, KPI terms, table headers; the mobile tab labels use 700 at 0.04em.

### Named Rules
**The Tabular Rule.** Every time, date, age, mission code, count and percentage uses tabular numerals so columns of tags line up.

**The Printed Field Rule.** Field names are uppercase, bold and tracked; values the user writes are sentence case at regular weight. The contrast between printed field and handwritten value is the form's legibility.

## Layout

Mobile first at 390px, one column with a 16px gutter (gutter). The band is sticky at the top; the tab bar is fixed at the bottom (58px, h-schede) with four equal tabs; on the entry form a sticky action bar ("Svuota" plus the full-width "Salva intervento" plate, 54px) sits on stock directly above the tab bar, separated by a 1px rule.

At 960px and above the tab bar becomes a 232px left rail (rail) carrying the app name; content pads to 32px (gutter-schermo) with a 1240px max width. The entry form flows into two CSS columns with a 48px gap (colonne), sections never broken across columns. Statistics charts and tables go to two columns; KPIs go to 3 columns at 700px and 6 at 1200px.

Field rhythm is 14px between fields (campo), 12px between paired fields. Shortcut chips adapt to width: phones show 3 frequent values plus an inline "Altro…" select chip on the same row; at 480px and up, 4 values.

**The Bottom Perforation Rule.** A section's dashed perforation sits on its bottom edge, never its top, so the last section has none and a section that lands at the top of a desktop column has no rule above it. Statistics blocks (KPIs, each chart, the tables heading, settings blocks) follow the same idea from the top: one dashed rule between blocks, none on the first.

## Elevation & Depth

Flat. Depth is carried by the band against the stock and by tint steps (stock, stock-2, carta). Shadows exist only on things that lift off the tag: the selected code strip, the floating toast, the dialog, and the selected segment of the period control.

### Shadow Vocabulary
- **Strip lift** (`box-shadow: 0 3px 10px rgb(0 0 0 / .18)`): the chosen code strip, which stays while the others are torn off.
- **Segment** (`box-shadow: 0 1px 3px rgb(0 0 0 / .14)`): selected segment of the period control.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / .28)`): the save/undo toast.
- **Dialog** (`box-shadow: 0 24px 60px rgb(0 0 0 / .35)`): confirmation dialogs, over a backdrop of rgb(10 9 7 / .55).

### Named Rules
**The No Cards Rule.** KPIs, charts and tables sit directly on the stock. Blocks are separated by dashed perforations and hairline rules, never by cards, borders around panels or raised surfaces.

## Shapes

One gentle radius (raggio, 8px) for inputs, buttons, chips, the strip's outer ends, messages and the toast. The mini strip uses 4px, inline code tags 3px, the segmented control's inner segment 6px, dialogs 12px. The code strip is square-cut between segments; only its outer ends round. Perforations are 2px dashed lines; the joints between strip segments are drawn as a dashed 2px gap cut in stock colour.

## Components

### Buttons
Plain, heavy-lettered plates.
- **Shape:** gently curved (raggio), 48px minimum height, 40px for the small variant.
- **Primary:** the reversed plate, banda fill with banda-testo, 700 weight; at night it inverts to light ink with dark text. "Salva intervento" grows to 54px and 1.0625rem, full width on phones, 260px minimum on screens, right-aligned.
- **Secondary:** carta fill with a 1.5px linea-forte outline. Hover to stock-2; press scales to 0.98.
- **Danger:** secondary with errore-testo text and outline.
- **Text:** no outline, stock-2 on hover.
- **Focus:** a 2.5px ink outline offset 2px, everywhere.

### Chips
- **Style:** filled and borderless, chip-fondo ground, ink text, 600 weight, 44px tall. Choice chips are visibly a different material from text inputs: chips are filled, inputs are light and outlined.
- **Selected:** banda fill with banda-testo (inverted to ink with stock text at night).
- **Altro… select:** an inline select styled as a chip (same fill, 108px minimum), turning band-filled when it holds a choice.
- **Manoeuvre chips (Volo):** the six helicopter manoeuvres are multi-select chips, each pressed independently. Code in 800 weight, then "· name" in 500, left aligned; two columns on the phone, three from 768px. Same selected style as every chip.

### Inputs / Fields
- **Style:** carta ground, 1.5px linea outline, raggio, 48px, tabular numerals. Custom chevron on selects.
- **Focus:** outline darkens to ink with a 1px ink ring.
- **Error:** shown in a message block on errore-fondo, never by recolouring the code colours.

### Navigation
- **Mobile:** the tab bar is the bottom of the black band: icon over a 0.6875rem uppercase label, inactive banda-testo-2, active banda-testo with a 3px bar on the top edge.
- **Desktop:** the left rail, rows 46px with sentence-case 600 labels; active and hover rows fill with banda-2, the active bar moves to the left edge.

### The Tear-off Code Strip (signature)
The codes are a row of joined colour strips (58px tall), each printed with its word, joints perforated. Before a choice all strips are full colour. Choosing one keeps it at full strength with a check and the strip lift shadow; the others are "torn off": the fill clips away downward (0.24s, cubic-bezier(0.16, 1, 0.3, 1)) leaving a dashed outline in their colour and the word in its `-strappo` tone.

### Mini Strip
The same strip, small, reports invio → rientro in the list, the detail band and statistics. Invio is light: a tint of its colour (30% over stock by day) with a 1.5px inset border in the colour and ink text; at night a translucent fill (22%) with the word in its light `-strappo` colour. Rientro is full colour with its `-testo` word. The two are joined by a perforation. A missing code is an empty outlined segment. Single codes use the inline code tag (full colour, 3px radius).

### Statistics
KPIs are a grid on the stock: label small term, numeral value, faded notes, cells split by hairline linea rules under a dashed top perforation. Charts are Chart.js bars in ink (light ink at night) with linea gridlines and inchiostro-2 axes; invio/rientro charts follow chiaro = invio (26% tint with a 2px border), pieno = rientro.

A two-way segmented control, **Interventi | Volo**, sits under the period control and switches the whole view; the period is shared. The Volo view counts only V-ECHO and T-ECHO: four KPIs (two columns, four from 1200px), three ink bar charts (flight hours by month, manoeuvres in %, missions by vehicle) and tables numbered V1–V5. Flight hours read as h:mm, like the Excel `[h]:mm`.

The Volo section of the form appears only for V-ECHO and T-ECHO, after Tempi; the warnings block always closes the last visible section.

## Do's and Don'ts

### Do:
- **Do** print the code word on every use of VERDE, GIALLO, ROSSO or NERO.
- **Do** draw invio light and rientro full, in the mini strip and in charts alike.
- **Do** keep choice chips filled and borderless (chip-fondo) and text inputs light and outlined (carta with a linea outline).
- **Do** put section perforations on the bottom edge, so a column-top section has no rule above it.
- **Do** set every number in tabular numerals.
- **Do** keep the shell in the black band: header, tab bar and rail are one material.
- **Do** keep touch targets at 44px or more (chips 44px, inputs and buttons 48px, strip 58px).

### Don't:
- **Don't** put KPIs, charts or tables in cards; separate them with dashed perforations on the stock.
- **Don't** use a neutral grey; tint every neutral from the stock or the band.
- **Don't** introduce an accent colour beyond the four START colours.
- **Don't** use web fonts; the system sans is the only family.
- **Don't** add ornament beyond the perforation dash.

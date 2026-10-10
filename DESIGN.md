---
name: "Fakturka"
description: "Modulární pracovní stůl pro českou fakturaci."
colors:
  background: "#eef2f7"
  foreground: "#19243a"
  card: "#ffffff"
  card-foreground: "#19243a"
  popover: "#ffffff"
  popover-foreground: "#19243a"
  primary: "#3156d9"
  primary-foreground: "#ffffff"
  secondary: "#e8edf5"
  secondary-foreground: "#283952"
  muted: "#f1f4f9"
  muted-foreground: "#58677e"
  accent: "#e6edff"
  accent-foreground: "#2447b7"
  destructive: "#bf303e"
  destructive-foreground: "#ffffff"
  success: "#166948"
  success-foreground: "#ffffff"
  warning: "#854a0c"
  warning-foreground: "#3c2a14"
  border: "#dce3ed"
  input: "#bcc9da"
  ring: "#3156d9"
  chart-1: "#3156d9"
  chart-2: "#6282e7"
  sidebar: "#18243e"
  sidebar-foreground: "#e2e9f5"
  sidebar-muted: "#aabbd6"
  sidebar-primary: "#ffffff"
  sidebar-accent: "#3156d9"
  sidebar-accent-foreground: "#ffffff"
  sidebar-border: "#34435e"
  sidebar-ring: "#a6bdff"
  dark-background: "#101826"
  dark-foreground: "#edf1f8"
  dark-card: "#192338"
  dark-card-foreground: "#edf1f8"
  dark-popover: "#192338"
  dark-popover-foreground: "#edf1f8"
  dark-primary: "#a4bbff"
  dark-primary-foreground: "#152348"
  dark-secondary: "#25324b"
  dark-secondary-foreground: "#e4ebf7"
  dark-muted: "#202c42"
  dark-muted-foreground: "#adbad0"
  dark-accent: "#2d3c62"
  dark-accent-foreground: "#d7e2ff"
  dark-destructive: "#ff99a3"
  dark-destructive-foreground: "#401722"
  dark-success: "#76d5ab"
  dark-success-foreground: "#153728"
  dark-warning: "#f0c279"
  dark-warning-foreground: "#3c2a14"
  dark-border: "#33425c"
  dark-input: "#4d5d78"
  dark-ring: "#a4bbff"
  dark-chart-1: "#a4bbff"
  dark-chart-2: "#7b99ed"
  dark-sidebar: "#121c30"
  dark-sidebar-foreground: "#e2e9f5"
  dark-sidebar-muted: "#aabbd6"
  dark-sidebar-primary: "#ffffff"
  dark-sidebar-accent: "#3156d9"
  dark-sidebar-accent-foreground: "#ffffff"
  dark-sidebar-border: "#34435e"
  dark-sidebar-ring: "#a6bdff"
  print-paper: "#ffffff"
  print-ink: "oklch(14.1% 0.005 285.823)"
  print-border: "oklch(87.1% 0.006 286.286)"
  print-muted: "oklch(55.2% 0.016 285.938)"
  print-outline: "oklch(92% 0.004 286.32)"
typography:
  headline:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  headline-login:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  amount:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  description:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1
  button:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  badge:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Inter, \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "5px"
  md: "7px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-destructive-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.destructive}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "44px"
    width: "100%"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
  card-header:
    padding: "16px 20px"
  card-content:
    padding: "{spacing.20}"
  badge-success:
    backgroundColor: "color-mix(in oklab, #166948 12%, transparent)"
    textColor: "{colors.success}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  navigation-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-accent-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
---

# Design System: Fakturka

## Overview

**Creative North Star: "Modulární pracovní stůl"**

Fakturka is a calm, precise working desk for Czech invoicing. Ink navigation establishes a stable edge, a cool field separates the workspace, and light work panels hold the records and forms. Royal blue marks the action and the current location. The same relationships continue in the dark theme.

The system puts money, document state and the next useful action in readable order. Inter, tabular figures, compact rows and thin dividers carry the visual identity. Controls stay native and substantial enough for touch; grouped information shares its parent surface. There are no newly produced shipping raster assets.

**Key Characteristics:**

- Ink navigation, cool workspace and clearly separated work panels.
- Inter with tabular figures and compact, readable hierarchy.
- Thin dividers and restrained color transitions.
- Native controls, structured mobile rows and direct task-state changes.

## Colors

The palette pairs an ink edge and a cool paper field with royal-blue working actions. The frontmatter records the literal light values and their `dark-` counterparts from the current CSS; it owns the primitives. Root CSS custom properties remain the runtime authority.

### Primary

- **Royal Working Blue** (`primary`, `ring`, `chart-1`): main actions, focus and positive income bars; its paired foreground keeps action labels legible.
- **Blue Wash** (`accent`, `accent-foreground`): hover and selection surfaces with a darker blue label.
- **Sidebar Action Blue** (`sidebar-accent`, `sidebar-accent-foreground`): active agenda, retaining the same saturated blue and white labels in dark mode.
- **Task Blue** (`chart-2`): the To-do column's small state dot; it is a functional secondary step of the blue family.

### Semantic states

- **Paid Green** (`success`, `success-foreground`): paid-state badges and completion actions. Light success is the final contrast-corrected value recorded above.
- **Issued Amber** (`warning`, `warning-foreground`): issued and attention states. Warning badges use warning text on a translucent warning wash, not the warning-foreground token.
- **Overdue Red** (`destructive`, `destructive-foreground`): overdue amounts, failures and irreversible actions. Quiet destructive actions use a light border and surface rather than a competing solid fill.
- Status badges retain readable words; optional colored dots add a second visual cue.

### Neutral

- **Cool Field** (`background`): workspace around the panels.
- **Working Paper** (`card`, `popover` and paired foregrounds): forms, records and transient surfaces. Dark mode uses a raised navy tone rather than white.
- **Ink Text** (`foreground`): headings and primary reading text.
- **Quiet Slate** (`muted-foreground`): explanatory text and metadata. `muted` supplies table-header, disabled-field and board tones.
- **Supporting Surface** (`secondary`, `secondary-foreground`): neutral badges and file-input action surfaces.
- **Fine Divider** (`border`): panel outlines and row separation. **Field Stroke** (`input`) is stronger so editable boundaries remain clear.
- **Navigation Ink** (`sidebar`) has independent text, muted-text, primary-wordmark, border and focus pairs. Do not borrow a workspace ghost treatment for this edge.
- **Document Paper** (`print-paper`, `print-ink`, `print-border`, `print-muted`, `print-outline`): fixed light invoice preview regardless of application theme. Print ink and neutral colors preserve Tailwind's canonical OKLCH values.

**The Action Blue Rule.** Use primary blue for the main working action, active location and in-progress state. Keep success, warning and destructive colors tied to their meanings.

**The Theme Relationship Rule.** Switch complete foreground/background pairs together. Sidebar action blue stays saturated in both themes; the workspace primary becomes pale blue in dark mode.

## Typography

**Display and Body Font:** Inter, locally served by `next/font`, with Latin and Latin-ext for Czech text; Helvetica Neue, Segoe UI, Arial and sans-serif are fallbacks.

**Technical Mono Font:** ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace, limited to technical identifiers such as the authentication setting.

Inter does the work at every scale; there is no separate decorative display face. The body's tabular numeric feature keeps financial columns stable. Headings inherit tight tracking; body copy stays ordinary sentence case.

### Hierarchy

- **Headline** (`headline`): page titles at 32px, semibold, 1.25 line height and -0.018em tracking. Login uses the recorded 28px sibling role.
- **Title** (`title`): panel headings at 16px, semibold, 1.25 line height and heading tracking.
- **Amount** (`amount`): income-strip figures at 24px, semibold, 1.25 line height and -0.025em tracking. Compact outstanding figures use 20px/28px; these are local adaptations, not a second display system.
- **Body** (`body`): root 16px/24px. Most working rows use the 14px/20px `body-compact` role; explanatory paragraphs use 14px with 1.625 line height.
- **Label** (`label`): field labels at 13px, medium, line height 1. Buttons and active navigation use 14px/20px, medium.
- **Badge** (`badge`): 12px/20px, medium; **Caption** (`caption`) is 12px/16px for help, dates and counts.
- Navigation group labels and table/document metadata use compact uppercase for grouping. Do not extend the unused page-header eyebrow option into a new decorative hierarchy.

**The Number Rule.** Preserve tabular numerals for amounts, dates and counts; let long values wrap rather than enlarge the page.

## Layout

The application has a fixed 64px top bar. At the lg breakpoint (64rem), a 224px left navigation edge appears and the content offsets by the same amount. Below lg, a modal drawer is 288px wide with an 85vw cap; the backdrop uses foreground at 45% and a 2px blur. Opening it traps focus, locks scrolling and supports Escape; resizing above lg closes it.

Standard record lists and overview use a centered 80rem maximum container. Customer forms, import and settings use 64rem; invoices use 72rem; new project uses 48rem and task detail 56rem. The task-board page expands to 1600px. Page gutters are 16px by default, 24px at sm (40rem), and 32px at lg. Vertical page padding is 32px, with section gaps generally 24px or 32px.

Forms use a 16px gap and generally become two columns at md (48rem). Header title and actions stack until sm, then sit side by side with wrapping action groups. The board uses a 12px gap: one column by default, two at md and five at xl (80rem). Its columns and cards remain distinct because they are status drop zones and movable records.

Financial summaries share a single strip: rows below sm, three divided columns from sm. Overview work panels use a fluid column plus a 320px secondary column at xl. The chart has a 224px plotting area, not an unrestricted hero height. Invoice/customer tables become structured mobile rows below md; intentionally wide data and the document's item table scroll inside their own region. Invoice item fields retain a two-column mobile layout and switch to explicit desktop tracks at lg.

The invoice preview has a 210mm maximum width and 297mm minimum height on screen, with 32px padding. Actual print uses A4 with 12mm page margins, hides navigation/actions, removes sheet padding, border, shadow and maximum width, and preserves content colors.

## Elevation & Depth

Depth comes primarily from differences between navigation, field, paper and muted surfaces, plus one-pixel boundaries. Ordinary work panels, controls and task cards have no shadow. The two shipped exceptions communicate a separate paper document and a modal confirmation.

### Shadow Vocabulary

- **Document preview:** `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`; accompanied by a one-pixel fixed light outline, removed in print.
- **Confirmation dialog:** `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`; native dialog with a black 50% backdrop.
- Focus rings are interaction feedback, not elevation: controls use three pixels with role-specific alpha; selected task drop targets use a two-pixel primary ring.

**The Flat Work Rule.** Work panels and controls have no ambient shadow. Reserve the shipped small shadow for the document preview and the larger shadow for the confirmation dialog.

## Shapes

The source radius base is 0.5rem. Its derived control corner is 8px (`lg`), its panel corner 12px (`xl`), compact linked text corners 5px (`sm`), and previews/file controls 7px (`md`). State pills and tiny dots use fully rounded ends. Most boundaries are one pixel. The invoice document's strong header/total rules are purpose-specific paper hierarchy.

**The Shared Surface Rule.** Related fields, item rows and payment records use the existing parent surface with spacing or a single divider. Keep native input boundaries, upload previews and the functional Kanban drop-zone/card distinction.

## Components

### Buttons

Direct and outlined, with no lift. Default controls use 8px corners, 16px horizontal padding, an 8px icon/text gap and 14px medium labels. The default height is 44px below sm and 40px from sm. Small buttons retain 44px touch height below sm and use 36px from sm; icon sizes follow the same 44/40 or 44/36 pattern. The declared large size uses 12px corners and 24px horizontal padding.

- **Primary:** primary fill, matching border and paired foreground. Hover lowers fill and border to 85% opacity.
- **Outline:** card fill, input stroke, foreground text; hover uses accent at 50% and the ordinary border.
- **Ghost:** transparent fill and border, muted text; hover uses accent at 60% and accent foreground.
- **Success / destructive:** semantic fill and paired foreground, with the same 85% hover treatment.
- **Destructive outline:** card fill, destructive text, 30% red border; hover uses 45% border and 8% wash. Used for secondary irreversible actions.
- Declared secondary and underlined link variants remain available in the button API; they are not separate visual patterns visible in the reviewed routes.
- Focus uses a 3px ring at 35%; disabled buttons have 50% opacity and cannot receive pointer actions. Pending submit actions change their label, show a loader, set busy state and disable duplicate submission.

### Chips

State pills use full rounding, 10px horizontal/2px vertical padding, a thin border and 12px/20px medium text. The optional dot is 6px. Success uses 12% wash and 25% border; warning 15% wash and 30% border; destructive 10% wash and 25% border; primary 10% wash and 20% border. Neutral uses secondary fill, outline uses transparent fill. Pills report a state rather than behaving like buttons.

### Cards / Containers

A work panel is 12px rounded paper with one border. Its header uses 20px horizontal/16px vertical padding, a 4px title/description gap and one bottom divider. Content uses 20px padding. A footer uses the same 20px/16px inset with a top divider and a 12px wrapping action gap. Payment history, invoice items, ARES and upload groups remain open inside this parent structure. Preview boxes retain the boundaries needed to identify the image or file.

### Inputs / Fields

Native editable surfaces use card fill, input stroke, 8px corners and 12px horizontal/8px vertical padding. Below sm their height is 44px and text 16px; from sm it is 40px and 14px. A field's label, control and help text share a 6px gap. Placeholder/help uses muted text. Hover switches the border; focus uses the ring border plus a 3px ring at 25%. Invalid fields use destructive border/ring; disabled fields use muted fill and 70% opacity.

Selects retain the native picker with a drawn chevron and 36px right padding. Textareas have auto height, 80px minimum height and 10px vertical padding. Loader rotation uses the inherited one-second linear spin, disabled by reduced-motion preference; pending labels remain visible.

### Navigation

The ink navigation has independent semantic tokens. Rows use 8px corners, 12px horizontal padding, a 10px icon gap and 14px text. They are 44px high on mobile and 40px from lg. Active rows use sidebar action blue and medium white labels; hover uses sidebar border at 60%. The focus ring uses sidebar ring at 40%. Drawn SVG icons are typically 16px, the menu trigger 20px. Breadcrumbs use 13px text and wrap within the top bar.

### Divided financial strip and records

A shared parent panel contains each period or payment figure with a label, amount and context. Dividers change from horizontal to vertical at sm without creating individual tiles. Payment records use unframed rows with one separator and an independently reachable delete control. On mobile, record number, amount, customer, state and due date wrap into compact rows while invoice selection and bulk actions remain available.

### Task board

Status columns use 12px corners, a muted 40% surface, a one-pixel border and 160px minimum height. Each movable task uses 8px corners, card fill, 12px padding and its own boundary. Columns have a semantic 8px dot; cards have priority/date metadata and a native status select. A drop target uses primary at 60% on the boundary and a 5% wash; card insertion uses a 2px ring. Dragged tasks use 40% opacity, pending tasks 60%. Saving/error text and rollback/retry preserve clarity when motion is reduced.

### Feedback

Alerts use a card surface, 8px corners, 16px horizontal/12px vertical padding and a 12px icon/content gap. A single one-pixel semantic left border and a 16px SVG icon communicate the state. They do not create a thick decorative side stripe.

Color/border changes use the shipped Tailwind default transition: 150ms with `cubic-bezier(0.4, 0, 0.2, 1)`. There is no entrance sequence or animated elevation. Preserve textual status when reducing loader motion.

## Do's and Don'ts

### Do:

- **Do** use the paired semantic tokens in both themes.
- **Do** keep Czech labels, CZK values, Czech dates and tabular numerals.
- **Do** group related figures in a divided strip and keep the parent work panel visible.
- **Do** preserve mobile invoice selection, native task selectors and clear pending/error feedback.
- **Do** keep focus, selection, caret and scrollbars aligned with the active theme.
- **Do** keep the invoice paper light in both themes and remove application chrome when printing.

### Don't:

- **Don't** turn every field group, payment or invoice item into another rounded panel.
- **Don't** replace semantic state colors with the primary accent.
- **Don't** add decorative page kickers; compact uppercase navigation groups and document metadata retain their semantic purpose.
- **Don't** apply decorative shadows, entrance animation, gradients or raster texture to ordinary work surfaces.
- **Don't** make the full page scroll horizontally when a structured mobile row or local data scroller is available.
- **Don't** substitute glyph characters for the existing drawn SVG icon language.


Not canonized: the unused page-header eyebrow API is not a rendered page pattern. The earlier review's nonblocking sparse project-grid density and two-column narrow invoice fields are local limitations, not prescriptions for new surfaces. Final scored containment and paid-badge contrast findings are resolved; the ship verdict does not claim an exhaustive new review of every route.

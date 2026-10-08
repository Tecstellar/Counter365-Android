# CounterPro Counter App --- Design System & UX Specification

**Document status:** Design control document\
**Scope:** Counter App only\
**Source of truth:** Supplied `Counter App.dc.html`\
**Rule:** The supplied UI must be reproduced faithfully. Do not redesign
without explicit approval.

------------------------------------------------------------------------

# 1. Design Authority

The supplied Counter App design is the visual and interaction reference.

The implementation must preserve:

-   Layout
-   Screen hierarchy
-   Typography
-   Colors
-   Spacing
-   Controls
-   Navigation
-   Copy
-   Interaction patterns
-   Role-dependent visibility
-   Loading/empty/error concepts
-   Onboarding/tour sequence

If the implementation needs a deviation, stop and document the deviation
before changing it.

------------------------------------------------------------------------

# 2. Design Token Policy

The source uses design-system variables including:

-   `--color-bg`
-   `--color-surface`
-   `--color-text`
-   `--color-accent`
-   `--color-accent-*`
-   `--color-divider`
-   `--font-body`
-   `--font-heading`
-   `--radius-lg`
-   `--shadow-sm`
-   `--shadow-md`

The exact values are supplied by the referenced design-system stylesheet
and are not all embedded directly in the Counter App file.

Therefore:

**Do not guess the exact token values.**

During implementation, extract the authoritative values from the
supplied design-system assets and create a single application token
file.

No screen may invent its own near-identical color/font value.

------------------------------------------------------------------------

# 3. Typography

The design differentiates:

-   Body font
-   Heading/display font
-   Small labels
-   Muted text
-   Kicker/section labels

The implementation must use the exact font families from the supplied
design-system tokens.

Do not replace them with a convenient default font.

Typography must preserve:

-   Weight
-   Size
-   Letter spacing
-   Line height
-   Case
-   Alignment

------------------------------------------------------------------------

# 4. Color System

The design is based around a strong accent/dark brand treatment with a
light surface/background system.

Required token usage:

-   Background
-   Surface
-   Text
-   Muted text
-   Divider
-   Accent levels
-   Primary button
-   Secondary button
-   Neutral surface
-   Status/feedback colors where explicitly present

Do not introduce additional colors merely to make a screen look more
modern.

------------------------------------------------------------------------

# 5. Shapes and Spacing

Preserve:

-   Existing border radii
-   Divider thickness
-   Card treatment
-   Button height
-   Input height
-   Spacing rhythm
-   Device-safe areas
-   Bottom navigation height
-   Header height

Where the source uses explicit pixel dimensions, reproduce them at the
corresponding design density.

------------------------------------------------------------------------

# 6. Device Presentation

The supplied design presents Android device frames around a 428×908
design area.

The production UI must remain responsive and preserve the same hierarchy
across supported Android screen sizes.

Do not use the design-frame dimensions as a reason to hardcode the
application to one physical device.

------------------------------------------------------------------------

# 7. Registration / Onboarding

## Splash

Visual characteristics shown by the source:

-   Full-screen accent background
-   COUNTER PRO wordmark
-   "BILLING FOR FOOD SHOPS"
-   Minimal progress indicator
-   Corner-detail treatment

Do not replace this with a generic splash screen.

## Intro

Four introduction panels are shown:

### 01 --- THE COUNTER

"Three taps, and the bill is done"

Concept: - Select ordered items - Choose cash/GPay/pending - Fast
counter workflow

### 02 --- THE MONEY

"Know what you actually made"

Concept: - Sales - Expenses - Profit - Day/week/month/year - Peak
hours - Best-selling items - Payment modes

### 03 --- THE PENDING

"No more notebook for payment pending"

Concept: - Pending bill - Customer name - Phone - Reminder/share
capability

### 04 --- THE PAPERWORK

"Send it, or print it"

Concept: - WhatsApp receipt - Thermal printer option - User access
control

Preserve the supplied copy unless product approval changes it.

------------------------------------------------------------------------

# 8. Registration Screens

## Step 1 --- Phone

Contains:

-   COUNTER branding
-   "STEP ... OF 4"
-   Phone number
-   +91 presentation
-   Terms/Privacy links
-   Primary continuation button

## Step 2 --- OTP

Contains:

-   Six OTP boxes
-   Sent-to-phone display
-   Change-phone action
-   Resend state

## Step 3 --- Shop details

Contains:

-   Shop name
-   Address
-   State
-   City/town
-   Pincode
-   Location tagging button
-   Optional logo

## Step 4 --- Shop type

Contains shop-type choices and explanation that a starter menu is
loaded.

## Registration completion

Shows:

-   Registered shop name
-   Address/place
-   Shop type
-   Phone/master ID
-   Location status
-   30 free days/no-card statement as shown by the supplied design
-   Start-tour action
-   Restart-flow action

------------------------------------------------------------------------

# 9. Home

Home is the main daily business view.

The design communicates:

-   Today's sales
-   Expense
-   Profit
-   Pending
-   Period switching
-   Business analytics

Period controls include:

-   Day
-   Week
-   Month
-   Year

The home screen must be driven by real persisted data in production.

------------------------------------------------------------------------

# 10. Main Navigation

The supplied design shows three primary bottom destinations:

-   HOME
-   SALES
-   ACCOUNT

The navigation must remain visually and behaviorally consistent with the
source.

------------------------------------------------------------------------

# 11. Header / Menu

The application header includes:

-   Counter branding
-   Menu button
-   Contextual controls
-   Accent background treatment

The side/menu navigation includes routes represented by the supplied
source, including:

-   Home
-   Reports
-   Pending
-   Customers
-   other available operational areas

Do not add unrelated navigation destinations.

------------------------------------------------------------------------

# 12. Sales / Menu

The Sales area includes:

-   Category navigation
-   Menu items
-   Favorites
-   Search where present
-   Item selection
-   Full/half behavior
-   Sold-out state
-   Cart summary
-   Bill action

The UI must preserve the source's tile/card proportions and interaction
behavior.

------------------------------------------------------------------------

# 13. Menu Editor

The design supports:

-   Existing category list
-   Item list
-   Drag/order affordance
-   Favorite state
-   Sold-out state
-   Edit item
-   Add item
-   New category

The editor uses the same design language as the main application.

------------------------------------------------------------------------

# 14. Bill Screen

The Bill screen contains:

-   Back
-   Bill number
-   Clear
-   Bill lines
-   Quantity controls
-   Line totals
-   Subtotal
-   GST when enabled
-   Total
-   Payment-mode controls
-   Pending-payment customer fields when Pending is selected
-   Save
-   Save & share

The visual hierarchy of TOTAL must remain prominent.

------------------------------------------------------------------------

# 15. Pending Payment UI

Pending payment UI includes:

-   Customer name
-   Phone number
-   Pending tracking context
-   Skip option where shown

Do not remove the warning/context copy without explicit approval.

------------------------------------------------------------------------

# 16. Account

Account includes:

-   User identity
-   Role
-   Phone
-   Subscription area
-   Users
-   Settings
-   Help/legal
-   Version/backup/sync information

Role restrictions must change what is visible/actionable without
changing the underlying design language.

------------------------------------------------------------------------

# 17. Users

User rows show:

-   User name
-   Additional metadata
-   Role badge

Owner access includes adding users.

Locked/non-authorized states must preserve the supplied visual
treatment.

------------------------------------------------------------------------

# 18. Reports

Reports include:

-   Month
-   Year
-   Summary
-   Day-wise
-   Top items
-   Export/share actions

The design describes:

-   Total sale
-   Total expense
-   Profit
-   Day-wise details
-   Top 10 items
-   PDF
-   Excel
-   WhatsApp

Subscription/permission lock states must be visually consistent with the
supplied source.

------------------------------------------------------------------------

# 19. Account Settings

Settings shown by the source include toggle-style controls and locked
states.

Do not convert these into unrelated UI components.

------------------------------------------------------------------------

# 20. Tour

The app tour contains nine steps.

Tour requirements:

-   Spotlight/scrim behavior
-   Step number/kicker
-   Title
-   Body
-   Hint
-   Next
-   Back
-   Skip
-   Route-aware opening
-   Final "Start billing" behavior

The supplied source intentionally opens the relevant screen/form for
some tour steps. Preserve that behavior.

------------------------------------------------------------------------

# 21. Interaction Rules

### Buttons

Preserve:

-   Primary
-   Secondary
-   Ghost
-   Icon
-   Full-width
-   Segmented controls

### Inputs

Preserve:

-   Label placement
-   Background
-   Border
-   Focus behavior
-   Validation presentation

### Cards

Preserve:

-   Surface
-   Radius
-   Shadow
-   Padding
-   Hierarchy

------------------------------------------------------------------------

# 22. State Design

Every screen must define:

### Loading

Use the design system without introducing distracting skeletons if the
supplied UI does not show them.

### Empty

Explain what the user can do next.

### Error

Use clear human-readable language.

### Offline

Clearly communicate unsynced state without blocking safe local billing
unnecessarily.

### Success

Provide confirmation without excessive animation/toast noise.

------------------------------------------------------------------------

# 23. Accessibility

Preserve the visual design while ensuring:

-   Touch targets are usable
-   Text remains readable
-   Screen-reader labels exist
-   Focus order is logical
-   Important status is not conveyed by color alone

Accessibility implementation must not visually redesign the product.

------------------------------------------------------------------------

# 24. Exactness Rule

When translating the design into production:

**Pixel-perfect where practical, token-perfect always.**

Never approximate:

-   Font family
-   Brand colors
-   Component radius
-   Primary button style
-   Navigation
-   Major spacing
-   Screen hierarchy

If exact information cannot be extracted from the source, mark it
`DESIGN VALUE REQUIRED` rather than guessing.

------------------------------------------------------------------------

# 25. Design QA Checklist

For every screen:

-   [ ] Correct route
-   [ ] Correct layout
-   [ ] Correct typography
-   [ ] Correct colors
-   [ ] Correct spacing
-   [ ] Correct icons
-   [ ] Correct copy
-   [ ] Correct button hierarchy
-   [ ] Correct role visibility
-   [ ] Loading state
-   [ ] Empty state
-   [ ] Error state
-   [ ] Offline state
-   [ ] Keyboard behavior
-   [ ] Small-screen behavior
-   [ ] Accessibility

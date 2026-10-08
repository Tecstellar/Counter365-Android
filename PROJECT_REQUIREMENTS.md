# CounterPro Counter App --- Project Requirements

**Document status:** Baseline product requirements\
**Scope:** Counter App only\
**Out of scope:** Admin Console\
**Source of truth:** Supplied `Counter App.dc.html` design/source file\
**Rule:** Anything not supported by the supplied Counter App source is
marked `UNSPECIFIED` and must not be invented silently.

------------------------------------------------------------------------

## 1. Product Definition

CounterPro is a billing application for food shops. The supplied design
presents the core promise as fast billing, payment tracking, WhatsApp
sharing instead of requiring a printer, day-level business visibility,
and controlled access for helpers.

The application must support food-shop workflows while keeping the
supplied visual design and terminology intact.

### Core product principles

1.  Billing must be fast.
2.  The user should be able to create a bill with minimal typing.
3.  Payment mode must be recorded.
4.  Pending payments must be trackable.
5.  Business totals must be derived from actual stored bills/expenses,
    not hardcoded dashboard values.
6.  User access must be role-controlled.
7.  Data must remain reliable when connectivity is poor.
8.  Existing supplied UI must not be redesigned without explicit
    approval.

------------------------------------------------------------------------

# 2. Scope

## 2.1 In Scope

The Counter App includes the functionality represented in the supplied
design:

-   Splash/loading experience
-   Product introduction/onboarding
-   Phone-number authentication
-   OTP verification
-   Shop registration/setup
-   Shop type selection
-   Shop location tagging
-   Optional shop logo
-   Registered-shop confirmation
-   First-use application tour
-   Home/dashboard
-   Sales/menu
-   Cart
-   Billing
-   Payment selection
-   Pending payment tracking
-   Customer-related pending information
-   Menu/catalog management
-   Categories
-   Menu item editing
-   Favorites
-   Sold-out state
-   Account
-   User management
-   Owner/Supervisor/Biller roles
-   Permission controls
-   Expenses
-   Pending-payment views
-   Customer views
-   Reports
-   Subscription-related UI/functionality shown in the Counter App
-   WhatsApp sharing
-   Printer-related functionality shown in the supplied design
-   Settings/help/legal areas shown in the supplied design
-   Offline/local persistence and synchronization behavior indicated by
    the supplied design

## 2.2 Explicitly Out of Scope

-   Counter Admin Console
-   Admin Console backend/dashboard
-   Platform-wide shop administration
-   Platform-wide subscription analytics
-   Platform-wide payments analytics

These may be integrated later. Do not implement them in the current
Counter App project.

------------------------------------------------------------------------

# 3. Users and Roles

The supplied design defines three application roles.

## 3.1 Owner

Owner has full application access.

Expected capabilities:

-   Billing
-   Day totals
-   Expenses
-   Pending payments
-   Reports
-   Menu management
-   User management
-   Subscription-related management

## 3.2 Supervisor

Supervisor has the same operational permissions shown for Owner except
subscription management.

Expected capabilities:

-   Billing
-   Day totals
-   Expenses
-   Pending payments
-   Reports
-   Menu management
-   User management

Subscription management: - Not permitted

## 3.3 Biller

Biller has restricted access.

Expected capabilities:

-   Create bills
-   View day total

Not permitted:

-   Expenses
-   Pending-payment management
-   Reports
-   Menu management
-   User management
-   Subscription management

### Important authorization requirement

Frontend visibility is not security.

The backend/server must independently enforce every protected operation.

------------------------------------------------------------------------

# 4. Permission Model

The supplied design identifies these operational permissions:

  Permission   Meaning
  ------------ -------------------------------
  `bill`       Take/create bills
  `total`      See the day's takings
  `exp`        Add/manage expenses
  `pend`       Clear/manage pending payments
  `report`     See day report and analytics
  `menu`       Edit menu and prices
  `users`      Add/remove users

The final persisted permission model must preserve the supplied
semantics.

Any additional permission is `UNSPECIFIED` until explicitly approved.

------------------------------------------------------------------------

# 5. Authentication and Registration

## 5.1 Registration flow

The supplied design shows:

1.  Splash
2.  Intro/onboarding
3.  Phone number
4.  OTP
5.  Shop details
6.  Shop type
7.  Registration confirmation
8.  App tour
9.  Start billing

## 5.2 Phone authentication

The supplied UI shows:

-   Indian `+91` presentation
-   Six-digit OTP
-   OTP resend state
-   Ability to change the phone number

### Requirements

-   Phone number must be validated.
-   OTP must be validated.
-   OTP attempts must be protected against abuse.
-   Authentication state must persist securely.
-   Logout must invalidate the session according to the selected
    authentication architecture.

### UNSPECIFIED

-   OTP provider
-   OTP expiration duration
-   Maximum OTP attempts
-   Exact session/token technology
-   Refresh-token policy

These must be selected during architecture implementation and documented
before coding.

------------------------------------------------------------------------

# 6. Shop Registration

The supplied design includes:

-   Shop name
-   Address
-   State
-   City/town
-   Pincode
-   Location tagging
-   Optional logo
-   Shop type

The shop becomes associated with the owner's master ID.

The supplied design states that the owner ID is used to create
Supervisors and Billers.

### Validation

At minimum:

-   Required fields must be validated.
-   Pincode format must be validated.
-   Shop name must be validated.
-   Invalid location operations must fail safely.
-   Logo upload failures must not corrupt registration.

Exact validation lengths are `UNSPECIFIED` unless specified elsewhere in
the source.

------------------------------------------------------------------------

# 7. Shop Types and Catalog

The supplied design contains starter catalog concepts for:

-   Tea Shop
-   Fast Food
-   Tiffin Shop
-   Restaurant

The catalog includes categories and products.

Examples in the supplied source include restaurant products such as:

-   Chicken Biryani
-   Veg Biryani
-   Fried Rice
-   Noodles
-   Full Meals
-   Butter Naan
-   Fresh Juice
-   Lassi
-   Soda
-   Water

These examples are design/sample data and must not be treated as
immutable production data.

The final product catalog must be stored in the database.

------------------------------------------------------------------------

# 8. Menu Requirements

The supplied design supports:

-   Categories
-   Items
-   Prices
-   Favorites
-   Sold-out state
-   Half/full portions where supported
-   Item editing
-   Add item
-   Add category
-   Item ordering
-   Category tabs
-   Menu changes

The design indicates that the first six items can be displayed as
favourites on the billing screen.

### Important

The exact favorite-order algorithm must be implemented according to the
supplied design behavior, not assumed from general billing-app
conventions.

------------------------------------------------------------------------

# 9. Billing Requirements

## 9.1 Core flow

Expected flow:

``` text
Sales
→ Menu
→ Select items
→ Cart
→ Bill
→ Select payment mode
→ Save
→ Optional share
```

## 9.2 Cart

The cart must support:

-   Item quantity
-   Increase quantity
-   Decrease quantity
-   Clear cart
-   Line total
-   Subtotal
-   Applicable GST shown by the design
-   Final total

## 9.3 Half portion

The supplied design supports a full/half interaction model.

Where an item does not support half portions, the application must not
allow a half selection.

## 9.4 Sold-out

Sold-out items cannot be added to a bill.

## 9.5 Monetary integrity

Never use unsafe floating-point arithmetic for persisted financial
values.

The architecture must select a deterministic money representation, such
as integer minor units, and document it before implementation.

------------------------------------------------------------------------

# 10. GST

The supplied design shows an optional 5% GST calculation.

The existing design logic derives GST from the subtotal when GST is
enabled.

Production implementation must:

-   Calculate GST deterministically.
-   Persist the applicable tax information needed to reproduce the bill.
-   Ensure historical bills do not unexpectedly change when future tax
    settings change.

Whether the app supports multiple tax rates is `UNSPECIFIED`.

------------------------------------------------------------------------

# 11. Payments

The supplied billing screen shows three payment modes:

-   Cash
-   GPay
-   Pending

The final backend must persist the payment state.

A successful bill must not rely on frontend-only state.

------------------------------------------------------------------------

# 12. Pending Payments

The supplied design allows a pending bill to be tracked using:

-   Customer name
-   Phone number

The phone number is used for later reminders/sharing.

Requirements:

-   Pending amount must be persisted.
-   Pending state must remain associated with its original bill.
-   Pending payment must be clearable.
-   Clearing a pending amount must create an auditable financial event.
-   Repeated clearing requests must not double-count money.

Exact reminder automation behavior is `UNSPECIFIED` unless explicitly
implemented by a later approved requirement.

------------------------------------------------------------------------

# 13. Customers

The supplied design contains customer-related functionality around
pending payments and customer information.

Required behavior:

-   Customer information must be persisted where collected.
-   Customer/bill relationships must be queryable.
-   Customer history must not be fabricated from UI state.
-   Customer deletion/retention policy is `UNSPECIFIED`.

------------------------------------------------------------------------

# 14. Vendors

The supplied design describes Vendors as contacts for supplies such as
milk, gas and other shop supplies.

Requirements:

-   Vendor records must be persisted.
-   Vendor information must be available to expense workflows where
    applicable.
-   Vendor-to-expense relationships must be consistent.

------------------------------------------------------------------------

# 15. Expenses

The supplied design contains expense functionality and sample expenses.

Requirements:

-   Add expense
-   Store amount
-   Store description/name
-   Associate expense with shop
-   Associate expense with date/time
-   Include expenses in report calculations
-   Enforce permission
-   Maintain an auditable record

Exact expense categories and recurring-expense behavior are
`UNSPECIFIED`.

------------------------------------------------------------------------

# 16. Dashboard / Home

The supplied design describes Home as the user's day view.

It includes concepts such as:

-   Sale
-   Expense
-   Profit
-   Pending
-   Period selection
-   Peak hours
-   Best-selling items
-   Payment-mode information

Supported periods shown by the design include:

-   Day
-   Week
-   Month
-   Year

All displayed financial values must be calculated from persisted data.

No hardcoded production dashboard numbers are allowed.

------------------------------------------------------------------------

# 17. Reports

The supplied design includes reports with:

-   Month/year selection
-   Summary
-   Day-wise view
-   Total sale
-   Total expense
-   Profit
-   Top 10 items
-   PDF export
-   Excel export
-   WhatsApp sharing

The design indicates report access can be restricted by
permission/subscription.

### Requirements

Reports must be reproducible from database data.

A report must never use sample/mock totals after production data is
available.

------------------------------------------------------------------------

# 18. Account

The Account area shown by the design includes:

-   Current user information
-   Role
-   Phone
-   Subscription
-   Users
-   Settings
-   Help/legal
-   App/version/backup/sync information

The exact editable profile fields are `UNSPECIFIED` where the design
only presents an inactive/edit affordance.

------------------------------------------------------------------------

# 19. User Management

Owner-level functionality includes creating/removing helpers.

The supplied design presents:

-   Owner
-   Supervisor
-   Biller
-   User list
-   Invite/add user
-   Role information
-   Permission/access behavior

Requirements:

-   User creation must be server-authorized.
-   User role must be persisted.
-   User must belong to the correct shop.
-   User must not access another shop's data.
-   Removing/deactivating a user must not destroy historical financial
    records.

Exact invitation mechanism is `UNSPECIFIED`.

------------------------------------------------------------------------

# 20. Subscription

The Counter App design contains subscription UI.

The supplied source shows a Counter Pro subscription area and
report/subscription gating concepts.

The exact production billing provider, purchase verification,
subscription state machine and entitlement synchronization are
`UNSPECIFIED`.

Do not implement fake subscription success.

Any production subscription state must come from a trusted server-side
verification process.

------------------------------------------------------------------------

# 21. Sharing and Printing

The design supports:

-   WhatsApp sharing
-   Receipt sharing
-   Report sharing
-   Thermal printer-related functionality

The exact printer protocol, printer SDK, supported models, WhatsApp
integration method and fallback behavior are `UNSPECIFIED`.

Implement only after these technical decisions are explicitly
documented.

------------------------------------------------------------------------

# 22. Offline and Sync

The supplied Account UI indicates that data stays on the phone until it
syncs and shows backup/sync information.

Therefore offline/local persistence is a first-class requirement.

Required principles:

-   User must not lose a successfully recorded local bill because the
    network disappears.
-   Local writes must be durable.
-   Sync must be retryable.
-   Sync must prevent duplicate server records.
-   Server acknowledgement must be persisted locally.
-   Conflicts must have deterministic handling.
-   Financial writes must be idempotent.

Exact conflict policy is `UNSPECIFIED` and must be decided in
`ARCHITECTURE.md`.

------------------------------------------------------------------------

# 23. App Tour

The supplied design contains a nine-step tour.

The tour covers concepts including:

1.  Home/day view
2.  Sales/billing
3.  Payment handling
4.  Pending payments
5.  Customers
6.  Vendors
7.  Expenses
8.  Reports
9.  Ready/start billing

The supplied tour content must be preserved in the product
implementation unless explicitly changed.

------------------------------------------------------------------------

# 24. Data Integrity Requirements

The following are mandatory:

-   Every bill belongs to exactly one shop.
-   Every bill item belongs to a bill.
-   Every payment belongs to the relevant financial transaction/bill.
-   Historical totals must remain reproducible.
-   Deleted/disabled menu items must not break historical bills.
-   Historical bill prices must not change when menu prices change.
-   Unauthorized users must not read/write another shop's data.
-   Repeated network retries must not create duplicate bills.
-   Financial records must use transactions where multiple records must
    succeed together.

------------------------------------------------------------------------

# 25. Error Handling

Every production operation must define:

-   Loading state
-   Success state
-   Empty state where applicable
-   Validation error
-   Network error
-   Authentication error
-   Authorization error
-   Server error
-   Database error
-   Retry behavior

Errors must be user-friendly and must not expose secrets, SQL, stack
traces or internal implementation details.

------------------------------------------------------------------------

# 26. Acceptance Criteria

A feature is NOT complete when only its UI exists.

A feature is complete only when:

-   UI implemented
-   Navigation implemented
-   State management implemented
-   Backend implemented
-   Database persistence implemented
-   Validation implemented
-   Authorization implemented
-   Error states implemented
-   Loading/empty states implemented
-   Offline behavior implemented where applicable
-   Retry/idempotency implemented where applicable
-   Tests implemented
-   Existing functionality remains working
-   Design remains faithful to the supplied source

------------------------------------------------------------------------

# 27. Unspecified Decision Register

The following must be decided explicitly before production
implementation:

-   Backend technology
-   Database technology
-   Authentication provider
-   OTP provider
-   Hosting
-   API style
-   Local database technology
-   Sync protocol
-   Conflict strategy
-   Subscription provider
-   Payment verification strategy
-   Printer SDK/protocol
-   WhatsApp integration mechanism
-   Exact report-generation implementation
-   Backup architecture
-   Encryption requirements
-   Data retention/deletion policy
-   Exact validation limits
-   Tax configuration model
-   Multi-device behavior
-   Multi-user concurrent billing behavior
-   Notification/reminder mechanism

**Rule:** The agent must not silently choose these and treat them as
requirements. Approved decisions must be added to this register and
`ARCHITECTURE.md`.

------------------------------------------------------------------------

# 28. Product Completion Definition

CounterPro Counter App is production-ready only when all in-scope
requirements have:

1.  A documented requirement
2.  A corresponding design behavior
3.  A corresponding architecture decision
4.  A working implementation
5.  Automated/manual verification
6.  No unresolved Critical or High defects
7.  Verified financial data integrity
8.  Verified role isolation
9.  Verified offline/sync behavior
10. Verified production build behavior

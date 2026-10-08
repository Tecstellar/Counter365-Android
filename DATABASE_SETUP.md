# COUNTERPRO — DATABASE SETUP & DATA ARCHITECTURE

**Project:** CounterPro Counter App  
**Scope:** Counter App only  
**Admin Console:** Out of scope for this database implementation phase  
**Mobile Stack:** React Native + Expo  
**Backend:** Supabase  
**Database:** Supabase PostgreSQL  
**Authentication:** Supabase Auth  
**Primary Security Model:** PostgreSQL Row Level Security (RLS)  
**Server-side privileged logic:** Supabase Edge Functions  
**Status:** Foundation specification

---

## 1. Purpose

This document defines the database foundation for CounterPro.

The database must support:

- Multiple shops/tenants
- Owner, Supervisor and Biller roles
- Role-based permissions
- User/shop membership
- Menu and menu categories
- Bills/orders
- Bill items
- Multiple payment methods and partial payments
- Pending payments
- Customers
- Vendors
- Expenses
- Daily totals
- Reports
- Subscription state
- Audit logging
- Offline-created records and synchronization
- Safe retry/idempotency
- Cross-shop data isolation
- Future expansion without breaking the Counter App

The database is a core production component. The Expo application must never be treated as the security boundary.

---

# 2. Non-Negotiable Database Rules

1. PostgreSQL is the source of truth for synchronized server data.
2. Every shop-owned table must contain a `shop_id` unless the table is genuinely global.
3. Every shop-owned table must be protected by RLS.
4. A user must never be able to read or mutate another shop's records.
5. Frontend role checks are UX controls, not security controls.
6. Owner/Supervisor/Biller authorization must be enforced at the database/RLS and server-function layers.
7. The Supabase service-role key must NEVER be bundled into the Expo application.
8. Schema changes must be made through SQL migrations and version control.
9. Do not manually modify production schema in the Supabase dashboard as the normal development workflow.
10. Financial records must be append-safe and auditable.
11. Destructive deletion of completed financial transactions should be avoided.
12. Client retries must not create duplicate bills or payments.
13. Offline synchronization must be idempotent.
14. Timestamps must be stored consistently and displayed in the shop/user timezone.
15. Monetary values must not use floating-point database types.
16. All sensitive server-side operations must validate authenticated user, shop membership and permission.
17. Database constraints must reject invalid financial states.
18. RLS policies must be tested for Owner, Supervisor, Biller and cross-shop access.
19. Generated database types must be regenerated after schema changes.
20. A migration is not complete until the application and database tests pass.

---

# 3. Tenant / Shop Model

CounterPro is a multi-tenant application.

The primary tenant is the **shop**.

Example:

- Shop A → Restaurant 1
- Shop B → Tea Shop 2

A user may belong to one or more shops in the future, but the initial Counter App can operate with one active shop at a time.

All shop-owned records must be connected to the shop through `shop_id`.

## Tenant isolation rule

For every request:

`authenticated user → shop membership → permitted shop → requested record`

A user must never be able to bypass this chain by changing a UUID in the client.

---

# 4. Authentication

Supabase Auth manages authentication.

The database should not duplicate passwords.

Recommended identity flow:

```text
Supabase Auth User
        |
        v
profiles
        |
        v
shop_members
        |
        v
shops
```

## `profiles`

Stores application-level user information linked to `auth.users`.

Suggested fields:

- `id uuid primary key` — same UUID as `auth.users.id`
- `full_name`
- `phone`
- `avatar_url`
- `created_at`
- `updated_at`

Do not store passwords here.

---

# 5. Core Shop Tables

## 5.1 `shops`

Represents a CounterPro business.

Suggested fields:

- `id uuid primary key`
- `name`
- `shop_type`
- `phone`
- `email`
- `address`
- `city`
- `state`
- `country`
- `currency_code`
- `timezone`
- `gst_enabled`
- `gst_number`
- `invoice_prefix`
- `is_active`
- `created_at`
- `updated_at`

### Shop type

The supplied Counter App design references shop categories such as:

- Tea Shop
- Fast Food
- Tiffin Shop
- Restaurant

Store this as controlled data rather than free-form UI text where practical.

---

# 6. Shop Membership and Roles

## 6.1 `shop_members`

Connects a user to a shop.

Suggested fields:

- `id uuid primary key`
- `shop_id`
- `user_id`
- `role`
- `is_active`
- `joined_at`
- `created_at`
- `updated_at`

Unique constraint:

```text
(shop_id, user_id)
```

## Supported roles

### Owner

Full access to the Counter App.

### Supervisor

Everything except subscription management.

### Biller

Billing and day-total access only.

Do not rely on role text in the mobile application alone. Database policies must enforce the actual permissions.

---

# 7. Permission Model

The Counter App source describes permissions around areas such as:

- Bill
- Total
- Expense
- Pending
- Report
- Menu
- Users

A dedicated permission layer is recommended so the product can evolve without rewriting RLS policies for every new role.

## `permissions`

Suggested fields:

- `key`
- `name`
- `description`

Examples:

```text
bill
total
expense
pending
report
menu
users
subscription
```

## `role_permissions`

Suggested fields:

- `role`
- `permission_key`

Initial policy:

| Role | Bill | Total | Expense | Pending | Report | Menu | Users | Subscription |
|---|---|---|---|---|---|---|---|---|
| Owner | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Supervisor | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Biller | Yes | Yes | No | No | No | No | No | No |

If the product later introduces custom permissions, the role-permission table can be extended without changing the core transaction schema.

---

# 8. Menu Data Model

Recommended structure:

```text
shops
  |
  +-- menu_categories
          |
          +-- menu_items
```

## 8.1 `menu_categories`

Fields:

- `id`
- `shop_id`
- `name`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

Unique within a shop:

```text
(shop_id, name)
```

## 8.2 `menu_items`

Fields:

- `id`
- `shop_id`
- `category_id`
- `name`
- `description`
- `price`
- `tax_rate`
- `image_url`
- `is_available`
- `is_favorite`
- `sort_order`
- `created_at`
- `updated_at`

Money must use `numeric(12,2)` or equivalent fixed-precision numeric type.

Do not use `float`, `real` or `double precision` for money.

---

# 9. Billing / Sales Data Model

Core relationship:

```text
bill
  |
  +-- bill_items
  |
  +-- payments
```

## 9.1 `bills`

Suggested fields:

- `id uuid`
- `shop_id`
- `bill_number`
- `customer_id nullable`
- `status`
- `subtotal`
- `discount_amount`
- `tax_amount`
- `total_amount`
- `paid_amount`
- `pending_amount`
- `notes`
- `created_by`
- `created_at`
- `updated_at`
- `completed_at`
- `cancelled_at`
- `cancel_reason`
- `client_operation_id`

Suggested status values:

```text
draft
completed
cancelled
refunded
```

The exact supported state transitions must be enforced in application/server logic and, where practical, database constraints.

## Bill number

`bill_number` should be unique per shop:

```text
(shop_id, bill_number)
```

Never use the bill number alone as the database primary key.

---

# 10. Bill Items

## `bill_items`

Fields:

- `id`
- `bill_id`
- `shop_id`
- `menu_item_id nullable`
- `item_name_snapshot`
- `unit_price`
- `quantity`
- `discount_amount`
- `tax_rate`
- `tax_amount`
- `line_total`
- `created_at`

### Important snapshot rule

A completed bill must preserve the item name and price that were actually sold.

Do not calculate historical bills from the current `menu_items` row.

Example:

```text
Menu item today:
Chicken Biryani = ₹180

Old bill:
Chicken Biryani = ₹160
```

The old bill must continue showing ₹160 even after the menu changes to ₹180.

---

# 11. Payments

A bill may have:

- Cash
- UPI/GPay
- Pending
- Multiple payments

Therefore payments should be stored as individual records.

## `payments`

Fields:

- `id`
- `shop_id`
- `bill_id`
- `payment_method`
- `amount`
- `status`
- `reference_number`
- `paid_at`
- `created_by`
- `client_operation_id`
- `created_at`

Suggested payment methods:

```text
cash
upi
pending
other
```

The exact UI labels can remain branded while the database stores stable enum-like values.

---

# 12. Payment Integrity

For a completed bill:

```text
sum(successful payments) + valid pending balance
```

must reconcile with the bill total according to the business rule.

The application must not trust a client-provided:

```text
paid_amount
pending_amount
total_amount
```

without server/database validation.

For important payment operations, prefer a Supabase Edge Function or transactional database function so multiple rows are committed atomically.

---

# 13. Pending Payments

Pending payments are a financial obligation, not merely a UI flag.

Recommended model:

```text
bills
  |
  +-- payments
  |
  +-- pending_payment records
```

If the final implementation uses a separate `pending_payments` table, it should reference the original bill/payment context.

Suggested fields:

- `id`
- `shop_id`
- `bill_id`
- `customer_id nullable`
- `amount_due`
- `amount_paid`
- `status`
- `due_date nullable`
- `created_by`
- `created_at`
- `updated_at`
- `settled_at`

Possible statuses:

```text
open
partially_paid
settled
cancelled
```

A pending record must not become detached from the bill that created it.

---

# 14. Customers

## `customers`

Fields:

- `id`
- `shop_id`
- `name`
- `phone`
- `email nullable`
- `address nullable`
- `notes nullable`
- `is_active`
- `created_at`
- `updated_at`

Customer history should be derived from bills/payments rather than duplicated manually.

---

# 15. Vendors

The product requirements include vendor-related functionality.

## `vendors`

Fields:

- `id`
- `shop_id`
- `name`
- `phone`
- `email nullable`
- `address nullable`
- `notes nullable`
- `is_active`
- `created_at`
- `updated_at`

Do not add stock-management tables merely because vendors exist. Stock management is outside the current scope.

---

# 16. Expenses

## `expenses`

Fields:

- `id`
- `shop_id`
- `category`
- `description`
- `amount`
- `expense_date`
- `payment_method`
- `created_by`
- `created_at`
- `updated_at`
- `voided_at nullable`

Expenses should be included in reporting but must not alter completed sales totals.

---

# 17. Refunds and Cancellations

Do not silently delete completed financial records.

Recommended approach:

- bill remains stored
- bill status changes
- refund/cancellation event is recorded
- original amounts remain auditable

## Optional `refunds`

Fields:

- `id`
- `shop_id`
- `bill_id`
- `amount`
- `reason`
- `payment_method`
- `created_by`
- `created_at`
- `client_operation_id`

If the implementation uses a unified financial-event model later, this table can be consolidated. Do not create both systems unnecessarily.

---

# 18. Daily Closing / Cash Drawer

The product requires daily totals and cash-drawer functionality.

A future-safe structure is:

## `cash_sessions`

Fields:

- `id`
- `shop_id`
- `opened_by`
- `opened_at`
- `opening_cash`
- `closed_by`
- `closed_at`
- `expected_cash`
- `actual_cash`
- `difference`
- `status`

Possible status:

```text
open
closed
```

Daily totals should be calculated from transactional data rather than manually overwriting totals.

---

# 19. Reports

Reports should normally be generated from source transactions.

Do not maintain many duplicated aggregate values unless performance proves it necessary.

Core reporting sources:

```text
bills
bill_items
payments
expenses
refunds
```

Typical report dimensions:

- date
- payment method
- total sales
- pending amount
- expenses
- refunds
- item quantities
- top items
- day total

If materialized/report tables are introduced later, document the refresh strategy.

---

# 20. Subscription

The product has Free/Pro subscription behavior, with PDF report download restricted by subscription.

The database should represent subscription state separately from report records.

## `subscriptions`

Suggested fields:

- `id`
- `shop_id`
- `provider`
- `provider_customer_id nullable`
- `provider_subscription_id nullable`
- `plan`
- `status`
- `current_period_start nullable`
- `current_period_end nullable`
- `cancel_at_period_end`
- `created_at`
- `updated_at`

Possible plan values:

```text
free
pro
```

Possible status values can include:

```text
active
trialing
past_due
cancelled
expired
```

The exact payment provider integration must be finalized before production implementation.

Do not allow the Expo client to mark itself as Pro.

Subscription truth must come from trusted server-side state.

---

# 21. Audit Log

Financial and permission-sensitive actions should be auditable.

## `audit_logs`

Fields:

- `id`
- `shop_id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata jsonb`
- `created_at`

Examples:

```text
bill.created
bill.cancelled
payment.created
refund.created
expense.created
member.added
member.role_changed
menu_item.updated
subscription.changed
```

Avoid storing secrets, passwords, authentication tokens or unnecessary personal information in audit metadata.

---

# 22. Offline Synchronization

CounterPro must continue working during poor connectivity.

The local app may create a transaction while offline.

Every offline-write operation must have a stable client operation ID:

```text
client_operation_id = UUID
```

Example:

```text
Device creates bill
       |
       +-- local database
       |
       +-- sync queue
       |
       v
Supabase
       |
       +-- operation accepted once
       |
       +-- retry returns same result
```

## Idempotency

A unique constraint should prevent duplicate processing:

```text
(shop_id, client_operation_id)
```

This is especially important for:

- bill creation
- payment creation
- refund creation
- expense creation
- pending settlement

Never use timestamps as idempotency keys.

---

# 23. Local Database

The Expo application should use an Expo-compatible local persistence layer for offline operation.

The local layer is a cache/offline working store, not a replacement for the Supabase server database.

Recommended logical local stores:

```text
local_bills
local_bill_items
local_payments
local_customers
local_menu_items
sync_queue
sync_state
```

The exact local technology should be finalized during implementation.

Do not create a second independent business database with different rules.

---

# 24. Sync Queue

Recommended fields:

- `id`
- `operation_id`
- `shop_id`
- `entity_type`
- `entity_id`
- `operation_type`
- `payload`
- `status`
- `attempt_count`
- `last_error`
- `created_at`
- `last_attempt_at`

Statuses:

```text
pending
processing
synced
failed
```

The queue must be retry-safe.

---

# 25. Conflict Rules

Not every entity should use the same conflict strategy.

### Bills / payments

Financial transactions should be append-oriented.

Do not resolve conflicts by blindly choosing the latest client value.

### Menu

For non-financial editable fields, last-write-wins may be acceptable if explicitly approved.

### Customers

Field-level merge or latest-write-wins may be acceptable depending on implementation.

### Roles / permissions

Server authority wins.

### Subscription

Server/provider authority wins.

---

# 26. RLS Architecture

RLS is mandatory.

Every shop-owned table should have policies conceptually equivalent to:

```text
user is authenticated
AND
user belongs to this row's shop
AND
user has the required permission
```

Never implement:

```text
USING (true)
```

for a shop-owned production table.

## Membership helper

Create a secure database helper/function such as:

```text
is_shop_member(shop_id)
```

and permission helper such as:

```text
has_shop_permission(shop_id, permission_key)
```

The exact SQL implementation must be reviewed for recursion and performance.

---

# 27. RLS Test Matrix

Every shop-owned table should be tested against:

| Scenario | Expected |
|---|---|
| Owner reads own shop | Allowed |
| Owner writes own shop | Allowed |
| Supervisor reads own shop | Allowed where permission exists |
| Supervisor subscription change | Denied |
| Biller creates allowed bill | Allowed |
| Biller changes menu | Denied |
| Biller reads unrelated sensitive data | Denied |
| User reads another shop | Denied |
| User modifies another shop | Denied |
| Anonymous request | Denied |

Tests must cover both direct table access and RPC/Edge Function paths.

---

# 28. Indexing Strategy

Indexes should support actual query patterns.

Likely important indexes:

```text
shop_members(shop_id, user_id)
menu_categories(shop_id, sort_order)
menu_items(shop_id, category_id)
bills(shop_id, created_at)
bills(shop_id, bill_number)
bill_items(shop_id, bill_id)
payments(shop_id, bill_id)
payments(shop_id, paid_at)
customers(shop_id, phone)
expenses(shop_id, expense_date)
audit_logs(shop_id, created_at)
```

Do not create indexes blindly on every column.

After production data grows, inspect query plans and add indexes based on evidence.

---

# 29. Constraints

Important constraints include:

- primary keys
- foreign keys
- unique shop-scoped identifiers
- non-null required fields
- non-negative monetary amounts where appropriate
- valid role values
- valid status values
- valid payment methods
- positive quantities
- unique idempotency keys

Database constraints should catch impossible states even if the frontend contains a bug.

---

# 30. Delete Policy

Use foreign-key behavior deliberately.

For financial records:

```text
ON DELETE CASCADE
```

must NOT be used casually.

A menu item can be archived rather than deleted.

A completed bill should not disappear because a menu item was removed.

Historical bill items should remain intact.

---

# 31. Timestamps

Use server-generated timestamps where possible.

Recommended fields:

```text
created_at
updated_at
```

For financial events also retain the business event time:

```text
paid_at
completed_at
expense_date
```

Do not confuse:

```text
created_at
```

with:

```text
when the sale happened
```

---

# 32. Storage

Supabase Storage can be used for:

- shop logo
- menu images
- report PDFs where persistence is required
- other approved business assets

Storage paths should include tenant identity where appropriate:

```text
shops/{shop_id}/...
```

Storage access policies must also enforce shop isolation.

Never expose private files through permanent public URLs unless the product explicitly requires them.

---

# 33. Edge Functions

Use Supabase Edge Functions for operations that require trusted server-side logic, for example:

- subscription verification
- payment-provider webhooks
- sensitive report generation
- privileged financial operations
- external API secrets
- WhatsApp/provider integrations when secrets are required
- server-side reconciliation

Do not place provider secrets in the Expo bundle.

---

# 34. Database Migrations

Recommended migration structure:

```text
supabase/
  migrations/
    0001_extensions.sql
    0002_profiles_and_shops.sql
    0003_memberships_and_permissions.sql
    0004_menu.sql
    0005_billing.sql
    0006_payments_and_pending.sql
    0007_customers_vendors_expenses.sql
    0008_cash_sessions.sql
    0009_subscriptions.sql
    0010_audit_logs.sql
    0011_rls.sql
    0012_indexes_and_constraints.sql
    0013_seed_reference_data.sql
```

Actual migration numbering can differ, but migrations must be deterministic and version controlled.

---

# 35. Seed Data

Only reference/demo data should be seeded.

Examples:

- role permissions
- supported shop types
- payment method definitions

Do not seed fake production sales into a production database.

Demo/test shops must be clearly separated from production.

---

# 36. Environment Separation

Maintain separate environments where possible:

```text
development
staging/testing
production
```

Each environment should have its own Supabase project/database.

Never connect a development build to the production database by accident.

Expo environment configuration must be explicit.

---

# 37. Secrets

Never commit:

- Supabase service-role key
- payment provider secret
- webhook secret
- OAuth client secret
- private API keys

The Expo app may contain only the public client configuration required by Supabase.

Privileged keys belong server-side.

---

# 38. Backup and Recovery

Production database backup and recovery must be verified before launch.

Required operational questions:

- How frequently is the database backed up?
- How long are backups retained?
- Can a backup actually be restored?
- What is the recovery procedure?
- What happens after accidental data corruption?

A backup that has never been restored/tested should not be treated as a proven recovery plan.

---

# 39. Database Testing

Minimum test groups:

### Schema tests

- tables exist
- constraints work
- foreign keys work
- unique constraints work

### RLS tests

- owner
- supervisor
- biller
- cross-shop isolation
- unauthenticated access

### Financial tests

- bill totals
- discounts
- taxes
- partial payments
- pending balance
- refunds
- cancellations
- duplicate retry

### Offline tests

- create offline
- reconnect
- sync
- retry
- duplicate operation
- interrupted sync
- conflicting edits

### Subscription tests

- free shop
- active Pro
- expired Pro
- report PDF authorization

---

# 40. Recommended Initial ER Relationship

```text
auth.users
    |
    v
profiles
    |
    +--------------------+
    |                    |
    v                    v
shop_members --------> shops
                         |
       +-----------------+-------------------+
       |                 |                   |
       v                 v                   v
menu_categories      customers           vendors
       |
       v
menu_items

shops
  |
  +--> bills
         |
         +--> bill_items
         |
         +--> payments
         |
         +--> pending payment context

shops
  +--> expenses
  +--> cash_sessions
  +--> subscriptions
  +--> audit_logs
```

---

# 41. Production Database Definition of Done

The database is not considered complete merely because tables exist.

It is complete only when:

- schema is represented by migrations
- all required foreign keys exist
- monetary fields use safe numeric types
- shop isolation is enforced
- RLS is enabled
- RLS policies are tested
- role/permission rules are tested
- financial operations are transaction-safe
- idempotency is implemented
- offline synchronization is retry-safe
- audit logging is implemented for sensitive operations
- subscription authority is server-side
- storage policies are secure
- secrets are outside the Expo bundle
- indexes support real queries
- backups/recovery are verified
- generated client types are current
- staging tests pass
- production migration is repeatable

---

# 42. Implementation Order

Antigravity should implement the database in this order:

1. Supabase project/environment configuration
2. Extensions and base utilities
3. Profiles
4. Shops
5. Shop memberships
6. Roles and permissions
7. RLS helper functions
8. Menu categories/items
9. Customers/vendors
10. Bills
11. Bill items
12. Payments
13. Pending payments
14. Expenses
15. Refund/cancellation records
16. Cash sessions
17. Audit logs
18. Subscriptions
19. Indexes
20. RLS policies
21. Database tests
22. Seed/reference data
23. Generated TypeScript types
24. Offline sync support
25. Integration testing

Do not start with reports or dashboard aggregates before the transactional foundation is correct.

---

# 43. Antigravity Database Guardrails

Before creating or changing any table, Antigravity must answer:

1. Is this table inside the current Counter App scope?
2. Who owns the data?
3. Does it require `shop_id`?
4. What is its primary key?
5. What are its foreign keys?
6. What data can be deleted?
7. What must remain auditable?
8. What are its RLS rules?
9. Which roles can read it?
10. Which roles can insert/update/delete it?
11. Can offline synchronization create duplicates?
12. Does it need an idempotency key?
13. What indexes are required?
14. What migration creates it?
15. What tests prove it is secure?

If these questions cannot be answered, do not silently invent the schema.

---

# 44. Final Database Principle

**CounterPro's mobile UI is not the source of truth.**

The production trust chain is:

```text
React Native + Expo
        |
        v
Supabase client
        |
        v
Supabase Auth
        |
        v
RLS / Edge Functions
        |
        v
PostgreSQL
        |
        v
Auditable business data
```

Correctness, tenant isolation, financial integrity and recoverability take priority over implementation speed.

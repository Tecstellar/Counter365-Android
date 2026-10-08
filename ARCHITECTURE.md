# CounterPro Counter App --- Architecture Specification

**Document status:** Technical architecture baseline\
**Scope:** Counter App only\
**Admin Console:** Explicitly excluded\
**Architecture principle:** Reliable financial application,
offline-capable, server-authorized, database-backed.

------------------------------------------------------------------------

# 1. Architecture Goals

The architecture must provide:

1.  Correct financial data
2.  Reliable persistence
3.  Strong tenant/shop isolation
4.  Server-side authorization
5.  Offline-first operational reliability
6.  Deterministic synchronization
7.  Idempotent financial writes
8.  Maintainable frontend/backend separation
9.  Testability
10. Safe schema evolution
11. Production observability
12. Exact implementation of the supplied UI

------------------------------------------------------------------------

# 2. Technology Decision Policy

The supplied design does not define a mandatory
backend/database/framework stack.

Therefore technology choices must NOT be silently invented.

Before implementation, create an approved technology decision section
containing:

-   Mobile framework
-   Backend framework/runtime
-   Database
-   Authentication provider
-   OTP provider
-   Local database
-   API protocol
-   Hosting
-   File/object storage
-   Subscription provider
-   Analytics/monitoring

Until approved, these are `ARCHITECTURE DECISIONS REQUIRED`.

------------------------------------------------------------------------

# 3. Logical Architecture

``` text
CounterPro Mobile App
        |
        +-- UI / Presentation
        |
        +-- State Management
        |
        +-- Domain / Business Rules
        |
        +-- Local Persistence
        |
        +-- Sync Engine
        |
        +-- API Client
                 |
                 v
          CounterPro Backend
                 |
        +--------+---------+
        |                  |
 Authentication       Authorization
        |                  |
        +--------+---------+
                 |
          Domain Services
                 |
          Data Access Layer
                 |
             Database
```

External integrations are isolated behind service interfaces.

------------------------------------------------------------------------

# 4. Multi-Tenant / Shop Isolation

Every operational record must be associated with a shop/tenant.

The backend must derive the authenticated user's shop context from
trusted identity/session information.

Never trust a client-provided `shop_id` as proof of authorization.

Every protected query must apply shop isolation.

------------------------------------------------------------------------

# 5. Domain Model

The architecture must support at least the domains represented by the
supplied Counter App.

## Core identity

-   User
-   Role
-   Permission
-   UserRole / role assignment as appropriate
-   Shop

## Shop configuration

-   Shop profile
-   Shop type
-   Shop settings
-   Shop logo/file reference
-   Location metadata where enabled

## Catalog

-   Category
-   Menu Item
-   Menu Item Price/history where required
-   Favorite/order state
-   Portion configuration
-   Availability/sold-out state

## Sales

-   Bill
-   Bill Item
-   Payment
-   Pending Payment

## People

-   Customer
-   Vendor

## Expenses

-   Expense
-   Expense category if approved

## Reporting

Reports should normally be generated from transactional data rather than
persisted as mutable totals unless caching is explicitly justified.

## Audit/synchronization

-   Audit event
-   Sync operation / outbox / mutation record
-   Device/session metadata where required

## Subscription

-   Subscription
-   Entitlement
-   Verification event

Exact fields are defined only after the database schema review.

------------------------------------------------------------------------

# 6. Database Principles

## 6.1 Primary keys

Use stable unique identifiers.

Do not use human-readable bill numbers as primary keys.

## 6.2 Money

Store money using a deterministic integer minor-unit representation or
another explicitly approved exact representation.

Never rely on binary floating-point values for financial persistence.

## 6.3 Historical integrity

A historical bill must remain reproducible even if:

-   menu price changes
-   menu item is deleted
-   category changes
-   customer details change
-   tax settings change

Therefore bill items must preserve the required historical
price/name/tax snapshot.

## 6.4 Transactions

Bill creation must be atomic.

Example:

``` text
Create bill
+
Create bill items
+
Create payment
+
Create pending record if applicable
+
Create audit event
+
Create sync/outbox event
```

Either the required transaction succeeds, or the financial operation is
not partially committed.

------------------------------------------------------------------------

# 7. Suggested Relationship Model

``` text
Shop
 ├── Users
 ├── Categories
 │     └── Menu Items
 ├── Customers
 ├── Vendors
 ├── Bills
 │     ├── Bill Items
 │     └── Payments
 │            └── Pending Payment (when applicable)
 ├── Expenses
 ├── Subscription
 └── Audit Events
```

This is an architectural model, not permission to invent unsupported
fields.

------------------------------------------------------------------------

# 8. Authentication Architecture

Required properties:

-   Phone-based authentication
-   OTP verification
-   Secure session persistence
-   Logout
-   Session expiration/revocation
-   Device/session protection
-   Rate limiting
-   OTP abuse protection

The mobile client must never store authentication secrets in insecure
plain storage.

Exact provider and token technology are `UNSPECIFIED`.

------------------------------------------------------------------------

# 9. Authorization Architecture

Authorization must happen on the backend.

Example:

``` text
Request
 ↓
Authenticate
 ↓
Identify user
 ↓
Identify shop
 ↓
Resolve role/permissions
 ↓
Check operation
 ↓
Execute authorized service
```

Never:

``` text
Client hides button
→ assume user cannot perform action
```

The following operations require server authorization:

-   Create bill
-   Modify bill where allowed
-   Record payment
-   Clear pending
-   Add expense
-   Edit menu
-   Manage users
-   View reports
-   Subscription operations

------------------------------------------------------------------------

# 10. API Architecture

Use a versioned API contract.

Every endpoint must define:

-   HTTP method
-   path
-   authentication requirement
-   permission requirement
-   request schema
-   validation
-   response schema
-   error schema
-   idempotency requirement
-   transaction boundary

Example conceptual API groups:

``` text
/auth
/shop
/users
/catalog
/bills
/payments
/pending
/customers
/vendors
/expenses
/reports
/subscription
/sync
```

Exact endpoint paths must be finalized before implementation.

------------------------------------------------------------------------

# 11. Idempotency

Financial mutation endpoints must be idempotent.

Example:

``` text
Client creates bill
request_id = ABC123

Network times out

Client retries ABC123

Server detects ABC123 already processed

Server returns original result

No duplicate bill.
```

Do not use timestamps alone as duplicate protection.

------------------------------------------------------------------------

# 12. Offline Architecture

The mobile application requires durable local persistence.

Recommended logical model:

``` text
UI
 ↓
Domain operation
 ↓
Local transaction
 ↓
Outbox / sync queue
 ↓
UI reflects local committed state
 ↓
Sync worker
 ↓
Server
 ↓
Acknowledgement
 ↓
Mark operation synchronized
```

Offline billing must not depend on immediate server availability.

------------------------------------------------------------------------

# 13. Synchronization

Each sync mutation should have a stable operation identifier.

Sync states may include:

-   pending
-   uploading
-   acknowledged
-   failed
-   retrying

The exact state model must be implemented consistently.

### Retry

Use bounded retry with backoff.

Do not retry permanent validation/authentication failures indefinitely.

### Duplicate protection

Server must recognize previously accepted operation IDs.

------------------------------------------------------------------------

# 14. Conflict Handling

Potential conflicts include:

-   Menu edited on multiple devices
-   User permissions changed while device is offline
-   Payment cleared from another device
-   Shop settings changed remotely

Financial conflicts must never be resolved by silently overwriting money
records.

The conflict policy must be explicitly approved before multi-device
production rollout.

------------------------------------------------------------------------

# 15. Billing Domain

The domain layer should calculate:

``` text
Line Total
= Unit Price × Quantity

Subtotal
= Sum(Line Totals)

Tax
= Approved tax calculation

Total
= Subtotal + Tax - Approved discounts
```

Do not duplicate calculation logic in:

-   UI
-   backend controller
-   report code
-   PDF generator

Create a single authoritative business-rule implementation.

------------------------------------------------------------------------

# 16. Payment Domain

Payment status must be represented explicitly.

For the supplied UI:

-   Cash
-   GPay
-   Pending

The payment model must support future extensibility without changing
historical records.

Pending is a financial state, not merely a UI label.

------------------------------------------------------------------------

# 17. Reports

Reports must query authoritative transactional data.

Avoid:

``` text
Dashboard total
→ report total
→ hardcoded different calculation
```

Instead:

``` text
Bills + Payments + Expenses
        ↓
Authoritative reporting service
        ↓
Dashboard
Reports
Exports
```

This prevents inconsistent numbers.

------------------------------------------------------------------------

# 18. Audit Trail

Financial and permission-sensitive actions should be auditable.

At minimum consider auditing:

-   Bill creation
-   Payment recording
-   Pending clearance
-   Expense creation
-   Menu changes
-   User/role changes
-   Subscription changes
-   Important sync events

Exact retention requirements are `UNSPECIFIED`.

------------------------------------------------------------------------

# 19. File / Image Storage

Shop logos and generated documents must not be stored as arbitrary
database blobs unless explicitly approved.

Use an approved storage strategy and store secure references.

Exact provider is `UNSPECIFIED`.

------------------------------------------------------------------------

# 20. Error Architecture

Use structured application errors.

Categories:

``` text
VALIDATION_ERROR
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
NOT_FOUND
CONFLICT
NETWORK_ERROR
SYNC_ERROR
DATABASE_ERROR
EXTERNAL_SERVICE_ERROR
INTERNAL_ERROR
```

The client must map technical failures to safe user-facing messages.

Never display:

-   SQL statements
-   stack traces
-   access tokens
-   internal server details

------------------------------------------------------------------------

# 21. Database Migration Policy

Every schema change must be a versioned migration.

Never edit production tables manually as the normal development
workflow.

Every migration must be:

-   reversible where practical
-   tested
-   reviewed
-   compatible with deployed application versions where required

------------------------------------------------------------------------

# 22. Environment Configuration

Never hardcode:

-   API secrets
-   OTP secrets
-   database credentials
-   subscription secrets
-   private keys

Maintain separate environments:

``` text
development
staging
production
```

Production credentials must never be committed to source control.

------------------------------------------------------------------------

# 23. Testing Architecture

Required levels:

### Unit tests

-   Money calculations
-   Tax
-   discounts
-   permissions
-   validation
-   synchronization logic

### Integration tests

-   API + database
-   authentication
-   authorization
-   bill transaction
-   payment transaction
-   pending clearing

### End-to-end tests

-   Registration
-   Login
-   Billing
-   Cash payment
-   GPay payment
-   Pending payment
-   Expense
-   Reports
-   User permissions

### Offline tests

-   Create bill offline
-   Kill application before sync
-   Restore network
-   Retry
-   Duplicate retry
-   Server failure
-   Conflict scenarios

------------------------------------------------------------------------

# 24. Observability

Production must have:

-   structured logs
-   crash reporting
-   API error monitoring
-   sync failure monitoring
-   database error monitoring
-   performance monitoring

Never log sensitive authentication or payment secrets.

------------------------------------------------------------------------

# 25. Security

Required:

-   Secure authentication
-   Backend authorization
-   Shop isolation
-   Input validation
-   Rate limiting
-   Secure local storage
-   Secure API transport
-   Secret management
-   Dependency auditing
-   Database access controls
-   Safe error messages

------------------------------------------------------------------------

# 26. Architecture Completion Gate

Architecture is approved only when:

-   [ ] Technology stack decided
-   [ ] Database schema reviewed
-   [ ] Relationships reviewed
-   [ ] API contract reviewed
-   [ ] Authentication decided
-   [ ] Authorization decided
-   [ ] Offline strategy decided
-   [ ] Sync strategy decided
-   [ ] Conflict policy decided
-   [ ] Financial representation decided
-   [ ] Subscription strategy decided
-   [ ] Printer strategy decided
-   [ ] Sharing strategy decided
-   [ ] Testing strategy decided
-   [ ] Security strategy decided
-   [ ] Migration strategy decided

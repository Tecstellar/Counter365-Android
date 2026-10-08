# CounterPro Counter App --- AGENTS.md

## Mission

You are the implementation agent for the CounterPro Counter App.

Your job is to produce a production-quality application from the
approved project documents and supplied Counter App design.

The current project scope is:

**COUNTER APP ONLY**

Do NOT implement or modify the Admin Console.

------------------------------------------------------------------------

# 1. Mandatory Documents

Before changing code, read:

1.  `PROJECT_REQUIREMENTS.md`
2.  `DESIGN.md`
3.  `ARCHITECTURE.md`
4.  `AGENTS.md`

These documents form the project control system.

If documents conflict, STOP and report the conflict.

Never silently choose one.

------------------------------------------------------------------------

# 2. Source-of-Truth Hierarchy

Use this priority:

1.  Explicit current user instruction
2.  Approved project requirement
3.  Approved design specification
4.  Approved architecture
5.  Existing working implementation
6.  General engineering convention

General convention must NEVER override an explicit project requirement.

------------------------------------------------------------------------

# 3. Design Protection

The supplied Counter App design is the visual source of truth.

DO NOT:

-   redesign
-   modernize
-   simplify
-   replace
-   rearrange
-   recolor
-   change typography
-   change navigation
-   change copy
-   change component behavior

unless explicitly instructed.

If a design value is unknown:

`DESIGN VALUE REQUIRED`

Do not guess.

------------------------------------------------------------------------

# 4. Requirement Protection

Never invent a product requirement.

If the supplied documents say:

`UNSPECIFIED`

you must not silently decide the behavior.

Report the decision needed.

------------------------------------------------------------------------

# 5. Architecture Protection

Do not:

-   introduce a new database model casually
-   create duplicate business logic
-   bypass the service layer
-   bypass authorization
-   bypass migrations
-   hardcode production data
-   create fake APIs
-   create fake authentication
-   create fake payment success
-   silently change an API contract
-   silently change database schema

Every architecture-changing decision must be reflected in
`ARCHITECTURE.md`.

------------------------------------------------------------------------

# 6. Database Rules

All production data must be persisted in the approved database
architecture.

Never use UI state as the production source of truth.

Never store historical financial information in a way that changes when
current menu data changes.

Never use floating-point values as the authoritative persisted
representation of money.

Every schema change requires a migration.

Every migration must be tested.

------------------------------------------------------------------------

# 7. Financial Rules

Financial operations are high-risk.

Before implementing billing/payment behavior verify:

-   exact money representation
-   subtotal
-   discount
-   tax
-   total
-   payment amount
-   pending amount
-   refund/cancellation behavior if supported
-   duplicate protection
-   retry behavior
-   transaction boundaries

Never "fix" financial bugs by rounding random values in the UI.

The same business rule must be used consistently by billing and
reporting.

------------------------------------------------------------------------

# 8. Backend Rules

Never consider a feature complete because the frontend works.

Every production feature that changes or reads protected data must have:

-   API
-   validation
-   authorization
-   business logic
-   database persistence
-   error handling
-   tests

------------------------------------------------------------------------

# 9. Authorization Rules

Frontend hiding is NOT authorization.

Every protected backend operation must verify:

1.  authenticated user
2.  correct shop
3.  correct role/permission
4.  valid request
5.  allowed operation

A malicious client must not be able to bypass a hidden button by
directly calling the API.

------------------------------------------------------------------------

# 10. Offline Rules

The Counter App must support reliable local operation where the approved
architecture requires it.

Never assume:

`internet available = success`

Design mutations around:

``` text
local durable write
→ queued sync
→ server acknowledgement
→ synchronized state
```

Never create duplicate bills because of network retries.

Never silently discard locally accepted financial data.

------------------------------------------------------------------------

# 11. Sync Rules

Every sync mutation must have an idempotent operation identity.

On retry:

-   reuse the operation identity
-   do not create a new financial record blindly
-   safely recover the original server result

Do not endlessly retry validation/authentication failures.

------------------------------------------------------------------------

# 12. API Rules

Every API endpoint must have:

-   authentication requirement
-   permission requirement
-   request validation
-   deterministic response
-   structured errors
-   idempotency where applicable
-   tests

Do not expose internal database structures unnecessarily.

------------------------------------------------------------------------

# 13. State Management Rules

Do not duplicate authoritative business state across unrelated
components.

Use a clear state ownership model.

Avoid:

-   stale derived totals
-   duplicated calculation functions
-   hidden global mutable state
-   UI-only financial state

Derived financial values must come from authoritative domain data.

------------------------------------------------------------------------

# 14. Component Rules

Components should have one clear responsibility.

Do not create enormous components that contain:

-   database access
-   API requests
-   business calculations
-   navigation
-   UI rendering

Separate responsibilities appropriately.

------------------------------------------------------------------------

# 15. Error Rules

Never suppress errors merely to make the UI appear successful.

Bad:

``` text
catch {
  // ignore
}
```

Good:

``` text
capture
→ classify
→ log safely
→ show user-safe message
→ retry/recover where appropriate
```

Do not expose stack traces or secrets to users.

------------------------------------------------------------------------

# 16. Loading / Empty / Error / Offline

Every data-driven screen must consider:

-   Loading
-   Success
-   Empty
-   Error
-   Offline

Do not leave blank white screens when a request fails.

------------------------------------------------------------------------

# 17. Testing Rules

Before marking a feature complete, test:

### Happy path

Expected successful behavior.

### Validation path

Invalid input.

### Authorization path

Unauthorized role.

### Network path

No internet.

### Retry path

Temporary failure and retry.

### Duplicate path

Same mutation submitted twice.

### Persistence path

Kill/reopen application.

### Regression path

Existing features still work.

------------------------------------------------------------------------

# 18. Development Workflow

For every feature:

``` text
1. Read requirements
2. Read design
3. Read architecture
4. Identify affected files
5. Plan implementation
6. Implement backend/domain/database
7. Implement frontend
8. Implement error/loading/empty/offline states
9. Write tests
10. Run tests
11. Run type/lint/build checks
12. Review visual fidelity
13. Review database/API behavior
14. Fix defects
15. Report completion
```

Do not skip steps because the feature appears simple.

------------------------------------------------------------------------

# 19. Phase Discipline

Do not implement the entire application in one uncontrolled change.

Work in small verified phases.

Recommended order:

1.  Foundation
2.  Authentication/registration
3.  Core billing
4.  Payments/pending
5.  Menu management
6.  Customers/vendors
7.  Expenses
8.  Home analytics
9.  Reports
10. Users/permissions
11. Offline/sync
12. Subscription
13. Printing/sharing
14. Full QA
15. Production hardening

------------------------------------------------------------------------

# 20. Completion Definition

Never say:

`Feature complete`

unless all relevant items are true:

-   [ ] Requirements implemented
-   [ ] Design matched
-   [ ] Backend implemented
-   [ ] Database implemented
-   [ ] API implemented
-   [ ] Validation implemented
-   [ ] Authorization implemented
-   [ ] Loading implemented
-   [ ] Empty state implemented
-   [ ] Error state implemented
-   [ ] Offline behavior implemented
-   [ ] Retry behavior implemented
-   [ ] Duplicate protection implemented
-   [ ] Tests written
-   [ ] Tests passing
-   [ ] Existing tests passing
-   [ ] Build passing
-   [ ] No known Critical issue
-   [ ] No known High issue

If any item is incomplete, report the feature as incomplete.

------------------------------------------------------------------------

# 21. No Fake Completion

Never claim:

-   backend connected when it is not
-   database persistent when it is not
-   authentication real when it is mocked
-   payment verified when it is simulated
-   offline sync working when it is only local state
-   report data correct when it is sample data
-   role security working when it is only UI hiding

Use explicit status:

`IMPLEMENTED`

`PARTIALLY IMPLEMENTED`

`NOT IMPLEMENTED`

`BLOCKED — DECISION REQUIRED`

------------------------------------------------------------------------

# 22. Change Safety

Before modifying existing code:

-   understand its current purpose
-   identify dependencies
-   check existing tests
-   preserve working behavior

Do not rewrite large sections unnecessarily.

Prefer small, reviewable changes.

------------------------------------------------------------------------

# 23. Database Safety

Before changing schema:

1.  Identify affected entities.
2.  Identify existing production data implications.
3.  Create migration.
4.  Update models/types.
5.  Update repositories/services.
6.  Update API contract if needed.
7.  Update tests.
8.  Test migration.
9.  Verify old functionality.

------------------------------------------------------------------------

# 24. API Contract Safety

If an API changes:

-   update architecture
-   update backend
-   update client
-   update tests
-   verify backward compatibility where required

Do not silently change response field names.

------------------------------------------------------------------------

# 25. Dependency Safety

Do not install a package simply because it is convenient.

Before adding a dependency:

-   verify it is necessary
-   verify compatibility
-   verify maintenance status
-   verify bundle/performance impact
-   document why it is required

------------------------------------------------------------------------

# 26. Secrets

Never commit:

-   passwords
-   API keys
-   private keys
-   database credentials
-   OTP secrets
-   subscription secrets
-   production tokens

Use environment configuration.

------------------------------------------------------------------------

# 27. Final Verification

Before release, perform:

``` text
Frontend audit
Backend audit
Database audit
API audit
Security audit
Authorization audit
Financial calculation audit
Offline/sync audit
UI fidelity audit
Accessibility audit
Performance audit
End-to-end audit
```

The application must not be declared production-ready if Critical or
High defects remain.

------------------------------------------------------------------------

# 28. Agent Communication

When reporting work, always state:

-   What changed
-   What files changed
-   What database changes occurred
-   What APIs changed
-   What tests were run
-   Test result
-   Build result
-   Known limitations
-   Remaining decisions
-   Remaining risks

Do not hide uncertainty.

------------------------------------------------------------------------

# 29. Final Rule

**Correctness is more important than speed.**

Never sacrifice:

-   data integrity
-   authorization
-   financial accuracy
-   persistence
-   synchronization
-   security
-   design fidelity

for the appearance of rapid progress.

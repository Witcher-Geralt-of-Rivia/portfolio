<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Demo 01 — Operations Implementation

How the Operations domain is built. The product contract it implements is
`docs/DEMO_OPERATIONS_SPEC.md`, which stays canonical; this document records
the code beneath it.

```
STATUS      domain complete / shell + Overview complete / ten modules unbuilt
STAGE       09C1, 09C2 and 09C2.1 complete
REGISTRY    operations = building
ROUTE       /demos/operations DEPLOYED, noindex, for external live review
```

## Stage 09C programme

```
09C1  domain + seed + runtime audit extension        COMPLETE
09C2  shell + routes + Overview                      COMPLETE
09C2.1 shell hardening + review deployment           COMPLETE
09C3  Leads + Customers + Inbox                      BLOCKED on live review
09C4  Reservations + Contracts + Fleet + Maintenance + Payments
09C5  Automations + Reports + notifications + integrated workflows
09C6  full QA + Work integration eligibility + deployment
```

## Layout

```
src/demos/operations/
  types.ts              13 entities, every canonical value a literal union
  constants.ts          collections, id prefixes, clock, counts, distributions
  permissions.ts        the four-role matrix and its guards
  operations-runtime.ts composition root; binds the seed to a DemoRuntime
  seed/
    names.ts            synthetic name and text pools
    entities.ts         the canonical dataset, built deterministically
    audit.ts            the 63 seeded audit entries
    index.ts            assembly + assertOperationsSeedIntegrity
  selectors/
    derive.ts           vehicle status, payment status, contract money, intervals
    overview.ts         Overview KPIs and the four report groups
    queries.ts          search, filter, sort, pagination
  services/
    context.ts          service context, typed reads, vehicle refresh
    leads.ts customers.ts reservations.ts contracts.ts
    payments.ts maintenance.ts inbox.ts notifications.ts automations.ts
  ui/                   Stage 09C2
    modules.ts          the eleven routes + the temporary `implemented` flag
    icons.tsx           eleven navigation glyphs, authored locally
    OperationsProvider  role -> OperationsContext, and the actor behind it
    OperationsRoute     the client boundary
    OperationsAppShell  sidebar, top bar, drawer, role control slot
    OperationsSidebar   role-filtered navigation
    OperationsOverview  reads collections, calls the selector, renders
    OverviewPanels      KPI grid, lead funnel, fleet ring, tables, queue
    NotificationCenter  disclosure popover; a sheet on a phone
    overview-policy.ts  Stage 09C2.1 - what each role sees, derived from
                        permissions.ts rather than restated
```

Twenty-one domain modules plus nine interface modules. Validation lives with
the service that enforces it rather
than in a parallel `validation/` tree: a rule and its only caller drifting
apart is the failure that arrangement invites.

## The boundary

`src/demo-runtime/` never learns what a lead is. The dependency runs one way,
and `qa/stage09c1-operations.mjs` asserts it by reading the source: no runtime
module imports from `src/demos/`, and no Operations entity name appears in
runtime code once comments are stripped — the runtime's own prose explains what
it must not know, and that explanation is not a leak.

```
Operations UI          shell + Overview (09C2); ten modules to come
      ↓
Operations services    leads · customers · reservations · contracts
                       payments · maintenance · inbox · notifications
                       automations
      ↓  ├── domain events → automation jobs → AutomationRun
      ↓  ├── audit entries
      ↓  └── notifications
Demo Runtime           records · collections · clock · ids · repository
                       async boundary · events · audit · jobs · session
      ↓
Persistence adapter →  IndexedDB   (memory fallback)
```

## Derived state

Three values are computed, never trusted as stored flags. This is what stops
the demo contradicting itself.

**Vehicle status.** `deriveVehicleStatus` applies the frozen precedence — an
active work order, then an Active contract, then a Confirmed reservation, then
Available. Every service that touches a contract, reservation or work order
ends by calling `refreshedVehicle`, which rewrites the status *and* clears the
relationship pointers; a stale `currentContractId` on an Available vehicle is
the same class of lie as a stale status. No form writes the status.

Eligibility and status answer different questions, and both are right: a
vehicle whose current rental ends next week is eligible for a booking the week
after, and still reads as Rented today. The QA harness asserts both.

**Payment status.** Stored as `Pending | Paid`. `Overdue` is derived from
`dueAt` against the logical clock (D-053), so a payment cannot disagree with
the demo's own time. `reconcileTimeDerivedState` raises `payment.overdue`
explicitly rather than a loop polling for it.

**Contract money.** `totalAmount = dailyRate × billableDays`, with partial days
rounded up and a floor of one. Everything is integer cents, so a balance built
from several payments cannot drift.

## Determinism

No `Math.random`, no `crypto.randomUUID`, no `Date.now()` — asserted by the
harness across the whole domain. Ids come from the runtime's per-collection
counters; timestamps come from the logical clock, based at
`2026-09-01T09:00:00Z`.

The seed is built by functions rather than hand-authored: 301 literal records
would be unreadable and impossible to keep consistent. Distributions are
expanded from the frozen counts and then walked with a stride coprime to their
length, which visits every element exactly once — the counts are untouched and
the order is still completely determined, but a list does not open with twelve
consecutive "New" leads.

The four relationship identities hold **by construction**, not by assertion
afterwards. The vehicle indices are carved into four pools that never overlap:

```
0-6    seven Rented        an Active contract
7-10   four Reserved       a Confirmed reservation
11-13  three Maintenance   an Open or In Progress work order
14-23  ten Available       only inactive history touches these
```

## Seeded audit (D-052)

63 entries, one per state transition the dataset implies. Creation is not
audited; transitions are, which is the rule the live services follow too.

The Stage 09A runtime could not express this: `ResetPayload` carried only
`records` and `meta`. The extension is minimal — an optional `audit` array on
`ResetPayload`, written inside the same transaction as the purge and reseed in
both adapters. `DemoSeed` gained an optional `audit`, and the runtime assigns
`demoId` and the sequence numbers so a seed cannot hand out a sequence that
collides with later mutations. `meta.auditSequence` starts at 63, so a
visitor's first audited action is entry 64.

Optional means optional: a demo that seeds no history still resets audit to
zero, which the harness checks against a generic Field fixture.

## Permissions

One table in `permissions.ts`, consulted by services and later by the UI. Every
mutating service calls `requireWrite` itself, so a write cannot reach
persistence because a screen forgot to hide a button — `FORBIDDEN` is raised in
the domain. The harness runs each service under all four roles.

This is an interaction simulation, not a security boundary. Nothing is
authenticated, every record stays readable in browser storage whatever role is
selected, and it is never described as RBAC or access control. What it
demonstrates is that an application enforces its rules in one place.

## Automation

Five typed rules, one function each. No generic expression evaluator: five
known rules written plainly are easier to read and honest about what the demo
does.

```
domain event → job → rule evaluation → action → AutomationRun → notification
```

Explicit processing. The job is enqueued and drained in the same breath — it
exists so the deferred path is real rather than implied, not so work can sit
around. A disabled rule still records a `Skipped` run, because silently doing
nothing leaves a visitor who just switched a rule off with no evidence the
system noticed.

Rule 01's rotation is deterministic and resolves to `actor_0002`, the only
seeded Sales Agent. Rule 02 sets the follow-up two days out (D-053). Rule 03
appends a local System message with no recipient. Rules 04 and 05 raise
notifications; vehicle state after a completed work order is recomputed by the
domain rules, never by an automation action — automation must not become a
second source of truth.

## QA

`qa/stage09c1-operations.mjs`, 211 checks. The whole business suite runs twice,
once per persistence adapter, because the two must be indistinguishable.

```
dependency boundary   runtime imports nothing from src/demos; no entity name
                      in runtime code; no any/ts-ignore/random/Date.now
seed integrity        counts, distributions, the four identities, referential
                      integrity, message ordering, audit validity
business suite x2     counts, distributions, Overview KPIs, W1-W6, role matrix,
                      conflict contracts, reset determinism
demo isolation        Field and Learning untouched by Operations mutation and
                      reset; a seed with no audit still resets to zero audit
content safety        2184 seeded strings scanned for emails, telephones, URLs,
                      messaging links, social handles and real brands
refresh persistence   lead, payment and notification survive a reload
memory fallback       forced IndexedDB failure still seeds, runs a workflow,
                      serves selectors and resets
performance sanity    a regression tripwire, never published as a benchmark
```

`qa/stage09c2-operations-ui.mjs` adds 140 checks against a local production
build, covering branding, route metadata, the Overview figures, the role
matrix, notifications, reset, accessibility, contrast, nine viewports, the
memory fallback, CLS and idle cost.

### Running it

The domain is browser code and cannot be exercised in Node. The fixture lives
under `qa/` so creating the route is a deliberate act:

```
cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
npm run dev
node qa/stage09c1-operations.mjs
rm -r src/app/demos/qa-operations
```

No QA route exists in the committed tree or in production.

## The interface (09C2)

`/demos/operations` is a Server Component page carrying the metadata and
inheriting the subtree's `noindex, nofollow`; one client boundary sits beneath
it, because everything below needs the browser.

**Two independent questions.** A module the selected role cannot view is not
rendered at all — the navigation never advertises data the role has no access
to. A module that exists for the role but is unbuilt renders as a
non-interactive label, because a link to a 404 is worse than one that is
plainly not ready. The second is temporary build state carried by
`implemented` in `ui/modules.ts`, and it disappears module by module through
09C3 to 09C5 along with the styling that reads it.

**KPIs follow the role too.** A KPI summarises a module's data, so showing one
for a module the role cannot open would make the Overview a hole in its own
policy. Admin sees four, Sales Agent two, Fleet Coordinator two, Finance
Analyst one. No filler card is invented to keep the row at four, and there are
no trend badges — there is no previous period to compare against, and a "+12%"
would be a fabricated metric.

**Everything derived.** The screen computes nothing: it reads the collections
once, hands them to `selectors/overview.ts` and renders the result. Nothing on
it is written as a literal.

Visuals are CSS and authored SVG — no chart library, no icon package. Where an
SVG carries data it is `aria-hidden` and the same values appear in text beside
it, so nothing depends on distinguishing four soft hues.

## Hardening (09C2.1)

Four defects, all found by looking at the rendered product rather than at the
code, and three of them present while the 09C2 suite was passing.

**The role rule was half applied.** 09C2 filtered KPI cards and nothing else.
`ui/overview-policy.ts` now maps every surface — KPI, panel, action-queue
category, notification category — to the module whose data it summarises, and
asks `permissions.ts` whether the role can open it. Derived, not restated, so
the two cannot drift. The visible symptom was a Finance notification badge
reading 8 over a list of 3 (D-056).

**KPI progress bars had no denominator.** They were replaced by breakdowns that
sum to the headline and can be checked against the panels below (D-057).

**The notification popover overflowed a phone.** Below 768px it presents as a
full-width sheet under the top bar, with a scrim, an explicit close control,
the page behind locked, and its own internal scroll (D-060 covers the shared
bar that sits above it).

**The mark carried the master's padding.** `public/brand/mark-120.png` is
trimmed to the artwork's bounds plus a 5% margin, keeping its aspect (D-059).

### The query bug underneath

Fixing the badge exposed a shared-runtime defect that mattered more than any of
the above. `useDemoQuery` discarded its data on every revalidation, so marking
eight notifications read — eight writes, eight revision bumps — cleared the
badge and emptied the list after the first write, while seven were still
outstanding. A reload then restored them, so the demo looked like it was losing
data it had never saved.

The persistence layer was never at fault: the IndexedDB adapter awaits
`tx.oncomplete`, so a resolved commit is durable. Reading the store directly at
the moment the badge cleared showed six or seven still unread. The hook now
keeps the previous answer while re-reading the same question, and drops it when
the question changes — the distinction matters, because keeping stale data
across a role change would leak the previous role's records for a frame
(D-058).

`OperationsOverview` stopped falling back to its skeleton on every mutation as
a consequence: the skeleton is for having nothing to show, not for refreshing
what is on screen.

### QA

`qa/stage09c21-operations-hardening.mjs`, 107 checks against a local production
build: KPI semantics and sums, the role matrix, role containment, the mobile
sheet at 390 and 360, the master logo's bytes and the derived mark's geometry,
and reset. Full regression is 715 checks across seven suites; see
`docs/QA_BASELINE.md`.

### Deployment

Deployed with `npm run deploy:safe` so it can be judged live. The registry
keeps `operations = building`, the route stays `noindex, nofollow`, nothing
links to it, and `#work` is untouched. Stage 09C3 is blocked until the review
comes back (D-061).

## Remaining UI work

Ten module screens: Leads, Customers, Reservations, Contracts, Fleet,
Maintenance, Payments, Automations, Inbox and Reports. Every service and
selector they need already exists. `#work` still renders its placeholder, and
the demo is deployed but unadvertised — `noindex, nofollow`, linked from
nowhere.

<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Demo Platform

Canonical for the demo architecture. What the platform is, how the runtime is
built, what it may and may not claim, and what has to be true before any of it
reaches the Work section.

## Purpose

Stage 09 originally planned a Work section of conventional case studies. That
route is blocked: the repository holds no verified client engagement, and
`docs/CASE_STUDY_SOURCE_AUDIT.md` records the search that established it. One
internal case study exists and is not public.

The strategy changed. Instead of describing work that cannot be evidenced, the
Work section becomes a launcher into three substantial interactive product
demonstrations that a visitor can use:

```
Demo 01   Operations / CRM / ERP SaaS        /demos/operations
Demo 02   Field Operations Web + Mobile      /demos/field
Demo 03   Adaptive Learning Platform         /demos/learning
```

Each behaves like real software while being entirely synthetic, entirely
client-side, and honest about both. Those route identities are frozen; the
fictional product names shown inside each application are decided per demo.

## Disclosure

Every finished demo carries, visibly:

```
INTERACTIVE ENGINEERING DEMO
SYNTHETIC DATA · FRONTEND ONLY
```

The strings live once, in `src/demo-runtime/demo-registry.ts`. The casing and
layout may be refined. The meaning may not be weakened, and the disclosure may
not be moved anywhere it can be missed.

A demo is never presented as client work, a live customer system, a production
customer application, or real operational data.

## Runtime architecture

```
React product UI
      ↓
Domain service            per demo; knows leads, jobs, lessons
      ↓
Mock async boundary       deterministic latency, no network
      ↓
Repository                generic list/get/query
      ↓
Persistence adapter       IndexedDB, or memory
      ↓
IndexedDB
```

Side channels hanging off the domain service: domain events, audit history, the
job queue, and reactive subscribers.

**UI never touches IndexedDB.** That is a hard rule. Everything above the
adapter speaks to `DemoPersistenceAdapter`, which is what allows the memory
fallback to exist and what keeps one runtime serving three unrelated products.

**The runtime knows records, collections, events, jobs, audit, roles, a clock
and persistence. It does not know what a lead, a vehicle, a technician or a
lesson is.** Those belong to each demo's own domain layer. Keeping that
boundary is the whole reason three products can share one runtime.

## Frontend only

No database server, no API route, no server action, no Redis, no WebSocket
server, no Firebase, no Supabase, no external persistence service, and no paid
AI. All application state lives in the browser; Next.js serves the static
frontend and nothing else.

`D-024` records the project-wide rule as "no backend, no database". That entry
is about server infrastructure. Browser-local synthetic storage is a different
thing and is explicitly permitted by the Stage 09A specification, which
requires IndexedDB in the same document that forbids a database server. `D-046`
records the distinction so the wording cannot be misread later.

## Persistence

| Item | Value |
|---|---|
| Database | `portfolio-demo-runtime` |
| Runtime schema version | 1 (frozen) |
| Stores | `records`, `meta`, `audit`, `jobs` |
| Adapters | `indexeddb` (primary), `memory` (fallback) |

Keys and indexes:

```
records   key ["demoId","collection","id"]
          index by_demo             demoId
          index by_demo_collection  ["demoId","collection"]
meta      key "demoId"
audit     key ["demoId","sequence"]
          index by_demo             demoId
jobs      key ["demoId","id"]
          index by_demo             demoId
          index by_demo_status      ["demoId","status"]
```

One database for all three demos. Isolation comes from `demoId` leading every
composite key, so a cross-demo read is structurally impossible rather than
something the query layer must remember.

Generic records rather than a store per entity: adding a demo entity must not
require a schema migration.

### Upgrades

`onupgradeneeded` creates missing stores and indexes and touches nothing else.
The database is never deleted on upgrade — that would discard a visitor's demo
state on every release. Individual demos reset when their own seed version
changes.

### Fallback

If IndexedDB cannot be opened — a private window, blocked site data, a quota
failure — the runtime falls back to a memory adapter, stays fully usable for
the session, and the shell shows `PERSISTENCE / SESSION ONLY`. It never implies
that changes will survive a reload when they will not.

The memory adapter is held to the same semantics as IndexedDB: structured
cloning on read and write, all-or-nothing commits, identical key uniqueness. A
fallback that quietly relaxed those would hide the bugs it exists to survive.

## Determinism

No `Math.random()`. No `crypto.randomUUID()` for canonical entities.

**Ids** are a monotonic counter per demo and collection, formatted
`customer_0001`. Counters persist with the demo's metadata and return to their
canonical values on reset.

**Time** comes from a logical clock: a base instant from the seed plus a tick
per mutation. Never `Date.now()`. Timestamps are synthetic and are never
presented as real-world event times.

Together these make reset mean reset: the same seed and the same number of
mutations always produce the same ids, the same timestamps and the same
aggregate values, so a screenshot is reproducible and a QA assertion about "the
third audit entry" can be written at all.

**Latency** in the mock boundary is derived from the operation's own name, so
different calls feel different while nothing varies between runs. Reads land in
100–140ms, mutations 160–220ms, commands 220–300ms. A harness may switch to
`instant`; that changes delay only, never a result.

## Mutations

Domain services build a plan and hand it to the runtime, which commits every
operation in one persistence transaction. Computing first and writing second is
not a style preference: an IndexedDB transaction commits as soon as control
returns to the event loop with no request outstanding, so a transaction that
pauses to think has already ended.

Ids and timestamps are allocated against a scratch copy of the demo's metadata.
A builder that throws, or a write that persistence rejects, leaves counters and
clock untouched — no id is silently burnt.

`revision` increments on every committed mutation. `0` means canonical,
freshly-seeded state, so `revision > 0` reliably answers "has the visitor
changed anything?". React invalidation, cross-tab invalidation and QA
assertions all read it.

## Events, audit and jobs

**Domain events** are a synchronous in-browser bus, scoped to one demo. No
timer, no queue drain, no network.

**Audit** records meaningful business mutations — a lead converted, a job
reassigned — written deliberately by workflows. It is not an event dump; a
trail full of "tab clicked" teaches nobody anything.

**Jobs** are persistent client-side deferred work with `pending`, `processing`,
`complete` and `failed`. There is no worker and no timer: a job moves only when
a workflow calls `processPending`. A future UI may honestly call these
background jobs or a sync queue, because that is the concept being modelled. It
must not imply a server is doing the work.

## Roles

`activeRole` and `activeActorId`, persisted in `localStorage` under
`portfolio-demo:<demoId>:role`.

**Role switching is an interaction simulation, not a security boundary.**
Nothing is authenticated or authorised, and every record stays readable in
browser storage whatever role is selected. It is never described as RBAC or as
access control.

## Connectivity

A visitor-controlled `online` / `offline` flag for demos that show offline
behaviour. It deliberately does not read `navigator.onLine`: real connectivity
is not reproducible and is usually true at a desk, which makes the offline path
impossible to demonstrate on purpose. Session-scoped, not persisted — a reload
returns to online, because nothing about the browser is actually offline.

The offline contract for a future demo: queue eligible mutations, show pending
sync state, replay on simulated reconnect.

## Cross-tab

`BroadcastChannel("portfolio-demo-runtime")` carries an invalidation signal
only — `{ demoId, revision, reason }`. Never record data: the database is
already the shared source of truth, so re-reading is both smaller and correct
by construction. Where the API is unavailable the demo works normally in its
own tab; multi-tab sync is an enhancement, never a requirement.

Two tabs writing at the same instant is last-writer-wins. That is the honest
limit of a frontend-only demo with no server to arbitrate.

## Reset

Reset restores one demo and only that demo: its records, audit, jobs, counters,
logical clock, revision and default role. Another demo's data is never touched
— the QA harness asserts this directly.

The destructive purge and the reseed share one transaction. A reset that
emptied the demo and then failed to reseed would leave a visitor with an empty
application and no obvious way back.

The control lives in the shared demo chrome, never inside a fictional product's
settings, because hunting for it inside the simulation is when a visitor gives
up instead.

## Release compatibility

```
seedVersion unchanged            preserve the visitor's demo state
seedVersion changed              reset THAT demo to canonical data
runtimeSchemaVersion changed     add stores/indexes; never delete the database
```

A deployment must not erase browser storage. A visitor returning after a
release keeps their demo state unless that demo's seed version says the
canonical dataset is no longer compatible, or they choose Reset.

## Routing

`src/app/demos/layout.tsx` is a Server Component — a `metadata` export is only
honoured in one — and nests inside the root layout rather than replacing it.

It sets `robots: { index: false, follow: false }`. Written as `index: false`,
not `noindex: true`: the latter keys are typed `never` and deprecated in Next
16.3.3 and fail the typecheck. Metadata is shallow-merged and the *last*
segment to define a key wins, so a demo page that sets its own `robots` would
discard this entirely; such a page must spread `DEMO_ROBOTS` instead.

The portfolio page is the canonical indexed presentation. A synthetic demo
surfacing alone in a results page would be separated from every piece of
context saying it is a demonstration.

`demo-shell.css` is imported by that layout rather than appended to
`globals.css`, so demo chrome never ships on the homepage.

## Shared chrome

A compact bar carrying what belongs to the portfolio rather than to the
fictional product: `← Portfolio` (to `/#work`), the disclosure, the demo title,
a role-switcher slot, the persistence notice slot, and Reset.

It is deliberately unlike the product beneath it. A disclosure styled as the
fictional company's own header is the one thing most likely to be read as part
of the simulation and ignored.

Measured: 36–37px at 1920/1440/1366/1024, 37px at 768, 87px in two rows at
430/390/360. Below 640px the reset label shortens and the disclosure pill
stacks; below 430px the title gives way, because the product beneath states its
own name and the disclosure and controls may not give way.

No contact route appears anywhere in a demo. Ever.

## Every visible action behaves

Canonical, and it applies to all three demos:

```
Save → saves          Edit → edits            Delete → deletes or archives
Search → searches     Filter → filters        Sort → sorts
Pagination → pages    Reset → resets          Role switch → changes the UI
```

No decorative controls, no dead buttons. Dashboard values derive from the
current records: change a record and every dependent count, chart, list and
badge changes coherently. A hard-coded dashboard number unrelated to the
collection beneath it is forbidden.

## Truthfulness

A demo simulates concepts; it must not claim to implement them. Never claim
secure authentication, an encrypted database, production RBAC or secure payment
processing. If a demo shows payments they are synthetic business records — no
Stripe, no PayPal, no card entry, no real processing.

Data is synthetic throughout: no real client export, CRM record, customer name,
email, telephone number, financial record or address. Where an email-like value
is needed it uses a reserved domain such as `example.com`. Browser storage
holds only synthetic demo data — no secret, token, API key or private material.

## QA contracts

Every demo must satisfy these before it can be called verified:

```
refresh      after a successful mutation, a reload preserves it (IndexedDB present)
reset        the same canonical state returns: same entities, ids, counters,
             timestamps and aggregates
isolation    resetting one demo leaves the other two untouched
idle         0 polling loops, 0 rAF loops, 0 recurring timers at rest
network      0 API requests, 0 external requests caused by the runtime
derived      dashboard values agree with the records they count
```

Harnesses: `qa/stage09a-runtime.mjs` (76 checks) and `qa/stage09a-shell.mjs`
(85 checks). Both take `QA_BASE`.

### How the browser integration is run

The runtime is browser code and cannot be exercised in Node. Two temporary
fixtures are created for a QA run and **deleted before commit**:

```
qa/fixtures/demos-qa-probe.page.tsx  publishes the runtime factories on window
qa/fixtures/demos-qa-shell.page.tsx  renders the chrome around a live runtime
```

Each is copied to `src/app/demos/<name>/page.tsx` for the run and removed
afterwards. They live under `qa/` so that creating the route is a deliberate
act; the source is kept so the QA is reproducible rather than described.

Playwright loads them and runs each assertion in `page.evaluate`, so every test
executes the same compiled code a demo would. Neither fixture may exist in
production: a QA route is not a product surface. Each harness's header comment
carries the exact procedure for recreating it.

Note that a folder beginning with `_` is a Next.js private folder and produces
no route, which is why the fixtures are named `qa-probe` and `qa-shell`.

## Completion gates

Stage 09 is complete only when:

```
operations = verified
field      = verified
learning   = verified
#work integrated and QA'd
```

`DemoStatus` is `planned | building | verified`. The Work launcher may expose
only `verified` demos; `workSectionIsPublishable()` enforces it. Until then the
`#work` placeholder stays live and `currentStage` stays at 8.

## What Stage 09A deliberately did not decide

No customer names, fleet records, orders, technicians, courses or learners. No
CRM screens, dashboards or field-service screens. No Demo 01 visual design.
Those belong to each product specification, starting with Stage 09B.

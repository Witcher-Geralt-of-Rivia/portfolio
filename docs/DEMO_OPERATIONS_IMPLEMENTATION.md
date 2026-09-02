<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Demo 01 - Operations Implementation

How the Operations domain is built. The product contract it implements is
`docs/DEMO_OPERATIONS_SPEC.md`, which stays canonical; this document records
the code beneath it.

```
STATUS      domain complete / shell, Overview and the three CRM modules
            complete / seven modules unbuilt
STAGE       09C1, 09C2, 09C2.1, all of 09C3 and 09C4.0 complete
REGISTRY    operations = building
ROUTE       /demos/operations, /leads, /customers and /inbox DEPLOYED,
            noindex, for external live review
```

## Stage 09C programme

```
09C1  domain + seed + runtime audit extension        COMPLETE
09C2  shell + routes + Overview                      COMPLETE
09C2.1 shell hardening + review deployment           COMPLETE
09C3  built one module per stage (D-062)
  09C3.1 Leads                                       COMPLETE
  09C3.1.1 Leads control presentation                COMPLETE
  09C3.1.2 Custom select system                      COMPLETE
  09C3.2 Customers                                   BLOCKED on live review
  09C3.3 Inbox + integrated CRM workflow
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
runtime code once comments are stripped. The runtime's own prose explains what
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

**Vehicle status.** `deriveVehicleStatus` applies the frozen precedence: an
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

No `Math.random`, no `crypto.randomUUID`, no `Date.now()`, asserted by the
harness across the whole domain. Ids come from the runtime's per-collection
counters; timestamps come from the logical clock, based at
`2026-09-01T09:00:00Z`.

The seed is built by functions rather than hand-authored: 301 literal records
would be unreadable and impossible to keep consistent. Distributions are
expanded from the frozen counts and then walked with a stride coprime to their
length, which visits every element exactly once: the counts are untouched and
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
`records` and `meta`. The extension is minimal: an optional `audit` array on
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
persistence because a screen forgot to hide a button. `FORBIDDEN` is raised in
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

Explicit processing. The job is enqueued and drained in the same breath: it
exists so the deferred path is real rather than implied, not so work can sit
around. A disabled rule still records a `Skipped` run, because silently doing
nothing leaves a visitor who just switched a rule off with no evidence the
system noticed.

Rule 01's rotation is deterministic and resolves to `actor_0002`, the only
seeded Sales Agent. Rule 02 sets the follow-up two days out (D-053). Rule 03
appends a local System message with no recipient. Rules 04 and 05 raise
notifications; vehicle state after a completed work order is recomputed by the
domain rules, never by an automation action: automation must not become a
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
rendered at all: the navigation never advertises data the role has no access
to. A module that exists for the role but is unbuilt renders as a
non-interactive label, because a link to a 404 is worse than one that is
plainly not ready. The second is temporary build state carried by
`implemented` in `ui/modules.ts`, and it disappears module by module through
09C3 to 09C5 along with the styling that reads it.

**KPIs follow the role too.** A KPI summarises a module's data, so showing one
for a module the role cannot open would make the Overview a hole in its own
policy. Admin sees four, Sales Agent two, Fleet Coordinator two, Finance
Analyst one. No filler card is invented to keep the row at four, and there are
no trend badges: there is no previous period to compare against, and a "+12%"
would be a fabricated metric.

**Everything derived.** The screen computes nothing: it reads the collections
once, hands them to `selectors/overview.ts` and renders the result. Nothing on
it is written as a literal.

Visuals are CSS and authored SVG: no chart library, no icon package. Where an
SVG carries data it is `aria-hidden` and the same values appear in text beside
it, so nothing depends on distinguishing four soft hues.

## Hardening (09C2.1)

Four defects, all found by looking at the rendered product rather than at the
code, and three of them present while the 09C2 suite was passing.

**The role rule was half applied.** 09C2 filtered KPI cards and nothing else.
`ui/overview-policy.ts` now maps every surface (KPI, panel, action-queue
category, notification category) to the module whose data it summarises, and
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
eight notifications read (eight writes, eight revision bumps) cleared the
badge and emptied the list after the first write, while seven were still
outstanding. A reload then restored them, so the demo looked like it was losing
data it had never saved.

The persistence layer was never at fault: the IndexedDB adapter awaits
`tx.oncomplete`, so a resolved commit is durable. Reading the store directly at
the moment the badge cleared showed six or seven still unread. The hook now
keeps the previous answer while re-reading the same question, and drops it when
the question changes. The distinction matters, because keeping stale data
across a role change would leak the previous role's records for a frame
(D-058).

`OperationsOverview` stopped falling back to its skeleton on every mutation as
a consequence: the skeleton is for having nothing to show, not for refreshing
what is on screen.

### QA

`qa/stage09c21-operations-hardening.mjs`, 111 checks against a local production
build: KPI semantics, sums and fit, the role matrix, role containment, the
mobile sheet at 390 and 360, the master logo's bytes and the derived mark's
geometry, and reset. Full regression is 719 checks across seven suites; see
`docs/QA_BASELINE.md`.

### Deployment

Deployed with `npm run deploy:safe` so it can be judged live. The registry
keeps `operations = building`, the route stays `noindex, nofollow`, nothing
links to it, and `#work` is untouched. Stage 09C3 is blocked until the review
comes back (D-061).

## Leads (09C3.1)

The first module that writes, and the pattern the other nine reuse: a data
table, a mobile record list, search, three filters, six sorts, pagination, a
detail drawer, create and edit forms, confirmations, URL-driven selection and
mutation feedback.

```
src/demos/operations/
  services/lead-workflows.ts   the missing join between mutations and rules
  selectors/leads-list.ts      matching, ordering, owners, activity, dates
  ui/scroll-lock.ts            one counted page-scroll lock for every overlay
  ui/OpsSelect.tsx             the product's select: label inside the border,
                               drawn chevron, quiet active state (09C3.1.1);
                               a thin wrapper over the shared DemoSelect
                               primitive since 09C3.1.2
  ui/leads/
    LeadsScreen.tsx            state, selection, composition
    LeadsToolbar.tsx           search, filters, sort, the one primary action
    LeadsTable.tsx             desktop table, aria-sort, row headers
    LeadsMobileList.tsx        the same records as cards below 768px
    LeadDetail.tsx             drawer on desktop, full surface on a phone
    LeadForm.tsx               create and edit, one form
    LeadConfirm.tsx            convert and archive
    OpsOverlay.tsx             one <dialog>, three geometries
    use-lead-action.ts         pending, error text, no double submit
    leads-view.ts              tones, sort labels, failure wording
```

### The route became a layout

`/demos/operations/layout.tsx` holds the provider and the shell, so navigating
between Overview and Leads no longer disposes the runtime and rebuilds it. When
each page carried its own provider, every module change reopened IndexedDB and
put both screens back to their skeletons.

The shell asks `usePathname()` which module it is showing rather than being
told by the page, so one pathname decides the active navigation entry, the
heading and the top bar's second line. Only `useSearchParams` needs a Suspense
boundary: the pathname resolves at prerender because every route here is
static with no dynamic segment.

### Automations actually run now

This is the substantial finding of the stage. `processEvents` had no caller
outside its own module and the runtime's event bus had no subscribers, so
creating a website lead never assigned it and qualifying a lead never scheduled
a follow-up, both of which the frozen contract requires. The QA harness had
been hand-writing the events and calling the engine directly, which tested the
rules correctly while the production path did not exist. See D-063.

### Ordering and matching live in the domain

`selectLeadList` filters through the shared `queryList` matcher, then sorts and
pages itself. That split is not a preference: `QuerySpec.sort` takes `keyof T`,
and three of the six sorts are not lead fields. Stage and Priority are ranks
(sorting their strings gives Contacted, Lost, New, Proposal, Qualified, Won,
which is alphabetical and meaningless), and Created lives on the record
envelope. The default is last activity descending with an explicit id
tie-break, written out rather than inherited from the adapters three layers
down.

Owner options are derived, not listed: an actor qualifies by being an active
Sales Agent (the same test Rule 01 applies) or by already owning a lead. A
Fleet Coordinator does not become a CRM owner by existing in the seed.

### The id is on screen, quietly

`personName(i)` repeats every twenty leads, so three of the forty-eight are
called "Alina Danforth". A drawer headed by the name alone cannot say which one
is open, and "Archive Alina Danforth?" is ambiguous across three records. The
id appears under the name in the detail and beside the name in confirmations,
never as a table column.

### QA

`qa/stage09c31-leads.mjs`, 281 checks with the domain probe in place and 252
without it (the domain section skips itself when the fixture route is absent,
which is what happens against production). It covers the seeded distribution
through the product, search, every filter and sort, pagination across all five
pages, URL selection with Back and Forward, deep links valid and invalid, the
detail's three sections, create for both automation paths, edit, qualify,
assign, convert, archive, the role matrix, the role-switch leak D-058 guards
against, Overview regression, persistence, reset, nine viewports, the mobile
sheets, accessibility, every stage and priority tone's contrast, network,
idle cost and CLS.

### Control presentation (09C3.1.1)

The first external review found four presentation faults, three of which were
the same fault: a control that did not say what it was.

```
filters      a detached uppercase label beside a browser select, four times
             -> label inside the border, drawn chevron, quiet active
                state; 40-42px, 11-12px radius            (D-069)
sort         a field select plus an unlabelled square carrying an arrow
             -> one control, twelve options, each naming a field and a
                direction: "Last activity - newest"       (D-069)
page size    a bare "10" behind the words PER PAGE at the far right
             -> "10 rows", in the footer it belongs to    (D-069)
pagination   three clusters spread across 1305px with no shared structure
             -> one grid under a rule; stacked on a phone (D-071)
provenance   a 469px capsule with 608px of nothing beside it
             -> the middle column of a three-zone bar     (D-070)
```

The controls are a real `<select>` with `appearance: none`. That removes the
platform's arrow and nothing else: keyboard behaviour, screen-reader
semantics and the native option list on a phone all remain, and none of them
would have been free in a hand-built menu. Width is left to the browser, which
sizes a select to its widest option, so a control does not resize when its
value changes.

`qa/stage09c31-leads.mjs` grew three sections for this: control geometry and
semantics, the pagination composition and both page sizes, and the band's
width against the space actually available at six widths.

### The select menu (09C3.1.2)

`src/components/demos/DemoSelect.tsx` draws the menu the operating system used
to. Eleven controls use it: the three Leads filters, the sort, the page size,
the demo role, the create/edit form's three and the detail's two.

The reason it exists is that a native `<select>` cannot be styled open. The
element is the platform's, and its popup arrived with square corners, no option
padding and a system-blue selection band whatever the closed control looked
like (D-072).

It is the ARIA select-only combobox: focus stays on the trigger and the active
option is pointed at with `aria-activedescendant`, so there is one focused
element to return to on Escape, on Tab and on an outside click. The menu is
portalled into the nearest `<dialog>` when there is one, because a modal dialog
is in the browser's top layer and a body-portalled menu would be painted behind
the sheet that opened it. Placement is measured: below when there is room,
above when there is not, capped at 320px with internal scrolling, clamped
horizontally to the viewport.

Stacking is stated rather than raced: 70 for menus, above the notification
panel and mobile drawer at 60 and the chrome at 40.

## Customers (09C3.2)

The second module that writes, and the first built entirely out of Leads: the
same table grammar, the same drawer, the same overlay, the same forms, the same
URL contract. What Customers adds is that **composition depends on the role**.

```
src/demos/operations/
  selectors/customers-list.ts       matching, ordering, paging, activity
  selectors/customer-relations.ts   the record's links to five other modules
  ui/OpsPagination.tsx              the footer, extracted from LeadsScreen
  ui/customers/
    CustomersScreen.tsx             state, selection, composition
    CustomersToolbar.tsx            search, two filters, eight sorts
    CustomersTable.tsx              desktop table, role-decided columns
    CustomersMobileList.tsx         the same records as cards below 768px
    CustomerDetail.tsx              overview, relationships, activity
    CustomerForm.tsx                create and edit, one form
    CustomerConfirm.tsx             archive
    customers-view.ts               the role policy, tones, sort labels
```

### The role decides the columns, not a conditional

A Finance Analyst cannot open Reservations, so a customer's reservation count
is not theirs to read. `customerColumnsFor(role)` filters the column list
through `canViewModule`, and `relationSectionsFor(role)` does the same for the
drawer's groups, both deriving from `permissions.ts` rather than restating it.

A withheld column is **not defined**, not rendered empty. A column of dashes
still tells the reader that something exists and is being kept from them, which
is worse than not offering the column at all.

Finance is not Admin with sections blanked out. Its drawer opens with Contracts
and Payments, in that order, so it reads as a finance view of a customer rather
than a CRM view with holes cut in it.

The query obeys the same rule one layer down: the screen never reads a
collection the role cannot open, so a count cannot leak through a column that
forgot to check.

### An edit audits every field that moved

`updateCustomer` recorded status and segment alone, so renaming a customer or
rewriting their notes changed the record and wrote nothing: the Activity panel
stayed silent about a change the visitor had just made and could see in the
fields above it. It now diffs all four fields and writes only what moved, so a
form resubmitted unchanged still adds no entry. D-064 settled the same question
for leads; a customer edit is the same action and now behaves the same way.

### Archiving is refused in the service's own words

A customer holding an Active contract or a Confirmed reservation cannot be
archived, because archiving them would leave a live rental attached to a record
the application has filed away. The confirmation states the rule before the
attempt, and a refusal leaves the dialog open with the service's own sentence
on it rather than closing over a generic "Conflict".

### There is no contact information on a customer

The entity has a name, a status, a segment, notes, and links to its own
records. No email, telephone, address or tax id exists in the type, the seed,
the form or the detail. That is the portfolio's standing rule holding inside a
CRM, which is the one product category where its absence is most conspicuous
and most deliberate.

### The pagination footer is now shared

`OpsPagination` was lifted out of `LeadsScreen` unchanged, classes included, so
the two modules cannot drift into two footers. Leads renders byte-identically
after the move: the same range, page label, steps, size control and geometry.

### QA

`qa/stage09c32-customers.mjs`, 174 checks with the domain probe in place and
130 without it. It covers the seeded 32 customers and their six conversions,
create, edit and archive through both the services and the product, the audit
diff, the archive guards and their wording, the list selectors, search, both
filters, eight sorts, pagination, URL selection, deep links valid and invalid,
all four roles' columns and drawer sections, the mobile cards and filter sheet,
five viewports, contrast, focus, the keyboard path through the custom select,
and the standing content rules on the rendered page.

## Inbox and the CRM workflow (09C3.3)

The third module that writes, and the one that joins the other two. A
conversation is always about a lead or a customer, so this is where the CRM
stops being three lists and becomes one product.

```
src/demos/operations/
  selectors/inbox-list.ts           rows, filters, search, order, clock time
  selectors/conversation-detail.ts  the thread, its subject, its brief
  ui/inbox/
    InboxScreen.tsx                 state, selection, actions, composition
    InboxToolbar.tsx                search and three filters
    ConversationList.tsx            the list, one button per thread
    ConversationThread.tsx          header, actions, transcript, composer
    ConversationContext.tsx         the lead or customer behind the thread
    ReplyComposer.tsx               a textarea and a button, nothing else
    inbox-view.ts                   the role policy, tones, filter options
```

### The shape is different because the work is

Leads and Customers are tables: filter, open a record, page grows. An inbox is
a list kept beside the thread being read, so both are on screen and each
scrolls on its own. That means no drawer, no pagination, and a module that
fills the height the shell leaves it rather than growing down the page
(D-077).

`.demo-shell:has(.ops-inbox)` is pinned to `100dvh` for that reason, scoped to
this module alone. `min-height: 100dvh` is a floor, not a height, so without
the pin every ancestor grows to its content and a panel told to scroll
internally has nothing to scroll against.

### Two domain gaps found before the UI

**Assignment took any string.** Nothing stopped a conversation being assigned
to the Fleet Coordinator, who cannot open the Inbox, or to an id belonging to
nobody. It now accepts null or an active actor whose role writes Inbox, and
refuses everything else through the typed error contract. The option list is
derived from the same rule by `inboxAssignees`, but the rule lives in the
service: an option list is a convenience, not an enforcement point (D-075).

**Assignment and replies wrote no audit at all.** Close and reopen did. The
frozen contract said a reply "writes audit where appropriate" and never said
what was appropriate, so 09C3.3 settled it: replies and assignments are
audited, read and unread are not, because marking a thread unread to come back
to it is triage rather than history. The reply entry carries no part of the
message body, and the assignment entry names both ends as people rather than
ids (D-076).

One piece of dead code went with them. `addSystemMessage` carried the comment
"Used by Rule 03" and had no callers anywhere: Rule 03 does its own commit,
atomically, and can also open a conversation when none exists, which that
helper could not. A function nobody calls with a comment claiming otherwise is
worse than no function.

### The assist reconciliation

The frozen contract said the Inbox shows the Lead Brief for lead and customer
conversations. It cannot. A brief is composed from a lead's stage, priority,
vehicle interest and follow-up, and twenty-six of the thirty-two seeded
customers were never leads; seven of the nine seeded customer conversations
reach no lead at all.

So the rule is narrower and true (D-078):

```
Lead conversation                    brief from that lead
Customer conversation, converted     brief from its source lead
Customer conversation, established   no brief, and the absence is explained
```

Nothing is fabricated for an established customer: no stage, no priority, no
vehicle interest, no recommended action. They get their own context and a line
saying why there is no brief.

The brief recomputes from current records on every read, over the lead's own
threads **plus the thread being read**. That second clause is what
`getLeadBrief` cannot express: without it, replying in a converted customer's
thread would leave the recommended action unchanged, which W5 requires it not
to do.

### The three-panel width, measured

A 1180 viewport does not give a three-panel inbox 1180 pixels. The sidebar
appears at exactly that width and takes 240, padding takes 40, the scrollbar
15, and the transcript came out 221 wide. Three panels start at 1400, where
the thread clears 440; from 1180 down it is list and thread with the context
behind a disclosure, and below 768 it is one thing at a time (D-082, D-083).

### The CRM joins up

```
Inbox      Open lead / Open customer      by subject type
Lead       Open conversation              in the brief that already mentions it
Lead       Open customer                  a bare id until Customers existed
Customer   Open conversation              one row per thread
Customer   Open lead                      the origin, from 09C3.2
```

Notifications whose source is a lead, a customer or a conversation now open it;
the other sixteen of the twenty-two stay unlinked until their modules are built
(D-084, D-085).

### Viewport containment (09C3.3.1)

The first external review rejected the Inbox: the application sat at the top of
a 2751px document with 1951px of portfolio background beneath it.

The suspect was the `height: 100dvh` this module puts on the demo shell.
Measurement cleared it. At an 800px viewport the shell was 800 tall with a
scrollHeight of 800, and every box beneath it was contained. The break was one
level higher, between `.demo-shell` at 800 and `.site-main` at 2751, its only
child.

`overflow` clips a descendant only when the descendant's containing block is
inside the clipping box. `.visually-hidden` is `position: absolute`, and
nothing between a conversation row and `.site-main` was positioned, so
twenty-four of those spans escaped every clip and laid out at their static
offsets, the last at y=2750 (D-086).

The document never scrolled and none of it was visible, which is why the suite
passed. A full-page capture honours that overflow, and the reviewer took one.

The fix is `position: relative` on the module and on every box inside it that
clips. It costs no layout. Two regressions came out of the correction itself
and both were caught by the module's own suite: a positioned transcript paints
above the static context toggle, which made that button unclickable on a phone,
and the module's heading and live region were still resolving against the
content wrapper rather than the module.

### QA

`qa/stage09c33-inbox.mjs`. The domain half proves the seeded distribution by
measurement, the audit policy, every assignment refusal, and Rule 03 end to end:
confirming a reservation through the real service appends a System message to
the customer's conversation and marks it unread, which proves the automation
path without building Reservations early.

## Rental core readiness (09C4.0)

Five screens were about to depend on the frozen domain contract. Three clauses
in it were not being enforced, and finding that after two of the screens
existed would have meant fixing it twice.

No UI. No new product scope. Four domain corrections, each of them a rule the
contract already stated.

### The automation gap, again

`confirmReservation` emits `reservation.confirmed`, `runtime.commit` publishes
it, `triggerFor` maps it to Rule 03, and the action that appends the System
message is written and correct. Nothing listened.

The runtime's bus is fire-and-forget with no buffer and no replay, so an event
published while nobody is subscribed reaches nobody. Proven before anything
changed: the only production subscriber in the repository is the one
`withAutomations` opens, and only the two lead workflows reach it. The only
other `processEvents` caller, `reconcileTimeDerivedState`, has no call sites at
all. Both QA suites that appear to prove Rule 03 works do the join by hand.

So a Reservations screen calling the bare service would have reproduced D-063's
defect exactly, and the suite would have gone on passing. The mechanism moved
to a neutral `services/workflows.ts` and `reservation-workflows.ts` wraps
confirm, convert and cancel (D-088). A screen asks for one business action.

### Two vehicles that disagreed with their own derivation

The contract says a vehicle is recomputed after every mutation touching its
contracts, reservations or work orders. Two services did not.

```
convertReservationToContract   left Reserved, with a pointer to a reservation
                               that is no longer Confirmed
createMaintenance              left Available, while an Open work order made
                               the derivation say Maintenance
```

Both now refresh in the same commit as the change that caused them (D-089).

### Draft references

`createReservation` accepted a `vehicleId` it never checked, so a draft could
name a vehicle that does not exist or a Utility van against a Touring booking.
It now validates existence and class. That is reference validity and not a
capacity hold: a Draft does not take a vehicle off the fleet, and confirmation
is what holds it.

### The invariant, as QA

`qa/stage09c40-core-readiness.mjs` asserts a world invariant rather than
expected strings. After every mutation it walks the whole fleet and compares
each stored vehicle against `deriveVehicleStatus` and `deriveVehicleLinks`
computed over the world that mutation left behind. That is what found both
omissions, and it is worth more than any single expected status because it
catches the vehicle nobody thought to look at.

### Not built, and why

There is no Fleet write service, and 09C4.3 cannot start without one. The edit
contract is fully specified; the create contract is not, because the frozen
document describes the seeded twenty-four asset codes and never says who
supplies the twenty-fifth. Reported with a recommendation rather than decided
in passing (D-090).

## Remaining UI work

Seven module screens: Reservations, Contracts, Fleet, Maintenance, Payments,
Automations and Reports. Every service and selector they need already exists,
and the three CRM modules have established the interaction patterns they
reuse.
`#work` still renders its placeholder, and the demo is deployed but
unadvertised: `noindex, nofollow`, linked from nowhere.

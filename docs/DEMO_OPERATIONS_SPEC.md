<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Demo 01 - Operations Product Specification

Canonical and **frozen** for Demo 01. Stage 09B froze this contract; Stage 09C
builds against it. Nothing here may be changed during implementation without an
explicit user instruction. If the build discovers a genuine blocker, stop and
report it rather than adjusting the contract to fit the code.

Platform-level architecture lives in `docs/DEMO_PLATFORM.md`. This document
covers only what the Operations domain adds on top.

```
STATUS          SPEC FROZEN / DOMAIN BUILT / UI NOT BUILT
STAGE           09B froze this contract; 09C1 built the domain beneath it
REGISTRY        operations = building
ROUTE           /demos/operations   not a public route yet
```

## 1. Product identity

```
public label        Rental Operations Platform
in-app identity     Operations Console
domain              motorcycle / light-vehicle rental operations
route               /demos/operations
```

No company brand is invented. "Operations Console" is a descriptive product
identity, chosen to avoid colliding with a real commercial trademark.

The fictional company manages sales leads, customers, rental vehicles,
reservations, contracts, payments, maintenance, customer conversations,
workflow automations and operational reporting. No real company is
represented, and no real customer data appears anywhere.

### Disclosure

The shared demo chrome shows, as on every demo:

```
INTERACTIVE ENGINEERING DEMO
SYNTHETIC DATA · FRONTEND ONLY
```

This demo is never described as client work.

## 2. Modules

Exactly eleven. There is no Settings module: role, reset and the return to the
portfolio all belong to the shared demo chrome.

```
Overview
Leads
Customers
Reservations
Contracts
Fleet
Maintenance
Payments
Automations
Inbox
Reports
```

That list is also the canonical module order, used by the sidebar, the mobile
More sheet and the bottom-navigation fallback rule.

### URL strategy

```
/demos/operations                 Overview
/demos/operations/leads
/demos/operations/customers
/demos/operations/reservations
/demos/operations/contracts
/demos/operations/fleet
/demos/operations/maintenance
/demos/operations/payments
/demos/operations/automations
/demos/operations/inbox
/demos/operations/reports
```

A selected record is URL state, not a dynamic route:

```
/demos/operations/leads?selected=lead_0007
```

Back and forward navigation work, a selected record can be deep-linked, and the
route tree stays eleven segments instead of dozens of dynamic ones. Frozen
unless implementation finds a genuine blocker, which must be reported.

## 3. Roles and permissions

Four simulated roles. Default on first launch is **Admin**, so a first-time
visitor sees the whole product.

```
Admin
Sales Agent
Fleet Coordinator
Finance Analyst
```

Role switching is an interaction simulation and not a security boundary.
Nothing is authenticated or authorised, and every record stays readable in
browser storage whatever role is selected. It is stated once, in the demo's own
disclosure surface, not repeated on every screen, and never called RBAC or
access control.

The role control itself lives in the shared chrome's `roleControl` slot, which
Stage 09A already provides. Operations supplies the control; it does not build a
second one.

### Permission matrix

`rw` read/write, `r` read-only, `-` module not visible.

| Module | Admin | Sales Agent | Fleet Coordinator | Finance Analyst |
|---|---|---|---|---|
| Overview | rw | r | r | r |
| Leads | rw | rw | - | - |
| Customers | rw | rw | - | r |
| Reservations | rw | rw | rw | - |
| Contracts | rw | r | r | r |
| Fleet | rw | - | rw | - |
| Maintenance | rw | - | rw | - |
| Payments | rw | - | - | rw |
| Automations | rw | - | - | - |
| Inbox | rw | rw | - | - |
| Reports | rw | - | - | r |

### Direct navigation to an unavailable module

Never silently render it, and never call it a security block. Render a
contained surface:

```
This module is not available for the selected demo role.
```

with an action returning to Overview. A write attempted by a read-only role
raises `FORBIDDEN` and surfaces as "Module or action unavailable for the
selected demo role."

## 4. Domain entities

Thirteen principal entities. `AuditEntry` and `Job` remain shared-runtime types
and are not redefined here.

```
Actor
Lead
Customer
Vehicle
Reservation
Contract
Payment
MaintenanceWorkOrder
Conversation
Message
AutomationRule
AutomationRun
Notification
```

### Collections and id prefixes

Ids use the Stage 09A convention exactly: `formatId(prefix, n)` yields
`prefix_0001`, counters are per collection, and reset restores them.

| Entity | Collection | Id prefix | Example |
|---|---|---|---|
| Actor | `actors` | `actor` | `actor_0001` |
| Lead | `leads` | `lead` | `lead_0001` |
| Customer | `customers` | `customer` | `customer_0001` |
| Vehicle | `vehicles` | `vehicle` | `vehicle_0001` |
| Reservation | `reservations` | `reservation` | `reservation_0001` |
| Contract | `contracts` | `contract` | `contract_0001` |
| Payment | `payments` | `payment` | `payment_0001` |
| MaintenanceWorkOrder | `maintenance` | `maintenance` | `maintenance_0001` |
| Conversation | `conversations` | `conversation` | `conversation_0001` |
| Message | `messages` | `message` | `message_0001` |
| AutomationRule | `automation_rules` | `automation_rule` | `automation_rule_0001` |
| AutomationRun | `automation_runs` | `automation_run` | `automation_run_0001` |
| Notification | `notifications` | `notification` | `notification_0001` |

### Actor

```
id  displayName  role  active
```

No email, no telephone, no credential, no avatar URL. Where an avatar marker is
needed it is initials derived from `displayName`.

### Lead

```
id  displayName  source  stage  vehicleInterest  assignedActorId  priority
createdAt  updatedAt  lastActivityAt  nextFollowUpAt
convertedCustomerId?  archived  version
```

No email, no phone, no address.

```
source     Website | Campaign | Referral | Walk-in | Returning customer
stage      New | Contacted | Qualified | Proposal | Won | Lost
priority   Low | Normal | High
```

`archived` is a separate flag, not a stage. Priority uses no emergency or red
visual language. High is an attention weight, not an alarm.

### Customer

```
id  displayName  status  segment  createdAt  updatedAt
sourceLeadId?  notes  archived  version
```

No email, no phone, no postal address.

```
status    Active | Inactive
segment   Standard | Frequent | Business
```

Segment is synthetic classification only.

### Vehicle

```
id  assetCode  modelLabel  vehicleClass  status  odometerKm
createdAt  updatedAt
currentContractId?  currentReservationId?  activeMaintenanceId?  version
```

```
assetCode      MTR-001 … MTR-024
vehicleClass   Urban | Touring | Utility
status         Available | Reserved | Rented | Maintenance
modelLabel     Metro 125 | City 160 | Urban 125 | Tour 250 | Trail 200 | Cargo 150
```

Model labels are fictional and descriptive. No real manufacturer appears
anywhere in the demo.

```
Urban     Metro 125, Urban 125, City 160
Touring   Tour 250, Trail 200
Utility   Cargo 150
```

### Reservation

```
id  customerId  vehicleId?  vehicleClass  startAt  endAt  status
createdAt  updatedAt  notes  convertedContractId?  version

status   Draft | Confirmed | Converted | Cancelled
```

### Contract

```
id  customerId  vehicleId  reservationId?  status  startAt  endAt
dailyRate  totalAmount  paidAmount  createdAt  updatedAt  version

status   Pending | Active | Completed | Cancelled
```

All amounts are synthetic, USD-denominated and stored as integer cents.

### Payment

```
id  contractId  customerId  amount  status  dueAt  paidAt?  category
createdAt  updatedAt  version

status     Pending | Paid          stored
category   Rental | Deposit | Adjustment
```

`Overdue` is never stored. It is an effective value derived from `dueAt`
against the logical clock, so the record cannot drift out of agreement with the
demo's own time; see §6. Amounts are integer cents; see Money below.

No card numbers, no bank information, no provider identifiers, no real
processing.

### MaintenanceWorkOrder

```
id  vehicleId  type  priority  status
openedAt  startedAt?  completedAt?  summary  version

type       Inspection | Preventive | Repair
priority   Routine | Soon | High
status     Open | In Progress | Completed | Cancelled
```

### Conversation

```
id  subjectType  subjectId  channel  assignedActorId  status  unread
createdAt  updatedAt  version

subjectType   Lead | Customer
channel       Web chat | In-app
status        Open | Closed
```

Only those two channels exist. No email, SMS or WhatsApp channel may be added:
a messaging surface with an address field is a contact route, which the
portfolio forbids outright.

### Message

```
id  conversationId  authorType  actorId?  body  createdAt

authorType   Customer | Staff | System
```

### AutomationRule

```
id  name  trigger  action  enabled  createdAt  updatedAt  lastRunAt?  version
```

Five predefined rules, toggleable and testable. There is no generic visual rule
builder in v1.

### AutomationRun

```
id  ruleId  sourceEventId  status  startedAt  completedAt  summary  version

status   Success | Skipped | Failed
```

### Notification

```
id  actorRole?  actorId?  category  title  body  read  createdAt
sourceEntityType?  sourceEntityId?  version

category   CRM | Reservation | Finance | Maintenance | Automation
```

## 5. Relationships

```
Lead
 └─ may convert → Customer

Customer
 ├─ has → Reservations
 ├─ has → Contracts
 ├─ has → Payments
 └─ has → Conversations

Vehicle
 ├─ has → Reservations
 ├─ has → Contracts
 └─ has → MaintenanceWorkOrders

Reservation
 └─ may convert → Contract

Contract
 ├─ belongs to → Customer
 ├─ belongs to → Vehicle
 └─ has → Payments

AutomationRule
 └─ has → AutomationRuns
```

Audit is cross-cutting and belongs to the runtime.

## 6. Derived state

Three values are computed from relationships rather than trusted as stored
flags. This is what stops the demo contradicting itself: the failure mode
where a vehicle reads Available while an active contract points at it.

### Vehicle status

Recomputed after every mutation touching that vehicle's contracts,
reservations or work orders. Precedence, highest first:

```
1  an active work order (Open or In Progress)      → Maintenance
2  an Active contract                              → Rented
3  a Confirmed reservation covering the current
   logical instant or the next scheduled period    → Reserved
4  otherwise                                       → Available
```

Vehicle status is never set directly by a form. The Fleet edit form may change
`modelLabel`, `vehicleClass` and `odometerKm` only.

### Payment overdue

```
stored status     Pending | Paid

effective status  = Paid       when stored status is Paid
                  = Overdue    when stored status is Pending and dueAt < clock.now()
                  = Pending    otherwise
```

`Overdue` is a derivation, never a stored flag. Persisting it would create a
second source of truth that goes stale the moment the logical clock moves past
a due date, and a demo whose payment list disagrees with its own clock is
exactly the incoherence the derived-state rules exist to prevent.

Every list, filter, count and report reads the effective value.
`payment.overdue` is raised by an explicit reconciliation pass over
time-derived state, not by a polling loop.

### Money

All monetary amounts (`dailyRate`, `totalAmount`, `paidAmount` and a payment's
`amount`) are **integer cents**. Nothing in the domain performs floating-point
arithmetic on money, so a balance cannot accumulate rounding drift across a
sequence of payments.

The frozen USD 18–46 daily-rate band is therefore 1800–4600 cents. Formatting
to "USD 24.00" is a presentation concern and happens at the edge.

### Contract total

```
days         = max(1, ceil((endAt - startAt) / 86_400_000))
totalAmount  = dailyRate × days
```

Daily rates are deterministic by class, within the frozen USD 18–46 band,
stored as integer cents:

```
Urban      18 – 26     1800 – 2600 cents
Utility    27 – 34     2700 – 3400 cents
Touring    35 – 46     3500 – 4600 cents
```

No contract may carry a total that contradicts this calculation.

## 7. Domain events

```
lead.created                lead.stage_changed          lead.converted
customer.created            customer.updated
reservation.created         reservation.confirmed
reservation.cancelled       reservation.converted
contract.created            contract.activated
contract.completed          contract.cancelled
payment.recorded            payment.overdue
maintenance.opened          maintenance.started
maintenance.completed
conversation.message_added
automation.rule_enabled     automation.rule_disabled
automation.run_completed
```

UI-only occurrences (a search term changing, a drawer opening, a chart hover)
are never emitted as domain events.

### Event to audit

Meaningful business mutations write an audit entry: a lead moving stage, a
reservation confirmed, a contract activated, a payment recorded, a maintenance
order completed, an automation rule disabled.

Never audited: search changed, filter changed, drawer opened, chart hovered,
page navigated, sort changed.

## 8. Automation

Five canonical rules, seeded and frozen.

| Id | Name | Trigger | Action |
|---|---|---|---|
| `automation_rule_0001` | New website lead assignment | `lead.created` where `source = Website` | assign the next Sales Agent by deterministic rotation; create a CRM notification |
| `automation_rule_0002` | Qualified lead follow-up | `lead.stage_changed` → `Qualified` | set `nextFollowUpAt` to the qualifying instant **+ 2 days**; create a CRM notification |
| `automation_rule_0003` | Reservation confirmation message | `reservation.confirmed` | create or update the customer's conversation and append a System message |
| `automation_rule_0004` | Overdue payment alert | `payment.overdue` | create a Finance notification |
| `automation_rule_0005` | Maintenance completion notice | `maintenance.completed` | create a Maintenance notification |

Rule 03 sends nothing anywhere. It appends a synthetic in-app message to a
local conversation; there is no recipient and no address.

Rule 05 raises a notification only. Vehicle status after a completed work order
is recomputed by the domain rules in §6, never by an automation action.
Automation must not be a second source of truth for domain state.

Rule 02's offset is exactly two days from the instant the lead reached
Qualified, measured on the logical clock. Stage 09B left it as "a deterministic
offset" with no value; two days is the frozen figure, chosen so a follow-up
lands inside the demo's visible window rather than beyond every date filter.

The seeded Sales Agent roster contains one actor, so Rule 01's rotation always
resolves to `actor_0002`. That is deterministic and correct rather than a
placeholder; it is recorded here so it does not read as a bug.

### Processing

```
domain event → job → rule evaluation → action → AutomationRun → audit / notification
```

Rules are evaluated explicitly after the mutation that raised the event. There
is no polling and no background worker, in keeping with the runtime's idle
contract.

```
Success   the rule matched and its action completed
Skipped   the rule was disabled, or its trigger predicate did not match
Failed    the action could not complete; the UI must explain why
```

## 9. Assist

One provider-neutral deterministic assistance feature: **Lead Brief**. It is
not a chatbot, has no input field, and makes no network request.

Shown in Lead detail and in Inbox for lead and customer conversations, marked:

```
ASSIST / LOCAL
```

The brief is composed by rule from the lead's stage, priority, vehicle
interest, conversation state and next follow-up. Shape:

```
Qualified lead interested in an Urban vehicle.
Recent activity indicates follow-up is due next.
```

One deterministic **Recommended next action** accompanies it, drawn from a
fixed set:

```
Follow up            Prepare reservation            Review conversation
```

No claim of model intelligence appears anywhere near it.

## 10. Screens

Every screen obeys the platform rule: if a control is visible, it works.

```
Search → searches        Filter → filters        Sort → sorts
Pagination → paginates   Create → creates        Edit → edits
Archive → archives       Save → saves            Cancel → cancels
Role switch → changes permissions and UI         Run automation → runs
Mark read → changes state                        Reset demo → restores seed
```

No non-functional control is placed in the application.

### Overview

Four primary KPIs, every one derived from current records. No KPI value is
stored or hard-coded.

| KPI | Derivation |
|---|---|
| Open leads | non-archived Leads whose stage is not `Won` or `Lost` |
| Confirmed reservations | Reservations with status `Confirmed` |
| Vehicles available | Vehicles whose derived status is `Available` |
| Payments requiring attention | Payments whose effective status is `Pending` or `Overdue` |

On seeded data that fourth KPI reads **8** (5 Pending + 3 Overdue). The UI must
compute it; 8 may never be written as a literal.

Four visuals, all derived, all CSS and SVG with no chart library:

```
Lead funnel          New → Contacted → Qualified → Proposal → Won
                     Lost is excluded from funnel progression and shown as a
                     separate annotation
Fleet status         the four vehicle statuses
Upcoming reservations
Action queue
```

The action queue is derived from overdue payments, open high-priority
maintenance, high-priority leads whose follow-up is due, and unread
notifications, in that order, most urgent first. Within a category the oldest
relevant timestamp comes first, then the entity id, so the list never
reshuffles between renders.

Stage 09B first froze the reverse of this, leading with unread notifications.
Stage 09C2 corrected it (D-055): a queue that opens with six identical
notifications buries the overdue payment underneath them, which is the opposite
of what an action list is for.

At most six items appear on the Overview.

### Leads

```
search · stage filter · source filter · owner filter · sort · pagination
create · edit · change stage · assign owner · convert to customer · archive
open detail
```

Columns: Lead, Source, Interest, Stage, Owner, Priority, Last activity, Next
follow-up. No contact details, because there are none to display.

Pagination defaults to 10 rows, with 10 and 20 as the only options: a dataset
of 48 has no use for a 100-row page.

### Customers

```
search · status filter · segment filter · sort · pagination
create · edit · archive · open detail
```

Detail shows summary, reservations, contracts, payments, conversations and
activity. There is no contact card.

Archive is refused with `CONFLICT` while the customer has an Active contract or
a Confirmed reservation.

### Reservations

```
search · status filter · date filter · vehicle-class filter · sort · pagination
create · edit draft · confirm · cancel · convert to contract · open detail
```

Create requires customer, vehicle class, start and end. Vehicle and notes are
optional. Availability validation is real, checking active contracts, confirmed
reservations and active maintenance.

Confirmation with no vehicle chosen offers the eligible available vehicles of
that class and requires the visitor to pick one. Nothing is auto-assigned
invisibly.

### Contracts

```
search · status filter · sort · pagination
open detail · activate · complete · cancel
```

No arbitrary delete. Detail shows customer, vehicle, period, financial summary,
payments, timeline and audit.

### Fleet

```
search · status filter · class filter · sort · grid/table toggle
create vehicle · edit vehicle · open detail · create maintenance
```

Both views of the toggle work. Detail shows asset code, model, class, status,
odometer, the active relationship, the upcoming reservation, maintenance
history and audit.

### Maintenance

```
search · status filter · priority filter · vehicle filter
create · start · complete · cancel · open detail
```

### Payments

```
search · status filter · category filter · sort · pagination
record payment · open detail
```

Recording a payment selects a contract, an amount and a category. There is no
payment-method or card UI: this is accounting-state simulation.

```
amount must be > 0
amount must not exceed the contract's remaining balance
```

Overpayment is refused in v1. On success the Payment is created, the contract's
`paidAmount` rises, an audit entry is written, and the Overview and Reports
figures move with it.

### Automations

Five rule rows showing enabled toggle, trigger, action, last run and run count,
with **Test rule** and **View runs**. No generic rule editor.

Test rule uses a dedicated synthetic test payload: it creates a job, evaluates
the rule, performs a safe deterministic action, records an AutomationRun and
writes audit. It must not mutate principal business records in surprising ways.

### Inbox

```
conversation list · search · status filter · channel filter · read/unread filter
open · mark read/unread · assign · send reply · close/reopen
```

A reply creates a Message, updates the conversation, marks it read and writes
audit where appropriate. There is no network call and no recipient address.

Lead and customer conversations show the Lead Brief and recommended next action
from §9.

### Reports

Exactly four groups:

```
CRM Funnel        Fleet Utilization        Contract Status        Payment Status
```

Filter: 30 days, 90 days, All demo data. The filter applies where a report is
genuinely time-based. A snapshot report states that it reflects current records.

Charts are CSS and SVG. Values derive from records. There is no export in v1.

### Notifications

A compact notification centre in the product chrome: unread count, list, mark
read, mark all read, and navigation to the source entity where one exists. No
browser push notifications.

## 11. Seed contract

Canonical clock base:

```
2026-09-01T09:00:00Z
```

Synthetic logical demo time. The browser's current time is never canonical seed
state.

### Counts

```
Actors                     4
Leads                     48
Customers                 32
Vehicles                  24
Reservations              18
Contracts                 14
Payments                  26
MaintenanceWorkOrders     10
Conversations             20
Messages                  64
AutomationRules            5
AutomationRuns            18
Notifications             22
```

### Distributions

```
Lead stage          New 12   Contacted 10   Qualified 9   Proposal 7   Won 6   Lost 4
Lead source         Website 18   Campaign 11   Referral 9   Walk-in 6   Returning customer 4
Lead priority       Low 14   Normal 24   High 10
Customer status     Active 26   Inactive 6
Customer segment    Standard 18   Frequent 9   Business 5
Vehicle status      Available 10   Reserved 4   Rented 7   Maintenance 3
Vehicle class       Urban 10   Touring 7   Utility 7
Reservation status  Draft 4   Confirmed 4   Converted 7   Cancelled 3
Contract status     Pending 3   Active 7   Completed 3   Cancelled 1
Payment status      Paid 18   Pending 5   Overdue 3
Payment category    Rental 18   Deposit 6   Adjustment 2
Maintenance status  Open 2   In Progress 1   Completed 6   Cancelled 1
Automation runs     Success 13   Skipped 4   Failed 1
Notification cat.   CRM 6   Reservation 4   Finance 5   Maintenance 4   Automation 3
```

### Relationship consistency

The distributions are not independent. These identities must hold in the seed
and after any reset:

```
7 Active contracts        ↔  the 7 Rented vehicles
4 Confirmed reservations  ↔  the 4 Reserved vehicles
2 Open + 1 In Progress    ↔  the 3 Maintenance vehicles
6 Won leads               ↔  6 of the 32 customers carry sourceLeadId
                             the remaining 26 are established customers
```

Vehicle totals: 10 + 4 + 7 + 3 = 24.

### Actors

```
actor_0001   Morgan Reed     Admin
actor_0002   Avery Chen      Sales Agent
actor_0003   Jordan Blake    Fleet Coordinator
actor_0004   Taylor Quinn    Finance Analyst
```

Explicitly synthetic identities. No emails, no telephone numbers.

### Conversations and messages

Twenty conversations across leads and customers: 11 with a Lead subject, 9 with
a Customer subject. Channels: Web chat 12, In-app 8. Status: Open 13, Closed 7.
Six are unread.

Sixty-four messages: sixteen conversations of three messages and four of four.
Every conversation holds at least two.

### Notifications

Twenty-two, covering all five categories, of which eight are unread. The unread
badge derives from the data; 8 is never written as a literal.

### Vehicles

Asset codes `MTR-001` through `MTR-024`. Where geographic grouping is useful,
the only permitted service areas are the synthetic labels Central, North, East
and South, six vehicles each. No real addresses and no map.

### Seeded audit history

Audit entries correspond to the state transitions the seeded history implies,
one entry per transition:

```
lead.converted             6      six Won leads
reservation.confirmed      4
reservation.converted      7
reservation.cancelled      3
contract.activated         7
contract.completed         3
contract.cancelled         1
payment.recorded          18      the eighteen Paid payments
maintenance.started        7      one In Progress plus six Completed
maintenance.completed      6
maintenance.cancelled      1
                          ──
total                     63
```

Creation is not audited; transitions are. `meta.auditSequence` after seeding is
therefore 63, and `revision` remains 0 because seeding is not a mutation.

Seeded jobs: 0. AutomationRuns are ordinary records, not runtime jobs.

### Required runtime extension

**The Stage 09A runtime cannot express a seeded audit trail today.**
`ResetPayload` carries `demoId`, `records` and `meta` only, so `resetDemo`
has no way to write the 63 entries above, and both adapters purge audit on
reset.

Stage 09C must extend it, minimally and in both adapters:

```
ResetPayload += audit?: AuditEntry[]
indexed-db.resetDemo   writes them in the same transaction as the purge and reseed
memory.resetDemo       writes them into the same staged commit
```

This preserves every existing guarantee (one transaction, demo isolation,
identical semantics between adapters) and is the smallest change that makes
"reset restores the demo exactly" true of audit as well as records. It is
recorded here rather than made silently, because Stage 09A is frozen and
tagged.

Without it, the alternative is a demo whose Activity panels are empty on first
launch, which was judged the worse outcome for a product whose selling point
includes auditability.

## 12. Workflows

Six acceptance paths, frozen now and asserted by Stage 09C's QA.

### W1 - Lead to customer

```
create lead
→ automation assigns a Sales Agent when source is Website
→ move stage
→ qualify
→ follow-up automation sets nextFollowUpAt
→ convert lead
→ customer created, lead Won, convertedCustomerId set
```

Conversion writes audit, emits `lead.converted`, and increments revision once
the transaction commits. Converting an already-converted lead raises
`CONFLICT`.

### W2 - Reservation to rental

```
select customer
→ create reservation
→ validate availability
→ confirm and select a vehicle
→ vehicle Reserved
→ convert to contract
→ activate contract
→ vehicle Rented
```

Conversion creates a Pending contract, sets the reservation to Converted and
records `convertedContractId`.

### W3 - Payment

```
open contract
→ record payment
→ contract paidAmount updates
→ payment appears in the contract and in Payments
→ Overview and Reports move
→ audit entry exists
```

### W4 - Maintenance

```
open vehicle
→ create work order
→ start work order
→ vehicle Maintenance
→ complete work order
→ vehicle status recomputed by §6
→ notification generated by Rule 05
```

Starting a work order on a vehicle with an Active contract raises `CONFLICT`
with a clear explanation. Completing a contract returns the vehicle to
Available unless an active work order or a confirmed reservation says otherwise.

### W5 - Inbox and assist

```
open conversation
→ read thread
→ deterministic Lead Brief visible
→ send reply
→ conversation updates
→ recommended next action reflects the new state
```

### W6 - Automation control

```
open Automations
→ disable a rule
→ trigger its event
→ run recorded as Skipped
→ enable the rule
→ trigger or Test
→ action runs
→ AutomationRun visible
```

## 13. Shell and responsive behaviour

```
shared portfolio demo bar        Stage 09A, unchanged
product sidebar                  232–248px on desktop
product top bar                  page title, context actions, notifications,
                                 synthetic actor marker
main content
```

The top bar does not duplicate the role switch; that control lives in the
shared chrome.

```
≥1180px    persistent sidebar
768–1179   collapsible drawer navigation
<768px     compact top app bar + bottom navigation + More sheet
```

A permanently open 240px sidebar is never attempted at 768px.

### Bottom navigation

Core items are Overview, Leads, Reservations, Fleet, More. Where the selected
role cannot see one of the four, the slot is filled from the canonical module
order, so the bar always offers four modules plus More:

```
Admin               Overview  Leads         Reservations  Fleet     More
Sales Agent         Overview  Leads         Reservations  Customers More
Fleet Coordinator   Overview  Reservations  Fleet         Contracts More
Finance Analyst     Overview  Customers     Contracts     Payments  More
```

The More sheet holds the remaining modules available to the role. A module the
role cannot access is never listed.

### Tables and forms on small screens

Desktop tables become stacked record rows or compact cards, never a desktop
table scaled down until it is unreadable. Search, filters, sort, pagination and
row actions all survive the transformation, and no important field is dropped
merely because the layout changed.

Forms may use two columns on desktop and are single-column on mobile, with the
primary action within easy reach.

Record detail is a side drawer on desktop and a full-screen sheet on mobile. A
440px drawer is never squeezed into a 360px viewport.

## 14. Forms, errors and states

Every mutation form carries field-level validation, an error summary where
several fields are wrong, a disabled processing state, a working cancel, and a
visible state change on success. There is no fake submit.

Principal business records are never hard-deleted. They are archived, cancelled
or closed as the domain dictates. Hard delete is reserved for temporary draft
entities and requires separate justification.

Mutations are not optimistic in v1. They go through the shared deterministic
async boundary, show a short processing state, and update after the domain
commit, which is easier to reason about and to test.

### Error mapping

```
VALIDATION    Fix the highlighted fields
CONFLICT      Explain the conflicting business state
FORBIDDEN     Module or action unavailable for the selected demo role
NOT_FOUND     This synthetic record is no longer available
UNAVAILABLE   Demo persistence is temporarily unavailable
```

A selected entity that no longer exists closes the stale detail surface or
shows the `NOT_FOUND` message. It never crashes the module.

### Empty and loading states

Every module has a designed empty state and a designed filter-zero state, with
working actions:

```
No leads match these filters.
Clear filters
```

Skeletons appear only where the async delay is genuinely perceptible. A 120ms
read does not flash a skeleton.

### First launch

Overview, as Admin, with the seeded dataset. No onboarding wizard: the visitor
meets the product immediately.

## 15. Visual direction

A premium modern operations SaaS product. Not a portfolio section, not a
developer console, not a cyberpunk dashboard, not a crypto application, not a
generic admin template.

```
warm near-white / cool milk surfaces
ink / navy-neutral text
soft sky primary
mint positive
peach attention
lavender secondary
```

Bright throughout. The homepage aurora is not reused as the background of every
application screen: the demo lives in the portfolio palette without
wearing the portfolio's atmosphere.

Originality is required. The Fuse React reference is an **interaction
completeness** benchmark only: the principle that a displayed control works.
None of its layouts, visual design, components, assets, code or trade dress may
be copied.

### Icons

The project has no icon package and every mark in it is authored locally as
SVG. Operations follows that: inline SVG, drawn for this product. No icon
library is installed.

## 16. Accessibility

```
semantic navigation and landmarks
correct page heading structure
real <table> elements on desktop where relationships are tabular
labels on every form input
keyboard-operable drawers and dialogs
focus management, and a visible focus ring
accessible error text
status announcements for async results
```

Mobile record cards may use different semantic structure while carrying
equivalent information.

Dialogs move focus in, contain it appropriately, close on Escape when safe, and
return focus to the trigger. A destructive confirmation names the affected
synthetic record.

## 17. QA contracts

Stage 09C must assert all of the following.

```
workflows      all six paths in §12 complete end to end
role matrix    for each of the four roles: visible modules, hidden modules,
               allowed mutations, refused mutations, direct-route behaviour
derived state  creating a lead moves Overview; confirming a reservation moves
               Fleet; activating a contract changes the vehicle; recording a
               payment moves the contract and the reports; completing
               maintenance changes the vehicle; notifications move the unread
               count
refresh        representative mutations survive a reload
reset          after heavy mutation, every count and distribution in §11
               returns exactly
determinism    after reset: same ids, same actor names, same clock, same
               counts, same dashboard figures, same relationships
no contact     zero matches for email patterns, phone patterns, mailto:, tel:,
               wa.me, whatsapp, telegram, discord across seed and rendered UI
network        zero API requests and zero external data requests during load,
               CRUD, search, filter, workflows, automation, inbox reply,
               reports and reset
```

Performance is not a benchmark exercise, but module navigation should feel
immediate, filters should update without perceptible lag, and a ~50-row table
should be trivial. No virtualization is required at this dataset size. The idle
runtime stays event-driven.

## 18. Out of scope for v1

Frozen exclusions, recorded so they are not reintroduced as scope creep:

```
no CSV or PDF export
no global cross-entity command palette
no generic visual automation rule builder
no Settings module
no real maps or geographic addresses
no payment provider, card entry or real processing
no browser push notifications
no optimistic mutations
no virtualization
no icon library
```

## 19. Truthfulness

```
real client data              none
real contact information      none
real manufacturer brands      none
real company names            none
backend required              no
AI API required               no
payment provider required     no
```

The demo simulates business concepts; it does not claim to implement them.
Secure authentication, an encrypted database, production RBAC and secure
payment processing are never claimed.

## 20. Architecture

```
Operations UI  (modules, tables, forms, drawers)
      │
      ▼
Operations domain services
  leads · customers · vehicles · reservations · contracts
  payments · maintenance · conversations · automation
      │
      ├──────────────► domain events ──► automation jobs ──► AutomationRun
      ├──────────────► audit entries
      └──────────────► notifications
      │
      ▼
Demo Runtime   (records, collections, clock, ids, repository,
                async boundary, events, audit, jobs, session)
      │
      ▼
Persistence adapter  →  IndexedDB   (memory fallback)
```

The runtime never learns what a lead or a vehicle is. Everything in the middle
band is the Operations domain, and it is the only layer that knows.

## 21. Next stage

```
Stage 09C - Build Operations / CRM / ERP SaaS Demo
```

Implementation against this frozen contract, in substages. 09C1 built the
domain, the deterministic seed and the services; 09C2 onward build the
interface.

Registry status is `planned` before 09C, `building` while it is under
construction, and `verified` only once the demo is finished and QA'd. It reads
`building` now.

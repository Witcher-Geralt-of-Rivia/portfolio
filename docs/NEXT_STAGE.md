<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-08            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 09                IN PROGRESS
  09A Demo platform     COMPLETE - shared runtime built and frozen
  09B Operations spec   COMPLETE - product contract frozen
  09C Operations build  IN PROGRESS
    09C1 domain + seed  COMPLETE
    09C2 shell + Overview  COMPLETE
    09C2.1 shell hardening + review deployment  COMPLETE
    09C3 Leads/Customers/Inbox  IN PROGRESS, one module per stage (D-062)
      09C3.1 Leads     COMPLETE and deployed
      09C3.1.1 Leads visual hardening  COMPLETE and deployed
      09C3.2 Customers BLOCKED - awaiting external live review of 09C3.1.1
      09C3.3 Inbox + integrated CRM workflow
```

## The block

Next task: Stage 09C3.2 - Operations CRM: Customers (BLOCKED UNTIL EXTERNAL LIVE REVIEW OF 09C3.1.1)

Stage 09C3.2 does not start until a human has looked at
`https://intelligent-systems-lab.duckdns.org/demos/operations/leads` on a real
screen and said what they think of it. The first such review is why 09C3.1.1
exists: it found four presentation faults the suite had no opinion about.

This is deliberate, and this stage earned it twice over. Every defect 09C2.1
fixed was found by looking at rendered pixels, three of four while the QA suite
passed — and 09C3.1's own review found two more the suite had no opinion about:
lead names rendering in the column-header face and sitting ten pixels above
their row, and a stub of border under the last row's name.

Leads is also the pattern every later module reuses: the table, the mobile
records, the detail drawer, the forms, the confirmations and the URL contract.
A problem in the pattern, found after Customers and Inbox exist, is a problem
fixed three times.

Nothing about the block is technical. The build is deployed, the regression is
green, and the work is ready to continue the moment the review comes back.

`currentStage` stays at **8**. Neither 09A nor 09B completes Stage 09: the
shared foundation exists and Demo 01's contract is frozen, but no demo has been
built, nothing is wired into the page, and `#work` still renders its Stage 03
placeholder.

## Ordered plan

```
1.  Persistent context system                   DONE
2.  Domain / HTTPS / production deploy          DONE
3.  Stage 05 - Intelligent Systems              DONE
4.  Stage 06 - Product Engineering              DONE
5.  Post-Stage 06 hardening                     DONE
6.  Stage 07 - AI Learning Systems              DONE
7.  Stage 08 - Engineering Lab                  DONE
8.  Stage 09A - Demo platform foundation        DONE
9.  Stage 09B - Operations product spec         DONE
10. Stage 09C1 - Operations domain + seed       DONE
11. Stage 09C2 - Shell + routes + Overview      DONE
12. Stage 09C2.1 - Hardening + review deploy    DONE
13. Stage 09C3.1 - Leads                        DONE
14. Stage 09C3.1.1 - Leads visual hardening     DONE
15. Stage 09C3.2 - Customers                    BLOCKED on live review
16. Stage 09C3.3 - Inbox + CRM workflow         LATER
17. Stage 09C4-C6 - modules, then QA/deploy     LATER
13. Field and Learning specs, then builds       LATER
14. Stage 09 - #work launcher integration       LATER
```

## What changed about Stage 09

Stage 09 was originally Work / Selected Engineering Case Studies. That route is
blocked on content: the repository holds no verified client engagement, and
`docs/CASE_STUDY_SOURCE_AUDIT.md` records the exhaustive search that
established it. Inventing one would break D-045 at the scale of a whole
engagement.

The strategy changed. `#work` becomes a launcher into three substantial
interactive product demonstrations a visitor can actually use:

```
/demos/operations   Operations / CRM / ERP SaaS
/demos/field        Field Operations Web + Mobile
/demos/learning     Adaptive Learning Platform
```

Each is synthetic, frontend-only and discloses both. Route identities are
frozen; the fictional product names inside each application are decided per
demo.

The case-study work is preserved, not deleted. `src/content/case-studies.ts`
still holds one verified internal case, Internal Production Delivery System,
with two empty draft slots. It is not public and is not part of the three
demos. It may later become a separate Engineering Evidence item; its provenance
must never be mixed with the synthetic demo products.

## What exists now

```
src/demo-runtime/          the shared runtime: persistence (IndexedDB +
                           memory), deterministic clock and ids, repository,
                           mock async boundary, events, audit, jobs, session,
                           connectivity, broadcast, React provider and hooks
src/components/demos/      DemoShell, DemoDisclosure, DemoResetControl
src/app/demos/layout.tsx   demo frame, robots noindex. No page beneath it,
                           so /demos is a 404 by design
src/styles/demo-shell.css  chrome styling, loaded by that layout
qa/stage09a-runtime.mjs    76 checks   qa/stage09a-shell.mjs   85 checks
docs/DEMO_PLATFORM.md      canonical for the demo architecture
```

Nothing is wired into `src/app/page.tsx`, `globals.css` is unchanged, and
production is untouched.

## NEXT TASK

**Stage 09C3 - Operations CRM: Leads + Customers + Inbox.**

The first three module screens. The shell, routing, role policy, notification
centre and Overview are built and measured; every service and selector these
screens need already exists and is covered by `qa/stage09c1-operations.mjs`.

Each module that lands must flip its `implemented` flag in
`src/demos/operations/ui/modules.ts` from false to true, which turns its
sidebar entry from a non-interactive label into a link. That flag and the
styling that reads it are temporary build state and disappear entirely once all
eleven modules exist.

Do not begin it until instructed.

## Finishing Stage 09

```
1  freeze each product spec, then build that demo
2  set that demo's status to "verified" in src/demo-runtime/demo-registry.ts
3  only when all three are verified, build the #work launcher
4  add a Stage 09 heading assertion to deploy/safe-deploy.ps1 (D-039)
5  QA #work at all eight viewports
6  npm run deploy:safe
7  only then set currentStage 9, frozen 1-9, and tag
```

`workSectionIsPublishable()` returns false until all three demos are verified,
so the launcher cannot advertise a demo that is not finished (D-050).

Once `#work` is built, `.nav-specimen` in `src/app/page.css` and the
`PLACEHOLDERS` loop in `src/app/page.tsx` become dead and can be removed.

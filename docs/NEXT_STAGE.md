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
    09C3 Leads/Customers/Inbox  COMPLETE, one module per stage (D-062)
      09C3.1 Leads     COMPLETE and deployed
      09C3.1.1 Leads visual hardening  COMPLETE and deployed
      09C3.1.2 Custom select system    COMPLETE and deployed
      09C3.2 Customers COMPLETE and deployed
      09C3.3 Inbox + integrated CRM workflow  COMPLETE and deployed
      09C3.3.1 Inbox viewport containment     COMPLETE and deployed
      09C3.3.2 Message timestamp reconciliation  COMPLETE
    09C4 Rental Operations Core  IN PROGRESS (D-090)
      09C4.0 core domain readiness  COMPLETE
      09C4.1 Reservations           COMPLETE, deployed and APPROVED
      09C4.A Contracts + Fleet + Maintenance  COMPLETE and deployed
      09C4.4 Payments + Automations + Reports  NOT STARTED
```

09C4.2 and 09C4.3 were merged into one batch, 09C4.A, on an explicit
instruction to complete Demo 01 quickly while preserving domain correctness,
persistence, role policy, accessibility, responsive behaviour and deployment
safety. The asset-code question that blocked 09C4.3 was answered in the same
instruction and recorded as D-094.

## The block

Next task: Stage 09C4.4 - Payments, Automations and Reports (NOT STARTED)

Eight of Demo 01's eleven modules are built and deployed. The three that remain
are the last batch, and it has not been started and does not start without an
explicit instruction. That rule has not changed and is worth keeping: six
reviews of this product have each found something the suite had no opinion
about, most recently an application rendering above 1951 pixels of portfolio
background while 367 checks passed.

Nothing is blocked. Every service and selector the last three modules need
already exists, `payments.ts` included, and the asset-code question that once
blocked the fleet work is closed (D-094).

Stage 09C3 is complete and approved. 09C4.1 Reservations is approved. 09C4.A is
built, deployed and awaiting its own review.

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
15. Stage 09C3.1.2 - Custom select system       DONE
16. Stage 09C3.2 - Customers                    DONE
17. Stage 09C3.3 - Inbox + CRM workflow         DONE
18. Stage 09C3.3.1 - Inbox viewport containment DONE
19. Stage 09C3.3.2 - Message timestamp contract DONE
20. Stage 09C4.0 - Core domain readiness        DONE
21. Stage 09C4.1 - Reservations                 DONE
22. Stage 09C4.A - Contracts, Fleet, Maintenance DONE
23. Stage 09C4.4 - Payments, Automations, Reports  NEXT
24. Stage 09C5-C6 - integration and full QA     LATER
25. Field and Learning specs, then builds       LATER
26. Stage 09 - #work launcher integration       LATER
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

**Stage 09C4.2 - Contracts.**

The second of five, in the sequence D-090 froze:

```
09C4.0  core domain readiness
09C4.1  Reservations
09C4.2  Contracts
09C4.3  Fleet + Maintenance
09C4.4  Payments + the integrated rental workflow
```

The CRM group is done and approved, and it established everything these
reuse: the table and drawer grammar, the approved select, the URL contract
for selection, the role gate and the single polite announcement.

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

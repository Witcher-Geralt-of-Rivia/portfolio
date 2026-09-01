<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-08            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 09                IN PROGRESS
  09A Demo platform     COMPLETE - shared runtime built and frozen
  09B Operations spec   NEXT
```

`currentStage` stays at **8**. Stage 09A completing does not complete Stage 09:
the shared foundation exists, but no demo has been built, nothing is wired into
the page, and `#work` still renders its Stage 03 placeholder.

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
9.  Stage 09B - Operations product spec         NEXT
10. Stage 09C/D - Field and Learning specs      LATER
11. Stage 09 - #work launcher integration       LATER
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

**Stage 09B - Operations / CRM / ERP SaaS Product Specification.**

09B is product and domain planning, not implementation. It should freeze:

```
product scenario        entities            relationships
roles                   navigation          workflows
screens                 CRUD contract       automation
notifications           dashboard derivation    seed dataset
```

before any screen is built. Stage 09A deliberately decided none of that: the
runtime knows records and collections, and never what a customer or an order
is.

Do not begin 09B until the specification is supplied.

## Finishing Stage 09

```
1  09B/09C/09D  freeze each product spec, then build the demo
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

<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-08            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 09                BLOCKED / awaiting verified case-study content
```

`currentStage` stays at **8**. Stage 09 is not complete and must not be marked
so: its framework is built, but no case study has been published because there
is nothing truthful to publish yet.

## Ordered plan

```
1. Persistent context system                    DONE
2. Domain / HTTPS / production deploy           DONE
3. Stage 05 - Intelligent Systems               DONE
4. Stage 06 - Product Engineering               DONE
5. Post-Stage 06 hardening                      DONE
6. Stage 07 - AI Learning Systems               DONE
7. Stage 08 - Engineering Lab                   DONE
8. Stage 09 - Work / Case Studies               BLOCKED - needs content
```

## Why Stage 09 is blocked

A case study asserts that real work was done. This repository holds no record
of any client engagement - no project file, no notes, no metrics, and nothing
in fourteen commits of history. The only project-shaped content in the tree is
the Stage 06-08 demonstration data, and every one of those modules declares
itself synthetic in its own source.

Writing case studies from that material would mean inventing clients, problems
and outcomes and publishing them on a live public site. D-045 already forbids
inventing a single number; inventing an entire engagement is the same rule at
a larger scale.

The full search and its findings are in `docs/CASE_STUDY_SOURCE_AUDIT.md`.

## What exists now

The system is built and waiting for content. Nothing is wired into the page,
so production is unchanged and `#work` still renders its Stage 03 placeholder.

```
src/content/case-studies.ts        typed model, render-safety filter, three
                                   empty entries marked status: "draft"
src/components/work/               section, index, case study, architecture,
                                   decisions, result
src/styles/work.css                section styling (not yet imported, and not
                                   yet measured against real copy)
qa/stage09-render-safety.mjs       25 checks proving a draft cannot render
```

## NEXT TASK

**Stage 09 - Work / Selected Engineering Case Studies**, blocked on content.

Supply verified case-study material, then finish the stage.

Three case studies are needed. For each, the required facts are listed in
`docs/CASE_STUDY_SOURCE_AUDIT.md` under "What is needed to unblock Stage 09".
Metrics are optional - a case study without numbers is preferred over one with
invented ones.

Do not begin Stage 10. Do not populate the drafts from imagination.

## Finishing Stage 09 once content exists

```
1  fill the entries in src/content/case-studies.ts and set status: "verified"
2  add "work" to the BUILT set in src/app/page.tsx and render the section
3  append @import "../styles/work.css" to src/app/globals.css
4  add the Stage 09 heading assertion to deploy/safe-deploy.ps1 (D-039):
   'Engineering decisions in context\.' - the id alone proves nothing,
   because the placeholder already emits id="work"
5  QA the section at all eight viewports; work.css has never been measured
6  npm run deploy:safe
7  only then set currentStage 9, frozen 1-9, and tag
```

Once `#work` is built, `.nav-specimen` in `src/app/page.css` and the
`PLACEHOLDERS` loop in `src/app/page.tsx` become dead and can be removed.

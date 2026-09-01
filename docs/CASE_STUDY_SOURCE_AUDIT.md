<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Case Study Source Audit

Stage 09 publishes case studies about real engineering work. Before any of it
can be written, the sources have to exist and be checked. This document records
what was searched, what was found, and what is still needed.

**Result: 0 of 3 required case studies are publishable. Stage 09 is BLOCKED.**

The `#work` placeholder stays live and `currentStage` stays at 8.

## What was searched

Everything in this repository except `node_modules`, `.next`, the two release
slots and `.git` internals:

```
docs/           all 11 canonical documents, read in full
src/            every component, style and data module
qa/             every harness, report and measurement file
public/          both SVG assets
repo root       README.md, AGENTS.md, CLAUDE.md, configs
git history     all 14 commits, plus every file ever added on any branch
```

Search terms included: case study, client, engagement, contract, freelance,
Upwork, Fiverr, testimonial, delivered, shipped, built for, worked with,
project, company suffixes (Inc/LLC/Ltd/GmbH/Corp) and email patterns.

Nothing outside this repository was opened. In particular
`C:\ce-staging\ecosystem.config.js` and every other project directory on the
host were left untouched, per the standing instruction.

## What was found

**No record of any client engagement exists in this repository, and none ever
has.** `git log --all --diff-filter=A --name-only` shows no case-study,
content, client or project-data file has been added at any point in the
project's history. There is no `src/content/`, no `work/` directory and no
drafts.

Every "project-like" artefact in the tree is synthetic demonstration content
built for Stages 06-08, and each module says so at the top of its own file:

| Module | Self-declaration |
|---|---|
| `product-scenarios.ts:10` | "These are design and engineering SIMULATIONS. They are not client work, not shipped products" |
| `learning-scenarios.ts:9` | "Everything in this file is SYNTHETIC. 'Maya' is not a person, the mastery percentages are not measurements" |
| `lab-experiments.ts:13` | "Everything here is a local simulation... sequence positions, not measured latency" |
| `PROJECT_STATE.md:308` | "These are engineering simulations, not client work." |

"Northwind Ltd", "Studio Lamp", "Order 4821", "JOB-108" and "Maya" are
interface fixtures inside surfaces labelled DEMO DATA or LOCAL SIMULATION.
None of them may be promoted into a case study.

`README.md` is unmodified `create-next-app` boilerplate.

## Candidate inventory

### Candidates 01-03 — client engagements

```
candidate:            none identified
source:               none
verified facts:       none
private facts:        none
safe public facts:    none
missing facts:        everything - see "What is needed" below
publishable:          NO
```

No client project is described anywhere in the repository, so there is nothing
to verify, anonymise or redact. This is an absence of source material, not a
privacy problem.

### Candidate 04 — this portfolio's own delivery infrastructure

```
candidate:            the portfolio's A/B release-slot deployment system
source:               this repository - docs/CHANGELOG.md, docs/DECISIONS.md
                      D-030..D-032, docs/QA_BASELINE.md
verified facts:       a real problem (a build into the live directory took the
                      public site down twice during Stage 05); a real fix
                      (alternating .next-release-a/b slots with validate,
                      smoke-test, switch, health-check and automatic rollback);
                      measured evidence (255/255 and 327/327 public requests
                      returned 200 during builds; the rollback path was
                      exercised, not merely written)
private facts:        none - the host runs another project, which is named in
                      DEPLOYMENT.md but whose configuration is off-limits and
                      was not read
safe public facts:    the problem, the architecture, the decisions and the
                      measurements above are all reproducible from this
                      repository
missing facts:        none factually - but this is the portfolio describing
                      itself, not delivered client work
publishable:          NO - pending an explicit decision by the user
```

This is the only body of genuinely verified engineering evidence available. It
is recorded here because it is the honest answer to "is there anything real to
show?", not because it should be published. Whether a self-referential case
study belongs in a Selected Work section is a content decision for the user,
not one to make on their behalf.

## What is needed to unblock Stage 09

Three case studies, each requiring the following. Metrics are optional; a case
study without numbers is acceptable and preferred over an invented one.

```
1  an anonymous project label      e.g. "Operations Platform"
                                   (a real client name will not be published
                                   without explicit approval)
2  category                        e.g. SAAS / BACKEND / AUTOMATION
3  the problem                     2-4 real operational or technical constraints
4  scope                           what was actually in and out of scope
5  the solution                    what was built
6  architecture                    5-9 real components and how they connect;
                                   only systems that were genuinely involved
7  technologies                    only what was actually used
8  one engineering challenge       the hardest real problem in the work
9  1-2 key decisions               each with the reason, and at least one
                                   naming a trade-off that was actually made
10 result                          2-4 delivered capabilities; qualitative is
                                   fine
```

Optional per case: up to three metrics, each with a source note recorded here
and never rendered publicly.

Also needed, per case: confirmation of what may be published — whether the
client may be named, whether any screenshot is safe, and whether any figure may
be quoted.

## Framework status

The system is built and waiting for content:

```
src/content/case-studies.ts        typed model, render-safety filter,
                                   three empty entries marked status: "draft"
src/components/work/               section, index, case study, architecture,
                                   decisions and result renderers
src/styles/work.css                section styling
qa/stage09-render-safety.mjs       proves a draft can never reach the page
```

Nothing is wired into `src/app/page.tsx`. The `#work` placeholder renders
exactly as before, and production is unchanged. When verified content arrives,
promoting a case study means setting `status: "verified"` and adding one import
and one line to `page.tsx`.

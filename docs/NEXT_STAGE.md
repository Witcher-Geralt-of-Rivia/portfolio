<!-- PROJECT_STAGE: 7 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-07            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 08                NOT STARTED
```

## Ordered plan

```
1. Persistent context system              DONE
2. Domain / HTTPS / production deploy     DONE
3. Stage 05 - Intelligent Systems         DONE
4. Stage 06 - Product Engineering         DONE
5. Post-Stage 06 hardening                DONE
6. Stage 07 - AI Learning Systems         DONE
7. Stage 08 - Engineering Lab             NEXT
```

## NEXT TASK

**Stage 08 - Engineering Lab.**

It fills `#lab`, still a Stage 03 navigation placeholder. The user will supply
that specification separately. Do not begin it automatically and do not design
it in advance.

## Sections still to build

```
#lab    Stage 08 - Engineering Lab
#work   later stage
```

Both are currently neutral placeholders showing an eyebrow label and the words
"Navigation specimen section". Replace one per stage; leave the other alone.

`#systems` (Stage 05), `#products` (Stage 06) and `#ai-learning` (Stage 07) are
built and frozen. Do not redesign them without an explicit instruction.

## Before starting Stage 08

The site is public, so anything shipped is immediately visible. Deploy with:

```
npm run deploy:safe
```

That is the whole procedure. It validates, builds the inactive release slot,
smoke-tests it on a loopback port, switches production, health-checks the public
URL and rolls back automatically if anything fails.

Do **not** deploy by hand. Production no longer serves `.next`, so a plain
`npm run build` is harmless — but it also deploys nothing.

The smoke gate asserts the markup of every built section: `id="systems"`,
`id="products"`, `id="ai-learning"`, and the Stage 06 and Stage 07 headings.
When Stage 08 fills `#lab`, add its heading to that list in
`deploy/safe-deploy.ps1` — an id alone proves nothing, because the placeholder
already emits it. See D-039.

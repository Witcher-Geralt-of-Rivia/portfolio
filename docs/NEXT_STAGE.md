<!-- PROJECT_STAGE: 5 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-05            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 06                NOT STARTED
```

## Ordered plan

```
1. Persistent context system            DONE
2. Domain / HTTPS / production deploy   DONE
3. Stage 05 - Intelligent Systems       DONE
4. Stage 06 - Product Engineering       NEXT
```

## NEXT TASK

**Stage 06 - Product Engineering / Web + Mobile + AI.**

It fills the `#products` section, which is still a Stage 03 navigation
placeholder. The user will supply that specification separately. Do not begin
it automatically and do not design it in advance.

## Sections still to build

```
#products      Stage 06 - Product Engineering / Web + Mobile + AI
#ai-learning   later stage
#lab           later stage
#work          later stage
```

Each is currently a neutral placeholder showing an eyebrow label and the words
"Navigation specimen section". Replace one per stage; leave the rest alone.

## Before starting Stage 06

The site is public, so anything shipped is immediately visible. Deploy with:

```
npm run deploy:safe
```

That is the whole procedure. It validates, builds the inactive release slot,
smoke-tests it on a loopback port, switches production, health-checks the public
URL and rolls back automatically if anything fails.

Do **not** deploy by hand. Production no longer serves `.next`, so a plain
`npm run build` is harmless — but it also deploys nothing.

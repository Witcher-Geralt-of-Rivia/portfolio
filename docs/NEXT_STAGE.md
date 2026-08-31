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

The site is public, so anything shipped is immediately visible. Follow the
production update procedure in `docs/DEPLOYMENT.md`:

```
npm run qa:memory  ->  npx tsc --noEmit  ->  npm run build  ->  pm2 restart portfolio
```

**`npm run build` replaces `.next` while the production process is serving from
it, so the live site breaks until the restart.** Treat build and restart as one
step, and re-verify the public URL afterwards.

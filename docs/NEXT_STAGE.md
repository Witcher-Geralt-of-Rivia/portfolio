<!-- PROJECT_STAGE: 4 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-04            COMPLETE and FROZEN
Persistent context      COMPLETE
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 05                NOT STARTED
```

Deployment did **not** advance the design stage. The current design stage
remains 4 and stages 1-4 remain frozen.

## Ordered plan

```
1. Persistent context system            DONE
2. Domain / HTTPS / production deploy   DONE
3. Independent public-site inspection   optional - see note below
4. Stage 05 - section content           NEXT
```

## NEXT TASK

**Stage 05.**

Stage 05 replaces the five neutral anchor sections on `/` with real section
content: Systems, Products, AI Learning, Lab and Work.

The user will supply that specification separately. Do not begin it
automatically, and do not design those sections in advance.

## Before starting Stage 05

The site is now public. Anything shipped from here is visible immediately at
`https://intelligent-systems-lab.duckdns.org`, so:

- Run the full regression suite before restarting the production process.
- The production update procedure is in `docs/DEPLOYMENT.md`. It is:
  `npm run qa:memory` -> `npm run build` -> `pm2 restart portfolio`.
  Caddy is not touched by an application deployment.
- The frozen-stage and privacy constraints apply unchanged.

## Independent public-site inspection

Every verification so far originated on the VPS itself. External inbound
reachability on port 443 is proven by Let's Encrypt's ACME validation, which
connected from four public IPs. A visual check from the user's own browser is
still worth doing once, but it is not a blocker for Stage 05.

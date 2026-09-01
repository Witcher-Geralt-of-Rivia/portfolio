<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-08            COMPLETE and FROZEN
Domain / HTTPS deploy   COMPLETE - live at https://intelligent-systems-lab.duckdns.org
Stage 09                NOT STARTED
```

## Ordered plan

```
1. Persistent context system                    DONE
2. Domain / HTTPS / production deploy           DONE
3. Stage 05 - Intelligent Systems               DONE
4. Stage 06 - Product Engineering               DONE
5. Post-Stage 06 hardening                      DONE
6. Stage 07 - AI Learning Systems               DONE
7. Stage 08 - Engineering Lab                   DONE
8. Stage 09 - Work / Case Studies               NEXT
```

## NEXT TASK

**Stage 09 - Work / Selected Engineering Case Studies.**

It fills `#work`, the last remaining Stage 03 navigation placeholder. The user
will supply that specification separately. Do not begin it automatically and do
not design it in advance.

## Sections still to build

```
#work   Stage 09 - Work / Selected Engineering Case Studies
```

It is still a neutral placeholder showing an eyebrow label and the words
"Navigation specimen section". `#systems` (05), `#products` (06),
`#ai-learning` (07) and `#lab` (08) are built and frozen. Do not redesign them
without an explicit instruction.

Once `#work` is built, `.nav-specimen` in `src/app/page.css` and the
`PLACEHOLDERS` loop in `src/app/page.tsx` become dead and can be removed.

## Before starting Stage 09

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
`id="products"`, `id="ai-learning"`, `id="lab"`, and the Stage 06, 07 and 08
headings. When Stage 09 fills `#work`, add its heading to that list in
`deploy/safe-deploy.ps1` — an id alone proves nothing, because the placeholder
already emits it. See D-039.

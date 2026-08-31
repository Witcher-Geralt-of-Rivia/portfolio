<!-- PROJECT_STAGE: 4 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Next Stage

## Current position

```
Stages 01-04            COMPLETE and FROZEN
Persistent context      COMPLETE (this documentation set)
Stage 05                NOT STARTED
```

## Ordered plan

```
1. Persistent context system            DONE
2. Domain / HTTPS / production deploy   NEXT
3. Independent public-site inspection   after 2
4. Stage 05 - section content           after 3
```

## NEXT TASK

**Domain + HTTPS + production deployment.**

The user will supply that specification separately. Do not begin it
automatically, and do not improvise any part of it.

Nothing in that area is configured today:

```
Domain / DNS        NOT CONFIGURED
HTTPS / TLS         NOT CONFIGURED
Reverse proxy       NOT CONFIGURED for this project
Production deploy   NOT COMPLETED
Provider firewall   UNVERIFIED
```

When that specification arrives, read the server-safety rules in
`docs/DEPLOYMENT.md` first. The VPS already hosts other services and existing
domains, ports and web-server configuration must be preserved.

## Not yet

Stage 05 will replace the five neutral anchor sections on `/` with real section
content. It has not started and must not be started before the deployment task
is complete.

Do not design Systems, Products, AI Learning, Lab or Work content yet.

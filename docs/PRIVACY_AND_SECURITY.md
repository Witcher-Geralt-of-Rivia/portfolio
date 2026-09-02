<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Privacy and Security

Hard restrictions. These are standing product decisions, not preferences, and
they hold until the user explicitly changes them.

## Contact Information Prohibition

The portfolio demonstrates technical capability only. It carries **no contact
route of any kind**.

Forbidden:

```
email address        telephone number     WhatsApp
Telegram             Discord              physical address
contact form         booking / calendar   "Hire Me" CTA
"Let's Talk" CTA     "Get in touch"       social account link
```

The prohibition covers every surface, not just visible UI:

```
visible UI                 HTML metadata          OpenGraph
JSON-LD                    HTML comments          example / placeholder data
hidden accessibility text  source code comments   downloadable files
```

Current state: verified clean. A rendered-HTML scan for `mailto:`, `tel:`,
email patterns, and the words contact / telegram / whatsapp / discord returns no
matches. The navigation deliberately omits Contact, Hire Me and About.

## Paid AI Runtime Prohibition

The portfolio must function fully with no AI account and no API key.

Forbidden:

```
OpenAI API           Anthropic / Claude API      Gemini API
any AI SDK           hosted inference service    paid token or credit
AI provider env var  server-side AI inference    browser-held AI key
```

The portfolio **may visually simulate**:

```
AI agents            tool calling         RAG
automation           adaptive learning    CRM automation
agent orchestration
```

Those demonstrations must be built from:

```
predefined deterministic state machines
local static JSON
client-side scripted sequences
local mock responses
interactive visual simulations
```

The Intelligence Constellation in the hero is exactly this: it depicts agent
orchestration and data flow, and it makes no network request of any kind.

Current state: verified clean. Runtime dependencies are `geist`, `next`, `react`
and `react-dom`. No `.env` file exists anywhere in the project, and no AI
provider variable is referenced.

## The Repository Is Public

The source lives at `https://github.com/Witcher-Geralt-of-Rivia/portfolio`, and
its **entire history is public with it**. That changes what a mistake costs: a
credential committed once stays reachable from the commit that introduced it,
so deleting it in a later commit does not unpublish it. Removing it afterwards
means rewriting history, which invalidates every commit SHA and every tag.

Consequently:

- Only synthetic demo data may enter this repository. Nothing real, nothing
  belonging to a client, nothing belonging to another project on this host.
- No credential or secret may enter Git history, not even in a commit that is
  about to be amended away.
- `node qa/public-repo-safety.mjs --history` runs before a publication push.
  It is a guard against the known mistakes — a tracked `.env`, a private key, a
  recognisable credential prefix, a build directory — and it is **not** proof
  that no secret exists. Read what you are about to publish.

Authorship carries the account's GitHub noreply address rather than a personal
one, so publishing a commit does not publish an email address. That was settled
by a one-time authorised history rewrite before the first push; history rewriting
is prohibited again unless the user explicitly authorises it.

## Secrets

- No credential, token, password or private key belongs in this repository.
- **Never place a secret in a `NEXT_PUBLIC_*` variable.** That prefix inlines the
  value into the client bundle, where it is readable by anyone.
- No secret belongs in frontend source, in a comment, or in committed JSON.
- `docs/project-state.json` holds project state only and must never carry
  credentials.
- `.gitignore` excludes `.env*`. Keep it that way.

Current state: no `.env` files exist; no API key of any kind is present.

## Browser Storage

The demo platform stores data in the visitor's own browser: an IndexedDB
database named `portfolio-demo-runtime`, and a `localStorage` key per demo
holding the simulated role.

This is not a departure from the no-backend rule. There is no database server,
no API route, no server action and no external persistence service; nothing
stored ever leaves the visitor's machine, and the site would work identically
with the browser's storage disabled. `D-046` records the distinction, because
`D-024` states the rule as "no backend, no database" and that entry is about
server infrastructure.

What may be stored:

```
synthetic demo records      synthetic audit entries
synthetic job rows          demo metadata (counters, logical clock, revision)
the selected simulated role
```

What may never be stored:

```
a secret, token or API key         a credential of any kind
real client or customer data       anything from another project on this host
a contact route of any kind        anything a visitor did not create in a demo
```

A visitor inspecting browser storage sees clearly synthetic namespaces. No key
resembles a production credential, and no stored value is treated as trusted
input: the cross-tab invalidation message is validated for shape before use,
because anything on that channel came from another script on the origin.

Role switching is an interaction simulation, not a security boundary. Nothing
is authenticated or authorised, and every record stays readable whatever role
is selected. It must never be described as RBAC or as access control.

Deleting the database is always available to the visitor through their browser,
and Reset restores canonical data per demo. A deployment must not erase it; see
`docs/DEMO_PLATFORM.md`.

## Exposed Surface

The development preview binds `0.0.0.0:3000` and is reachable from the public
internet at the VPS address. Consequently:

- Nothing sensitive may be served from `public/`.
- Verified: `/.env`, `/.env.local`, `/package.json`, `/next.config.ts`,
  `/src/app/page.tsx` and `/.git/config` all return 404 over the public IP.
- The app has no API route, no server action and no server-side database
  connection, so there is no request-handling attack surface beyond static file
  serving. The demo platform's storage is browser-local and never served.

## Server Safety

The VPS hosts other services besides this project. See `docs/DEPLOYMENT.md` for
the rules that apply before any server-configuration work.

Observed but **not** touched by this project: a reverse proxy on ports 80/443,
and PostgreSQL listening on `0.0.0.0:5432` with no inbound firewall rule
admitting it. Neither was modified. Report, do not change, unless the user asks.

## If a Request Conflicts With This Document

Stop. Report the conflict and quote the rule. Do not implement a contact route,
an AI provider or a secret-bearing variable on the strength of conversational
context alone - this document is canonical.

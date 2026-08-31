<!-- PROJECT_STAGE: 5 -->
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

## Secrets

- No credential, token, password or private key belongs in this repository.
- **Never place a secret in a `NEXT_PUBLIC_*` variable.** That prefix inlines the
  value into the client bundle, where it is readable by anyone.
- No secret belongs in frontend source, in a comment, or in committed JSON.
- `docs/project-state.json` holds project state only and must never carry
  credentials.
- `.gitignore` excludes `.env*`. Keep it that way.

Current state: no `.env` files exist; no API key of any kind is present.

## Exposed Surface

The development preview binds `0.0.0.0:3000` and is reachable from the public
internet at the VPS address. Consequently:

- Nothing sensitive may be served from `public/`.
- Verified: `/.env`, `/.env.local`, `/package.json`, `/next.config.ts`,
  `/src/app/page.tsx` and `/.git/config` all return 404 over the public IP.
- The app has no API route, no server action and no database connection, so
  there is no request-handling attack surface beyond static file serving.

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

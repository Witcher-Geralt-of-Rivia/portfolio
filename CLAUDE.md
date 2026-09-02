@AGENTS.md

# Claude Project Instructions

Before editing this repository:

1. Read `docs/CLAUDE_HANDOFF.md`
2. Follow its Session Bootstrap Procedure
3. Treat repository docs as canonical project memory
4. Never rely solely on conversation history

Stages 01-08 are frozen. Do not redesign them without an explicit user
instruction. When documentation conflicts with itself or with the code, stop and
report the conflict instead of guessing.

Run `npm run qa:memory` after changing any canonical document.

## Writing style

**No em dash.** The character U+2014 is banned from everything this project
authors: UI copy, documentation, comments, QA messages, metadata and commit
messages. Use punctuation that carries the meaning instead - a colon where what
follows explains, a comma for an aside, a full stop between two sentences,
parentheses around a bracketed clause, a hyphen in a heading or a label.

`npm run qa:style` enforces it across every tracked text file and names the
file and line if one returns.

"use client";

/**
 * QA FIXTURE: not part of the product, and not a route while it lives here.
 *
 * Renders the shared demo chrome around a live runtime so `qa/stage09a-shell.mjs`
 * can measure it: height at every viewport, behaviour at narrow widths,
 * contrast against the live aurora, and the reset dialog's keyboard and focus
 * contract. No demo exists yet to render it around, and shipping unmeasured
 * chrome would repeat the mistake Stage 09 made with `work.css`.
 *
 * To run the harness:
 *
 *   cp qa/fixtures/demos-qa-shell.page.tsx src/app/demos/qa-shell/page.tsx
 *   npm run dev
 *   node qa/stage09a-shell.mjs
 *   rm -r src/app/demos/qa-shell
 *
 * The seed below is generic on purpose. Stage 09A decided no product's business
 * data, and measuring a bar does not require any.
 */

import DemoShell from "@/components/demos/DemoShell";
import DemoRuntimeProvider from "@/demo-runtime/react/DemoRuntimeProvider";
import { useDemoSession } from "@/demo-runtime/react/hooks";
import type { DemoSeed } from "@/demo-runtime/types";

const PROBE_SEED: DemoSeed = {
  demoId: "operations",
  seedVersion: 1,
  baseClock: "2026-03-02T09:00:00.000Z",
  clockTickMs: 60_000,
  collections: {
    alpha: {
      idPrefix: "alpha",
      records: [
        { id: "alpha_0001", data: { label: "Alpha one" } },
        { id: "alpha_0002", data: { label: "Alpha two" } },
      ],
    },
  },
  initialRole: "operator",
  roles: ["operator", "manager", "admin"],
};

function RoleControl() {
  const { activeRole, roles, setRole } = useDemoSession();
  return (
    <select
      className="demo-chrome__action"
      aria-label="Simulated role"
      value={activeRole}
      onChange={(e) => setRole(e.target.value)}
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

export default function DemoShellFixture() {
  return (
    <DemoRuntimeProvider seed={PROBE_SEED}>
      <DemoShell title="Operations Platform" roleControl={<RoleControl />}>
        <div style={{ padding: 24 }}>
          <p id="shell-fixture" style={{ fontFamily: "monospace", fontSize: 13 }}>
            shell fixture
          </p>
        </div>
      </DemoShell>
    </DemoRuntimeProvider>
  );
}

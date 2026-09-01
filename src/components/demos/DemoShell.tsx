"use client";

/**
 * Shared demo chrome.
 *
 * A compact bar above every demonstration, carrying the things that belong to
 * the portfolio rather than to the fictional product: the way back, the
 * disclosure, which demo this is, the simulated role, whether persistence is
 * working, and Reset.
 *
 * It is deliberately not styled like the product beneath it. A visitor must be
 * able to tell at a glance which parts of the screen are the demonstration and
 * which are the frame around it — a disclosure that looked like the fictional
 * company's own header would be the one thing most likely to be read as part
 * of the simulation and ignored.
 *
 * Kept to roughly two lines of text in height. Portfolio furniture that ate
 * 80px of every demo viewport would make the products it is introducing look
 * cramped on exactly the screens where they need the room.
 */

import Link from "next/link";

import { useOptionalDemoRuntimeContext } from "@/demo-runtime/react/DemoRuntimeProvider";

import DemoDisclosure from "./DemoDisclosure";
import DemoResetControl from "./DemoResetControl";

export type DemoShellProps = {
  /**
   * Optional working title.
   *
   * Deliberately optional and deliberately unused by a finished demo. This bar
   * is the provenance layer — whose frame this is, that the data is synthetic,
   * how to leave and how to reset. The product names itself inside its own
   * shell, and printing that name here too made the bar read as part of the
   * fictional company rather than as the portfolio's frame around it.
   */
  title?: string;
  /** Role switcher, supplied by the demo. A slot, so the demo owns its roles. */
  roleControl?: React.ReactNode;
  children: React.ReactNode;
};

export default function DemoShell({ title, roleControl, children }: DemoShellProps) {
  const context = useOptionalDemoRuntimeContext();
  const sessionOnly = context?.persistenceMode === "memory";

  return (
    <div className="demo-shell">
      <header className="demo-chrome">
        <div className="demo-chrome__inner">
          {/* Back to the portfolio's Work section, which is where a visitor
              arrived from. The mark travels with it: together they say whose
              frame this is, which is the whole job of this bar. No contact
              route, here or anywhere. */}
          <Link className="demo-chrome__back" href="/#work">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/mark-120.png"
              alt=""
              width={19}
              height={22}
              className="demo-chrome__mark"
              draggable={false}
            />
            <span aria-hidden="true">←</span> Portfolio
          </Link>

          <DemoDisclosure />

          {title ? <p className="demo-chrome__title">{title}</p> : <span className="demo-chrome__gap" />}

          <div className="demo-chrome__controls">
            {sessionOnly && (
              /* Shown only on the fallback path. Claiming persistence that is
                 not there would be worse than having none: the visitor would
                 lose work they were told was saved. */
              <p className="demo-chrome__notice" role="status">
                PERSISTENCE / SESSION ONLY
              </p>
            )}
            {roleControl ? <div className="demo-chrome__slot">{roleControl}</div> : null}
            <DemoResetControl />
          </div>
        </div>
      </header>

      {/* A div, not a <main>: the root layout's SiteShell already renders the
          page's main landmark, and nesting a second one is invalid and gives
          assistive technology two answers to "where does the content start?". */}
      <div className="demo-surface">{children}</div>
    </div>
  );
}

"use client";

/**
 * Operations demo: the product sidebar.
 *
 * One question now: a module the selected role cannot view is not rendered at
 * all, so the navigation never advertises data that role has no access to.
 *
 * There used to be a second. While the product was being built, a module that
 * existed for the role but had no screen yet rendered as a non-interactive
 * label, because a link to a 404 is worse than one that plainly says it is not
 * ready. All eleven exist as of 09C4.B, so that branch, the `implemented` flag
 * behind it and its two styles are gone.
 */

import Link from "next/link";

import { visibleModules } from "../permissions";
import type { ModuleName, Role } from "../types";
import { MODULE_ICONS } from "./icons";
import { MODULE_GROUPS, MODULE_ROUTES, type ModuleGroup } from "./modules";

export default function OperationsSidebar({
  role,
  activeModule,
  onNavigate,
}: {
  role: Role;
  activeModule: ModuleName;
  onNavigate?: () => void;
}) {
  const permitted = new Set(visibleModules(role));

  return (
    <nav className="ops-sidebar" aria-label="Operations">
      <div className="ops-sidebar__identity">
        <p className="ops-sidebar__product">Operations Console</p>
        <p className="ops-sidebar__tagline">Rental operations</p>
      </div>

      <div className="ops-sidebar__scroll">
        {MODULE_GROUPS.map((group) => {
          const items = MODULE_ROUTES.filter(
            (m) => m.group === group && permitted.has(m.id)
          );
          if (items.length === 0) return null;

          return (
            <div className="ops-sidebar__group" key={group}>
              {group !== "primary" && (
                <p className="ops-sidebar__heading">{groupLabel(group)}</p>
              )}
              <ul className="ops-sidebar__list">
                {items.map((item) => {
                  const Icon = MODULE_ICONS[item.id];
                  const active = item.id === activeModule;

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`ops-sidebar__item${active ? " ops-sidebar__item--active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <Icon />
                        <span className="ops-sidebar__label">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function groupLabel(group: ModuleGroup): string {
  return group === "primary" ? "" : group;
}

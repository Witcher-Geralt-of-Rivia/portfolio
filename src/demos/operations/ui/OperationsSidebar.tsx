"use client";

/**
 * Operations demo: the product sidebar.
 *
 * Role and build state are two independent questions, and the sidebar answers
 * them separately:
 *
 *   - a module the selected role cannot view is **not rendered at all**, so
 *     the navigation never advertises data that role has no access to;
 *   - a module that exists for the role but has not been built yet renders as
 *     a non-interactive item, because a link to a 404 is worse than a label
 *     that is plainly not ready.
 *
 * The second state is temporary. It disappears module by module through 09C3
 * to 09C5, and with it the `implemented` flag and these styles.
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

                  if (!item.implemented) {
                    return (
                      <li key={item.id}>
                        <span className="ops-sidebar__item ops-sidebar__item--pending">
                          <Icon />
                          <span className="ops-sidebar__label">{item.label}</span>
                          {/* Temporary build-state marker, removed as each
                              module lands. Not product language. */}
                          <span className="ops-sidebar__pending" aria-hidden="true" />
                          <span className="visually-hidden">not built yet</span>
                        </span>
                      </li>
                    );
                  }

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

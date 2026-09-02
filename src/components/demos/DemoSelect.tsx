"use client";

/**
 * The demo platform's select.
 *
 * A native `<select>` can be styled shut but not open: the popup is drawn by
 * the operating system, so it arrives with square corners, almost no option
 * padding, a saturated system-blue selection and a border that belongs to
 * Windows rather than to this product. No amount of CSS on `<option>` changes
 * that, which is why the menu is authored here instead.
 *
 * The trigger keeps the approved closed design; only the menu is new.
 *
 * ## The pattern
 *
 * WAI-ARIA's select-only combobox. The trigger is a `<button role="combobox">`
 * that owns a `<ul role="listbox">`, and **focus never leaves the trigger** -
 * the active option is pointed at with `aria-activedescendant`. That is what
 * keeps Escape, Tab and outside-click behaviour simple: there is only ever one
 * focused element to return to.
 *
 * The accessible name is built from the visible label and the current value
 * together, so a screen reader says "Stage, All stages" once rather than
 * reading a decorative label and then repeating it.
 *
 * ## Where the menu is rendered
 *
 * Into the nearest `<dialog>` ancestor when there is one, and into
 * `document.body` otherwise. A modal dialog sits in the browser's top layer,
 * above every z-index on the page, so a menu portalled to the body from inside
 * the filter sheet would be painted *behind* the sheet that opened it.
 * `closest("dialog")` puts it in the same layer as its trigger either way.
 *
 * Fixed positioning, measured from the trigger, so no scrolling ancestor with
 * `overflow: hidden` can clip it - which the filter sheet's scrolling body
 * would otherwise do.
 *
 * ## Stacking
 *
 * `--z-demo-select: 70`, above the notification panel and the mobile
 * navigation drawer (both 60) and the demo chrome (40). Dialogs are in the top
 * layer and are unaffected by any of it.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type DemoSelectOption = { value: string; label: string };

/**
 * Every open menu, so opening one can close the rest.
 *
 * Two menus on screen at once is not a state the product has an answer for,
 * and letting Stage and Source both hang open would be the kind of thing a
 * visitor has to click twice to escape.
 */
const openMenus = new Set<() => void>();

/** How much room a menu needs below the trigger before it gives up and flips. */
const MIN_ROOM_BELOW = 180;
const MAX_MENU_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

type Placement = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

export default function DemoSelect({
  value,
  options,
  onChange,
  srLabel,
  label,
  active = false,
  compact = false,
  disabled = false,
  className = "",
  triggerClassName = "",
}: {
  value: string;
  options: readonly DemoSelectOption[];
  onChange: (value: string) => void;
  /** Names the control when there is no visible label. */
  srLabel: string;
  /** Shown inside the trigger, and read as part of the accessible name. */
  label?: string;
  active?: boolean;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const ids = useId();
  const listId = `${ids}-list`;
  const labelId = `${ids}-label`;
  const valueId = `${ids}-value`;
  const optionId = (index: number) => `${ids}-opt-${index}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ buffer: "", timer: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);

  /* Measured from the trigger each time, because the page may have scrolled
     since the last time this menu was open. */
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const roomAbove = rect.top - VIEWPORT_MARGIN;
    /* Below by default; above only when below genuinely cannot hold a usable
       menu and above is roomier. */
    const flip = roomBelow < MIN_ROOM_BELOW && roomAbove > roomBelow;

    setPlacement({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(MAX_MENU_HEIGHT, flip ? roomAbove : roomBelow)),
      ...(flip
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  const openMenu = useCallback(
    (index: number) => {
      if (disabled) return;
      /* Close every other menu first: only one is ever open. */
      for (const other of openMenus) other();
      setActiveIndex(index);
      measure();
      setOpen(true);
    },
    [disabled, measure]
  );

  /* The layer this menu belongs to. A trigger inside a modal dialog needs its
     menu inside that dialog, or the dialog's top layer paints over it. */
  useLayoutEffect(() => {
    if (!open) return;
    const host = triggerRef.current?.closest("dialog") as HTMLElement | null;
    setLayer(host ?? document.body);
  }, [open]);

  /* Registered while open so a sibling can close this one. */
  useEffect(() => {
    if (!open) return;
    openMenus.add(close);
    return () => {
      openMenus.delete(close);
    };
  }, [open, close]);

  /* The menu can be wider than its trigger when an option needs the room, so
     the horizontal clamp happens after it has been measured. Layout effect, so
     the correction lands before the browser paints it. */
  useLayoutEffect(() => {
    if (!open || !placement || !listRef.current) return;
    const width = listRef.current.getBoundingClientRect().width;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const clamped = Math.max(VIEWPORT_MARGIN, Math.min(placement.left, maxLeft));
    if (Math.abs(clamped - placement.left) > 0.5) {
      setPlacement({ ...placement, left: clamped });
    }
  }, [open, placement]);

  /* Keep the menu attached to its trigger while the page moves under it. These
     are listeners, not a poll: nothing runs while the menu is closed. */
  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, measure]);

  /* Outside click closes without changing the value. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  /* Keep the active option in view when arrowing through a long menu. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  /* The typeahead buffer clears itself. This is the one timer the component
     owns, it exists only between keystrokes, and it is cleared on unmount. */
  useEffect(
    () => () => {
      if (typed.current.timer) window.clearTimeout(typed.current.timer);
    },
    []
  );

  const commit = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
    triggerRef.current?.focus();
  };

  const typeahead = (key: string) => {
    const state = typed.current;
    if (state.timer) window.clearTimeout(state.timer);
    state.buffer += key.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.buffer = "";
    }, 600);

    const from = open ? activeIndex : selectedIndex;
    const order = [...options.slice(from + 1), ...options.slice(0, from + 1)];
    const hit = order.find((o) => o.label.toLowerCase().startsWith(state.buffer));
    if (!hit) return;
    const index = options.indexOf(hit);
    if (open) setActiveIndex(index);
    else commit(index);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;

    if (!open) {
      if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        /* Opens onto the current value, never onto the first item. */
        openMenu(selectedIndex);
        return;
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        typeahead(key);
      }
      return;
    }

    switch (key) {
      case "Escape":
        event.preventDefault();
        /* Closes without changing anything. Focus is already here. */
        close();
        return;
      case "Tab":
        /* Close and let focus move on; not prevented, so the tab order is
           whatever it would have been. */
        close();
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        return;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      default:
        if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          typeahead(key);
        }
    }
  };

  const menu =
    open && placement && layer
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={srLabel}
            className="demo-select__menu"
            style={{
              left: placement.left,
              minWidth: placement.width,
              maxHeight: placement.maxHeight,
              ...(placement.top !== undefined ? { top: placement.top } : {}),
              ...(placement.bottom !== undefined ? { bottom: placement.bottom } : {}),
            }}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                /* The option's value, addressable from CSS and from QA. The
                   listbox has no native `value` for a test to select by. */
                data-value={option.value}
                className="demo-select__option"
                data-active={index === activeIndex ? "true" : undefined}
                /* pointerdown rather than click: the outside-click listener
                   runs on pointerdown too, and click would arrive second. */
                onPointerDown={(event) => {
                  event.preventDefault();
                  commit(index);
                }}
                onPointerEnter={() => setActiveIndex(index)}
              >
                <span className="demo-select__option-label">{option.label}</span>
                <span className="demo-select__tick" aria-hidden="true">
                  {option.value === value ? <Tick /> : null}
                </span>
              </li>
            ))}
          </ul>,
          layer
        )
      : null;

  return (
    <span
      className={`demo-select ${className}`.trim()}
      data-active={active ? "true" : undefined}
      data-open={open ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${valueId}`}
        {...(open ? { "aria-activedescendant": optionId(activeIndex) } : {})}
        disabled={disabled}
        className={`demo-select__trigger ${triggerClassName}`.trim()}
        onClick={() => (open ? close() : openMenu(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        {label ? (
          <span className="demo-select__label" id={labelId}>
            {label}
          </span>
        ) : (
          <span className="visually-hidden" id={labelId}>
            {srLabel}
          </span>
        )}
        <span className="demo-select__value" id={valueId}>
          {selected?.label ?? ""}
        </span>
        <Chevron />
      </button>
      {menu}
    </span>
  );
}

/** Authored here: the project ships no icon package. */
function Chevron() {
  return (
    <svg
      className="demo-select__chevron"
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" focusable="false">
      <path
        d="M1 4L3.5 6.5L9 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

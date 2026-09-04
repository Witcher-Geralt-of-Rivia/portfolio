"use client";

/**
 * The execution trace, drawn along the architecture that is already there.
 *
 * As the section passes, the connection paths draw themselves in order and the
 * nodes they arrive at come up behind them. What the visitor sees is the
 * architecture resolving rather than appearing.
 *
 * THIS DOES NOT DRAW A SECOND ARCHITECTURE. The paths it animates are the exact
 * `<path class="arch-link-trace">` overlay elements `ArchitectureCanvas` already renders from
 * `routeConnections(mode)`, and the nodes are the exact `<button class=
 * "arch-node">` elements it already renders from the mode's node list. Nothing
 * here knows how a connection is routed or where a node sits; it queries what
 * the section drew and animates that. A tracer with its own copy of the
 * geometry would be a second source of truth for the same picture, and the two
 * would disagree the first time either changed.
 *
 * Node thresholds are DERIVED, not guessed. A node lights when the last
 * connection arriving at it has finished drawing, which comes out of the
 * connection order the section already publishes. The brief asks for no guessed
 * percentages and this is why: the numbers are read off the picture.
 *
 * Everything it writes is a custom property or a data attribute on elements it
 * found. It adds no DOM of its own, so the section's markup, its focus order,
 * its hover behaviour and its ARIA are all exactly what they were.
 */

import { useCallback, useEffect, useRef } from "react";

import { useStickyProgress } from "@/lib/use-sticky-progress";
import { clamp01 } from "@/lib/scroll-geometry";

/**
 * How much of the section's progress one connection's draw occupies.
 *
 * Wide enough that consecutive draws overlap, so the trace reads as one
 * continuous execution rather than a queue of segments finishing one at a time.
 */
const DRAW_WINDOW = 0.19;

/**
 * Where the trace is finished, leaving the rest of the section's travel as a
 * settled state.
 *
 * Not 1. Finishing exactly as the section leaves means the completed
 * architecture is never actually on screen, and it makes the last node's
 * resolution depend on progress reaching precisely 1, which it does not always
 * do: measured at the bottom of the range, progress read 0.998 and two nodes
 * were left in their arriving state permanently. Completing early is both
 * better to look at and robust to the last fraction.
 */
const COMPLETE_AT = 0.92;

/**
 * When connection `i` of `count` starts and finishes drawing.
 *
 * The starts are compressed so the LAST connection finishes at `COMPLETE_AT`.
 * Spacing them evenly at `i / count` instead pushes the final windows past the
 * end of the section: measured, the last connections were still at 0.47 drawn
 * when the section had finished passing. The certification deck failed the same
 * way for the same reason, and this is the same fix.
 */
function drawSpan(index: number, count: number): { start: number; finish: number } {
  const spread = count > 1 ? (COMPLETE_AT - DRAW_WINDOW) / (count - 1) : 0;
  const start = index * spread;
  return { start, finish: Math.min(COMPLETE_AT, start + DRAW_WINDOW) };
}

type Wiring = {
  links: SVGPathElement[];
  lengths: number[];
  nodes: HTMLElement[];
  /** 0..1 progress at which each node's last incoming connection completes. */
  nodeThresholds: number[];
};

const EMPTY: Wiring = { links: [], lengths: [], nodes: [], nodeThresholds: [] };

export default function ArchitectureTracer({ children }: { children: React.ReactNode }) {
  const wiringRef = useRef<Wiring>(EMPTY);

  /**
   * Read the picture. Every DOM read in this component lives here, and it runs
   * on mount, on resize, and when the canvas has been replaced.
   */
  const readWiring = useCallback((root: HTMLElement): Wiring => {
    const links = Array.from(root.querySelectorAll<SVGPathElement>(".arch-link-trace"));
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".arch-node"));
    if (links.length === 0) return EMPTY;

    /* `getTotalLength` is a layout read, so it happens here and never in a
       frame. Measured after the geometry is committed, per the brief. */
    const lengths = links.map((path) => {
      try {
        return path.getTotalLength();
      } catch {
        return 0;
      }
    });

    /* Which connection arrives at which node.
       `ArchitectureCanvas` renders one path per connection in connection order,
       and each node's accessible name starts with its label, so the two are
       matched on the label rather than on an index nobody wrote down. */
    const count = links.length;
    const nodeThresholds = nodes.map((node) => {
      const id = node.dataset.archNode ?? "";
      let last = -1;
      links.forEach((path, i) => {
        if (id && path.dataset.archTo === id) last = i;
      });
      /* A source node has nothing arriving at it, so it is resolved from the
         start: the trace begins there. Everything else waits for the last
         connection that lands on it to finish drawing, which is a time this
         module already computes rather than a percentage anyone guessed. */
      return last < 0 ? 0 : drawSpan(last, count).finish;
    });

    return { links, lengths, nodes, nodeThresholds };
  }, []);

  const onFrame = useCallback(
    (progress: number, { range: root }: { range: HTMLElement }) => {
      let wiring = wiringRef.current;
      /* The canvas is keyed on the mode, so switching mode replaces the whole
         subtree and every cached element becomes detached. One connectivity
         check per frame is cheaper than an observer and cannot miss. */
      if (wiring.links.length === 0 || !wiring.links[0].isConnected) {
        wiring = readWiring(root);
        wiringRef.current = wiring;
      }
      const { links, lengths, nodes, nodeThresholds } = wiring;
      const count = links.length;
      if (count === 0) return;

      for (let i = 0; i < count; i++) {
        const { start } = drawSpan(i, count);
        const drawn = clamp01((progress - start) / DRAW_WINDOW);
        const path = links[i];
        path.style.setProperty("--arch-len", lengths[i].toFixed(2));
        path.style.setProperty("--arch-drawn", drawn.toFixed(4));
      }

      for (let i = 0; i < nodes.length; i++) {
        /* Three states, and the middle one is a moment rather than a range: a
           node is ACTIVE while the trace is arriving at it and RESOLVED once
           the connection has finished landing.

           The thresholds are the connections' own finish times, so a node
           cannot light before the line reaching it has been drawn, and every
           node is resolved by the time the section has passed. */
        const finish = nodeThresholds[i];
        const state =
          progress >= finish ? "resolved" : progress >= finish - DRAW_WINDOW ? "active" : "idle";
        if (nodes[i].dataset.archTrace !== state) nodes[i].dataset.archTrace = state;
      }
    },
    [readWiring]
  );

  const { rangeRef, stageRef, enhanced } = useStickyProgress<HTMLDivElement, HTMLDivElement>({
    sticky: false,
    travel: () => 0,
    onFrame,
    rangeHeightProperty: "--arch-unused",
  });

  /* Leaving enhanced mode has to clear what the frames wrote, or a visitor who
     turns on reduced motion is left with half-drawn connections. */
  useEffect(() => {
    if (enhanced) return;
    const root = rangeRef.current;
    if (!root) return;
    for (const path of root.querySelectorAll<SVGPathElement>(".arch-link-trace")) {
      path.style.removeProperty("--arch-len");
      path.style.removeProperty("--arch-drawn");
    }
    for (const node of root.querySelectorAll<HTMLElement>(".arch-node")) {
      delete node.dataset.archTrace;
    }
  }, [enhanced, rangeRef]);

  return (
    <div ref={rangeRef} className={`arch-trace-scope${enhanced ? " is-traced" : ""}`}>
      <div ref={stageRef}>{children}</div>
    </div>
  );
}

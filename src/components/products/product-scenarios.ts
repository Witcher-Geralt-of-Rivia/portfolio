/**
 * Product scenarios for the Product Engineering Studio.
 *
 * Three scenarios, each describing ONE product operating across four surfaces:
 * a web application, a mobile app, an AI-assist panel and a backend event
 * pipeline. Switching scenario changes the contents of those surfaces; the
 * surfaces themselves persist, because they represent one engineering system
 * in different product contexts.
 *
 * These are design and engineering SIMULATIONS. They are not client work, not
 * shipped products, and the figures in them are illustrative interface data.
 *
 * Everything renders from this file so the studio has no duplicated JSX trees,
 * and the flow runs entirely in React state — no network request of any kind.
 */

export type ScenarioId = "operations" | "commerce" | "field";

/** Blocks the web surface can compose. One renderer handles all scenarios. */
export type WebBlock =
  | { kind: "tiles"; items: { label: string; value: string; note: string }[] }
  | { kind: "chart"; label: string; points: number[] }
  | { kind: "rows"; label: string; items: { name: string; meta: string; status: string; tone: Tone }[] }
  | { kind: "cards"; label: string; items: { name: string; meta: string; tone: Tone }[] }
  | { kind: "timeline"; label: string; steps: { name: string; done: boolean }[] }
  | { kind: "map"; label: string };

export type Tone = "lavender" | "sky" | "mint" | "peach" | "rose" | "lemon";

export type MobileBlock =
  | { kind: "cards"; items: { title: string; meta: string; tone: Tone }[] }
  | { kind: "progress"; label: string; steps: string[]; activeIndex: number }
  | { kind: "checklist"; label: string; items: { text: string; done: boolean }[] }
  | { kind: "suggestion"; title: string; meta: string; tone: Tone };

export type FlowStep = {
  /** Shown in the studio status line and announced once at the end. */
  label: string;
  /** Index of the event-rail node this step activates, if any. */
  rail?: number;
  /** Surface that visibly reacts at this step. */
  surface?: "web" | "mobile" | "assistant";
};

export type ProductScenario = {
  id: ScenarioId;
  label: string;
  accessibleDescription: string;
  web: {
    route: string;
    nav: string[];
    title: string;
    blocks: WebBlock[];
  };
  mobile: {
    header: string;
    blocks: MobileBlock[];
    tabs: string[];
    action?: string;
  };
  assistant: {
    heading: string;
    body: string;
    action: string;
    /** Replaces `body` once the product flow has run. */
    resolvedBody: string;
  };
  flow: FlowStep[];
};

/** The backend pipeline. Identical across scenarios: it is the same system. */
export const EVENT_RAIL = [
  { id: "ui", label: "UI Event", technical: "EMIT" },
  { id: "api", label: "API", technical: "REQ" },
  { id: "service", label: "Service", technical: "EXEC" },
  { id: "data", label: "Data", technical: "STORE" },
  { id: "job", label: "Background Job", technical: "ASYNC" },
  { id: "sync", label: "Sync", technical: "PUSH" },
];

export const CAPABILITIES = [
  { index: "01", title: "Responsive UI" },
  { index: "02", title: "Mobile-first flows" },
  { index: "03", title: "Shared product state" },
  { index: "04", title: "API integration" },
  { index: "05", title: "Realtime patterns" },
  { index: "06", title: "AI-assisted UX" },
];

const OPERATIONS: ProductScenario = {
  id: "operations",
  label: "Operations SaaS",
  accessibleDescription:
    "Operations SaaS scenario: a web operations console with workflow activity, a recent process table and an approval queue; a mobile task app; and an assistant summarising work that needs review.",
  web: {
    route: "/app/overview",
    nav: ["Overview", "Workflows", "Accounts", "Activity"],
    title: "Operations overview",
    blocks: [
      {
        kind: "tiles",
        items: [
          { label: "Active workflows", value: "24", note: "running" },
          { label: "Pending approvals", value: "2", note: "awaiting review" },
          { label: "System health", value: "Nominal", note: "all services" },
        ],
      },
      { kind: "chart", label: "Workflow activity", points: [18, 26, 22, 34, 30, 42, 38, 47, 44, 52, 49, 58] },
      {
        kind: "rows",
        label: "Recent processes",
        items: [
          { name: "Account provisioning", meta: "batch 2214", status: "Completed", tone: "mint" },
          { name: "Invoice reconciliation", meta: "batch 2213", status: "Running", tone: "sky" },
          { name: "Access review", meta: "batch 2212", status: "Queued", tone: "lavender" },
        ],
      },
      {
        kind: "rows",
        label: "Approval queue",
        items: [
          { name: "Vendor onboarding", meta: "requested by operations", status: "Needs review", tone: "lemon" },
          { name: "Policy exception", meta: "requested by support", status: "Needs review", tone: "lemon" },
        ],
      },
    ],
  },
  mobile: {
    header: "Today",
    tabs: ["Home", "Tasks", "Activity"],
    blocks: [
      {
        kind: "cards",
        items: [
          { title: "Approval needed", meta: "Vendor onboarding", tone: "lemon" },
          { title: "Workflow completed", meta: "Account provisioning", tone: "mint" },
          { title: "Account updated", meta: "Northwind Ltd", tone: "sky" },
        ],
      },
    ],
  },
  assistant: {
    heading: "Operational brief",
    body: "Two workflows require review before execution.",
    resolvedBody: "One approval cleared. A single workflow is still awaiting review.",
    action: "Review approvals",
  },
  flow: [
    { label: "Web approval selected", rail: 0, surface: "web" },
    { label: "API event activated", rail: 1 },
    { label: "Service processing", rail: 2 },
    { label: "Data state updated", rail: 3 },
    { label: "Background job activated", rail: 4 },
    { label: "Mobile received state", rail: 5, surface: "mobile" },
    { label: "Assistant brief updated", surface: "assistant" },
  ],
};

const COMMERCE: ProductScenario = {
  id: "commerce",
  label: "Commerce Platform",
  accessibleDescription:
    "Commerce Platform scenario: a web commerce console with catalogue cards and an order status timeline; a mobile order-tracking screen; and an assistant surfacing a frequently paired item.",
  web: {
    route: "/app/commerce",
    nav: ["Catalog", "Orders", "Customers", "Insights"],
    title: "Commerce overview",
    blocks: [
      {
        kind: "tiles",
        items: [
          { label: "Open orders", value: "38", note: "in fulfilment" },
          { label: "Low stock", value: "3", note: "needs restock" },
          { label: "Fulfilment", value: "On track", note: "today" },
        ],
      },
      {
        kind: "cards",
        label: "Catalog",
        items: [
          { name: "Studio Lamp", meta: "In stock · 42", tone: "peach" },
          { name: "Travel Pack", meta: "In stock · 17", tone: "rose" },
          { name: "Everyday Bottle", meta: "Low stock · 6", tone: "lemon" },
        ],
      },
      {
        kind: "timeline",
        label: "Order status",
        steps: [
          { name: "Placed", done: true },
          { name: "Packed", done: true },
          { name: "Shipped", done: false },
          { name: "Delivered", done: false },
        ],
      },
      {
        kind: "rows",
        label: "Recent orders",
        items: [
          { name: "Order 4821", meta: "Studio Lamp ×1", status: "Packed", tone: "peach" },
          { name: "Order 4820", meta: "Travel Pack ×2", status: "Shipped", tone: "rose" },
        ],
      },
    ],
  },
  mobile: {
    header: "Your order",
    tabs: ["Shop", "Orders", "Account"],
    blocks: [
      { kind: "cards", items: [{ title: "Order 4821", meta: "Studio Lamp ×1", tone: "peach" }] },
      { kind: "progress", label: "Delivery", steps: ["Placed", "Packed", "Shipped", "Delivered"], activeIndex: 1 },
      { kind: "suggestion", title: "Everyday Bottle", meta: "Often bought together", tone: "lavender" },
    ],
  },
  assistant: {
    heading: "Commerce assistant",
    body: "One item is frequently paired with the current order.",
    resolvedBody: "The paired item has been added to the order summary for review.",
    action: "View recommendation",
  },
  flow: [
    { label: "Order state changed", rail: 0, surface: "web" },
    { label: "API activated", rail: 1 },
    { label: "Service updated order", rail: 2 },
    { label: "Data confirmed", rail: 3 },
    { label: "Notification queued", rail: 4 },
    { label: "Mobile order status updated", rail: 5, surface: "mobile" },
    { label: "Assistant recommendation ready", surface: "assistant" },
  ],
};

const FIELD: ProductScenario = {
  id: "field",
  label: "Field Workflow",
  accessibleDescription:
    "Field Workflow scenario: a web dispatch console with a schedule, a job list and an abstract service-area view; a mobile technician checklist; and an assistant flagging an unresolved prerequisite.",
  web: {
    route: "/app/dispatch",
    nav: ["Dispatch", "Schedule", "Team", "Reports"],
    title: "Dispatch console",
    blocks: [
      {
        kind: "tiles",
        items: [
          { label: "Jobs today", value: "12", note: "scheduled" },
          { label: "In progress", value: "4", note: "active now" },
          { label: "Blocked", value: "1", note: "needs input" },
        ],
      },
      { kind: "map", label: "Service area" },
      {
        kind: "rows",
        label: "Schedule",
        items: [
          { name: "09:00 · Site inspection", meta: "Team A", status: "Done", tone: "mint" },
          { name: "11:30 · Equipment service", meta: "Team B", status: "Active", tone: "sky" },
          { name: "14:00 · Follow-up visit", meta: "Team A", status: "Planned", tone: "lemon" },
        ],
      },
      {
        kind: "rows",
        label: "Jobs",
        items: [
          { name: "Job 318", meta: "Equipment service", status: "Blocked", tone: "lemon" },
          { name: "Job 317", meta: "Site inspection", status: "Complete", tone: "mint" },
        ],
      },
    ],
  },
  mobile: {
    header: "Current task",
    tabs: ["Tasks", "Route", "Notes"],
    action: "Complete step",
    blocks: [
      { kind: "cards", items: [{ title: "Equipment service", meta: "Job 318 · Team B", tone: "sky" }] },
      {
        kind: "checklist",
        label: "Checklist",
        items: [
          { text: "Site access confirmed", done: true },
          { text: "Safety check recorded", done: true },
          { text: "Parts availability", done: false },
        ],
      },
    ],
  },
  assistant: {
    heading: "Task assistant",
    body: "The current task has one unresolved prerequisite.",
    resolvedBody: "The prerequisite is now recorded. The task can proceed.",
    action: "Review requirement",
  },
  flow: [
    { label: "Task completion event", rail: 0, surface: "mobile" },
    { label: "API activated", rail: 1 },
    { label: "Service validated", rail: 2 },
    { label: "Job state updated", rail: 3 },
    { label: "Background synchronisation", rail: 4 },
    { label: "Web console updated", rail: 5, surface: "web" },
    { label: "Assistant reflects condition", surface: "assistant" },
  ],
};

export const PRODUCT_SCENARIOS: ProductScenario[] = [OPERATIONS, COMMERCE, FIELD];
export const DEFAULT_SCENARIO_ID: ScenarioId = "operations";

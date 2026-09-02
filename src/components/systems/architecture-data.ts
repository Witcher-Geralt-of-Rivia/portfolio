/**
 * Architecture data for the Intelligent Systems lab.
 *
 * Four modes, each a complete system topology. Everything the lab renders
 * (nodes, routing, execution trace, accessible summary) is declared here, so
 * the components stay presentational and no mode is a hand-built JSX tree.
 *
 * Positions are percentages of the canvas box, fixed and deterministic. No
 * randomness: screenshots and client experiences must be identical every time.
 *
 * `band` groups nodes into three architectural rows. The desktop canvas
 * positions absolutely; the mobile layout reads the same bands top to bottom
 * as a vertical flow.
 */

export type NodeCategory =
  | "input"
  | "orchestration"
  | "systems"
  | "control"
  | "output";

export type ArchNode = {
  id: string;
  label: string;
  /** Small mono identifier under the label. Architectural shorthand only. */
  technical: string;
  category: NodeCategory;
  /** Percentage of canvas width / height, node centre. */
  x: number;
  y: number;
  /** 0 = orchestration row, 1 = parallel capabilities, 2 = control and output. */
  band: number;
  /** Rendered width in CSS pixels. */
  w: number;
  /** Shown in the panel's detail strip on hover or focus. */
  description: string;
};

export type ArchConnection = [from: string, to: string];

export type TraceRow = { t: string; text: string };

export type ArchitectureMode = {
  id: string;
  label: string;
  /** Visually hidden summary, announced when the mode changes. */
  description: string;
  nodes: ArchNode[];
  connections: ArchConnection[];
  trace: TraceRow[];
};

const Y = [16, 50, 84];

const AGENT: ArchitectureMode = {
  id: "agent",
  label: "Agent Workflow",
  description:
    "Agent workflow architecture from request routing through planning, retrieval, tools, validation, human approval and execution.",
  nodes: [
    { id: "request", label: "Request", technical: "INPUT", category: "input", x: 11, y: Y[0], band: 0, w: 112,
      description: "Entry point for a task, carrying intent and whatever context is available at the time." },
    { id: "router", label: "Intent Router", technical: "ROUTE", category: "orchestration", x: 33, y: Y[0], band: 0, w: 134,
      description: "Classifies the request and selects which capability path should handle it." },
    { id: "planner", label: "Planner", technical: "PLAN", category: "orchestration", x: 55, y: Y[0], band: 0, w: 112,
      description: "Builds an explicit execution sequence before any tool activity begins." },
    { id: "context", label: "Context", technical: "CTX", category: "orchestration", x: 78, y: Y[0], band: 0, w: 112,
      description: "Assembles the working set the plan needs: state, history and constraints." },
    { id: "retrieval", label: "Retrieval", technical: "RAG", category: "systems", x: 28, y: Y[1], band: 1, w: 116,
      description: "Grounds the plan in retrieved source material rather than model recall." },
    { id: "tools", label: "Tools", technical: "MCP/API", category: "systems", x: 50, y: Y[1], band: 1, w: 112,
      description: "The typed capability surface an agent may call, each with a defined contract." },
    { id: "memory", label: "Memory", technical: "STATE", category: "systems", x: 72, y: Y[1], band: 1, w: 112,
      description: "Durable task state, so a long workflow can resume rather than restart." },
    { id: "validation", label: "Validation", technical: "CHECK", category: "control", x: 28, y: Y[2], band: 2, w: 120,
      description: "Checks structure, rules and output conditions before execution." },
    { id: "approval", label: "Human Approval", technical: "HITL", category: "control", x: 52, y: Y[2], band: 2, w: 146,
      description: "Holds consequential actions for a person to authorise before they run." },
    { id: "execute", label: "Execute", technical: "ACTION", category: "output", x: 76, y: Y[2], band: 2, w: 112,
      description: "Performs the approved action and records the result against the plan." },
  ],
  connections: [
    ["request", "router"], ["router", "planner"], ["planner", "context"],
    ["context", "retrieval"], ["context", "tools"], ["context", "memory"],
    ["retrieval", "validation"], ["tools", "validation"], ["memory", "validation"],
    ["validation", "approval"], ["approval", "execute"],
  ],
  trace: [
    { t: "00.000", text: "request received" },
    { t: "00.018", text: "intent routed" },
    { t: "00.041", text: "plan created" },
    { t: "00.086", text: "context assembled" },
    { t: "00.132", text: "tools selected" },
    { t: "00.184", text: "validation passed" },
    { t: "00.221", text: "approval required" },
    { t: "00.410", text: "action ready" },
  ],
};

const AUTOMATION: ArchitectureMode = {
  id: "automation",
  label: "Automation",
  description:
    "Automation architecture from trigger through rule evaluation and workflow branching across API, queue, transform and condition steps, then retry, audit and action.",
  nodes: [
    { id: "trigger", label: "Trigger", technical: "EVENT", category: "input", x: 15, y: Y[0], band: 0, w: 112,
      description: "The event that starts the workflow: a webhook, a schedule or a state change." },
    { id: "rules", label: "Rules", technical: "EVAL", category: "orchestration", x: 42, y: Y[0], band: 0, w: 112,
      description: "Decides whether and how the workflow should proceed for this event." },
    { id: "workflow", label: "Workflow", technical: "FLOW", category: "orchestration", x: 70, y: Y[0], band: 0, w: 116,
      description: "The ordered definition of steps, branches and compensating actions." },
    { id: "api", label: "API", technical: "CALL", category: "systems", x: 20, y: Y[1], band: 1, w: 104,
      description: "Outbound calls to the systems this workflow coordinates." },
    { id: "queue", label: "Queue", technical: "ASYNC", category: "systems", x: 40, y: Y[1], band: 1, w: 108,
      description: "Separates asynchronous work from request-response processing." },
    { id: "transform", label: "Transform", technical: "MAP", category: "systems", x: 60, y: Y[1], band: 1, w: 124,
      description: "Reshapes payloads between systems that disagree about structure." },
    { id: "condition", label: "Condition", technical: "BRANCH", category: "systems", x: 80, y: Y[1], band: 1, w: 120,
      description: "Branches the workflow on data rather than on a hard-coded sequence." },
    { id: "retry", label: "Retry", technical: "RECOVER", category: "control", x: 24, y: Y[2], band: 2, w: 112,
      description: "Recovers from transient failure with bounded, idempotent re-execution." },
    { id: "audit", label: "Audit", technical: "LOG", category: "control", x: 50, y: Y[2], band: 2, w: 112,
      description: "Records what ran, with which input, and what it decided." },
    { id: "action", label: "Action", technical: "EFFECT", category: "output", x: 76, y: Y[2], band: 2, w: 112,
      description: "The committed effect the workflow existed to produce." },
  ],
  connections: [
    ["trigger", "rules"], ["rules", "workflow"],
    ["workflow", "api"], ["workflow", "queue"], ["workflow", "transform"], ["workflow", "condition"],
    ["api", "retry"], ["queue", "retry"], ["transform", "retry"], ["condition", "retry"],
    ["retry", "audit"], ["audit", "action"],
  ],
  trace: [
    { t: "00.000", text: "trigger received" },
    { t: "00.014", text: "rules evaluated" },
    { t: "00.039", text: "workflow started" },
    { t: "00.076", text: "payload transformed" },
    { t: "00.118", text: "task queued" },
    { t: "00.162", text: "condition passed" },
    { t: "00.214", text: "audit recorded" },
    { t: "00.271", text: "action completed" },
  ],
};

const CRM: ArchitectureMode = {
  id: "crm",
  label: "CRM / ERP",
  description:
    "Business systems architecture from an incoming lead or order through normalization and business rules into CRM, ERP and enrichment, then synchronization, validation and notification.",
  nodes: [
    { id: "lead", label: "Lead / Order", technical: "RECORD", category: "input", x: 15, y: Y[0], band: 0, w: 132,
      description: "An inbound business record arriving from a form, channel or partner system." },
    { id: "normalize", label: "Normalize", technical: "CLEAN", category: "orchestration", x: 43, y: Y[0], band: 0, w: 120,
      description: "Reconciles field names, formats and identifiers before anything downstream." },
    { id: "business-rules", label: "Business Rules", technical: "POLICY", category: "orchestration", x: 72, y: Y[0], band: 0, w: 142,
      description: "Applies the commercial logic that decides routing, ownership and priority." },
    { id: "crm", label: "CRM", technical: "CUSTOMER", category: "systems", x: 26, y: Y[1], band: 1, w: 104,
      description: "Synchronizes customer and operational state through controlled mappings." },
    { id: "erp", label: "ERP", technical: "OPERATIONS", category: "systems", x: 50, y: Y[1], band: 1, w: 104,
      description: "Carries the operational and financial side of the same record." },
    { id: "enrichment", label: "Enrichment", technical: "AUGMENT", category: "systems", x: 74, y: Y[1], band: 1, w: 128,
      description: "Adds derived or looked-up attributes the source record did not supply." },
    { id: "sync", label: "Sync", technical: "RECONCILE", category: "systems", x: 26, y: Y[2], band: 2, w: 112,
      description: "Reconciles both directions so neither system silently drifts out of date." },
    { id: "crm-validation", label: "Validation", technical: "CHECK", category: "control", x: 51, y: Y[2], band: 2, w: 120,
      description: "Confirms the record satisfies its rules before anyone is told about it." },
    { id: "notification", label: "Notification", technical: "NOTIFY", category: "output", x: 77, y: Y[2], band: 2, w: 130,
      description: "Tells the right person or system that the record is ready to act on." },
  ],
  connections: [
    ["lead", "normalize"], ["normalize", "business-rules"],
    ["business-rules", "crm"], ["business-rules", "erp"], ["business-rules", "enrichment"],
    ["crm", "sync"], ["erp", "sync"], ["enrichment", "sync"],
    ["sync", "crm-validation"], ["crm-validation", "notification"],
  ],
  trace: [
    { t: "00.000", text: "record received" },
    { t: "00.021", text: "fields normalized" },
    { t: "00.052", text: "rules applied" },
    { t: "00.096", text: "CRM mapped" },
    { t: "00.133", text: "ERP mapped" },
    { t: "00.178", text: "records synchronized" },
    { t: "00.226", text: "validation passed" },
    { t: "00.281", text: "notification prepared" },
  ],
};

const SAAS: ArchitectureMode = {
  id: "saas",
  label: "SaaS Backend",
  description:
    "SaaS backend architecture from client request through API gateway and access control into an application service backed by database, cache, queue and external API, then background workers and observability.",
  nodes: [
    { id: "client", label: "Client", technical: "REQ", category: "input", x: 11, y: Y[0], band: 0, w: 104,
      description: "Web or mobile surface issuing an authenticated request." },
    { id: "gateway", label: "API Gateway", technical: "ROUTE", category: "orchestration", x: 35, y: Y[0], band: 0, w: 132,
      description: "Single entry point handling routing, rate limits and request shape." },
    { id: "auth", label: "Auth / RBAC", technical: "ACCESS", category: "control", x: 60, y: Y[0], band: 0, w: 130,
      description: "Establishes who is calling and which operations they may perform." },
    { id: "application", label: "Application", technical: "SERVICE", category: "orchestration", x: 85, y: Y[0], band: 0, w: 126,
      description: "Where the domain logic actually runs, isolated from transport concerns." },
    { id: "database", label: "Database", technical: "STORE", category: "systems", x: 18, y: Y[1], band: 1, w: 118,
      description: "System of record, with schema and constraints enforced at the source." },
    { id: "cache", label: "Cache", technical: "FAST", category: "systems", x: 39, y: Y[1], band: 1, w: 106,
      description: "Absorbs repeat reads so the database is not the limit on throughput." },
    { id: "saas-queue", label: "Queue", technical: "ASYNC", category: "systems", x: 60, y: Y[1], band: 1, w: 108,
      description: "Separates asynchronous work from request-response processing." },
    { id: "external", label: "External API", technical: "3RD PARTY", category: "systems", x: 82, y: Y[1], band: 1, w: 134,
      description: "Third-party dependencies, isolated behind timeouts and fallbacks." },
    { id: "workers", label: "Workers", technical: "BACKGROUND", category: "systems", x: 35, y: Y[2], band: 2, w: 118,
      description: "Consume queued work so slow tasks never block a user request." },
    { id: "observability", label: "Observability", technical: "TELEMETRY", category: "control", x: 65, y: Y[2], band: 2, w: 142,
      description: "Traces, metrics and logs that make the running system explainable." },
  ],
  connections: [
    ["client", "gateway"], ["gateway", "auth"], ["auth", "application"],
    ["application", "database"], ["application", "cache"], ["application", "saas-queue"], ["application", "external"],
    ["database", "workers"], ["cache", "workers"], ["saas-queue", "workers"], ["external", "workers"],
    ["workers", "observability"],
  ],
  trace: [
    { t: "00.000", text: "request received" },
    { t: "00.012", text: "route matched" },
    { t: "00.029", text: "access evaluated" },
    { t: "00.058", text: "service executed" },
    { t: "00.103", text: "data resolved" },
    { t: "00.147", text: "background task queued" },
    { t: "00.211", text: "telemetry recorded" },
    { t: "00.246", text: "response ready" },
  ],
};

export const ARCHITECTURE_MODES: ArchitectureMode[] = [
  AGENT,
  AUTOMATION,
  CRM,
  SAAS,
];

export const DEFAULT_MODE_ID = AGENT.id;

/**
 * Which connections carry a moving packet, per mode. Kept deliberately short:
 * two to four at a time reads as a system under load, a dozen reads as noise.
 */
export const FLOW_CONNECTIONS: Record<string, number[]> = {
  agent: [0, 4, 7, 10],
  automation: [0, 3, 8, 11],
  crm: [0, 3, 6, 9],
  saas: [0, 4, 8, 11],
};

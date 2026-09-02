/**
 * Stage 08 - Engineering Lab.
 *
 * Five experiments, each a deterministic frame sequence. Running an experiment
 * walks its frames on a timer; every frame carries the complete state the UI
 * needs, so the render is a pure function of (experiment, variant, frame).
 *
 * There is no randomness anywhere in this file and no timing is generated at
 * runtime: the same click always produces the same frames in the same order,
 * which is what makes the screenshots reproducible and the harness able to
 * assert an exact end state.
 *
 * Everything here is a local simulation. No request leaves the browser, no
 * server is involved, and the illustrative step labels ("T+2", "retry delay")
 * are sequence positions, not measured latency.
 */

export type ExperimentId = "api" | "ratelimit" | "webhook" | "queue" | "idempotency";
export type Tone = "sky" | "lavender" | "mint" | "peach" | "aqua";

/** One stage of an experiment's system flow. */
export type FlowStage = { id: string; label: string; code: string };

export type Variant = { id: string; label: string };

export type JobState = "pending" | "processing" | "complete" | "retrying" | "dead";

export type ApiView = {
  kind: "api";
  /** Response is only shown once the handler has produced one. */
  shown: boolean;
  status: number;
  statusText: string;
  step: string;
  headers: [string, string][];
  body: string;
};

export type RateView = {
  kind: "rate";
  dots: ("pending" | "accepted" | "rejected")[];
  used: number;
  limit: number;
  remaining: number;
  blocked: boolean;
};

export type WebhookView = {
  kind: "webhook";
  signature: "pending" | "verified";
  duplicate: "pending" | "unique";
  attempts: { n: number; label: string; ok: boolean | null }[];
};

export type QueueView = {
  kind: "queue";
  jobs: { id: string; state: JobState; attempts: number; note: string }[];
  /** How many backoff marks are showing, 0-3. */
  backoff: number;
};

export type IdemView = {
  kind: "idem";
  timeline: { t: string; label: string; done: boolean }[];
  requests: number;
  actions: number;
  duplicates: number;
};

export type View = ApiView | RateView | WebhookView | QueueView | IdemView;

export type Frame = {
  /** Active flow stage index; -1 before the run starts. */
  stage: number;
  /** A stage that has failed, so the flow can stop there. */
  failed?: number;
  /** OBSERVATION > STATE */
  state: string;
  /** OBSERVATION > LAST EVENT */
  event: string;
  view: View;
};

export type Experiment = {
  id: ExperimentId;
  index: string;
  label: string;
  category: string;
  tone: Tone;
  /** Single engineering-pattern tag shown beside the explanation. */
  tag: string;
  /** OBSERVATION > PATTERN */
  pattern: string;
  flow: FlowStage[];
  variants: Variant[];
  inputTitle: string;
  inputs: { label: string; value: string }[];
  /** Optional payload shown as a code block in the input panel. */
  inputBody?: string;
  action: { run: string; running: string; done: string };
  /** Up to four small technical annotations. */
  annotations: string[];
  explanation: string;
  /** Milliseconds per frame. Total run stays inside 1.0-2.2s. */
  frameMs: number;
  /** The pre-run view. Reset returns here exactly. */
  initial: View;
  /** Deterministic frame sequences, keyed by variant id. */
  frames: Record<string, Frame[]>;
};

export const PATTERN_RAIL = [
  { index: "01", title: "Validation" },
  { index: "02", title: "Idempotency" },
  { index: "03", title: "Retry" },
  { index: "04", title: "Backoff" },
  { index: "05", title: "Deduplication" },
  { index: "06", title: "Observability" },
];

/* =====================================================================
   01 - API REQUEST INSPECTOR
   Separating validation, authentication and application handling so a
   failure is attributable to a stage rather than to "the API".
   ===================================================================== */

const API_FLOW: FlowStage[] = [
  { id: "request", label: "Request", code: "REQ" },
  { id: "validate", label: "Validate", code: "VAL" },
  { id: "authenticate", label: "Authenticate", code: "AUTH" },
  { id: "route", label: "Route", code: "RTE" },
  { id: "handler", label: "Handler", code: "HDL" },
  { id: "response", label: "Response", code: "RES" },
];

const API_HEADERS: [string, string][] = [
  ["content-type", "application/json"],
  ["x-request-id", "req_7c1a"],
];

const apiView = (over: Partial<ApiView> = {}): ApiView => ({
  kind: "api",
  shown: false,
  status: 0,
  statusText: "",
  step: "",
  headers: API_HEADERS,
  body: "",
  ...over,
});

/** Walks the flow to `upto`, then reports the outcome at that stage. */
function apiFrames(
  upto: number,
  outcome: { status: number; statusText: string; body: string; state: string; event: string },
  failedAt?: number
): Frame[] {
  const steps = ["received", "shape checked", "credentials checked", "route matched", "handler ran"];
  const frames: Frame[] = [];
  for (let i = 0; i <= upto; i++) {
    const last = i === upto;
    frames.push({
      stage: i,
      failed: last && failedAt !== undefined ? failedAt : undefined,
      state: last ? outcome.state : "RUNNING",
      event: last ? outcome.event : `${API_FLOW[i].label} ${steps[i] ?? "complete"}`,
      view: apiView(
        last
          ? { shown: true, status: outcome.status, statusText: outcome.statusText, body: outcome.body, step: `${i + 1} of ${API_FLOW.length}` }
          : { step: `${i + 1} of ${API_FLOW.length}` }
      ),
    });
  }
  return frames;
}

const API: Experiment = {
  id: "api",
  index: "01",
  label: "API Request Inspector",
  category: "API",
  tone: "sky",
  tag: "VALIDATION",
  pattern: "Validate before execution",
  flow: API_FLOW,
  variants: [
    { id: "valid", label: "Valid request" },
    { id: "invalid", label: "Validation error" },
    { id: "unauthorized", label: "Unauthorized" },
  ],
  inputTitle: "REQUEST",
  inputs: [
    { label: "METHOD", value: "POST" },
    { label: "PATH", value: "/api/orders" },
    { label: "CONTENT-TYPE", value: "application/json" },
    { label: "AUTH", value: "Bearer <token>" },
  ],
  inputBody: '{\n  "sku": "SKU-114",\n  "quantity": 2\n}',
  action: { run: "Send request", running: "Sending…", done: "Send again" },
  annotations: ["REQ / 01", "STATE / PIPELINE"],
  explanation:
    "The request pipeline separates validation, authentication and application handling so failures remain explicit and observable. A malformed body is rejected before any credential is checked, and an unauthorized caller never reaches the handler.",
  frameMs: 240,
  initial: apiView(),
  frames: {
    valid: apiFrames(5, {
      status: 200,
      statusText: "OK",
      body: '{\n  "id": "ord_2048",\n  "status": "accepted"\n}',
      state: "SUCCESS",
      event: "Response accepted",
    }),
    invalid: apiFrames(
      1,
      {
        status: 422,
        statusText: "Unprocessable Entity",
        body: '{\n  "error": "quantity must be a positive integer"\n}',
        state: "REJECTED",
        event: "Validation failed before authentication",
      },
      1
    ),
    unauthorized: apiFrames(
      2,
      {
        status: 401,
        statusText: "Unauthorized",
        body: '{\n  "error": "token expired"\n}',
        state: "REJECTED",
        event: "Authentication failed before routing",
      },
      2
    ),
  },
};

/* =====================================================================
   02 - RATE LIMIT SIMULATOR
   A fixed window with a burst allowance. Seven requests arrive; the
   window admits five plus a burst of two, and the rest are refused.
   ===================================================================== */

const RATE_FLOW: FlowStage[] = [
  { id: "arrive", label: "Arrive", code: "IN" },
  { id: "window", label: "Window", code: "WIN" },
  { id: "quota", label: "Quota", code: "QTA" },
  { id: "decide", label: "Decide", code: "DEC" },
];

const RATE_LIMIT = 5;
const RATE_BURST = 2;
const RATE_TOTAL = 7;

/**
 * The window admits five requests. Two of those five may arrive back to back
 * rather than spaced out - that is what the burst allowance buys. Everything
 * after the fifth is refused with a 429 until the window rolls.
 *
 * Sequence: 1-3 admitted normally, 4-5 admitted on the burst allowance, 6-7
 * refused.
 */
function rateFrames(): Frame[] {
  const frames: Frame[] = [];
  const normal = RATE_LIMIT - RATE_BURST; // 3 spaced arrivals
  for (let i = 1; i <= RATE_TOTAL; i++) {
    const dots = Array.from({ length: RATE_TOTAL }, (_, n) => {
      if (n >= i) return "pending" as const;
      return n < RATE_LIMIT ? ("accepted" as const) : ("rejected" as const);
    });
    const used = Math.min(i, RATE_LIMIT);
    const refused = i > RATE_LIMIT;
    const burst = !refused && i > normal;
    frames.push({
      stage: refused ? 3 : 2,
      state: refused ? "BLOCKED" : burst ? "BURST" : "ACCEPTED",
      event: refused
        ? `Request ${i} refused, 429 too many requests`
        : burst
          ? `Request ${i} admitted on the burst allowance, ${RATE_LIMIT - used} remaining`
          : `Request ${i} admitted, ${RATE_LIMIT - used} remaining`,
      view: {
        kind: "rate",
        dots,
        used,
        limit: RATE_LIMIT,
        remaining: Math.max(0, RATE_LIMIT - used),
        blocked: refused,
      },
    });
  }
  return frames;
}

const RATE: Experiment = {
  id: "ratelimit",
  index: "02",
  label: "Rate Limit Simulator",
  category: "RATE LIMITING",
  tone: "lavender",
  tag: "CONTROL",
  pattern: "Refuse early, refuse cheaply",
  flow: RATE_FLOW,
  variants: [],
  inputTitle: "PARAMETERS",
  inputs: [
    { label: "LIMIT", value: "5 requests" },
    { label: "WINDOW", value: "10s" },
    { label: "BURST", value: "2" },
    { label: "SEQUENCE", value: "7 requests" },
  ],
  action: { run: "Send burst", running: "Sending…", done: "Send again" },
  annotations: ["WIN / 10s", "STATE / QUOTA"],
  explanation:
    "A fixed window admits five requests, two of which may arrive back to back on the burst allowance rather than spaced out. Refusing the excess at the edge keeps the cost of a traffic spike proportional to the limit rather than to the traffic, and the caller learns immediately with a 429 rather than by timing out.",
  frameMs: 200,
  initial: {
    kind: "rate",
    dots: Array.from({ length: RATE_TOTAL }, () => "pending" as const),
    used: 0,
    limit: RATE_LIMIT,
    remaining: RATE_LIMIT,
    blocked: false,
  },
  frames: { default: rateFrames() },
};

/* =====================================================================
   03 - WEBHOOK RELIABILITY
   Verify, deduplicate, process, acknowledge - and survive a delivery
   that fails once.
   ===================================================================== */

const WEBHOOK_FLOW: FlowStage[] = [
  { id: "receive", label: "Receive", code: "RCV" },
  { id: "verify", label: "Verify", code: "SIG" },
  { id: "dedupe", label: "Deduplicate", code: "DED" },
  { id: "process", label: "Process", code: "PRC" },
  { id: "ack", label: "Acknowledge", code: "ACK" },
];

const webhookView = (over: Partial<WebhookView> = {}): WebhookView => ({
  kind: "webhook",
  signature: "pending",
  duplicate: "pending",
  attempts: [],
  ...over,
});

const WEBHOOK_OK: Frame[] = [
  { stage: 0, state: "RUNNING", event: "Event received", view: webhookView() },
  { stage: 1, state: "RUNNING", event: "Signature verified", view: webhookView({ signature: "verified" }) },
  { stage: 2, state: "RUNNING", event: "No prior delivery for this id", view: webhookView({ signature: "verified", duplicate: "unique" }) },
  {
    stage: 3, state: "RUNNING", event: "Handler processing event",
    view: webhookView({ signature: "verified", duplicate: "unique", attempts: [{ n: 1, label: "Delivering", ok: null }] }),
  },
  {
    stage: 4, state: "ACKNOWLEDGED", event: "Delivery acknowledged on first attempt",
    view: webhookView({ signature: "verified", duplicate: "unique", attempts: [{ n: 1, label: "SUCCESS", ok: true }] }),
  },
];

const WEBHOOK_RETRY: Frame[] = [
  { stage: 0, state: "RUNNING", event: "Event received", view: webhookView() },
  { stage: 1, state: "RUNNING", event: "Signature verified", view: webhookView({ signature: "verified" }) },
  { stage: 2, state: "RUNNING", event: "No prior delivery for this id", view: webhookView({ signature: "verified", duplicate: "unique" }) },
  {
    stage: 3, state: "RUNNING", event: "Handler processing event",
    view: webhookView({ signature: "verified", duplicate: "unique", attempts: [{ n: 1, label: "Delivering", ok: null }] }),
  },
  {
    stage: 3, failed: 3, state: "FAILED", event: "Attempt 1 returned 503, delivery will be retried",
    view: webhookView({ signature: "verified", duplicate: "unique", attempts: [{ n: 1, label: "FAILED 503", ok: false }] }),
  },
  {
    stage: 3, state: "RETRYING", event: "Retrying delivery",
    view: webhookView({
      signature: "verified", duplicate: "unique",
      attempts: [{ n: 1, label: "FAILED 503", ok: false }, { n: 2, label: "Delivering", ok: null }],
    }),
  },
  {
    stage: 3, state: "RUNNING", event: "Attempt 2 processed",
    view: webhookView({
      signature: "verified", duplicate: "unique",
      attempts: [{ n: 1, label: "FAILED 503", ok: false }, { n: 2, label: "SUCCESS", ok: true }],
    }),
  },
  {
    stage: 4, state: "ACKNOWLEDGED", event: "Delivery acknowledged after one retry",
    view: webhookView({
      signature: "verified", duplicate: "unique",
      attempts: [{ n: 1, label: "FAILED 503", ok: false }, { n: 2, label: "SUCCESS", ok: true }],
    }),
  },
];

const WEBHOOK: Experiment = {
  id: "webhook",
  index: "03",
  label: "Webhook Reliability",
  category: "WEBHOOKS",
  tone: "mint",
  tag: "DEDUPLICATION",
  pattern: "Verify, deduplicate, then act",
  flow: WEBHOOK_FLOW,
  variants: [
    { id: "success", label: "Success" },
    { id: "retry", label: "Fail once" },
  ],
  inputTitle: "INCOMING EVENT",
  inputs: [
    { label: "SOURCE", value: "orders service" },
    { label: "SIGNATURE", value: "sha256=<digest>" },
    { label: "DELIVERY", value: "dlv_0091" },
  ],
  inputBody: '{\n  "event": "order.updated",\n  "id": "evt_4821"\n}',
  action: { run: "Deliver event", running: "Delivering…", done: "Deliver again" },
  annotations: ["SIG / CHECKED", "STATE / RETRY"],
  explanation:
    "A webhook receiver verifies the signature before it trusts a payload, and checks the delivery id before it acts on one. Because the sender retries on any non-2xx reply, the handler has to be safe to run twice: the deduplication step is what makes that true.",
  frameMs: 240,
  initial: webhookView(),
  frames: { success: WEBHOOK_OK, retry: WEBHOOK_RETRY },
};

/* =====================================================================
   04 - QUEUE & RETRY SIMULATOR
   A worker draining a queue, one job that succeeds on its third attempt
   with widening backoff, and one that exhausts its retries and is set
   aside rather than retried forever.
   ===================================================================== */

const QUEUE_FLOW: FlowStage[] = [
  { id: "producer", label: "Producer", code: "PRD" },
  { id: "queue", label: "Queue", code: "QUE" },
  { id: "worker", label: "Worker", code: "WRK" },
  { id: "retry", label: "Retry", code: "RTY" },
  { id: "result", label: "Result", code: "OUT" },
];

const JOB_IDS = ["JOB-104", "JOB-105", "JOB-106", "JOB-107", "JOB-108"];

type JobSpec = { state: JobState; attempts: number; note: string };

const queueFrame = (
  stage: number,
  state: string,
  event: string,
  jobs: Record<string, JobSpec>,
  backoff: number,
  failed?: number
): Frame => ({
  stage,
  failed,
  state,
  event,
  view: {
    kind: "queue",
    backoff,
    jobs: JOB_IDS.map((id) => ({
      id,
      state: jobs[id]?.state ?? "pending",
      attempts: jobs[id]?.attempts ?? 0,
      note: jobs[id]?.note ?? "",
    })),
  },
});

const done = (attempts = 1): JobSpec => ({
  state: "complete",
  attempts,
  note: attempts === 1 ? "1 attempt" : `${attempts} attempts`,
});

/* Backoff is shown as widening marks, not as real waiting: the whole run is
   1.8s. The delays are labelled as simulation steps, never as milliseconds. */
const QUEUE_FRAMES: Frame[] = [
  queueFrame(0, "QUEUED", "5 jobs enqueued", {}, 0),
  queueFrame(2, "RUNNING", "JOB-104 processing", { "JOB-104": { state: "processing", attempts: 1, note: "attempt 1" } }, 0),
  queueFrame(2, "RUNNING", "JOB-105 processing", { "JOB-104": done(), "JOB-105": { state: "processing", attempts: 1, note: "attempt 1" } }, 0),
  queueFrame(
    3, "RETRYING", "JOB-106 attempt 1 failed, backing off",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": { state: "retrying", attempts: 1, note: "attempt 1 failed" } },
    1, 3
  ),
  queueFrame(
    3, "RETRYING", "JOB-106 attempt 2 failed, backing off further",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": { state: "retrying", attempts: 2, note: "attempt 2 failed" } },
    2, 3
  ),
  queueFrame(
    2, "RUNNING", "JOB-106 succeeded on attempt 3",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": done(3) },
    3
  ),
  queueFrame(
    2, "RUNNING", "JOB-107 processing",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": done(3), "JOB-107": { state: "processing", attempts: 1, note: "attempt 1" } },
    3
  ),
  queueFrame(
    3, "RETRYING", "JOB-108 failing, retries exhausting",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": done(3), "JOB-107": done(), "JOB-108": { state: "retrying", attempts: 3, note: "attempt 3 failed" } },
    3, 3
  ),
  queueFrame(
    4, "DEAD-LETTER", "JOB-108 moved to dead-letter, max retries exceeded",
    { "JOB-104": done(), "JOB-105": done(), "JOB-106": done(3), "JOB-107": done(), "JOB-108": { state: "dead", attempts: 3, note: "max retries exceeded" } },
    3
  ),
];

const QUEUE: Experiment = {
  id: "queue",
  index: "04",
  label: "Queue & Retry Simulator",
  category: "QUEUES",
  tone: "peach",
  tag: "RETRY",
  pattern: "Retry with backoff, then stop",
  flow: QUEUE_FLOW,
  variants: [],
  inputTitle: "PRODUCER",
  inputs: [
    { label: "JOBS", value: "5 queued" },
    { label: "WORKERS", value: "1" },
    { label: "MAX RETRIES", value: "3" },
    { label: "BACKOFF", value: "exponential" },
  ],
  action: { run: "Process queue", running: "Processing…", done: "Process again" },
  annotations: ["QUEUE / ACTIVE", "STATE / RETRY"],
  explanation:
    "A worker drains the queue, and a failing job is retried with a widening delay rather than immediately. Retrying forever turns one broken job into an outage, so after a fixed number of attempts the job is moved to a dead-letter queue where it can be inspected without blocking the rest.",
  frameMs: 200,
  initial: queueFrame(-1, "READY", "", {}, 0).view,
  frames: { default: QUEUE_FRAMES },
};

/* =====================================================================
   05 - IDEMPOTENCY GUARD
   Two identical requests, one business action.
   ===================================================================== */

const IDEM_FLOW: FlowStage[] = [
  { id: "receive", label: "Receive", code: "RCV" },
  { id: "key", label: "Key check", code: "KEY" },
  { id: "execute", label: "Execute", code: "EXE" },
  { id: "cache", label: "Cache", code: "CCH" },
  { id: "duplicate", label: "Duplicate", code: "DUP" },
  { id: "return", label: "Return cached", code: "RET" },
];

const IDEM_STEPS = [
  { t: "T+0", label: "request received" },
  { t: "T+1", label: "idempotency key checked" },
  { t: "T+2", label: "business action executed" },
  { t: "T+3", label: "result cached" },
  { t: "T+4", label: "duplicate detected" },
  { t: "T+5", label: "cached result returned" },
];

const IDEM_FRAMES: Frame[] = IDEM_STEPS.map((_, i) => ({
  stage: i,
  state: i < 4 ? "RUNNING" : i === 4 ? "DUPLICATE" : "DEDUPLICATED",
  event: [
    "First request received",
    "Key pay_8f24 not seen before",
    "Payment action executed once",
    "Result stored against the key",
    "Second request carries the same key",
    "Cached result returned, no second action",
  ][i],
  view: {
    kind: "idem",
    timeline: IDEM_STEPS.map((s, n) => ({ ...s, done: n <= i })),
    requests: i >= 4 ? 2 : 1,
    actions: i >= 2 ? 1 : 0,
    duplicates: i >= 4 ? 1 : 0,
  },
}));

const IDEMPOTENCY: Experiment = {
  id: "idempotency",
  index: "05",
  label: "Idempotency Guard",
  category: "IDEMPOTENCY",
  tone: "aqua",
  tag: "IDEMPOTENCY",
  pattern: "Same key, same result, one effect",
  flow: IDEM_FLOW,
  variants: [],
  inputTitle: "REQUEST",
  inputs: [
    { label: "METHOD", value: "POST" },
    { label: "PATH", value: "/payments" },
    { label: "IDEMPOTENCY-KEY", value: "pay_8f24" },
    { label: "SENT", value: "2 identical requests" },
  ],
  action: { run: "Send twice", running: "Sending…", done: "Send again" },
  annotations: ["KEY / CHECKED", "STATE / CACHED"],
  explanation:
    "A retry that reaches the server twice must not charge twice. The key is checked before the action runs, the result is cached against it, and the duplicate is answered from that cache, so two incoming requests produce exactly one business effect.",
  frameMs: 240,
  initial: {
    kind: "idem",
    timeline: IDEM_STEPS.map((s) => ({ ...s, done: false })),
    requests: 0,
    actions: 0,
    duplicates: 0,
  },
  frames: { default: IDEM_FRAMES },
};

export const EXPERIMENTS: Experiment[] = [API, RATE, WEBHOOK, QUEUE, IDEMPOTENCY];
export const DEFAULT_EXPERIMENT_ID: ExperimentId = "api";

/** The variant a fresh experiment starts on. */
export const defaultVariantId = (e: Experiment): string =>
  e.variants.length > 0 ? e.variants[0].id : "default";

/**
 * Stage 07 — AI Learning Systems.
 *
 * Every scenario is declared here as data. The panels, the map and the journey
 * are renderers over these structures, so adding a scenario means writing data
 * rather than markup — the same rule as `architecture-data.ts` (Stage 05) and
 * `product-scenarios.ts` (Stage 06).
 *
 * Everything in this file is SYNTHETIC. "Maya" is not a person, the mastery
 * percentages are not measurements, and no assessment was ever performed. The
 * numbers exist to demonstrate the shape of an adaptive learning system, and
 * the surface labels them as a local deterministic simulation.
 */

export type ScenarioId = "tutor" | "assessment" | "path";

/** Four knowledge states. Never encoded by colour alone — see learning.css. */
export type NodeState = "mastered" | "learning" | "gap" | "locked";

export type MapNode = {
  id: string;
  /** Shown under the node. */
  label: string;
  /** Mono code shown inside the node. */
  code: string;
  x: number;
  y: number;
  r: number;
  state: NodeState;
  tier: "primary" | "prereq";
};

export type MapLink = {
  from: string;
  to: string;
  /** `branch` renders as an optional, dashed route. */
  kind: "prereq" | "branch";
};

export type Meter = { label: string; value: number };
export type JourneyStep = { id: string; label: string; code: string };

export type TutorContent = {
  brief: string;
  focusLabel: string;
  focus: string;
  action: string;
};

/**
 * A scenario's two deterministic states. `Adapt` advances from one to the
 * other; there is no generated content and no request of any kind.
 */
export type Variant = {
  /** Node state overrides applied on top of the scenario's base nodes. */
  states: Partial<Record<string, NodeState>>;
  /** Ordered ids of the highlighted adaptive route. */
  highlight: string[];
  /** Milestone numbering, used by the path builder to show a reorder. */
  order?: Record<string, number>;
  /** Index into `journey`. */
  current: number;
  confidence: number;
  gaps: string[];
  meters: Meter[];
  tutor: TutorContent;
  /** Sentence describing the map, kept in sync with what is drawn. */
  summary: string;
};

export type LearningScenario = {
  id: ScenarioId;
  label: string;
  /** Caption above the map. */
  mapTitle: string;
  learner: { name: string; level: string; goal: string };
  metersTitle: string;
  gapsTitle: string;
  artifact?: { title: string; body: string; tag: string };
  nodes: MapNode[];
  links: MapLink[];
  journey: JourneyStep[];
  action: { idle: string; running: string; done: string; again: string };
  variants: [Variant, Variant];
};

/** The five stages the adapt sequence walks through. */
export const ADAPT_STAGES = [
  { id: "analyzing", label: "Prerequisites recalculated" },
  { id: "selecting", label: "Learning activity selected" },
  { id: "assessing", label: "Assessment adjusted" },
  { id: "feedback", label: "Feedback prepared" },
  { id: "updated", label: "Next step updated" },
] as const;

/** Legend copy. State is carried by text and stroke as well as by hue. */
export const NODE_STATES: { id: NodeState; label: string }[] = [
  { id: "mastered", label: "Mastered" },
  { id: "learning", label: "Learning" },
  { id: "gap", label: "Gap" },
  { id: "locked", label: "Locked" },
];

export const PRINCIPLES = [
  { index: "01", title: "Learner context first" },
  { index: "02", title: "Evidence before inference" },
  { index: "03", title: "Feedback drives adaptation" },
  { index: "04", title: "Progress remains observable" },
];

/* =====================================================================
   01 — ADAPTIVE TUTOR
   A knowledge map of the concepts behind the learner's stated goal, with
   prerequisite edges. The adaptive route is the chain that has to be
   cleared before the goal concept becomes reachable.
   ===================================================================== */

const TUTOR: LearningScenario = {
  id: "tutor",
  label: "Adaptive Tutor",
  mapTitle: "KNOWLEDGE MAP",
  learner: { name: "Maya", level: "Intermediate", goal: "Build REST APIs" },
  metersTitle: "Mastery",
  gapsTitle: "Knowledge gaps",
  nodes: [
    { id: "headers", label: "Headers", code: "HDR", x: 108, y: 30, r: 14, state: "mastered", tier: "prereq" },
    { id: "json", label: "JSON", code: "JSN", x: 214, y: 46, r: 14, state: "mastered", tier: "prereq" },
    { id: "schemas", label: "Schemas", code: "SCH", x: 330, y: 30, r: 14, state: "locked", tier: "prereq" },
    { id: "http", label: "HTTP", code: "HTTP", x: 60, y: 90, r: 21, state: "mastered", tier: "primary" },
    { id: "requests", label: "Requests", code: "REQ", x: 150, y: 120, r: 21, state: "mastered", tier: "primary" },
    { id: "apis", label: "APIs", code: "API", x: 250, y: 150, r: 21, state: "learning", tier: "primary" },
    { id: "validation", label: "Validation", code: "VAL", x: 338, y: 96, r: 21, state: "gap", tier: "primary" },
    { id: "rest", label: "REST", code: "REST", x: 446, y: 46, r: 21, state: "learning", tier: "primary" },
    { id: "assertions", label: "Assertions", code: "ASR", x: 470, y: 96, r: 14, state: "locked", tier: "prereq" },
    { id: "auth", label: "Authentication", code: "AUTH", x: 424, y: 158, r: 21, state: "locked", tier: "primary" },
    { id: "methods", label: "Methods", code: "MTH", x: 48, y: 178, r: 14, state: "mastered", tier: "prereq" },
    { id: "responses", label: "Responses", code: "RES", x: 152, y: 214, r: 21, state: "learning", tier: "primary" },
    { id: "errors", label: "Error handling", code: "ERR", x: 346, y: 226, r: 21, state: "gap", tier: "primary" },
    { id: "status", label: "Status codes", code: "STA", x: 232, y: 268, r: 14, state: "gap", tier: "prereq" },
    { id: "testing", label: "Testing", code: "TST", x: 452, y: 262, r: 21, state: "locked", tier: "primary" },
  ],
  links: [
    { from: "headers", to: "http", kind: "prereq" },
    { from: "methods", to: "http", kind: "prereq" },
    { from: "http", to: "requests", kind: "prereq" },
    { from: "http", to: "responses", kind: "prereq" },
    { from: "json", to: "requests", kind: "prereq" },
    { from: "requests", to: "apis", kind: "prereq" },
    { from: "responses", to: "apis", kind: "prereq" },
    { from: "status", to: "responses", kind: "prereq" },
    { from: "apis", to: "validation", kind: "prereq" },
    { from: "apis", to: "errors", kind: "prereq" },
    { from: "schemas", to: "validation", kind: "prereq" },
    { from: "validation", to: "errors", kind: "prereq" },
    { from: "validation", to: "rest", kind: "prereq" },
    { from: "validation", to: "auth", kind: "branch" },
    { from: "errors", to: "testing", kind: "prereq" },
    { from: "assertions", to: "testing", kind: "prereq" },
  ],
  journey: [
    { id: "context", label: "Context", code: "CTX" },
    { id: "gap", label: "Gap", code: "GAP" },
    { id: "lesson", label: "Lesson", code: "LSN" },
    { id: "exercise", label: "Exercise", code: "EXC" },
    { id: "assessment", label: "Assessment", code: "ASM" },
    { id: "feedback", label: "Feedback", code: "FBK" },
    { id: "next", label: "Next step", code: "NXT" },
  ],
  action: {
    idle: "Adapt next step",
    running: "Adapting…",
    done: "Path updated",
    again: "Adapt again",
  },
  variants: [
    {
      states: {},
      highlight: ["validation", "errors", "testing"],
      current: 1,
      confidence: 68,
      gaps: ["HTTP status semantics", "Request validation", "Error handling"],
      meters: [
        { label: "HTTP", value: 82 },
        { label: "APIs", value: 71 },
        { label: "Testing", value: 56 },
        { label: "Auth", value: 64 },
      ],
      tutor: {
        brief: "You are ready to practice request validation.",
        focusLabel: "Focus:",
        focus: "validate incoming data before business logic runs.",
        action: "Practice validation",
      },
      summary:
        "Adaptive learning map showing learner gaps, prerequisite knowledge and recommended next learning activity. Validation is the current gap; error handling and testing remain locked behind it.",
    },
    {
      states: { validation: "learning", status: "learning" },
      highlight: ["validation", "errors", "testing"],
      current: 3,
      confidence: 71,
      gaps: ["HTTP status semantics", "Error handling", "Test coverage"],
      meters: [
        { label: "HTTP", value: 84 },
        { label: "APIs", value: 73 },
        { label: "Testing", value: 58 },
        { label: "Auth", value: 64 },
      ],
      tutor: {
        brief:
          "The learner is ready for a validation exercise before moving into testing.",
        focusLabel: "NEXT:",
        focus: "Validation exercise",
        action: "Start validation exercise",
      },
      summary:
        "Adaptive learning map after adaptation. Validation has moved from gap to in-progress, the recommended activity is a validation exercise, and testing stays behind error handling.",
    },
  ],
};

/* =====================================================================
   02 — ASSESSMENT ENGINE
   The graph is the evaluation pipeline itself: a response fans out across
   rubric criteria, converges on an evaluation, and produces feedback and a
   difficulty decision. Nothing here scores anything — it shows the shape an
   assessment architecture takes.
   ===================================================================== */

const ASSESSMENT: LearningScenario = {
  id: "assessment",
  label: "Assessment Engine",
  mapTitle: "EVALUATION GRAPH",
  learner: { name: "Maya", level: "Intermediate", goal: "Build REST APIs" },
  metersTitle: "Rubric criteria",
  gapsTitle: "Evidence gathered",
  artifact: {
    title: "ASSESSMENT ITEM",
    body: "Which status code best represents a syntactically valid request that fails application-level validation?",
    tag: "DETERMINISTIC DEMO",
  },
  nodes: [
    { id: "question", label: "Question", code: "QST", x: 80, y: 60, r: 21, state: "mastered", tier: "primary" },
    { id: "response", label: "Response", code: "RSP", x: 80, y: 170, r: 21, state: "learning", tier: "primary" },
    { id: "accuracy", label: "Accuracy", code: "ACC", x: 215, y: 60, r: 14, state: "mastered", tier: "prereq" },
    { id: "reasoning", label: "Reasoning", code: "RSN", x: 215, y: 125, r: 14, state: "learning", tier: "prereq" },
    { id: "application", label: "Application", code: "APP", x: 215, y: 190, r: 14, state: "gap", tier: "prereq" },
    { id: "clarity", label: "Clarity", code: "CLR", x: 215, y: 255, r: 14, state: "mastered", tier: "prereq" },
    { id: "evidence", label: "Evidence", code: "EVD", x: 140, y: 285, r: 14, state: "learning", tier: "prereq" },
    { id: "evaluation", label: "Evaluation", code: "EVL", x: 330, y: 150, r: 21, state: "learning", tier: "primary" },
    { id: "decision", label: "Decision", code: "DEC", x: 412, y: 68, r: 14, state: "locked", tier: "prereq" },
    { id: "feedback", label: "Feedback", code: "FBK", x: 436, y: 176, r: 21, state: "locked", tier: "primary" },
    { id: "difficulty", label: "Difficulty", code: "DIF", x: 430, y: 264, r: 21, state: "locked", tier: "primary" },
  ],
  links: [
    { from: "question", to: "response", kind: "prereq" },
    { from: "response", to: "accuracy", kind: "prereq" },
    { from: "response", to: "reasoning", kind: "prereq" },
    { from: "response", to: "application", kind: "prereq" },
    { from: "response", to: "clarity", kind: "prereq" },
    { from: "evidence", to: "clarity", kind: "prereq" },
    { from: "accuracy", to: "evaluation", kind: "prereq" },
    { from: "reasoning", to: "evaluation", kind: "prereq" },
    { from: "application", to: "evaluation", kind: "prereq" },
    { from: "clarity", to: "evaluation", kind: "prereq" },
    { from: "evaluation", to: "decision", kind: "prereq" },
    { from: "evaluation", to: "feedback", kind: "prereq" },
    { from: "decision", to: "feedback", kind: "branch" },
    { from: "feedback", to: "difficulty", kind: "prereq" },
  ],
  journey: [
    { id: "question", label: "Question", code: "QST" },
    { id: "response", label: "Response", code: "RSP" },
    { id: "rubric", label: "Rubric", code: "RBC" },
    { id: "evaluation", label: "Evaluation", code: "EVL" },
    { id: "feedback", label: "Feedback", code: "FBK" },
    { id: "difficulty", label: "Difficulty", code: "DIF" },
  ],
  action: {
    idle: "Adapt next step",
    running: "Adapting…",
    done: "Rubric updated",
    again: "Adapt again",
  },
  variants: [
    {
      states: {},
      highlight: ["response", "application", "evaluation"],
      current: 2,
      confidence: 62,
      gaps: ["Applied to a concrete case", "Names the failing layer"],
      meters: [
        { label: "Conceptual accuracy", value: 78 },
        { label: "Reasoning", value: 66 },
        { label: "Application", value: 48 },
        { label: "Clarity", value: 81 },
      ],
      tutor: {
        brief:
          "The response is conceptually sound but has not been applied to a concrete case.",
        focusLabel: "Focus:",
        focus: "separate transport-level success from domain-level rejection.",
        action: "Review criterion",
      },
      summary:
        "Assessment evaluation graph showing a response measured against four rubric criteria, converging on an evaluation, a feedback route and a difficulty decision. Application is the weakest criterion.",
    },
    {
      states: { application: "learning", evaluation: "mastered", feedback: "learning", difficulty: "learning" },
      highlight: ["evaluation", "feedback", "difficulty"],
      current: 4,
      confidence: 66,
      gaps: ["Applied to a concrete case", "Rubric weighting confirmed"],
      meters: [
        { label: "Conceptual accuracy", value: 80 },
        { label: "Reasoning", value: 69 },
        { label: "Application", value: 57 },
        { label: "Clarity", value: 81 },
      ],
      tutor: {
        brief:
          "Evaluation is complete. Feedback targets the application criterion and difficulty holds steady.",
        focusLabel: "NEXT:",
        focus: "Applied validation item",
        action: "Open next item",
      },
      summary:
        "Assessment evaluation graph after adaptation. Evaluation has resolved, feedback is prepared against the application criterion, and the difficulty decision is now active.",
    },
  ],
};

/* =====================================================================
   03 — LEARNING PATH BUILDER
   A controlled roadmap rather than a network: milestones on a route from
   the stated goal's prerequisites to deployment, with two optional
   branches. Adapting promotes Testing ahead of Persistence — a real,
   deterministic reorder, visible in the milestone numbering.
   ===================================================================== */

const PATH: LearningScenario = {
  id: "path",
  label: "Learning Path Builder",
  mapTitle: "PATH ROADMAP",
  learner: { name: "Maya", level: "Intermediate", goal: "Build and deploy a REST API" },
  metersTitle: "Prerequisite readiness",
  gapsTitle: "Open objectives",
  artifact: {
    title: "GOAL",
    body: "Build and deploy a REST API",
    tag: "SYNTHETIC PATH",
  },
  nodes: [
    { id: "auth", label: "Auth", code: "AUTH", x: 255, y: 60, r: 14, state: "locked", tier: "prereq" },
    { id: "data", label: "Data", code: "DATA", x: 160, y: 100, r: 21, state: "learning", tier: "primary" },
    { id: "persistence", label: "Persistence", code: "DB", x: 350, y: 100, r: 21, state: "locked", tier: "primary" },
    { id: "foundations", label: "Foundations", code: "HTTP", x: 65, y: 170, r: 21, state: "mastered", tier: "primary" },
    { id: "validation", label: "Validation", code: "VAL", x: 255, y: 170, r: 21, state: "gap", tier: "primary" },
    { id: "deploy", label: "Deploy", code: "SHIP", x: 450, y: 170, r: 21, state: "locked", tier: "primary" },
    { id: "testing", label: "Testing", code: "TST", x: 350, y: 250, r: 21, state: "locked", tier: "primary" },
    { id: "monitoring", label: "Monitoring", code: "OBS", x: 450, y: 265, r: 14, state: "locked", tier: "prereq" },
  ],
  links: [
    { from: "foundations", to: "data", kind: "prereq" },
    { from: "data", to: "validation", kind: "prereq" },
    { from: "data", to: "auth", kind: "branch" },
    { from: "validation", to: "persistence", kind: "prereq" },
    { from: "validation", to: "testing", kind: "prereq" },
    { from: "persistence", to: "deploy", kind: "prereq" },
    { from: "testing", to: "deploy", kind: "prereq" },
    { from: "deploy", to: "monitoring", kind: "branch" },
  ],
  journey: [
    { id: "goal", label: "Goal", code: "GOL" },
    { id: "prerequisites", label: "Prerequisites", code: "PRE" },
    { id: "objectives", label: "Objectives", code: "OBJ" },
    { id: "activities", label: "Activities", code: "ACT" },
    { id: "checkpoints", label: "Checkpoints", code: "CHK" },
    { id: "path", label: "Path", code: "PTH" },
  ],
  action: {
    idle: "Adapt path",
    running: "Adapting…",
    done: "Path updated",
    again: "Adapt again",
  },
  variants: [
    {
      states: {},
      highlight: ["validation", "persistence", "deploy"],
      order: { foundations: 1, data: 2, validation: 3, persistence: 4, deploy: 5 },
      current: 1,
      confidence: 68,
      gaps: ["Validate request bodies", "Persist and query records", "Ship behind a health check"],
      meters: [
        { label: "HTTP", value: 82 },
        { label: "Python", value: 74 },
        { label: "Validation", value: 51 },
        { label: "Databases", value: 46 },
      ],
      tutor: {
        brief:
          "Persistence is scheduled before testing, so the first deploy would ship untested.",
        focusLabel: "Focus:",
        focus: "clear validation, then decide what to sequence next.",
        action: "Review sequence",
      },
      summary:
        "Learning path roadmap with five ordered milestones from HTTP foundations to deployment, plus optional authentication and monitoring branches. Testing sits outside the main sequence.",
    },
    {
      states: { testing: "learning", validation: "learning" },
      highlight: ["validation", "testing", "deploy"],
      order: { foundations: 1, data: 2, validation: 3, testing: 4, persistence: 5, deploy: 6 },
      current: 3,
      confidence: 72,
      gaps: ["Persist and query records", "Ship behind a health check", "Add monitoring after first deploy"],
      meters: [
        { label: "HTTP", value: 84 },
        { label: "Python", value: 74 },
        { label: "Validation", value: 60 },
        { label: "Databases", value: 46 },
      ],
      tutor: {
        brief:
          "Testing has been promoted ahead of persistence so each layer ships with coverage behind it.",
        focusLabel: "NEXT:",
        focus: "Testing milestone",
        action: "Open testing milestone",
      },
      summary:
        "Learning path roadmap after adaptation. Testing has been promoted to the fourth milestone, ahead of persistence, so the route now reaches deployment through a tested layer.",
    },
  ],
};

export const LEARNING_SCENARIOS: LearningScenario[] = [TUTOR, ASSESSMENT, PATH];
export const DEFAULT_SCENARIO_ID: ScenarioId = "tutor";

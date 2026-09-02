/**
 * Operations demo: domain types.
 *
 * The thirteen entities frozen in `docs/DEMO_OPERATIONS_SPEC.md`. Every
 * canonical value is a literal union, so a service cannot be handed an
 * arbitrary string where a stage or a status belongs.
 *
 * This module imports from `@/demo-runtime` and never the other way round. The
 * runtime knows records and collections; it must never learn what a lead is.
 *
 * No field carries contact information. There is no email, telephone or postal
 * address on any entity here, and none may be added: the portfolio forbids a
 * contact route on every surface, including example data.
 */

/* =====================================================================
   1. VALUE UNIONS
   ===================================================================== */

export const ROLES = ["Admin", "Sales Agent", "Fleet Coordinator", "Finance Analyst"] as const;
export type Role = (typeof ROLES)[number];

export const MODULES = [
  "Overview",
  "Leads",
  "Customers",
  "Reservations",
  "Contracts",
  "Fleet",
  "Maintenance",
  "Payments",
  "Automations",
  "Inbox",
  "Reports",
] as const;
export type ModuleName = (typeof MODULES)[number];

export const LEAD_SOURCES = [
  "Website",
  "Campaign",
  "Referral",
  "Walk-in",
  "Returning customer",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const PRIORITIES = ["Low", "Normal", "High"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CUSTOMER_STATUSES = ["Active", "Inactive"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_SEGMENTS = ["Standard", "Frequent", "Business"] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const VEHICLE_CLASSES = ["Urban", "Touring", "Utility"] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export const VEHICLE_STATUSES = ["Available", "Reserved", "Rented", "Maintenance"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const MODEL_LABELS = [
  "Metro 125",
  "City 160",
  "Urban 125",
  "Tour 250",
  "Trail 200",
  "Cargo 150",
] as const;
export type ModelLabel = (typeof MODEL_LABELS)[number];

export const SERVICE_AREAS = ["Central", "North", "East", "South"] as const;
export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const RESERVATION_STATUSES = ["Draft", "Confirmed", "Converted", "Cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const CONTRACT_STATUSES = ["Pending", "Active", "Completed", "Cancelled"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * What a payment record actually stores.
 *
 * `Overdue` is deliberately absent: it is derived from `dueAt` against the
 * logical clock (D-053). A stored overdue flag would go stale the moment the
 * clock passed a due date, giving the demo two disagreeing answers.
 */
export const PAYMENT_STORED_STATUSES = ["Pending", "Paid"] as const;
export type PaymentStoredStatus = (typeof PAYMENT_STORED_STATUSES)[number];

export const PAYMENT_EFFECTIVE_STATUSES = ["Pending", "Paid", "Overdue"] as const;
export type PaymentEffectiveStatus = (typeof PAYMENT_EFFECTIVE_STATUSES)[number];

export const PAYMENT_CATEGORIES = ["Rental", "Deposit", "Adjustment"] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const MAINTENANCE_TYPES = ["Inspection", "Preventive", "Repair"] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_PRIORITIES = ["Routine", "Soon", "High"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_STATUSES = ["Open", "In Progress", "Completed", "Cancelled"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const CONVERSATION_SUBJECTS = ["Lead", "Customer"] as const;
export type ConversationSubject = (typeof CONVERSATION_SUBJECTS)[number];

/**
 * The only two channels. No email, SMS or messaging-app channel may be added:
 * a conversation surface with an address field is a contact route.
 */
export const CONVERSATION_CHANNELS = ["Web chat", "In-app"] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export const CONVERSATION_STATUSES = ["Open", "Closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_AUTHORS = ["Customer", "Staff", "System"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];

export const AUTOMATION_RUN_STATUSES = ["Success", "Skipped", "Failed"] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export const NOTIFICATION_CATEGORIES = [
  "CRM",
  "Reservation",
  "Finance",
  "Maintenance",
  "Automation",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/* =====================================================================
   2. ENTITIES

   Each is the `data` payload of a runtime DemoRecord. Runtime bookkeeping
   (id, createdAt, updatedAt, version) lives on the record wrapper, except
   where the spec puts a domain-meaningful timestamp on the entity itself.
   ===================================================================== */

export type Actor = {
  displayName: string;
  role: Role;
  active: boolean;
};

export type Lead = {
  displayName: string;
  source: LeadSource;
  stage: LeadStage;
  vehicleInterest: VehicleClass;
  assignedActorId: string | null;
  priority: Priority;
  lastActivityAt: string;
  nextFollowUpAt: string | null;
  convertedCustomerId?: string;
  archived: boolean;
};

export type Customer = {
  displayName: string;
  status: CustomerStatus;
  segment: CustomerSegment;
  sourceLeadId?: string;
  notes: string;
  archived: boolean;
};

export type Vehicle = {
  assetCode: string;
  modelLabel: ModelLabel;
  vehicleClass: VehicleClass;
  /**
   * Last computed status. Persisted so lists and filters can read it directly,
   * but it is only ever written by `deriveVehicleStatus`, never by a form.
   */
  status: VehicleStatus;
  odometerKm: number;
  serviceArea: ServiceArea;
  currentContractId?: string;
  currentReservationId?: string;
  activeMaintenanceId?: string;
};

export type Reservation = {
  customerId: string;
  vehicleId?: string;
  vehicleClass: VehicleClass;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  notes: string;
  convertedContractId?: string;
};

export type Contract = {
  customerId: string;
  vehicleId: string;
  reservationId?: string;
  status: ContractStatus;
  startAt: string;
  endAt: string;
  /** Integer cents (D-053). */
  dailyRate: number;
  /** Integer cents. `dailyRate × billable days`. */
  totalAmount: number;
  /** Integer cents. Sum of this contract's Paid payments. */
  paidAmount: number;
};

export type Payment = {
  contractId: string;
  customerId: string;
  /** Integer cents. */
  amount: number;
  status: PaymentStoredStatus;
  dueAt: string;
  paidAt?: string;
  category: PaymentCategory;
};

export type MaintenanceWorkOrder = {
  vehicleId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  openedAt: string;
  startedAt?: string;
  completedAt?: string;
  summary: string;
};

export type Conversation = {
  subjectType: ConversationSubject;
  subjectId: string;
  channel: ConversationChannel;
  assignedActorId: string | null;
  status: ConversationStatus;
  unread: boolean;
};

export type Message = {
  conversationId: string;
  authorType: MessageAuthor;
  actorId?: string;
  body: string;
  /** Domain-meaningful send time, distinct from the record's createdAt. */
  sentAt: string;
};

export type AutomationTrigger =
  | "lead.created.website"
  | "lead.qualified"
  | "reservation.confirmed"
  | "payment.overdue"
  | "maintenance.completed";

export type AutomationRule = {
  name: string;
  trigger: AutomationTrigger;
  action: string;
  enabled: boolean;
  lastRunAt?: string;
  runCount: number;
};

export type AutomationRun = {
  ruleId: string;
  sourceEventId: string;
  status: AutomationRunStatus;
  startedAt: string;
  completedAt: string;
  summary: string;
};

export type Notification = {
  actorRole?: Role;
  actorId?: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  sourceEntityType?: string;
  sourceEntityId?: string;
};

/* =====================================================================
   3. DERIVED SHAPES
   ===================================================================== */

/** A payment with its clock-derived status resolved. */
export type ResolvedPayment = {
  id: string;
  data: Payment;
  effectiveStatus: PaymentEffectiveStatus;
};

export type ContractBalance = {
  /** Integer cents. */
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
};

export type LeadBrief = {
  summary: string;
  recommendedAction: RecommendedAction;
};

export const RECOMMENDED_ACTIONS = [
  "Follow up",
  "Prepare reservation",
  "Review conversation",
] as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

/** The interval two bookings must not both occupy. */
export type Interval = { startAt: string; endAt: string };

/* =====================================================================
   4. SESSION CONTEXT

   Every mutating service takes one of these. Permission is enforced in the
   domain, not by a future screen choosing not to draw a button.
   ===================================================================== */

export type OperationsSession = {
  role: Role;
  actorId: string;
};

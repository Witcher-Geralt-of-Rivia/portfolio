/**
 * Operations demo: synthetic name and text pools.
 *
 * Every display name in the demo is composed from these arrays by index. No
 * randomness, so the same reset always produces the same people, and no name
 * is copied from a real customer, client or public figure.
 *
 * None of the strings here may contain an email address, a telephone number, a
 * URL, a social handle or a real company name. `qa/stage09c1-operations.mjs`
 * scans them.
 */

const FIRST_NAMES = [
  "Alina", "Bran", "Cassia", "Devon", "Elin", "Ferran", "Greta", "Halden",
  "Ilse", "Joss", "Kenna", "Lorcan", "Mira", "Nolan", "Odile", "Perrin",
  "Quilla", "Ronan", "Sable", "Tamsin",
] as const;

const LAST_NAMES = [
  "Ashcroft", "Belmonte", "Calloway", "Danforth", "Ellery", "Fairbanks",
  "Grimshaw", "Hollis", "Ingram", "Jarrow", "Kessler", "Lindqvist",
  "Merrick", "Nordahl", "Ostberg", "Prewitt", "Rennick", "Sandoval",
  "Thackeray", "Vasquez",
] as const;

/**
 * A stable synthetic person name for a given index.
 *
 * The two pools are coprime in length only by accident, so the last name is
 * offset by a different stride to stop the sequence pairing the same surname
 * with every first name in turn.
 */
export function personName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length];
  return `${first} ${last}`;
}

/** Business names for the Business segment. Invented, generic, unbranded. */
const BUSINESS_NAMES = [
  "Harbourline Couriers",
  "Northgate Logistics",
  "Riverbend Deliveries",
  "Stonepath Services",
  "Westfield Dispatch",
] as const;

export function businessName(index: number): string {
  return BUSINESS_NAMES[index % BUSINESS_NAMES.length];
}

/** Short synthetic customer notes. */
const CUSTOMER_NOTES = [
  "Prefers shorter rental periods.",
  "Usually books ahead of a weekend.",
  "Has rented from the Central area before.",
  "Asks for the same vehicle class each time.",
  "Flexible on collection times.",
  "",
] as const;

export function customerNote(index: number): string {
  return CUSTOMER_NOTES[index % CUSTOMER_NOTES.length];
}

/**
 * Message bodies, by author type.
 *
 * Deliberately mundane operational chatter. Nothing here carries a contact
 * route, a link or a real organisation.
 */
const CUSTOMER_MESSAGES = [
  "Is an urban model available for next week?",
  "Could I extend the rental by two days?",
  "What is included in the daily rate?",
  "I would like to change the collection time.",
  "Does the touring class suit a longer trip?",
  "Can I switch to a utility model instead?",
  "Is the vehicle ready for collection today?",
  "How long does the handover usually take?",
] as const;

const STAFF_MESSAGES = [
  "Checking availability now, one moment.",
  "That change is possible. I have updated the booking.",
  "The daily rate covers the vehicle and routine servicing.",
  "Collection time updated as requested.",
  "The touring class is the better fit for that distance.",
  "I can move you to a utility model from Thursday.",
  "The vehicle is prepared and ready for collection.",
  "Handover normally takes about fifteen minutes.",
] as const;

const SYSTEM_MESSAGES = [
  "Reservation confirmed. Vehicle assigned.",
  "Reservation updated by the operations team.",
  "Contract activated for this booking.",
  "Maintenance completed on the assigned vehicle.",
] as const;

export function customerMessage(index: number): string {
  return CUSTOMER_MESSAGES[index % CUSTOMER_MESSAGES.length];
}

export function staffMessage(index: number): string {
  return STAFF_MESSAGES[index % STAFF_MESSAGES.length];
}

export function systemMessage(index: number): string {
  return SYSTEM_MESSAGES[index % SYSTEM_MESSAGES.length];
}

/** Short maintenance summaries. */
const MAINTENANCE_SUMMARIES = [
  "Scheduled inspection at service interval.",
  "Brake pads checked and adjusted.",
  "Chain tension and lubrication.",
  "Tyre replaced after wear check.",
  "Electrical check following a reported fault.",
  "Routine preventive service.",
  "Fairing panel refitted.",
] as const;

export function maintenanceSummary(index: number): string {
  return MAINTENANCE_SUMMARIES[index % MAINTENANCE_SUMMARIES.length];
}

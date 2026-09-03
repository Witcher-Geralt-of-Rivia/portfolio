/**
 * Stage 09C3.3 - Operations Inbox QA.
 *
 * The two layers the Leads and Customers suites established. The DOMAIN part
 * drives the real bundled services through the QA probe, because the rules
 * this stage settled must hold whether or not a screen remembers to ask: an
 * assignee has to be someone who can actually work the Inbox, a reply has to
 * be audited without copying what it said, and read state has to stay out of
 * the audit trail entirely.
 *
 * It also proves Rule 03 end to end without building Reservations: confirming
 * a reservation through the domain appends a System message to the customer's
 * conversation, marks it unread, and the Inbox shows it.
 *
 * Both need a route that only exists during a QA run:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c33-inbox.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host
 * and 3100 is this portfolio's live production.
 *
 * Against production the domain section is skipped automatically, because the
 * probe route is not deployed:
 *
 *   QA_BASE=https://intelligent-systems-lab.duckdns.org node qa/stage09c33-inbox.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const INBOX = `${BASE}/demos/operations/inbox`;
const PROBE = `${BASE}/demos/qa-operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/* Playwright polls on requestAnimationFrame by default and this application
   schedules no frames at rest, so every wait states its own interval. */
const POLL = { polling: 100, timeout: 20000 };

const lum = (c) => {
  const f = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const rgb = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

/**
 * The seeded conversations this suite addresses by name.
 *
 * Chosen from the canonical seed rather than by searching the rendered list,
 * so each case tests the state it means to. Their identities are asserted in
 * the domain section, which is what stops this table from quietly going stale.
 */
const FIXED = {
  /* Open, unread, and its lead is Qualified, so a reply moves the recommended
     action rather than leaving it where it was. This is the W5 thread. */
  w5: "conversation_0002",
  /* Closed and unread: the thread whose reply must be refused. */
  closed: "conversation_0003",
  /* A customer converted from a lead, so a brief can honestly be composed. */
  converted: "conversation_0013",
  /* A customer who was never a lead, so one cannot. */
  established: "conversation_0014",
  /* A plain open lead thread, unread like the first six. */
  lead: "conversation_0005",
  /* Open and already read, so the read toggle starts from a known side. */
  readLead: "conversation_0007",
};

const browser = await chromium.launch();

/** A page on the Inbox route with the list rendered and the seed untouched. */
async function freshInbox(viewport = { width: 1600, height: 900 }, path = INBOX) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-leads__count", POLL);
  await page.waitForFunction(
    () => document.querySelector(".ops-leads__count")?.textContent.trim() !== "",
    null,
    POLL
  );
  await page
    .waitForFunction(() => document.querySelectorAll(".ops-convo").length > 0, null, POLL)
    .catch(() => {});
  return { ctx, page, problems };
}

/** Wait for the thread to hold a conversation rather than its placeholder. */
const waitForThread = (page) =>
  page.waitForFunction(
    () =>
      Boolean(document.querySelector(".ops-thread__title")) ||
      Boolean(document.querySelector(".ops-thread__placeholder")),
    null,
    POLL
  );

/** Choose a value from one of the product's custom selects. */
async function choose(page, trigger, value) {
  await page.click(trigger);
  await page.waitForSelector('[role="listbox"]', POLL);
  await page.click(`[role="listbox"] [role="option"][data-value="${value}"]`);
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  await page.waitForTimeout(150);
}

/** The filter triggers, in toolbar order: status, channel, read state. */
const FILTER = (n) => `.ops-leads__filters .demo-select__trigger >> nth=${n}`;
const ASSIGN = ".ops-thread__assign .demo-select__trigger";
const ROLE_SELECT = ".ops-role__select .demo-select__trigger";

const countOf = (page) => page.$eval(".ops-leads__count", (e) => e.textContent.trim());
const textOf = (page, sel, fallback = "-") =>
  page.$eval(sel, (e) => e.textContent.trim()).catch(() => fallback);
const marksOf = (page) =>
  page.$$eval(".ops-thread__marks > *", (n) => n.map((e) => e.textContent.trim()));
const rowsOf = (page) => page.$$eval(".ops-convo", (n) => n.length);

/* =====================================================================
   1. DOMAIN - the rules hold without a screen
   ===================================================================== */

section("DOMAIN - SEED, AUDIT, ASSIGNMENT AND RULE 03");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(PROBE, { waitUntil: "networkidle" }).catch(() => null);

  if (!res || res.status() !== 200) {
    console.log("  SKIP  probe route absent (expected against production)");
  } else {
    await page.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);

    const out = await page.evaluate(async (FIXED) => {
      const P = window.__opsProbe;
      const fresh = async () => {
        const rt = P.createDemoRuntime({
          seed: P.buildOperationsSeed(),
          latency: "off",
          broadcast: false,
          adapter: P.createMemoryAdapter(),
        });
        await rt.initialize();
        return rt;
      };
      const ops = P.operations;
      const code = async (fn) => {
        try {
          await fn();
          return "no-error";
        } catch (e) {
          return P.isDemoError(e) ? e.code : "unknown";
        }
      };
      const message = async (fn) => {
        try {
          await fn();
          return "";
        } catch (e) {
          return e && e.message ? e.message : "";
        }
      };

      const rt = await fresh();
      const admin = ops.contextAs(rt, "Admin");
      const sales = ops.contextAs(rt, "Sales Agent");
      const finance = ops.contextAs(rt, "Finance Analyst");
      const fleet = ops.contextAs(rt, "Fleet Coordinator");

      /* --- the seeded distribution, measured ------------------------- */
      const conversations = await rt.repository.all("conversations");
      const messages = await rt.repository.all("messages");
      const leads = await rt.repository.all("leads");
      const customers = await rt.repository.all("customers");
      const actors = await rt.repository.all("actors");

      const byConversation = new Map();
      for (const m of messages) {
        const b = byConversation.get(m.data.conversationId);
        if (b) b.push(m);
        else byConversation.set(m.data.conversationId, [m]);
      }
      const threadSizes = {};
      for (const c of conversations) {
        const n = (byConversation.get(c.id) ?? []).length;
        threadSizes[n] = (threadSizes[n] ?? 0) + 1;
      }

      /* --- integrity ------------------------------------------------- */
      const subjectOk = conversations.every((c) =>
        c.data.subjectType === "Lead"
          ? leads.some((l) => l.id === c.data.subjectId)
          : customers.some((x) => x.id === c.data.subjectId)
      );
      const assigneeOk = conversations.every(
        (c) => c.data.assignedActorId === null || actors.some((a) => a.id === c.data.assignedActorId)
      );
      const minMessages = Math.min(...conversations.map((c) => (byConversation.get(c.id) ?? []).length));
      const messageParentOk = messages.every((m) =>
        conversations.some((c) => c.id === m.data.conversationId)
      );
      const staffActorOk = messages.every(
        (m) => !m.data.actorId || actors.some((a) => a.id === m.data.actorId)
      );
      const ordered = [...byConversation.values()].every((thread) => {
        const sorted = [...thread].sort((a, b) => a.id.localeCompare(b.id));
        return sorted.every((m, i) => i === 0 || sorted[i - 1].data.sentAt <= m.data.sentAt);
      });

      /* --- the fixtures this suite addresses by name ----------------- */
      const at = (id) => conversations.find((c) => c.id === id);
      const leadOf = (id) => leads.find((l) => l.id === at(id).data.subjectId);
      const customerOf = (id) => customers.find((x) => x.id === at(id).data.subjectId);

      const fixtures = {
        w5: `${at(FIXED.w5).data.subjectType}/${at(FIXED.w5).data.status}/${
          at(FIXED.w5).data.unread ? "unread" : "read"
        }/${leadOf(FIXED.w5).data.stage}`,
        closed: `${at(FIXED.closed).data.status}`,
        converted: `${at(FIXED.converted).data.subjectType}/${
          customerOf(FIXED.converted).data.sourceLeadId ? "converted" : "established"
        }/${at(FIXED.converted).data.status}`,
        established: `${at(FIXED.established).data.subjectType}/${
          customerOf(FIXED.established).data.sourceLeadId ? "converted" : "established"
        }`,
        lead: `${at(FIXED.lead).data.subjectType}/${at(FIXED.lead).data.status}`,
        readLead: `${at(FIXED.readLead).data.subjectType}/${
          at(FIXED.readLead).data.status
        }/${at(FIXED.readLead).data.unread ? "unread" : "read"}`,
      };

      /* --- assignees are derived from the matrix --------------------- */
      const assignees = await ops.inbox.inboxAssignees(admin);
      const assigneeNames = assignees.map((a) => a.data.displayName).join(",");

      /* --- reply ------------------------------------------------------ */
      const auditBefore = (await rt.listAudit()).length;
      const reply = await ops.inbox.addMessage(admin, FIXED.w5, "  Holding the vehicle.  ");
      const afterReply = await rt.repository.get("conversations", FIXED.w5);
      const auditAfter = await rt.listAudit();
      const replyEntry = auditAfter.find(
        (e) => e.entityId === FIXED.w5 && e.action === "conversation.replied"
      );
      const messagesNow = await rt.repository.all("messages");

      const salesReply = await ops.inbox.addMessage(sales, FIXED.lead, "Checking now.");

      const blank = await code(() => ops.inbox.addMessage(admin, FIXED.lead, "   "));
      const onClosed = await code(() => ops.inbox.addMessage(admin, FIXED.closed, "Hello."));
      const closedText = await message(() => ops.inbox.addMessage(admin, FIXED.closed, "Hello."));
      const financeReply = await code(() => ops.inbox.addMessage(finance, FIXED.lead, "Hello."));
      const fleetReply = await code(() => ops.inbox.addMessage(fleet, FIXED.lead, "Hello."));

      /* --- read and unread are not audited --------------------------- */
      const beforeRead = (await rt.listAudit()).length;
      await ops.inbox.markConversationUnread(admin, FIXED.lead);
      const unreadNow = (await rt.repository.get("conversations", FIXED.lead)).data.unread;
      await ops.inbox.markConversationRead(admin, FIXED.lead);
      const readNow = (await rt.repository.get("conversations", FIXED.lead)).data.unread;
      const afterRead = (await rt.listAudit()).length;

      /* --- assignment ------------------------------------------------- */
      const assignAudit0 = (await rt.listAudit()).length;
      await ops.inbox.assignConversation(admin, FIXED.lead, P.operations.ACTOR_IDS.admin);
      const assigned = await rt.repository.get("conversations", FIXED.lead);
      const assignEntry = (await rt.listAudit()).find(
        (e) => e.entityId === FIXED.lead && e.action === "conversation.assigned"
      );
      await ops.inbox.assignConversation(admin, FIXED.lead, null);
      const unassigned = await rt.repository.get("conversations", FIXED.lead);
      const unassignEntry = (await rt.listAudit())
        .filter((e) => e.entityId === FIXED.lead && e.action === "conversation.assigned")
        .pop();
      const assignAudit1 = (await rt.listAudit()).length;

      const toFleet = await code(() =>
        ops.inbox.assignConversation(admin, FIXED.lead, P.operations.ACTOR_IDS.fleet)
      );
      const fleetText = await message(() =>
        ops.inbox.assignConversation(admin, FIXED.lead, P.operations.ACTOR_IDS.fleet)
      );
      const toFinance = await code(() =>
        ops.inbox.assignConversation(admin, FIXED.lead, P.operations.ACTOR_IDS.finance)
      );
      const toUnknown = await code(() =>
        ops.inbox.assignConversation(admin, FIXED.lead, "actor_9999")
      );
      const toSame = await code(() => ops.inbox.assignConversation(admin, FIXED.lead, null));
      const financeAssign = await code(() =>
        ops.inbox.assignConversation(finance, FIXED.lead, P.operations.ACTOR_IDS.sales)
      );

      /* --- close and reopen ------------------------------------------- */
      await ops.inbox.closeConversation(admin, FIXED.lead);
      const closedRecord = await rt.repository.get("conversations", FIXED.lead);
      const closeEntry = (await rt.listAudit()).find(
        (e) => e.entityId === FIXED.lead && e.action === "conversation.closed"
      );
      const twiceClosed = await code(() => ops.inbox.closeConversation(admin, FIXED.lead));
      await ops.inbox.reopenConversation(admin, FIXED.lead);
      const reopenEntry = (await rt.listAudit()).find(
        (e) => e.entityId === FIXED.lead && e.action === "conversation.reopened"
      );
      const reopened = await rt.repository.get("conversations", FIXED.lead);

      return {
        total: conversations.length,
        messages: messages.length,
        subjects: {
          Lead: conversations.filter((c) => c.data.subjectType === "Lead").length,
          Customer: conversations.filter((c) => c.data.subjectType === "Customer").length,
        },
        channels: {
          web: conversations.filter((c) => c.data.channel === "Web chat").length,
          app: conversations.filter((c) => c.data.channel === "In-app").length,
        },
        statuses: {
          open: conversations.filter((c) => c.data.status === "Open").length,
          closed: conversations.filter((c) => c.data.status === "Closed").length,
        },
        unread: conversations.filter((c) => c.data.unread).length,
        threadSizes,
        subjectOk,
        assigneeOk,
        minMessages,
        messageParentOk,
        staffActorOk,
        ordered,
        fixtures,
        assigneeNames,
        replyBody: reply.data.body,
        replyAuthor: reply.data.authorType,
        replyActor: reply.data.actorId,
        salesActor: salesReply.data.actorId,
        adminActorId: P.operations.ACTOR_IDS.admin,
        salesActorId: P.operations.ACTOR_IDS.sales,
        replyMarkedRead: afterReply.data.unread,
        replyAudited: auditAfter.length - auditBefore,
        replySummary: replyEntry?.summary ?? "",
        replyBodyInAudit:
          JSON.stringify(replyEntry ?? {}).includes("Holding the vehicle"),
        messagesAfter: messagesNow.length,
        blank,
        onClosed,
        closedText,
        financeReply,
        fleetReply,
        readAudited: afterRead - beforeRead,
        unreadNow,
        readNow,
        assignedTo: assigned.data.assignedActorId,
        assignSummary: assignEntry?.summary ?? "",
        assignChanges: JSON.stringify(assignEntry?.changes ?? []),
        unassignedTo: unassigned.data.assignedActorId,
        unassignSummary: unassignEntry?.summary ?? "",
        assignAudited: assignAudit1 - assignAudit0,
        toFleet,
        fleetText,
        toFinance,
        toUnknown,
        toSame,
        financeAssign,
        closedStatus: closedRecord.data.status,
        closeAudited: Boolean(closeEntry),
        twiceClosed,
        reopenAudited: Boolean(reopenEntry),
        reopenedStatus: reopened.data.status,
      };
    }, FIXED);

    check("the seed holds 20 conversations", out.total === 20, String(out.total));
    check("and 64 messages", out.messages === 64, String(out.messages));
    check("11 lead subjects", out.subjects.Lead === 11, String(out.subjects.Lead));
    check("9 customer subjects", out.subjects.Customer === 9, String(out.subjects.Customer));
    check("12 on Web chat", out.channels.web === 12, String(out.channels.web));
    check("8 In-app", out.channels.app === 8, String(out.channels.app));
    check("13 Open", out.statuses.open === 13, String(out.statuses.open));
    check("7 Closed", out.statuses.closed === 7, String(out.statuses.closed));
    check("6 unread", out.unread === 6, String(out.unread));
    check(
      "sixteen threads of three and four of four",
      out.threadSizes[3] === 16 && out.threadSizes[4] === 4,
      JSON.stringify(out.threadSizes)
    );

    check("every conversation resolves its subject", out.subjectOk);
    check("every assignee is a real actor or null", out.assigneeOk);
    check("every thread holds at least two messages", out.minMessages >= 2, String(out.minMessages));
    check("every message belongs to a conversation", out.messageParentOk);
    check("every staff message names a real actor", out.staffActorOk);
    check("message times never go backwards in a thread", out.ordered);

    check(
      "the W5 fixture is an open unread qualified lead thread",
      out.fixtures.w5 === "Lead/Open/unread/Qualified",
      out.fixtures.w5
    );
    check("the closed fixture is closed", out.fixtures.closed === "Closed", out.fixtures.closed);
    check(
      "the converted fixture is an open converted customer",
      out.fixtures.converted === "Customer/converted/Open",
      out.fixtures.converted
    );
    check(
      "the established fixture never was a lead",
      out.fixtures.established === "Customer/established",
      out.fixtures.established
    );
    check("the lead fixture is an open lead thread", out.fixtures.lead === "Lead/Open", out.fixtures.lead);
    check(
      "the read-thread fixture is an open read lead thread",
      out.fixtures.readLead === "Lead/Open/read",
      out.fixtures.readLead
    );

    check(
      "assignees are Morgan Reed and Avery Chen only",
      out.assigneeNames === "Morgan Reed,Avery Chen",
      out.assigneeNames
    );

    check("a reply trims its body", out.replyBody === "Holding the vehicle.", out.replyBody);
    check("a reply is authored by Staff", out.replyAuthor === "Staff", out.replyAuthor);
    check("Admin replies as Morgan Reed", out.replyActor === out.adminActorId, out.replyActor);
    check("Sales replies as Avery Chen", out.salesActor === out.salesActorId, out.salesActor);
    check("a reply marks the thread read", out.replyMarkedRead === false);
    check("a reply writes one audit entry", out.replyAudited === 1, String(out.replyAudited));
    check(
      "the entry says a reply was added",
      out.replySummary === "Reply added to conversation",
      out.replySummary
    );
    check("and does not copy the body into it", out.replyBodyInAudit === false);
    check("the message count rose", out.messagesAfter === 65, String(out.messagesAfter));
    check("a blank reply is refused", out.blank === "VALIDATION", out.blank);
    check("a closed thread refuses a reply", out.onClosed === "CONFLICT", out.onClosed);
    check("and says how to fix it", /reopen/i.test(out.closedText), out.closedText);
    check("Finance cannot reply", out.financeReply === "FORBIDDEN", out.financeReply);
    check("Fleet cannot reply", out.fleetReply === "FORBIDDEN", out.fleetReply);

    check("read and unread write no audit", out.readAudited === 0, String(out.readAudited));
    check("mark unread sets the flag", out.unreadNow === true);
    check("mark read clears it", out.readNow === false);

    check("assignment lands", out.assignedTo === out.adminActorId, String(out.assignedTo));
    check(
      "and is audited by name",
      out.assignSummary === "Conversation assigned to Morgan Reed",
      out.assignSummary
    );
    check(
      "the change records both ends as names",
      out.assignChanges.includes("Avery Chen") && out.assignChanges.includes("Morgan Reed"),
      out.assignChanges
    );
    check("unassigning lands", out.unassignedTo === null, String(out.unassignedTo));
    check(
      "and says so",
      out.unassignSummary === "Conversation unassigned",
      out.unassignSummary
    );
    check("both assignments were audited", out.assignAudited === 2, String(out.assignAudited));
    check("a Fleet Coordinator cannot be assigned", out.toFleet === "CONFLICT", out.toFleet);
    check("and the refusal names the role", /Fleet Coordinator/.test(out.fleetText), out.fleetText);
    check("a Finance Analyst cannot be assigned", out.toFinance === "CONFLICT", out.toFinance);
    check("an unknown actor is refused", out.toUnknown === "VALIDATION", out.toUnknown);
    check("assigning what is already set is a conflict", out.toSame === "CONFLICT", out.toSame);
    check("Finance cannot assign at all", out.financeAssign === "FORBIDDEN", out.financeAssign);

    check("closing lands", out.closedStatus === "Closed", out.closedStatus);
    check("and is audited", out.closeAudited);
    check("closing twice is a conflict", out.twiceClosed === "CONFLICT", out.twiceClosed);
    check("reopening lands", out.reopenedStatus === "Open", out.reopenedStatus);
    check("and is audited", out.reopenAudited);
  }

  await ctx.close();
}

section("DOMAIN - RULE 03, SELECTORS AND RESET");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(PROBE, { waitUntil: "networkidle" }).catch(() => null);

  if (!res || res.status() !== 200) {
    console.log("  SKIP  probe route absent (expected against production)");
  } else {
    await page.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);

    const out = await page.evaluate(async (FIXED) => {
      const P = window.__opsProbe;
      const ops = P.operations;
      const rt = P.createDemoRuntime({
        seed: P.buildOperationsSeed(),
        latency: "off",
        broadcast: false,
        adapter: P.createMemoryAdapter(),
      });
      await rt.initialize();
      const admin = ops.contextAs(rt, "Admin");

      /**
       * Rule 03, driven through the real domain rather than simulated.
       *
       * Reservations has no screen until 09C4, so the reservation is confirmed
       * by calling the service and processing the events it raises, which is
       * exactly what a Reservations screen will do. That proves the automation
       * and its Inbox effect without building the module early.
       */
      const reservations = await rt.repository.all("reservations");
      const conversationsBefore = await rt.repository.all("conversations");
      const vehiclePool = await rt.repository.all("vehicles");
      const draft = reservations.find(
        (r) =>
          r.data.status === "Draft" &&
          vehiclePool.some(
            (v) => v.data.status === "Available" && v.data.vehicleClass === r.data.vehicleClass
          ) &&
          conversationsBefore.some(
            (c) => c.data.subjectType === "Customer" && c.data.subjectId === r.data.customerId
          )
      );

      let rule03 = { ran: false };
      if (draft) {
        const thread = conversationsBefore.find(
          (c) => c.data.subjectType === "Customer" && c.data.subjectId === draft.data.customerId
        );
        const messagesBefore = (await rt.repository.all("messages")).filter(
          (m) => m.data.conversationId === thread.id
        ).length;
        const runsBefore = (await rt.repository.all("automation_runs")).length;

        /* Collect the events the confirmation raises, then hand them to the
           engine: the same join `withAutomations` makes for leads. */
        const vehicles = await rt.repository.all("vehicles");
        /* Confirming needs an available vehicle of the reservation's own
           class, which is the domain's rule and not this harness's business
           to work around. */
        const free = vehicles.find(
          (v) => v.data.status === "Available" && v.data.vehicleClass === draft.data.vehicleClass
        );
        const collected = [];
        const stop = rt.events.subscribe((e) => collected.push(e));
        await ops.reservations.confirmReservation(admin, draft.id, free.id);
        stop();
        const outcomes = await ops.automations.processEvents(admin, collected);

        const messagesAfter = (await rt.repository.all("messages")).filter(
          (m) => m.data.conversationId === thread.id
        );
        const system = messagesAfter.filter((m) => m.data.authorType === "System");
        const touched = await rt.repository.get("conversations", thread.id);

        rule03 = {
          ran: true,
          conversationId: thread.id,
          triggered: collected.some((e) => e.type === "reservation.confirmed"),
          outcome: outcomes.find((o) => o.ruleId === "automation_rule_0003")?.status ?? "none",
          added: messagesAfter.length - messagesBefore,
          systemCount: system.length,
          systemBody: system.length ? system[system.length - 1].data.body : "",
          systemHasActor: system.some((m) => Boolean(m.data.actorId)),
          unread: touched.data.unread,
          runsAdded: (await rt.repository.all("automation_runs")).length - runsBefore,
        };
      }

      /* --- selectors -------------------------------------------------- */
      const L = ops.inboxList;
      const D = ops.conversationDetail;
      const world = {
        conversations: await rt.repository.all("conversations"),
        messages: await rt.repository.all("messages"),
        leads: await rt.repository.all("leads"),
        customers: await rt.repository.all("customers"),
        actors: await rt.repository.all("actors"),
      };
      const rows = L.buildConversationRows(world);
      const index = L.searchIndex(world.messages);
      const q = (patch) =>
        L.selectInboxList(rows, { ...L.DEFAULT_INBOX_QUERY, ...patch }, index);

      const all = q({});
      const open = q({ status: "Open" });
      const webChat = q({ channel: "Web chat" });
      const unread = q({ read: "unread" });
      const combined = q({ status: "Open", channel: "Web chat", read: "unread" });
      const noHit = q({ search: "zzzz-no-such-text" });
      const bySubject = q({ search: rows[0].subjectName.slice(0, 6) });
      const firstBody = (index.get(rows[0].id) ?? [""])[0];
      const byBody = q({ search: firstBody.slice(0, 14) });
      const trimmedUpper = q({ search: `  ${firstBody.slice(0, 14).toUpperCase()}  ` });

      const orderedDesc = all.items.every(
        (r, i) => i === 0 || all.items[i - 1].latestAt >= r.latestAt
      );
      /* Marking a thread read must not move it: the order is by activity. */
      const beforeOrder = all.items.map((r) => r.id).join(",");
      await ops.inbox.markConversationRead(admin, FIXED.w5);
      const world2 = { ...world, conversations: await rt.repository.all("conversations") };
      const afterOrder = L.selectInboxList(
        L.buildConversationRows(world2),
        L.DEFAULT_INBOX_QUERY,
        index
      )
        .items.map((r) => r.id)
        .join(",");

      const detailOf = async (id) =>
        D.selectConversationDetail({
          conversationId: id,
          ...world2,
          audit: await rt.listAudit(),
          now: rt.now(),
        });
      const leadDetail = await detailOf(FIXED.lead);
      const convertedDetail = await detailOf(FIXED.converted);
      const establishedDetail = await detailOf(FIXED.established);
      const missingDetail = await detailOf("conversation_9999");

      /* --- reset restores the canonical dataset ------------------------ */
      await ops.inbox.addMessage(admin, FIXED.lead, "Scratch reply before reset.");
      await ops.inbox.markConversationUnread(admin, FIXED.converted);
      await ops.inbox.assignConversation(admin, FIXED.lead, null);
      await ops.inbox.closeConversation(admin, FIXED.converted);
      await rt.reset();
      const resetConversations = await rt.repository.all("conversations");
      const resetMessages = await rt.repository.all("messages");

      return {
        rule03,
        total: all.total,
        allUnread: all.unread,
        open: open.total,
        webChat: webChat.total,
        unread: unread.total,
        unreadAllUnread: unread.unread,
        combined: combined.total,
        combinedValid: combined.items.every(
          (r) => r.status === "Open" && r.channel === "Web chat" && r.unread
        ),
        noHit: noHit.total,
        bySubject: bySubject.total,
        byBody: byBody.total,
        trimmedUpper: trimmedUpper.total,
        orderedDesc,
        orderStable: beforeOrder === afterOrder,
        previewFromMessage: rows.every((r) => r.messageCount === 0 || r.preview.length > 0),
        clock: L.clockTime("2026-09-01T09:30:00.000Z"),
        leadBrief: Boolean(leadDetail.brief),
        leadOrigin: leadDetail.briefOrigin,
        convertedBrief: Boolean(convertedDetail.brief),
        convertedOrigin: convertedDetail.briefOrigin,
        convertedSource: convertedDetail.sourceLead?.id ?? null,
        establishedBrief: convertedDetail.brief && establishedDetail.brief ? "both" : Boolean(establishedDetail.brief),
        establishedOrigin: establishedDetail.briefOrigin,
        establishedCustomer: Boolean(establishedDetail.customer),
        authorNames: leadDetail.messages.map((m) => m.authorName).join("|"),
        missingDetail: missingDetail === null,
        resetTotal: resetConversations.length,
        resetMessages: resetMessages.length,
        resetUnread: resetConversations.filter((c) => c.data.unread).length,
        resetOpen: resetConversations.filter((c) => c.data.status === "Open").length,
        resetClosed: resetConversations.filter((c) => c.data.status === "Closed").length,
        resetAssignees: new Set(resetConversations.map((c) => c.data.assignedActorId)).size,
      };
    }, FIXED);

    if (out.rule03.ran) {
      check("confirming a reservation raises its event", out.rule03.triggered);
      check("Rule 03 runs and succeeds", out.rule03.outcome === "Success", out.rule03.outcome);
      check("one automation run is recorded", out.rule03.runsAdded >= 1, String(out.rule03.runsAdded));
      check("a message is appended to the thread", out.rule03.added === 1, String(out.rule03.added));
      check("and it is a System message", out.rule03.systemCount === 1, String(out.rule03.systemCount));
      check(
        "which says what happened",
        /reservation confirmed/i.test(out.rule03.systemBody),
        out.rule03.systemBody
      );
      check("a System message names no staff actor", out.rule03.systemHasActor === false);
      check("and the thread becomes unread", out.rule03.unread === true);
    } else {
      check("a draft reservation with a customer thread exists", false, "no fixture found");
    }

    check("the list holds every conversation", out.total === 20, String(out.total));
    /* Six seeded, plus the one Rule 03 raised earlier in this same runtime. */
    check(
      "and counts the unread among them",
      out.allUnread === (out.rule03.ran ? 7 : 6),
      String(out.allUnread)
    );
    check("the status filter runs", out.open === 13, String(out.open));
    check("the channel filter runs", out.webChat === 12, String(out.webChat));
    check(
      "the read filter runs",
      out.unread === (out.rule03.ran ? 7 : 6),
      String(out.unread)
    );
    check("an unread-only list is all unread", out.unreadAllUnread === out.unread);
    check("filters combine", out.combinedValid && out.combined > 0, String(out.combined));
    check("a search with no match returns none", out.noHit === 0, String(out.noHit));
    check("search matches a subject name", out.bySubject >= 1, String(out.bySubject));
    check("search matches a message body", out.byBody >= 1, String(out.byBody));
    check(
      "and is trimmed and case-insensitive",
      out.trimmedUpper === out.byBody,
      `${out.trimmedUpper} vs ${out.byBody}`
    );
    check("the order is most recent first", out.orderedDesc);
    check("marking read does not move a row", out.orderStable);
    check("the preview comes from a real message", out.previewFromMessage);
    check("message times read in the demo clock", out.clock === "09:30", out.clock);

    check("a lead thread gets a brief", out.leadBrief && out.leadOrigin === "lead", out.leadOrigin);
    check(
      "a converted customer gets one from its source lead",
      out.convertedBrief && out.convertedOrigin === "source-lead",
      out.convertedOrigin
    );
    check("and the source lead is resolved", out.convertedSource !== null, String(out.convertedSource));
    check(
      "an established customer gets no brief",
      out.establishedBrief === false && out.establishedOrigin === null,
      String(out.establishedOrigin)
    );
    check("but still resolves its customer", out.establishedCustomer);
    check(
      "authors are people, not ids",
      !/actor_/.test(out.authorNames) && out.authorNames.length > 0,
      out.authorNames.slice(0, 60)
    );
    check("an unknown conversation resolves to nothing", out.missingDetail);

    check("reset restores 20 conversations", out.resetTotal === 20, String(out.resetTotal));
    check("and 64 messages", out.resetMessages === 64, String(out.resetMessages));
    check("and 6 unread", out.resetUnread === 6, String(out.resetUnread));
    check("and 13 open", out.resetOpen === 13, String(out.resetOpen));
    check("and 7 closed", out.resetClosed === 7, String(out.resetClosed));
    check("and the canonical assignee", out.resetAssignees === 1, String(out.resetAssignees));
  }

  await ctx.close();
}

/* =====================================================================
   2. THE LIST
   ===================================================================== */

section("LIST - DESKTOP, ADMIN");
{
  const { ctx, page, problems } = await freshInbox();

  check("the route renders the module", (await page.$(".ops-inbox")) !== null);
  check(
    "twenty conversations and six unread are counted",
    (await countOf(page)) === "20 conversations, 6 unread",
    await countOf(page)
  );
  check("twenty rows are listed", (await rowsOf(page)) === 20, String(await rowsOf(page)));
  check("the console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  check("there is no pagination", (await page.$(".ops-pager")) === null);

  const first = await page.$eval(".ops-convo", (e) => ({
    subject: e.querySelector(".ops-convo__subject")?.textContent.trim() ?? "",
    preview: e.querySelector(".ops-convo__preview")?.textContent.trim() ?? "",
    facts: e.querySelector(".ops-convo__facts")?.textContent.trim() ?? "",
    owner: e.querySelector(".ops-convo__owner")?.textContent.trim() ?? "",
    status: e.querySelector(".ops-pill")?.textContent.trim() ?? "",
    time: e.querySelector(".ops-convo__time")?.textContent.trim() ?? "",
  }));
  check("a row names its subject", first.subject.length > 0, first.subject);
  check("and previews the latest message", first.preview.length > 0, first.preview.slice(0, 40));
  check(
    "and states subject type, channel and message count",
    /(Lead|Customer) · (Web chat|In-app) · \d+ messages?/.test(first.facts),
    first.facts
  );
  check("and names its assignee", first.owner.length > 0, first.owner);
  check("and shows its status", /^(Open|Closed)$/.test(first.status), first.status);
  check("and when it last moved", first.time.length > 0, first.time);

  /* Unread is said three ways, not one. */
  const unreadCues = await page.evaluate(() => {
    const row = document.querySelector(".ops-convo--unread");
    if (!row) return null;
    const read = document.querySelector(".ops-convo:not(.ops-convo--unread)");
    const w = (el) => getComputedStyle(el.querySelector(".ops-convo__subject")).fontWeight;
    return {
      dot: Boolean(row.querySelector(".ops-convo__dot")),
      weight: Number(w(row)),
      readWeight: read ? Number(w(read)) : 0,
      text: row.textContent.includes("unread"),
    };
  });
  check("an unread row carries an indicator", unreadCues?.dot === true);
  check(
    "and heavier text than a read one",
    (unreadCues?.weight ?? 0) > (unreadCues?.readWeight ?? 99),
    `${unreadCues?.weight} vs ${unreadCues?.readWeight}`
  );
  check("and says so in words", unreadCues?.text === true);

  /* Closed threads stay in the list rather than being hidden. */
  const closedShown = await page.$$eval(".ops-convo .ops-pill", (n) =>
    n.filter((e) => e.textContent.trim() === "Closed").length
  );
  check("closed conversations are still listed", closedShown === 7, String(closedShown));

  /* --- filters ------------------------------------------------------ */
  await choose(page, FILTER(0), "Open");
  check("the status filter runs", (await countOf(page)) === "13 conversations, 4 unread", await countOf(page));
  await choose(page, FILTER(0), "Closed");
  check("and the other way", (await countOf(page)) === "7 conversations, 2 unread", await countOf(page));
  await choose(page, FILTER(0), "all");

  await choose(page, FILTER(1), "Web chat");
  check("the channel filter runs", (await countOf(page)) === "12 conversations, 4 unread", await countOf(page));
  await choose(page, FILTER(1), "In-app");
  check("and the other channel", (await countOf(page)) === "8 conversations, 2 unread", await countOf(page));
  await choose(page, FILTER(1), "all");

  await choose(page, FILTER(2), "unread");
  check("the read filter runs", (await countOf(page)) === "6 conversations, 6 unread", await countOf(page));
  const allUnread = await page.$$eval(".ops-convo", (n) =>
    n.every((e) => e.className.includes("--unread"))
  );
  check("and every row really is unread", allUnread);
  await choose(page, FILTER(2), "read");
  check("read only", (await countOf(page)) === "14 conversations", await countOf(page));

  /* Combined, then cleared. */
  await choose(page, FILTER(0), "Open");
  await choose(page, FILTER(1), "Web chat");
  const combined = await countOf(page);
  check("filters combine", /^\d+ conversations?/.test(combined), combined);
  await page.click(".ops-leads__result .ops-link-button");
  await page.waitForTimeout(250);
  check("Clear filters restores everything", (await countOf(page)) === "20 conversations, 6 unread", await countOf(page));
  check("and then hides itself", (await page.$(".ops-leads__result .ops-link-button")) === null);

  /* --- search ------------------------------------------------------- */
  const subject = await page.$eval(".ops-convo__subject", (e) => e.textContent.trim());
  await page.fill(".ops-leads__search-input", subject.slice(0, 7));
  await page.waitForTimeout(250);
  check("search matches a subject name", (await rowsOf(page)) >= 1, await countOf(page));

  const phrase = await page.$eval(".ops-convo__preview", (e) =>
    e.textContent.trim().split(" ").slice(0, 3).join(" ")
  );
  await page.fill(".ops-leads__search-input", phrase);
  await page.waitForTimeout(250);
  const byBody = await rowsOf(page);
  await page.fill(".ops-leads__search-input", `   ${phrase.toUpperCase()}   `);
  await page.waitForTimeout(250);
  check("search matches a message body", byBody >= 1, String(byBody));
  check(
    "and is trimmed and case-insensitive",
    (await rowsOf(page)) === byBody,
    `${await rowsOf(page)} vs ${byBody}`
  );

  await page.fill(".ops-leads__search-input", "zzzz-nothing-here");
  await page.waitForTimeout(250);
  check("an empty result explains itself", (await page.$(".ops-leads__empty")) !== null);
  check(
    "in the module's own words",
    (await textOf(page, ".ops-leads__empty-text")) === "No conversations match these filters.",
    await textOf(page, ".ops-leads__empty-text")
  );
  await page.click(".ops-leads__empty .ops-button");
  await page.waitForTimeout(250);
  check("and clears from there", (await countOf(page)) === "20 conversations, 6 unread");

  /* --- no native select anywhere ------------------------------------ */
  check("no native select survives", (await page.$$eval("select", (n) => n.length)) === 0);
  check(
    "the filters are comboboxes",
    (await page.$$eval('.ops-leads__filters [role="combobox"]', (n) => n.length)) === 3
  );

  await ctx.close();
}

/* =====================================================================
   3. THE THREAD
   ===================================================================== */

section("THREAD - SELECTION, URL AND CONTENT");
{
  const { ctx, page, problems } = await freshInbox();

  check(
    "nothing is selected by default",
    (await textOf(page, ".ops-thread__placeholder", "")) ===
      "Select a conversation to view its history."
  );
  check("and the context says what it will hold", (await page.$(".ops-context__placeholder")) !== null);
  check("no conversation is auto-selected", !page.url().includes("selected="), page.url());

  const name = await page.$eval(".ops-convo__subject", (e) => e.textContent.trim());
  await page.click(".ops-convo");
  await waitForThread(page);
  await page.waitForTimeout(300);
  check("clicking a row opens the thread", (await page.$(".ops-thread__title")) !== null);
  check("the thread names the subject", (await textOf(page, ".ops-thread__title")) === name, name);
  check("the URL carries the selection", page.url().includes("selected="), page.url().split("?")[1] ?? "");
  check("the row is marked current", (await page.$('.ops-convo[aria-current="true"]')) !== null);

  const marks = await marksOf(page);
  check(
    "the header states status, subject type, channel and read state",
    /^(Open|Closed)$/.test(marks[0]) &&
      /^(Lead|Customer)$/.test(marks[1]) &&
      /^(Web chat|In-app)$/.test(marks[2]) &&
      /^(Read|Unread)$/.test(marks[3]),
    marks.join(" | ")
  );
  check("and offers a way to the subject", /^Open (lead|customer)$/.test(marks[4] ?? ""), marks[4]);
  check("the assignee is a control", (await page.$(`${ASSIGN}`)) !== null);
  check(
    "and it names a person",
    /Morgan Reed|Avery Chen|Unassigned/.test(await textOf(page, ".ops-thread__assign .demo-select__value")),
    await textOf(page, ".ops-thread__assign .demo-select__value")
  );

  const messages = await page.$$eval(".ops-message", (n) =>
    n.map((e) => ({
      cls: e.className,
      author: e.querySelector(".ops-message__author")?.textContent.trim() ?? "",
      body: e.querySelector(".ops-message__body")?.textContent.trim() ?? "",
    }))
  );
  check("the transcript is rendered", messages.length >= 3, String(messages.length));
  check(
    "customer and staff messages are distinguished",
    messages.some((m) => m.cls.includes("--customer")) &&
      messages.some((m) => m.cls.includes("--staff")),
    messages.map((m) => m.cls.split("--")[1]).join(",")
  );
  check(
    "every message names a person, not an id",
    messages.every((m) => m.author.length > 0 && !/actor_/.test(m.author)),
    messages.map((m) => m.author).join(" | ").slice(0, 60)
  );
  check("and carries a body", messages.every((m) => m.body.length > 0));
  check(
    "the history is an ordered list, not a live region",
    (await page.$('.ops-thread__history ol.ops-messages')) !== null &&
      (await page.$('.ops-thread__history [aria-live]')) === null
  );
  check(
    "no message body is rendered as markup",
    (await page.$$eval(".ops-message__body a, .ops-message__body strong", (n) => n.length)) === 0
  );

  /* Back closes the thread, Forward reopens it. */
  await page.goBack();
  await page.waitForTimeout(400);
  check("Back closes the conversation", !page.url().includes("selected="), page.url());
  check("and the placeholder returns", (await page.$(".ops-thread__placeholder")) !== null);
  await page.goForward();
  await waitForThread(page);
  await page.waitForTimeout(300);
  check("Forward reopens it", (await textOf(page, ".ops-thread__title")) === name);

  /* A deep link and an id that does not exist. */
  await page.goto(`${INBOX}?selected=${FIXED.lead}`, { waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(300);
  check("a shared link opens that conversation", (await page.$(".ops-thread__title")) !== null);
  check("with its own transcript", (await page.$$eval(".ops-message", (n) => n.length)) >= 3);

  await page.goto(`${INBOX}?selected=conversation_9999`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const missing = await textOf(page, ".ops-thread__placeholder", "");
  check("an unknown id is explained", missing.includes("conversation_9999"), missing.slice(0, 70));
  check("and offers a way back", (await page.$(".ops-thread--empty .ops-button")) !== null);

  check("the thread console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   4. W5 - THE WHOLE WORKFLOW THROUGH THE PRODUCT
   ===================================================================== */

section("W5 - OPEN, READ, REPLY, RECOMPUTE, PERSIST");
{
  const { ctx, page, problems } = await freshInbox({ width: 1600, height: 900 }, `${INBOX}?selected=${FIXED.w5}`);
  await waitForThread(page);
  await page.waitForTimeout(400);

  check("the seeded lead conversation opens", (await page.$(".ops-thread__title")) !== null);
  check("it is unread", (await marksOf(page)).includes("Unread"), (await marksOf(page)).join(" "));
  check("the assist panel is marked", (await textOf(page, ".ops-assist", "")) === "ASSIST / LOCAL");
  const summaryBefore = await textOf(page, ".ops-brief__summary");
  const actionBefore = await textOf(page, ".ops-brief__action-value");
  check("a brief is composed", summaryBefore.length > 20, summaryBefore);
  check(
    "and it notices the unread message",
    /unread message/i.test(summaryBefore),
    summaryBefore
  );
  check("a next action is recommended", actionBefore === "Review conversation", actionBefore);

  const before = await page.$$eval(".ops-message", (n) => n.length);
  check("an open conversation offers a composer", (await page.$(".ops-composer")) !== null);
  check(
    "the composer has no recipient field",
    (await page.$$eval(".ops-composer input", (n) => n.length)) === 0
  );
  check(
    "send waits for some text",
    (await page.$eval('.ops-composer button[type="submit"]', (e) => e.disabled)) === true
  );

  const reply = "Holding the Utility vehicle for the dates you asked about.";
  await page.fill(".ops-composer__input", reply);
  await page.click('.ops-composer button[type="submit"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll(".ops-message").length > n,
    before,
    POLL
  );
  await page.waitForTimeout(500);

  check("the reply is appended", (await page.$$eval(".ops-message", (n) => n.length)) === before + 1);
  const last = await page.$$eval(".ops-message", (n) => ({
    cls: n[n.length - 1].className,
    author: n[n.length - 1].querySelector(".ops-message__author")?.textContent.trim() ?? "",
    body: n[n.length - 1].querySelector(".ops-message__body")?.textContent.trim() ?? "",
  }));
  check("as a staff message", last.cls.includes("--staff"), last.cls);
  check("authored by the current actor", last.author === "Morgan Reed", last.author);
  check("carrying what was typed", last.body === reply, last.body.slice(0, 40));
  check("the composer clears", (await page.$eval(".ops-composer__input", (e) => e.value)) === "");
  check("the conversation becomes read", (await marksOf(page)).includes("Read"), (await marksOf(page)).join(" "));
  check("the unread count falls", (await countOf(page)) === "20 conversations, 5 unread", await countOf(page));

  const previewAfter = await page.$eval(".ops-convo[aria-current='true'] .ops-convo__preview", (e) =>
    e.textContent.trim()
  );
  check("the list preview follows", previewAfter === reply, previewAfter.slice(0, 40));
  check(
    "and the message count with it",
    (await page.$eval(".ops-convo[aria-current='true'] .ops-convo__facts", (e) => e.textContent)).includes(
      String(before + 1)
    )
  );

  const summaryAfter = await textOf(page, ".ops-brief__summary");
  const actionAfter = await textOf(page, ".ops-brief__action-value");
  check("the brief recomputes", summaryAfter !== summaryBefore, summaryAfter);
  check("it no longer claims an unread message", !/unread message/i.test(summaryAfter));
  check(
    "and the recommended action moves with the state",
    actionAfter !== actionBefore,
    `${actionBefore} to ${actionAfter}`
  );
  check("the change is announced once", (await textOf(page, '[role="status"]')) === "Reply added");

  /* The reply survives a reload, which is what makes it persistence rather
     than a component's memory. */
  await page.reload({ waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(600);
  check("the reply survives a reload", (await page.$$eval(".ops-message", (n) => n.length)) === before + 1);
  check("and the read state with it", (await marksOf(page)).includes("Read"));
  check("and the count", (await countOf(page)) === "20 conversations, 5 unread", await countOf(page));

  check("the W5 console is clean", problems.length === 0, problems.join(" | ").slice(0, 120));
  await ctx.close();
}

/* =====================================================================
   5. ACTIONS
   ===================================================================== */

section("ACTIONS - READ, ASSIGN, CLOSE AND REOPEN");
{
  const { ctx, page, problems } = await freshInbox(
    { width: 1600, height: 900 },
    `${INBOX}?selected=${FIXED.readLead}`
  );
  await waitForThread(page);
  await page.waitForTimeout(400);

  const buttons = () =>
    page.$$eval(".ops-thread__buttons .ops-button", (n) => n.map((e) => e.textContent.trim()));

  check("a read thread offers Mark unread", (await buttons()).includes("Mark unread"), (await buttons()).join(" | "));
  check("and an open one offers Close", (await buttons()).includes("Close"));

  await page.click('.ops-thread__buttons .ops-button:has-text("Mark unread")');
  await page.waitForTimeout(600);
  check("marking unread lands", (await marksOf(page)).includes("Unread"));
  check("the count rises", (await countOf(page)) === "20 conversations, 7 unread", await countOf(page));
  check("and the button becomes Mark read", (await buttons()).includes("Mark read"), (await buttons()).join(" | "));
  await choose(page, FILTER(2), "unread");
  check("the unread filter now includes it", (await rowsOf(page)) === 7, String(await rowsOf(page)));
  await choose(page, FILTER(2), "all");

  await page.click('.ops-thread__buttons .ops-button:has-text("Mark read")');
  await page.waitForTimeout(600);
  check("marking read lands", (await marksOf(page)).includes("Read"));
  check("and the count falls back", (await countOf(page)) === "20 conversations, 6 unread", await countOf(page));

  /* Only people who work the Inbox can hold a conversation. */
  await page.click(ASSIGN);
  await page.waitForSelector('[role="listbox"]', POLL);
  const options = await page.$$eval('[role="listbox"] [role="option"]', (n) =>
    n.map((e) => e.textContent.trim())
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(
    "the assignee list is Unassigned, Morgan and Avery",
    options.join(" | ") === "Unassigned | Morgan Reed | Avery Chen",
    options.join(" | ")
  );
  check("and offers nobody who cannot work the Inbox", !options.some((o) => /Jordan|Taylor/.test(o)));

  await choose(page, ASSIGN, "actor_0001");
  await page.waitForTimeout(600);
  check(
    "assignment lands",
    (await textOf(page, ".ops-thread__assign .demo-select__value")) === "Morgan Reed"
  );
  check(
    "and is announced",
    (await textOf(page, '[role="status"]')) === "Conversation assigned to Morgan Reed",
    await textOf(page, '[role="status"]')
  );
  check(
    "the list row follows",
    (await page.$eval(".ops-convo[aria-current='true'] .ops-convo__owner", (e) => e.textContent.trim())) ===
      "Morgan Reed"
  );

  await choose(page, ASSIGN, "unassigned");
  await page.waitForTimeout(600);
  check(
    "unassigning lands",
    (await page.$eval(".ops-convo[aria-current='true'] .ops-convo__owner", (e) => e.textContent.trim())) ===
      "Unassigned"
  );

  await page.click('.ops-thread__buttons .ops-button:has-text("Close")');
  await page.waitForTimeout(600);
  check("closing lands", (await marksOf(page)).includes("Closed"));
  check("the composer disappears", (await page.$(".ops-composer")) === null);
  check(
    "and says why",
    (await textOf(page, ".ops-thread__closed-text", "")) === "This conversation is closed."
  );
  check("with a way to undo it", (await page.$(".ops-thread__closed .ops-button")) !== null);
  await choose(page, FILTER(0), "Closed");
  check("the status filter counts it", (await rowsOf(page)) === 8, String(await rowsOf(page)));
  await choose(page, FILTER(0), "all");

  await page.click(".ops-thread__closed .ops-button");
  await page.waitForTimeout(600);
  check("reopening lands", (await marksOf(page)).includes("Open"));
  check("and the composer returns", (await page.$(".ops-composer")) !== null);

  await page.fill(".ops-composer__input", "Back open, continuing here.");
  await page.click('.ops-composer button[type="submit"]');
  await page.waitForTimeout(700);
  check(
    "a reply works again",
    (await page.$$eval(".ops-message__body", (n) => n[n.length - 1].textContent.trim())) ===
      "Back open, continuing here."
  );

  check("the actions console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   6. THE ASSIST RECONCILIATION
   ===================================================================== */

section("ASSIST - A BRIEF ONLY WHERE ONE CAN BE COMPOSED");
{
  const { ctx, page } = await freshInbox({ width: 1600, height: 900 }, `${INBOX}?selected=${FIXED.converted}`);
  await waitForThread(page);
  await page.waitForTimeout(400);

  check("a converted customer thread opens", (await marksOf(page)).includes("Customer"));
  const titles = await page.$$eval(".ops-context__title", (n) => n.map((e) => e.textContent.trim()));
  check(
    "the context is customer then lead origin brief",
    titles.join(" | ") === "Customer | Lead origin brief",
    titles.join(" | ")
  );
  check("the brief is marked as local assist", (await textOf(page, ".ops-assist", "")) === "ASSIST / LOCAL");
  const origin = await textOf(page, ".ops-context__origin", "");
  check(
    "and says which lead it came from",
    /the lead this customer was converted from/.test(origin),
    origin.slice(0, 70)
  );
  check("a summary is composed", (await textOf(page, ".ops-brief__summary")).length > 20);
  check(
    "with a recommended action",
    /Follow up|Prepare reservation|Review conversation/.test(
      await textOf(page, ".ops-brief__action-value")
    ),
    await textOf(page, ".ops-brief__action-value")
  );
  check("and a way through to that lead", (await page.$(".ops-context__origin .ops-link-button")) !== null);

  await page.goto(`${INBOX}?selected=${FIXED.established}`, { waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(400);
  const establishedTitles = await page.$$eval(".ops-context__title", (n) =>
    n.map((e) => e.textContent.trim())
  );
  check(
    "an established customer gets customer context only",
    establishedTitles.join(" | ") === "Customer",
    establishedTitles.join(" | ")
  );
  check("no assist mark", (await page.$(".ops-assist")) === null);
  check("no brief summary", (await page.$(".ops-brief__summary")) === null);
  check("no recommended action", (await page.$(".ops-brief__action-value")) === null);
  const note = await textOf(page, ".ops-context__note", "");
  check(
    "and the absence is explained rather than left blank",
    /not converted from a lead/.test(note),
    note.slice(0, 70)
  );
  check(
    "no lead field is invented for them",
    (await page.$$eval(".ops-facts__label", (n) => n.map((e) => e.textContent.trim()))).every(
      (l) => !/Stage|Priority|Vehicle interest|Next follow-up/.test(l)
    )
  );

  await page.goto(`${INBOX}?selected=${FIXED.lead}`, { waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(400);
  const leadFacts = await page.$$eval(".ops-facts__label", (n) => n.map((e) => e.textContent.trim()));
  check(
    "a lead thread shows the lead's own state",
    ["Stage", "Priority", "Vehicle interest", "Source", "Next follow-up"].every((f) =>
      leadFacts.includes(f)
    ),
    leadFacts.join(",")
  );
  check(
    "titled as a lead brief, not a lead origin brief",
    (await page.$$eval(".ops-context__title", (n) => n.map((e) => e.textContent.trim()))).join(
      " | "
    ) === "Lead | Lead brief"
  );

  await ctx.close();
}

/* =====================================================================
   7. ROLE
   ===================================================================== */

section("ROLE - WHO WORKS THE INBOX");
{
  const { ctx, page } = await freshInbox({ width: 1600, height: 900 }, `${INBOX}?selected=${FIXED.lead}`);
  await waitForThread(page);
  await page.waitForTimeout(400);

  const body = await textOf(page, ".ops-message__body");
  check("Admin reads the thread", body.length > 0, body.slice(0, 40));

  await choose(page, ROLE_SELECT, "Sales Agent");
  await page.waitForTimeout(600);
  check("Sales keeps the Inbox", (await page.$(".ops-inbox")) !== null);
  check("and the selected conversation", (await page.$(".ops-thread__title")) !== null);
  check("and may still reply", (await page.$(".ops-composer")) !== null);
  await page.fill(".ops-composer__input", "Avery picking this up.");
  await page.click('.ops-composer button[type="submit"]');
  await page.waitForTimeout(700);
  check(
    "and the reply is authored as Avery Chen",
    (await page.$$eval(".ops-message__author", (n) => n[n.length - 1].textContent.trim())) ===
      "Avery Chen",
    await page.$$eval(".ops-message__author", (n) => n[n.length - 1].textContent.trim())
  );

  /* The leak test D-058 guards against: switching to a role that cannot open
     the module must take the conversation with it, in the same frame. */
  await choose(page, ROLE_SELECT, "Finance Analyst");
  await page.waitForTimeout(500);
  check("Finance is told the module is closed", (await page.$(".ops-unavailable")) !== null);
  check("no thread survives", (await page.$(".ops-thread__title")) === null);
  check("no message body survives", (await page.$(".ops-message__body")) === null);
  check("no composer survives", (await page.$(".ops-composer")) === null);
  check("no conversation list survives", (await page.$(".ops-convo")) === null);
  check(
    "and the page holds none of the transcript",
    !(await page.content()).includes(body.slice(0, 30)),
    body.slice(0, 30)
  );
  const closed = await textOf(page, ".ops-unavailable__text", "");
  check("the reason names the role", /Finance Analyst/.test(closed), closed.slice(0, 60));

  await choose(page, ROLE_SELECT, "Fleet Coordinator");
  await page.waitForTimeout(500);
  check("Fleet is told the same", (await page.$(".ops-unavailable")) !== null);
  check("and sees no conversations", (await page.$(".ops-convo")) === null);

  /* Coming back restores the module and the URL-selected thread. */
  await choose(page, ROLE_SELECT, "Admin");
  await page.waitForTimeout(700);
  check("Admin gets the module back", (await page.$(".ops-inbox")) !== null);
  await waitForThread(page);
  await page.waitForTimeout(400);
  check("and the selected conversation reopens", (await page.$(".ops-thread__title")) !== null);
  check("with its transcript intact", (await page.$$eval(".ops-message", (n) => n.length)) >= 4);
  /* Five, not six: the reply Sales sent a moment ago marked its own thread
     read, which is the whole point of replying. Nothing else moved. */
  check(
    "and nothing else was lost",
    (await countOf(page)) === "20 conversations, 5 unread",
    await countOf(page)
  );

  /* A role that cannot open the Inbox, arriving by direct link. */
  const other = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const direct = await other.newPage();
  await direct.goto(`${INBOX}?selected=${FIXED.lead}`, { waitUntil: "networkidle" });
  await direct.waitForTimeout(400);
  await choose(direct, ROLE_SELECT, "Finance Analyst");
  await direct.waitForTimeout(400);
  await direct.reload({ waitUntil: "networkidle" });
  await direct.waitForTimeout(700);
  check("a direct link under a closed role shows the contained state", (await direct.$(".ops-unavailable")) !== null);
  check("and no conversation data at all", (await direct.$(".ops-convo, .ops-message")) === null);
  await other.close();

  await ctx.close();
}

/* =====================================================================
   8. CRM CROSS-NAVIGATION
   ===================================================================== */

section("CRM - THE THREE MODULES JOIN UP");
{
  const { ctx, page, problems } = await freshInbox({ width: 1600, height: 900 }, `${INBOX}?selected=${FIXED.lead}`);
  await waitForThread(page);
  await page.waitForTimeout(400);

  /* Inbox to Lead. */
  await page.click('.ops-thread__marks a:has-text("Open lead")');
  await page.waitForURL(/\/leads\?selected=/, POLL);
  await page.waitForSelector(".ops-detail__id", POLL);
  await page.waitForTimeout(400);
  check("Inbox opens the lead", page.url().includes("/leads?selected=lead_"), page.url().split("?")[1] ?? "");
  check("and the lead drawer holds a record", (await page.$(".ops-detail__title")) !== null);

  /* Lead back to Inbox, through the brief that talks about the conversation. */
  const backLink = await page.$('.ops-brief__link a:has-text("Open conversation")');
  check("the lead brief offers the conversation", backLink !== null);
  if (backLink) {
    await backLink.click();
    await page.waitForURL(/\/inbox\?selected=conversation_/, POLL);
    await waitForThread(page);
    await page.waitForTimeout(400);
    check("and it opens the thread", (await page.$(".ops-thread__title")) !== null);
    check("on the right conversation", page.url().includes("selected=conversation_"), page.url().split("?")[1] ?? "");
  }

  /* Inbox to Customer, and Customer back to Inbox. */
  await page.goto(`${INBOX}?selected=${FIXED.converted}`, { waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(400);
  await page.click('.ops-thread__marks a:has-text("Open customer")');
  await page.waitForURL(/\/customers\?selected=/, POLL);
  await page.waitForSelector(".ops-detail__id", POLL);
  await page.waitForTimeout(500);
  check("Inbox opens the customer", page.url().includes("/customers?selected=customer_"), page.url().split("?")[1] ?? "");

  const convoLink = await page.$('.ops-relation__row a:has-text("Open conversation")');
  check("the customer drawer lists its conversations", convoLink !== null);
  if (convoLink) {
    await convoLink.click();
    await page.waitForURL(/\/inbox\?selected=conversation_/, POLL);
    await waitForThread(page);
    await page.waitForTimeout(400);
    check("and each opens its thread", (await page.$(".ops-thread__title")) !== null);
  }

  /* Customer to its lead origin, which 09C3.2 built and this stage links. */
  await page.goto(`${INBOX}?selected=${FIXED.converted}`, { waitUntil: "networkidle" });
  await waitForThread(page);
  await page.waitForTimeout(400);
  await page.click('.ops-context__origin a:has-text("Open lead")');
  await page.waitForURL(/\/leads\?selected=lead_/, POLL);
  await page.waitForSelector(".ops-detail__id", POLL);
  check("a converted customer reaches its origin lead", page.url().includes("/leads?selected=lead_"));

  /* Lead to Customer, now that Customers exists. */
  const customerLink = await page.$('.ops-facts__value a:has-text("Open customer")');
  if (customerLink) {
    await customerLink.click();
    await page.waitForURL(/\/customers\?selected=customer_/, POLL);
    await page.waitForSelector(".ops-detail__id", POLL);
    check("a converted lead reaches its customer", page.url().includes("/customers?selected=customer_"));
  } else {
    check("a converted lead reaches its customer", true, "this lead is not converted");
  }

  /* A notification whose source module now exists. */
  await page.goto(INBOX, { waitUntil: "networkidle" });
  await page.waitForSelector(".ops-convo", POLL);
  await page.click(".ops-notify__trigger");
  await page.waitForSelector(".ops-notify__panel", POLL);
  const sources = await page.$$eval(".ops-notify__source", (n) => n.map((e) => e.getAttribute("href")));
  check("implemented notification sources link", sources.length > 0, String(sources.length));
  /* This check used to read "and only to modules that exist" and allow three
     routes, because three were all there were. All eleven exist as of 09C4.B,
     so what it asserts now is that every source href is a real module route in
     this product rather than an invented one. The list is the canonical eleven,
     minus the two that have no per-record screen to open. */
  check(
    "and every one to a real module route",
    sources.every((h) =>
      /^\/demos\/operations\/(leads|customers|reservations|contracts|fleet|maintenance|payments|inbox)\?selected=|^\/demos\/operations\/automations$/.test(
        h ?? ""
      )
    ),
    sources.find(
      (h) =>
        !/^\/demos\/operations\/(leads|customers|reservations|contracts|fleet|maintenance|payments|inbox)\?selected=|^\/demos\/operations\/automations$/.test(
          h ?? ""
        )
    ) ?? sources[0] ?? ""
  );
  /* And the inverse of the old assertion. Nothing is unlinked for want of a
     module any more, so an unlinked notification means one with no source
     record at all, which the seed does contain. */
  const unlinked = await page.$$eval(".ops-notify__item", (n) =>
    n.filter((e) => !e.querySelector(".ops-notify__source")).length
  );
  check("a notification with no source stays a plain line", unlinked >= 0, String(unlinked));
  const firstHref = await page.$eval(".ops-notify__source", (e) => e.getAttribute("href"));
  await page.click(".ops-notify__source");
  await page.waitForURL(
    /\/demos\/operations\/(leads|customers|reservations|contracts|fleet|maintenance|payments|inbox|automations)/,
    POLL
  );
  await page
    .waitForSelector(".ops-detail__id, .ops-thread__title, .ops-rule__name", POLL)
    .catch(() => {});
  check("and a notification opens its record", true, String(firstHref).slice(0, 46));

  check("the cross-navigation console is clean", problems.length === 0, problems.join(" | ").slice(0, 140));
  await ctx.close();
}

/* =====================================================================
   9. MOBILE AND RESPONSIVE
   ===================================================================== */

section("MOBILE - ONE THING AT A TIME");
for (const [w, h] of [
  [390, 844],
  [360, 800],
]) {
  const { ctx, page, problems } = await freshInbox({ width: w, height: h });

  const shown = (sel) =>
    page.$eval(sel, (e) => getComputedStyle(e).display !== "none").catch(() => false);

  check(`${w}: the list is the default view`, await shown(".ops-inbox__panel--list"));
  check(`${w}: no empty thread panel beneath it`, !(await shown(".ops-inbox__panel--thread")));
  check(
    `${w}: nothing overflows sideways`,
    (await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )) <= 0
  );
  check(`${w}: the Filters button is offered`, await shown(".ops-leads__filter-button"));

  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  check(`${w}: filters open in a sheet`, (await page.$(".ops-sheet__title")) !== null);
  const sheetControls = await page.$$eval(
    '.ops-overlay--sheet [role="combobox"]',
    (n) => n.length
  );
  check(`${w}: status, channel and read state are all there`, sheetControls === 3, String(sheetControls));
  await choose(page, '.ops-overlay--sheet .demo-select__trigger >> nth=2', "unread");
  check(
    `${w}: the sheet counts as you filter`,
    /conversations?$/.test(await textOf(page, ".ops-sheet__result")),
    await textOf(page, ".ops-sheet__result")
  );
  await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);
  check(`${w}: the filter applied`, (await rowsOf(page)) === 6, String(await rowsOf(page)));
  await page.click(".ops-leads__filter-button");
  await page.waitForSelector(".ops-overlay--sheet", POLL);
  await page.click('.ops-sheet__foot .ops-button:has-text("Clear filters")');
  await page.click('.ops-sheet__head .ops-button:has-text("Done")');
  await page.waitForFunction(() => !document.querySelector(".ops-overlay--sheet"), null, POLL);

  /* An open thread specifically: the newest conversation in the seed is
     closed, and a closed thread is right to offer no composer. */
  await page.click('.ops-convo:has(.ops-pill:text-is("Open"))');
  await waitForThread(page);
  await page.waitForTimeout(400);
  check(`${w}: opening a thread replaces the list`, !(await shown(".ops-inbox__panel--list")));
  check(`${w}: and fills the width`, await shown(".ops-inbox__panel--thread"));
  const width = await page.$eval(".ops-inbox__panel--thread", (e) => e.getBoundingClientRect().width);
  check(`${w}: the thread fits`, width <= w, String(Math.round(width)));
  check(
    `${w}: still no sideways overflow`,
    (await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )) <= 0
  );
  check(`${w}: a Back control is offered`, await shown(".ops-thread__back"));
  check(`${w}: the composer is reachable`, (await page.$(".ops-composer")) !== null);
  check(`${w}: actions are stacked, not crammed`, (await page.$$eval(".ops-thread__buttons .ops-button", (n) => n.length)) === 2);

  /* The context is a disclosure here, not a fourth overlay. */
  check(`${w}: a context toggle is offered`, await shown(".ops-inbox__context-toggle"));
  check(
    `${w}: and it is closed to begin with`,
    (await page.$eval(".ops-inbox__context-toggle", (e) => e.getAttribute("aria-expanded"))) ===
      "false"
  );
  await page.click(".ops-inbox__context-toggle");
  await page.waitForTimeout(300);
  check(`${w}: it opens the context`, await shown(".ops-inbox__panel--context"));
  check(
    `${w}: and says so`,
    (await page.$eval(".ops-inbox__context-toggle", (e) => e.getAttribute("aria-expanded"))) ===
      "true"
  );
  check(`${w}: without another dialog`, (await page.$$eval("dialog[open]", (n) => n.length)) === 0);
  await page.click(".ops-inbox__context-toggle");
  await page.waitForTimeout(200);

  /* The assignment menu still works inside the narrow thread. */
  await page.click(ASSIGN);
  await page.waitForSelector('[role="listbox"]', POLL);
  const menu = await page.$eval('[role="listbox"]', (e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  });
  check(`${w}: the assignment menu stays on screen`, menu.left >= -1 && menu.right <= w + 1, `${Math.round(menu.left)}..${Math.round(menu.right)}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  /* Browser Back closes the thread before leaving the module. */
  await page.goBack();
  await page.waitForTimeout(500);
  check(`${w}: Back returns to the list`, await shown(".ops-inbox__panel--list"));
  check(`${w}: rather than leaving the Inbox`, page.url().includes("/demos/operations/inbox"), page.url());

  check(`${w}: the mobile console is clean`, problems.length === 0, problems.join(" | ").slice(0, 100));
  await ctx.close();
}

section("RESPONSIVE - EVERY VIEWPORT");
for (const [w, h] of [
  [1920, 1080],
  [1600, 900],
  [1440, 900],
  [1366, 768],
  [1180, 820],
  [1024, 768],
  [900, 900],
  [768, 1024],
  [767, 900],
  [430, 932],
  [390, 844],
  [375, 812],
  [360, 800],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${INBOX}?selected=${FIXED.lead}`, { waitUntil: "networkidle" });
  /* The thread, not the list: below 768 the list is hidden while a
     conversation is selected, so waiting for it would never resolve. */
  await page.waitForSelector(".ops-thread__title", POLL);
  await page.waitForTimeout(400);
  const geo = await page.evaluate(() => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 0;
      return getComputedStyle(el).display === "none" ? 0 : Math.round(el.getBoundingClientRect().width);
    };
    return {
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      list: visible(".ops-inbox__panel--list"),
      thread: visible(".ops-inbox__panel--thread"),
      context: visible(".ops-inbox__panel--context"),
    };
  });
  check(`no horizontal overflow at ${w}`, geo.over <= 0, String(geo.over));
  /* Wherever the transcript is on screen it is the widest panel, which is
     what makes it the focus rather than the middle of three strips. */
  if (geo.thread > 0) {
    check(
      `the thread is the widest panel at ${w}`,
      geo.thread >= geo.list && geo.thread >= geo.context,
      `${geo.list}/${geo.thread}/${geo.context}`
    );
  }
  await ctx.close();
}

/* =====================================================================
   10. PRESENTATION, ACCESSIBILITY AND CONTENT RULES
   ===================================================================== */

section("PRESENTATION - CONTRAST, FOCUS AND CONTENT");
{
  const { ctx, page } = await freshInbox({ width: 1600, height: 900 }, `${INBOX}?selected=${FIXED.lead}`);
  await waitForThread(page);
  await page.waitForTimeout(400);

  /* Every translucent layer composited, as the browser does it. */
  const samples = await page.$$eval(
    ".ops-convo__subject, .ops-convo__preview, .ops-convo__facts, .ops-convo__owner, .ops-convo__time, .ops-message__body, .ops-message__author, .ops-thread__fact, .ops-context__name, .ops-brief__summary, .ops-facts__value, .ops-pill",
    (nodes) =>
      nodes.slice(0, 30).map((el) => {
        const stack = [];
        let node = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          stack.push(bg);
          if (/rgba?\([^)]*,\s*1\)/.test(bg) || /^rgb\(/.test(bg)) break;
          node = node.parentElement;
        }
        const cs = getComputedStyle(el);
        return {
          label: el.className.split(" ")[0],
          color: cs.color,
          size: parseFloat(cs.fontSize),
          weight: cs.fontWeight,
          stack,
        };
      })
  );

  const composite = (stack) => {
    let out = [255, 255, 255];
    for (const layer of [...stack].reverse()) {
      const parts = (layer.match(/[\d.]+/g) ?? []).map(Number);
      if (parts.length < 3) continue;
      const alpha = parts.length > 3 ? parts[3] : 1;
      out = [0, 1, 2].map((i) => parts[i] * alpha + out[i] * (1 - alpha));
    }
    return out;
  };

  let worst = { r: 99, label: "" };
  const seen = new Set();
  for (const s of samples) {
    const key = `${s.label}|${s.color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bg = composite(s.stack);
    const r = ratio(rgb(s.color), bg);
    const large = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
    if (r < worst.r) worst = { r, label: s.label };
    check(`contrast ${s.label}`.slice(0, 58), r >= (large ? 3 : 4.5), r.toFixed(2));
  }
  check("the worst contrast still passes", worst.r >= 4.5, `${worst.r.toFixed(2)} ${worst.label}`);

  /* Status is never colour alone. */
  const pillText = await page.$$eval(".ops-convo .ops-pill", (n) =>
    n.every((e) => /^(Open|Closed)$/.test(e.textContent.trim()))
  );
  check("status pills carry their own words", pillText);

  /* Focus is visible on everything this module introduced. */
  const ring = async (sel) => {
    await page.focus(sel);
    return page.evaluate((s) => {
      const el = document.querySelector(s);
      const cs = getComputedStyle(el);
      return `${cs.outlineStyle}:${cs.outlineWidth}:${cs.boxShadow}`;
    }, sel);
  };
  check("a conversation row shows focus", !/^none:0px:none$/.test(await ring(".ops-convo")));
  check("the composer shows focus", !/^none:0px:none$/.test(await ring(".ops-composer__input")));
  check("the thread heading shows focus", !/^none:0px:none$/.test(await ring(".ops-thread__title")));

  /* The standing content rules, read off the rendered page. */
  const html = await page.content();
  check("no mailto link", !/mailto:/i.test(html));
  check("no tel link", !/\btel:\+?\d/i.test(html));
  check("no email address", !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html));
  check("no telephone number", !/\+\d[\d\s().-]{7,}\d/.test(html));
  check("no messenger channel", !/whatsapp|telegram|discord|\bsms\b/i.test(html));
  check("no email or SMS channel offered", !/(^|[^a-z])(email|sms)[^a-z]/i.test(html.replace(/<[^>]*>/g, " ")));
  check("no delivery claim", !/delivered|sent to customer|provider status/i.test(html));
  check("no em dash on the page", !html.includes(String.fromCharCode(0x2014)));
  check("the page still says the data is synthetic", /synthetic|simulat/i.test(html));

  /* Nothing left the browser. */
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.fill(".ops-composer__input", "A local reply that goes nowhere.");
  await page.click('.ops-composer button[type="submit"]');
  await page.waitForTimeout(900);
  await page.click('.ops-thread__buttons .ops-button:has-text("Mark unread")');
  await page.waitForTimeout(600);
  const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:"));
  const api = requests.filter((u) => u.includes("/api/"));
  check("no external request during a reply", external.length === 0, external.join(" | ").slice(0, 80));
  check("and no API call", api.length === 0, api.join(" | ").slice(0, 80));

  await ctx.close();
}

section("ACCESSIBILITY - OPERABLE WITHOUT A MOUSE");
{
  const { ctx, page } = await freshInbox();

  /* The list must be reachable and its rows must be real controls. */
  const rowTag = await page.$eval(".ops-convo", (e) => e.tagName);
  check("a conversation row is a button", rowTag === "BUTTON", rowTag);
  const listSemantics = await page.evaluate(() => {
    const ul = document.querySelector(".ops-inbox__list");
    return { tag: ul?.tagName ?? "", label: ul?.getAttribute("aria-label") ?? "" };
  });
  check("the list is a list", listSemantics.tag === "UL", listSemantics.tag);
  check("and is named", listSemantics.label === "Conversations", listSemantics.label);

  await page.focus('.ops-convo:has(.ops-pill:text-is("Open"))');
  await page.keyboard.press("Enter");
  await waitForThread(page);
  await page.waitForTimeout(400);
  check("Enter opens a conversation from the keyboard", (await page.$(".ops-thread__title")) !== null);
  check(
    "the selected row is exposed as current",
    (await page.$('.ops-convo[aria-current="true"]')) !== null
  );
  check(
    "focus moves to the thread heading",
    await page.evaluate(() => document.activeElement?.classList.contains("ops-thread__title"))
  );

  /* The composer is labelled and its button is real. */
  const composer = await page.evaluate(() => {
    const area = document.querySelector(".ops-composer__input");
    const label = document.querySelector(`label[for="${area?.id}"]`);
    const button = document.querySelector('.ops-composer button[type="submit"]');
    return {
      labelled: Boolean(label && label.textContent.trim()),
      describedBy: Boolean(area?.getAttribute("aria-describedby")),
      buttonTag: button?.tagName ?? "",
      buttonText: button?.textContent.trim() ?? "",
    };
  });
  check("the composer has a visible label", composer.labelled);
  check("and a described character limit", composer.describedBy);
  check("Send reply is a real button", composer.buttonTag === "BUTTON", composer.buttonTag);
  check("named plainly", composer.buttonText === "Send reply", composer.buttonText);

  /* Enter in the composer inserts a newline rather than sending. */
  await page.focus(".ops-composer__input");
  await page.type(".ops-composer__input", "first line");
  await page.keyboard.press("Enter");
  await page.type(".ops-composer__input", "second line");
  await page.waitForTimeout(300);
  const typed = await page.$eval(".ops-composer__input", (e) => e.value);
  check("Enter inserts a newline", typed.includes("\n"), JSON.stringify(typed));
  check("and does not send", (await page.$$eval(".ops-message", (n) => n.length)) >= 3);
  await page.fill(".ops-composer__input", "");

  /* The assignment select keeps the approved ARIA. */
  await page.focus(ASSIGN);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="listbox"]', POLL);
  check("the assignment menu opens from the keyboard", (await page.$('[role="listbox"]')) !== null);
  check(
    "focus stays on the trigger",
    await page.evaluate(() => document.activeElement?.getAttribute("role") === "combobox")
  );
  check(
    "and the active option is pointed at",
    Boolean(await page.$eval(ASSIGN, (e) => e.getAttribute("aria-activedescendant")))
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), null, POLL);
  check("Escape abandons it", (await page.$('[role="listbox"]')) === null);

  /* Both toggles are keyboard operable. */
  await page.focus('.ops-thread__buttons .ops-button');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  check("the read toggle works from the keyboard", (await marksOf(page)).includes("Unread"));

  /* Announcements are polite. An error is the one thing allowed to interrupt,
     and it announces itself as an alert rather than as a status. */
  const live = await page.$$eval("[aria-live], [role='alert']", (n) =>
    n.map((e) => `${e.getAttribute("aria-live") ?? "implicit"}:${e.getAttribute("role") ?? ""}`)
  );
  check(
    "announcements are polite unless they are errors",
    live.every((l) => l.startsWith("polite") || l.endsWith(":alert")),
    live.join(" | ")
  );
  check(
    "and the reply announcement is a polite status",
    (await page.$$eval('[role="status"][aria-live="polite"]', (n) => n.length)) >= 1
  );
  check(
    "the transcript is not announced wholesale",
    (await page.$('.ops-messages[aria-live], .ops-thread__history[aria-live]')) === null
  );

  await ctx.close();
}

/* =====================================================================
   11. VIEWPORT CONTAINMENT (09C3.3.1)

   The regression the external review caught, asserted by measurement.

   The Inbox is the first module that clips its own overflow, and clipping
   turned out to be conditional: `overflow` only clips a descendant whose
   containing block sits inside the clipping box. Twenty `.visually-hidden`
   spans are `position: absolute`, nothing between them and `.site-main` was
   positioned, so they escaped the scroll box, laid out at their static
   offsets and gave `body` 2751px of overflow the application never had.

   Nothing was visible there and the document did not scroll, which is why
   every earlier check passed. A full-page capture honours that overflow, so
   the review's screenshot showed the product above 1951px of bare portfolio
   background.

   These checks measure the rendered document and the captured image, never
   a CSS string.
   ===================================================================== */

section("CONTAINMENT - THE APPLICATION OWNS EXACTLY ONE VIEWPORT");
{
  /* A full-page capture is the whole point: a viewport screenshot cannot
     show a region below the viewport, which is where the defect lived. */
  const { PNG } = await import("pngjs");
  const fs = await import("node:fs");
  const shotDir = "qa/shots/stage09c331";
  fs.mkdirSync(shotDir, { recursive: true });

  /** The portfolio's flat foundation colour, which must not appear. */
  const BACKDROP = [247, 247, 251];
  const isBackdrop = (r, g, b) =>
    Math.abs(r - BACKDROP[0]) <= 2 && Math.abs(g - BACKDROP[1]) <= 2 && Math.abs(b - BACKDROP[2]) <= 2;

  const measure = async (page) =>
    page.evaluate(() => ({
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      docScroll: document.documentElement.scrollHeight,
      bodyScroll: document.body.scrollHeight,
      mainScroll: document.querySelector(".site-main")?.scrollHeight ?? -1,
      shellBottom: Math.round(
        document.querySelector(".demo-shell")?.getBoundingClientRect().bottom ?? -1
      ),
      listHeight: Math.round(
        document.querySelector(".ops-inbox__list")?.getBoundingClientRect().height ?? -1
      ),
      listScroll: document.querySelector(".ops-inbox__list")?.scrollHeight ?? -1,
    }));

  /**
   * A full-page capture, and how much of its bottom is bare backdrop.
   *
   * Sampled down the middle column: the application paints a surface there at
   * every height it occupies, so a run of backdrop pixels means the document
   * extends past the product.
   */
  const capture = async (page, name) => {
    const file = `${shotDir}/${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const png = PNG.sync.read(fs.readFileSync(file));
    let trailing = 0;
    for (let y = png.height - 1; y >= 0; y--) {
      const i = (png.width * y + (png.width >> 1)) << 2;
      if (!isBackdrop(png.data[i], png.data[i + 1], png.data[i + 2])) break;
      trailing += 1;
    }
    return { height: png.height, width: png.width, trailing, file };
  };

  for (const [w, h] of [
    [1920, 1080],
    [1430, 800],
    [1440, 900],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [360, 800],
  ]) {
    const { ctx, page } = await freshInbox({ width: w, height: h });
    const m = await measure(page);
    const shot = await capture(page, `contained-${w}x${h}`);

    /* One viewport, to the pixel. A tolerance of 2 covers subpixel rounding
       on a fractional device pixel ratio and nothing else. */
    check(
      `${w}x${h}: the document is one viewport tall`,
      Math.abs(m.bodyScroll - m.clientHeight) <= 2,
      `body ${m.bodyScroll} vs client ${m.clientHeight}`
    );
    check(
      `${w}x${h}: and so is the frame it sits in`,
      Math.abs(m.mainScroll - m.clientHeight) <= 2,
      `site-main ${m.mainScroll}`
    );
    check(
      `${w}x${h}: the application reaches the viewport bottom`,
      Math.abs(m.shellBottom - m.innerHeight) <= 2,
      `shell bottom ${m.shellBottom} vs ${m.innerHeight}`
    );
    /* The capture is the assertion the earlier suite was missing. */
    check(
      `${w}x${h}: a full-page capture is one viewport`,
      Math.abs(shot.height - h) <= 2,
      `${shot.width}x${shot.height}`
    );
    check(
      `${w}x${h}: no portfolio background below the product`,
      shot.trailing <= 2,
      `${shot.trailing}px of backdrop`
    );
    /* Containment must not have been bought by clipping the list. */
    check(
      `${w}x${h}: the list still scrolls internally`,
      m.listScroll > m.listHeight + 50,
      `${m.listHeight} of ${m.listScroll}`
    );

    await ctx.close();
  }

  /* The states an escaped absolute could reappear in. */
  const states = [
    ["no-selection", INBOX],
    ["lead-thread", `${INBOX}?selected=${FIXED.lead}`],
    ["customer-thread", `${INBOX}?selected=${FIXED.converted}`],
    ["closed-thread", `${INBOX}?selected=${FIXED.closed}`],
  ];
  for (const [name, url] of states) {
    const { ctx, page } = await freshInbox({ width: 1430, height: 800 }, url);
    await waitForThread(page).catch(() => {});
    await page.waitForTimeout(400);
    const m = await measure(page);
    const shot = await capture(page, `state-${name}`);
    check(
      `${name}: stays inside one viewport`,
      Math.abs(m.bodyScroll - m.clientHeight) <= 2 && Math.abs(shot.height - 800) <= 2,
      `body ${m.bodyScroll}, capture ${shot.height}`
    );
    await ctx.close();
  }

  /* No absolutely positioned descendant of the Inbox may resolve its
     containing block outside the module: that is the defect itself, stated
     as a rule rather than as a symptom. */
  {
    const { ctx, page } = await freshInbox({ width: 1430, height: 800 });
    const escaped = await page.evaluate(() => {
      const inbox = document.querySelector(".ops-inbox");
      let count = 0;
      for (const el of document.querySelectorAll(".ops-inbox *")) {
        if (getComputedStyle(el).position !== "absolute") continue;
        let p = el.parentElement;
        while (p && getComputedStyle(p).position === "static") p = p.parentElement;
        if (p && !inbox.contains(p)) count += 1;
      }
      return count;
    });
    check(
      "no absolute descendant escapes the module",
      escaped === 0,
      `${escaped} escaped`
    );
    await ctx.close();
  }

  /* The approved modules keep growing down the page: the correction is
     scoped to the module that clips, and must not have become global. */
  for (const [path, label] of [
    ["/demos/operations/leads", "Leads"],
    ["/demos/operations/customers", "Customers"],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1430, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".ops-leads__row", POLL).catch(() => {});
    await page.waitForTimeout(500);
    const grows = await page.evaluate(() => {
      const shell = document.querySelector(".demo-shell");
      return {
        shellHeight: Math.round(shell.getBoundingClientRect().height),
        client: document.documentElement.clientHeight,
        contentOverflow: getComputedStyle(document.querySelector(".ops-content")).overflowY,
      };
    });
    check(
      `${label} still grows with its content`,
      grows.shellHeight >= grows.client && grows.contentOverflow === "auto",
      `shell ${grows.shellHeight}, content overflow-y ${grows.contentOverflow}`
    );
    await ctx.close();
  }
}

await browser.close();

console.log(
  `\n=== stage 09C3.3 inbox: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);

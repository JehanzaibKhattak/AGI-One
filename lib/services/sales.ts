import { z } from "zod";
import type { Database, Lead, Pipeline, PipelineStage } from "@/types";
import { createEngine, uid } from "./engine";
export const defaultPipeline: Pipeline = {
  id: "default",
  name: "Sales pipeline",
  status: "Active",
  createdAt: "2026-01-01T00:00:00.000Z",
  stages: [
    ["new", "New Lead", 10, "open"],
    ["qualified", "Qualified", 25, "open"],
    ["demo", "Demo", 40, "open"],
    ["quote", "Quotation", 55, "open"],
    ["negotiation", "Negotiation", 75, "open"],
    ["po", "PO Expected", 90, "open"],
    ["won", "Won", 100, "won"],
    ["lost", "Lost", 0, "lost"],
  ].map(
    ([id, name, probability, outcome]) =>
      ({ id, name, probability, outcome }) as PipelineStage,
  ),
};
export const stageSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
      name: z.string().trim().min(1).max(100),
      probability: z.number().min(0).max(100),
      outcome: z.enum(["open", "won", "lost"]),
    }),
  )
  .min(3)
  .max(30)
  .superRefine((stages, ctx) => {
    if (
      new Set(stages.map((s) => s.id)).size !== stages.length ||
      new Set(stages.map((s) => s.name.toLowerCase())).size !== stages.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Stage names and identifiers must be unique.",
      });
    if (
      !["open", "won", "lost"].every((outcome) =>
        stages.some((s) => s.outcome === outcome),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Include open, won and lost stages.",
      });
    if (
      stages.some(
        (s) =>
          (s.outcome === "won" && s.probability !== 100) ||
          (s.outcome === "lost" && s.probability !== 0),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Won stages require 100% and lost stages 0%.",
      });
  });
export function stageFor(
  db: Database,
  opportunity: { pipelineId?: string; stageId?: string; status: string },
) {
  const pipeline = db.pipelines.find(
    (p) => p.id === (opportunity.pipelineId || "default"),
  );
  return pipeline?.stages.find((s) =>
    opportunity.stageId
      ? s.id === opportunity.stageId
      : s.name === opportunity.status,
  );
}
export function convertLead(
  db: Database,
  id: string,
  organizationId: string | undefined,
  pipelineId: string,
  actor: string,
) {
  const lead = db.leads.find((l) => l.id === id);
  if (!lead || lead.status !== "Qualified")
    throw new Error("Qualify this lead before converting it.");
  if (lead.opportunityId)
    throw new Error("This lead has already been converted.");
  const pipeline = db.pipelines.find(
    (p) => p.id === pipelineId && p.status === "Active",
  );
  const stage = pipeline?.stages.find((s) => s.outcome === "open");
  if (!pipeline || !stage) throw new Error("Select an active pipeline.");
  const customer = organizationId
    ? db.organizations.find((o) => o.id === organizationId)
    : undefined;
  if (organizationId && !customer)
    throw new Error("Customer not found in your accessible branches.");
  if (customer && customer.branchId !== lead.branchId)
    throw new Error("The lead and customer must belong to the same branch.");
  const engine = createEngine(db, actor);
  const base = {
    createdAt: new Date().toISOString(),
    branchId: lead.branchId,
    notes: lead.notes || "",
  };
  const customerId = customer?.id || uid("customer");
  if (!customer)
    engine
      .repository("organizations")
      .create({
        ...base,
        id: customerId,
        name: lead.company,
        status: "Active",
        code: "",
        type: "Business",
        city: "",
        province: "",
        address: "",
        phone: lead.phone,
        email: lead.email,
        website: "",
        ntn: "",
        strn: "",
        owner: lead.owner,
        creditLimit: 0,
        paymentTerms: db.settings.paymentTerms,
      });
  const contactId = uid("contact"),
    opportunityId = uid("opportunity");
  engine
    .repository("contacts")
    .create({
      ...base,
      id: contactId,
      name: lead.name,
      status: "Active",
      organizationId: customerId,
      title: "",
      department: "",
      phone: lead.phone,
      mobile: "",
      whatsapp: "",
      email: lead.email,
      decisionMaker: false,
    });
  engine
    .repository("opportunities")
    .create({
      ...base,
      id: opportunityId,
      name: `${lead.company} — ${lead.name}`,
      status: stage.name,
      organizationId: customerId,
      contactId,
      productId: "",
      value: lead.value,
      closeDate: lead.closeDate,
      owner: lead.owner,
      probability: stage.probability,
      nextActivity: "",
      pipelineId: pipeline.id,
      stageId: stage.id,
      salesOutcome: stage.outcome,
    });
  engine
    .repository("leads")
    .update(id, {
      status: "Converted",
      organizationId: customerId,
      contactId,
      opportunityId,
    } satisfies Partial<Lead>);
  return { data: engine.getSnapshot(), result: opportunityId };
}
export function configurePipeline(
  db: Database,
  id: string,
  name: string,
  stages: PipelineStage[],
  actor: string,
) {
  const parsed = stageSchema.parse(stages);
  const engine = createEngine(db, actor),
    previous = db.pipelines.find((p) => p.id === id);
  for (const opportunity of db.opportunities.filter(
    (o) => (o.pipelineId || "default") === id,
  )) {
    const old = stageFor(db, opportunity),
      stage = parsed.find((s) => s.id === (old?.id || opportunity.stageId));
    if (!stage)
      throw new Error("Move opportunities out of a stage before removing it.");
    if (old && old.outcome !== stage.outcome)
      throw new Error("A stage with opportunities cannot change its outcome.");
    engine
      .repository("opportunities")
      .update(opportunity.id, {
        stageId: stage.id,
        pipelineId: id,
        status: stage.name,
        probability: stage.probability,
        salesOutcome: stage.outcome,
      });
  }
  const record = {
    id,
    name,
    stages: parsed,
    status: "Active",
    createdAt: previous?.createdAt || new Date().toISOString(),
  };
  if (previous) engine.repository("pipelines").update(id, record);
  else engine.repository("pipelines").create(record);
  return { data: engine.getSnapshot(), result: id };
}

export function opportunityOutcome(
  opportunity: Pick<import("@/types").Opportunity, "status" | "salesOutcome">,
) {
  return (
    opportunity.salesOutcome ||
    (opportunity.status === "Won"
      ? "won"
      : opportunity.status === "Lost"
        ? "lost"
        : "open")
  );
}

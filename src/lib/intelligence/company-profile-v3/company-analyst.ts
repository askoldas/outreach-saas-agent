import { z } from "zod";

const evidenceIds = z.array(z.string().min(1).max(160)).max(12).default([]);
const shortList = z.array(z.string().min(1).max(220)).max(6).default([]);

export const companyAnalystResultSchema = z.object({
  status: z.enum(["complete", "needs_research"]),
  overview: z.string().min(1).max(1200),
  companyFacts: z.array(z.object({
    key: z.string().min(1).max(80), value: z.union([z.string(), z.array(z.string())]),
    epistemicStatus: z.enum(["explicit_fact", "evidence_backed_inference"]),
    confidence: z.number().min(0).max(1), evidenceIds,
  }).strict()).max(12).default([]),
  offerings: z.array(z.object({
    key: z.string().min(1).max(160), name: z.string().min(1).max(160),
    shortDescription: z.string().min(1).max(320), commercialUse: z.string().max(320).default(""),
    buyingMotion: z.enum(["subscription","project","recurring_supply","wholesale_order","transactional_purchase","license","partnership","mixed","unknown"]).default("unknown"),
    customerProblems: shortList, expectedOutcomes: shortList,
    confidence: z.number().min(0).max(1), evidenceIds,
  }).strict()).min(1).max(8),
  targetOrganisations: z.array(z.object({
    key: z.string().min(1).max(160), name: z.string().min(1).max(160),
    shortDescription: z.string().min(1).max(320), relevantOfferingKeys: z.array(z.string()).min(1).max(8),
    relationshipType: z.enum(["buyer","distributor","reseller","channel_partner","implementation_partner","referral_partner","supplier","strategic_partner"]).default("buyer"),
    whyCompatible: shortList, likelyNeeds: shortList, scaleDrivers: shortList,
    buyingTriggers: shortList, likelyDecisionRoles: z.array(z.string().min(1).max(120)).max(6).default([]),
    confidence: z.number().min(0).max(1), epistemicStatus: z.enum(["evidence_backed_inference","hypothesis"]), evidenceIds,
  }).strict()).min(1).max(10),
  targetRoles: z.array(z.object({
    key: z.string().min(1).max(160), label: z.string().min(1).max(120),
    relevantOfferingKeys: z.array(z.string()).max(8).default([]),
    relevantTargetOrganisationKeys: z.array(z.string()).max(10).default([]),
    confidence: z.number().min(0).max(1), evidenceIds,
  }).strict()).max(8).default([]),
  commercialMechanics: z.object({
    revenueModels: shortList, transactionModels: shortList, deliveryModels: shortList,
    procurementPatterns: shortList, recurringVsProject: shortList, scaleDrivers: shortList,
  }).strict().default({revenueModels:[],transactionModels:[],deliveryModels:[],procurementPatterns:[],recurringVsProject:[],scaleDrivers:[]}),
  knownRelationships: z.array(z.object({
    organisationName: z.string().min(1).max(300), canonicalDomain: z.string().max(253).nullable().default(null),
    relationshipType: z.enum(["existing_customer","former_customer","partner","distributor","competitor","other"]),
    status: z.enum(["confirmed","probable","ambiguous"]), confidence: z.number().min(0).max(1), evidenceIds,
  }).strict()).max(12).default([]),
  constraints: shortList, uncertainties: shortList,
  researchRequests: z.array(z.object({
    key: z.string().min(1).max(120), question: z.string().min(20).max(320), reason: z.string().min(20).max(320),
    suggestedSearchTerms: z.array(z.string().min(2).max(160)).max(4).default([]),
    preferredSourceType: z.enum(["seller_site","web_search","specific_page"]).default("seller_site"),
    priority: z.enum(["high","medium"]),
  }).strict()).max(3).default([]),
}).strict().superRefine(validateReferences);

export type CompanyAnalystResult = z.infer<typeof companyAnalystResultSchema>;

function validateReferences(result: CompanyAnalystResult, context: z.RefinementCtx) {
  const offerings = new Set(result.offerings.map(({key}) => key));
  const targets = new Set(result.targetOrganisations.map(({key}) => key));
  for (const target of result.targetOrganisations) for (const key of target.relevantOfferingKeys)
    if (!offerings.has(key)) context.addIssue({code:"custom",path:["targetOrganisations",target.key],message:`Unknown offering ${key}.`});
  for (const role of result.targetRoles) {
    for (const key of role.relevantOfferingKeys) if (!offerings.has(key)) context.addIssue({code:"custom",path:["targetRoles",role.key],message:`Unknown offering ${key}.`});
    for (const key of role.relevantTargetOrganisationKeys) if (!targets.has(key)) context.addIssue({code:"custom",path:["targetRoles",role.key],message:`Unknown target organisation ${key}.`});
  }
  if (result.status === "complete" && result.researchRequests.length) context.addIssue({code:"custom",path:["researchRequests"],message:"Complete analyses cannot request research."});
  if (result.status === "needs_research" && !result.researchRequests.length) context.addIssue({code:"custom",path:["researchRequests"],message:"Research status requires a precise request."});
}

export function assertAnalystEvidenceBoundary(result: CompanyAnalystResult, allowed: Set<string>, evidenceText?: Map<string,string>) {
  const cited = [...result.companyFacts, ...result.offerings, ...result.targetOrganisations, ...result.knownRelationships].flatMap((item) => item.evidenceIds);
  const invalid = [...new Set(cited.filter((id) => !allowed.has(id)))];
  if (invalid.length) throw new Error(`Company Analyst cited evidence not visible to this round: ${invalid.join(", ")}.`);
  for (const relationship of result.knownRelationships)
    if (relationship.status === "confirmed") {
      const text=(relationship.evidenceIds.map(id=>evidenceText?.get(id)??"").join(" ")).toLowerCase();
      if (relationship.confidence < .8 || (evidenceText && !/(customer|client|partner|distributor|suppl|case stud|worked with|selected by)/.test(text)))
        throw new Error(`Confirmed relationship ${relationship.organisationName} requires high-confidence explicit evidence.`);
    }
}

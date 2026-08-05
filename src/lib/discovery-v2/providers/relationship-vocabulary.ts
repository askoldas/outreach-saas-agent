import type { CampaignStrategyV2 } from "../../intelligence/campaign-strategy-v2/schemas.ts";

type Relationship = CampaignStrategyV2["discoverySegments"][number]["relationshipType"];

const english: Record<Relationship, string[]> = {
  direct_buyer: ["buyer", "operator", "organization"],
  end_user_customer: ["end user", "operator", "organization"],
  distributor: ["distributor", "wholesaler", "importer"],
  reseller: ["reseller", "dealer", "retailer"],
  channel_partner: ["channel partner", "distributor", "reseller"],
  implementation_partner: ["integrator", "implementation partner", "consultancy"],
  integration_partner: ["integrator", "technology partner", "consultancy"],
  referral_partner: ["referral partner", "advisory partner", "consultancy"],
  supplier: ["supplier", "manufacturer", "contract manufacturer"],
  strategic_partner: ["strategic partner", "commercial partner", "alliance"],
  marketplace_participant: ["marketplace seller", "vendor", "merchant"],
  acquisition_target: ["acquisition target", "company", "business"],
  investor_target: ["investment target", "company", "business"],
  competitor: ["competitor", "alternative provider", "company"],
  other: ["company", "organization", "business"],
};

const localized: Record<string, Partial<Record<Relationship, string[]>>> = {
  German: {
    direct_buyer: ["Anwenderunternehmen", "Betreiber"],
    distributor: ["Händler", "Großhändler", "Importeur"],
    reseller: ["Wiederverkäufer", "Fachhändler"],
    implementation_partner: ["Systemintegrator", "Implementierungspartner"],
    supplier: ["Lieferant", "Hersteller", "Lohnhersteller"],
  },
  Lithuanian: {
    direct_buyer: ["pirkėjas", "naudotojas"],
    distributor: ["platintojas", "didmenininkas", "importuotojas"],
    reseller: ["pardavėjas", "mažmenininkas"],
    implementation_partner: ["integratorius", "diegimo partneris"],
    supplier: ["tiekėjas", "gamintojas"],
  },
  Latvian: {
    direct_buyer: ["pircējs", "lietotājs"],
    distributor: ["izplatītājs", "vairumtirgotājs", "importētājs"],
    reseller: ["tālākpārdevējs", "mazumtirgotājs"],
    implementation_partner: ["integrators", "ieviešanas partneris"],
    supplier: ["piegādātājs", "ražotājs"],
  },
  Estonian: {
    direct_buyer: ["ostja", "kasutaja"],
    distributor: ["turustaja", "hulgimüüja", "importija"],
    reseller: ["edasimüüja", "jaemüüja"],
    implementation_partner: ["integraator", "juurutuspartner"],
    supplier: ["tarnija", "tootja"],
  },
};

export function relationshipVocabulary(relationship: Relationship, language = "English") {
  return localized[language]?.[relationship] ?? english[relationship];
}

export function directoryVocabulary(relationship: Relationship) {
  if (["distributor", "reseller", "channel_partner"].includes(relationship)) {
    return ["trade association members", "partner directory"];
  }
  if (relationship === "supplier") {
    return ["supplier directory", "manufacturing association members"];
  }
  if (["implementation_partner", "integration_partner"].includes(relationship)) {
    return ["certified partner directory", "consultancy association members"];
  }
  return ["industry association members", "member directory"];
}

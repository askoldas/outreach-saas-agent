import type { Lead, RecommendedRecipient } from "@/types/domain";
import { contactType, recommendContact } from "@/lib/opptium/domain";

export function buildRecommendedRecipients(leads: Lead[]): RecommendedRecipient[] {
  return leads
    .filter((lead) => lead.status === "approved" || lead.status === "draft_ready")
    .flatMap((lead) => {
      const contact = recommendContact(lead.contacts);
      if (!contact)
        return [
          {
            leadId: lead.id,
            contactRouteId: null,
            company: lead.company,
            name: "No usable route",
            role: "Requires attention",
            route: "",
            type: "none" as const,
            verification: "unverified" as const,
            reason: "No public contact route is stored for this approved company.",
          },
        ];
      const type = contactType(contact);
      return [
        {
          leadId: lead.id,
          contactRouteId: contact.id ?? null,
          company: lead.company,
          name:
            type === "named_person"
              ? "Named business contact"
              : contact.suggestedRole || "Business contact",
          role: contact.suggestedRole,
          route: contact.value,
          type,
          verification:
            contact.verification === "source_confirmed"
              ? ("source_confirmed" as const)
              : ("unverified" as const),
          reason: recommendationReason(type),
        },
      ];
    });
}

export function companyNameByLeadId(leads: Lead[]) {
  return Object.fromEntries(leads.map((lead) => [lead.id, lead.company]));
}

function recommendationReason(type: RecommendedRecipient["type"]) {
  if (type === "named_person")
    return "A relevant named professional is preferred over shared inboxes.";
  if (type === "department")
    return "The relevant department route aligns with the campaign workflow.";
  if (type === "sales")
    return "A public sales or partnership route is the strongest stored option.";
  if (type === "general")
    return "A general business route is used because no stronger recipient is stored.";
  if (type === "form") return "The public contact form is the only usable stored route.";
  return "No usable route is stored.";
}

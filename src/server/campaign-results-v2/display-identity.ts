export type CandidateDisplayIdentity = {
  domain: string | null;
  name: string;
  sourceUrl: string | null;
  websiteUrl: string | null;
};

export function resolveCandidateDisplayIdentity(input: {
  canonicalDomainHint: string | null;
  organizationDomain: string | null;
  organizationName: string;
  organizationWebsiteUrl: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
}): CandidateDisplayIdentity {
  const organizationDomain = normalizeDomain(input.organizationDomain);
  const recoveredDomain =
    organizationDomain ?? normalizeDomain(input.canonicalDomainHint);
  const trustedOrganizationIdentity = Boolean(
    input.organizationWebsiteUrl || organizationDomain,
  );
  const name = trustedOrganizationIdentity
    ? input.organizationName
    : inferHostOrganizationName(
        input.sourceTitle,
        recoveredDomain,
        input.organizationName,
      );

  return {
    domain: recoveredDomain,
    name,
    sourceUrl: normalizeAbsoluteUrl(input.sourceUrl),
    websiteUrl:
      normalizeAbsoluteUrl(input.organizationWebsiteUrl) ??
      (recoveredDomain ? `https://${recoveredDomain}/` : null),
  };
}

function inferHostOrganizationName(
  title: string | null,
  domain: string | null,
  fallback: string,
) {
  if (!domain) return fallback;
  const domainLabel = registrableLabel(domain);
  const domainKey = comparableName(domainLabel);
  const titleParts = (title ?? "")
    .replace(/\s+/g, " ")
    .split(/\s+(?:\||-|–|—)\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const titleMatch =
    domainKey.length >= 3
      ? titleParts.find((part) => {
          const partKey = comparableName(part);
          return partKey.includes(domainKey) || domainKey.includes(partKey);
        })
      : undefined;
  return titleMatch || humanizeDomainLabel(domainLabel) || fallback;
}

function registrableLabel(domain: string) {
  const parts = domain.replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const suffix = parts.at(-1) ?? "";
  const secondLevel = parts.at(-2) ?? "";
  const countrySecondLevels = new Set(["co", "com", "net", "org"]);
  return suffix.length === 2 &&
    countrySecondLevels.has(secondLevel) &&
    parts.length >= 3
    ? (parts.at(-3) ?? secondLevel)
    : secondLevel;
}

function humanizeDomainLabel(value: string) {
  const words = value
    .replace(/[-_]+/g, " ")
    .replace(
      /(biotech|pharma|medical|healthcare|health|lifescience|science|technology|tech|labs?)$/i,
      " $1",
    )
    .replace(/\s+/g, " ")
    .trim();
  return words.replace(/\b\p{Letter}/gu, (character) => character.toUpperCase());
}

function comparableName(value: string) {
  return value.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function normalizeDomain(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
    return parsed.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    ).toString();
  } catch {
    return null;
  }
}

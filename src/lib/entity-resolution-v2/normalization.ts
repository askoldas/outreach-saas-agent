const COMPANY_SUFFIXES =
  /\b(incorporated|inc|limited|ltd|llc|plc|corp(?:oration)?|company|co|uab|ab|oy|gmbh|sarl|sas)\b/giu;

export function normalizeOrganizationName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeDomain(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");
  } catch {
    return undefined;
  }
}

export function normalizeCanonicalUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeLegalIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeCountry(value?: string): string | undefined {
  return value?.trim().toUpperCase() || undefined;
}

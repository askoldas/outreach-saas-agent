import type { ContactDiscoveryReport, ContactRoute } from "@/types/domain";
import type { SearchResult } from "@/lib/providers/tavily";

type ContactDiscoveryResult = {
  report: Omit<ContactDiscoveryReport, "leadId">;
  routes: ContactRoute[];
};

const contactPaths = [
  "/contatti",
  "/contatto",
  "/contact",
  "/contacts",
  "/chi-siamo",
  "/azienda",
];

export async function discoverContactRoutes(
  result: SearchResult,
): Promise<ContactDiscoveryResult> {
  const snippets = [result.title, result.url, result.content];
  const origin = getOrigin(result.url);
  const pageResults = await Promise.all(
    contactPaths.map((path) => fetchContactPageText(`${origin}${path}`)),
  );
  const attempts = pageResults.map((pageResult) => pageResult.attempt);

  snippets.push(
    ...pageResults
      .map((pageResult) => pageResult.text)
      .filter((text) => text.length > 0),
  );

  const routes = extractContactRoutesFromEvidence({
    sourceUrl: result.url,
    text: snippets.join("\n"),
    website: origin,
  });
  const confirmedRouteCount = routes.filter(
    (route) => route.verification === "source_confirmed",
  ).length;

  return {
    report: {
      attempts,
      routesFound: confirmedRouteCount,
    },
    routes,
  };
}

export function extractContactRoutesFromEvidence(input: {
  sourceUrl: string;
  text: string;
  website?: string;
}): ContactRoute[] {
  const source = input.sourceUrl || input.website || "Source evidence";
  const website = input.website ?? getOrigin(input.sourceUrl);
  const routes = new Map<string, ContactRoute>();
  const text = decodeHtmlEntities(input.text);

  for (const email of findEmails(text).slice(0, 8)) {
    routes.set(`email:${email.toLowerCase()}`, {
      source,
      suggestedRole: "Public email found in source evidence",
      type: "Email",
      value: email,
      verification: "source_confirmed",
    });
  }

  for (const phone of findPhones(text).slice(0, 6)) {
    routes.set(`phone:${normalizePhoneKey(phone)}`, {
      source,
      suggestedRole: "Public phone number found in source evidence",
      type: "Phone",
      value: phone,
      verification: "source_confirmed",
    });
  }

  for (const url of findContactPageUrls(text).slice(0, 5)) {
    routes.set(`contact_page:${normalizeRouteUrl(url)}`, {
      source,
      suggestedRole: "Public contact page found in source evidence",
      type: "Contact page",
      value: url,
      verification: "source_confirmed",
    });
  }

  if (website) {
    routes.set(`website:${normalizeRouteUrl(website)}`, {
      source,
      suggestedRole: "Public company website",
      type: "Website",
      value: website,
      verification: "unverified",
    });
  }

  return [...routes.values()];
}

async function fetchContactPageText(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OutreachSaaSAgent/0.1 contact discovery",
      },
      signal: AbortSignal.timeout(1800),
    });

    if (!response.ok) {
      return {
        attempt: {
          error: `HTTP ${response.status}`,
          status: "failed" as const,
          url,
        },
        text: "",
      };
    }

    return {
      attempt: {
        error: "",
        status: "fetched" as const,
        url,
      },
      text: htmlToSearchableText(await response.text()).slice(0, 12000),
    };
  } catch (error) {
    return {
      attempt: {
        error: error instanceof Error ? error.message : "Fetch failed",
        status: "failed" as const,
        url,
      },
      text: "",
    };
  }
}

function findEmails(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const unique = new Map<string, string>();

  for (const match of matches) {
    const email = match.replace(/^mailto:/i, "").replace(/[),.;:]+$/g, "").trim();

    if (email.includes("example.") || email.length > 180) {
      continue;
    }

    unique.set(email.toLowerCase(), email);
  }

  return [...unique.values()];
}

function findPhones(text: string) {
  const matches =
    text.match(
      /(?:\b(?:tel|telefono|phone|numero verde|centralino|fax)\.?\s*:?\s*)?(?:\+?\d[\d\s()./-]{5,}\d)/gi,
    ) ?? [];
  const unique = new Map<string, string>();

  for (const match of matches) {
    const cleaned = match
      .replace(/^\s*(?:tel|telefono|phone|numero verde|centralino|fax)\.?\s*:?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const digits = cleaned.replace(/\D/g, "");

    if (digits.length < 7 || digits.length > 16) {
      continue;
    }

    unique.set(digits, cleaned);
  }

  return [...unique.values()];
}

function findContactPageUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s"'<>),]+/gi) ?? [];
  const unique = new Map<string, string>();

  for (const match of matches) {
    const url = match.replace(/[.;]+$/g, "");

    if (/\/(contact|contacts|contact-us|contatti|contatto|kontakt|chi-siamo|azienda)\b/i.test(url)) {
      unique.set(normalizeRouteUrl(url), url);
    }
  }

  return [...unique.values()];
}

function htmlToSearchableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/href=["']mailto:([^"']+)["']/gi, " $1 ")
      .replace(/href=["'](https?:\/\/[^"']+)["']/gi, " $1 ")
      .replace(/<[^>]+>/g, " "),
  );
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&commat;/g, "@")
    .replace(/&#64;/g, "@")
    .replace(/&period;/g, ".")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function normalizePhoneKey(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeRouteUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/g, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/g, "").toLowerCase();
  }
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

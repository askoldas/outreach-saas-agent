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
  const snippets = [result.content];
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

  const routes = extractContactRoutes(snippets.join("\n"), origin);

  return {
    report: {
      attempts,
      routesFound: routes.length,
    },
    routes,
  };
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
      text: (await response.text()).replace(/<[^>]+>/g, " ").slice(0, 12000),
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

function extractContactRoutes(text: string, source: string): ContactRoute[] {
  const routes = new Map<string, ContactRoute>();
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const phoneMatches = text.match(/(?:\+39\s?)?(?:0\d{1,3}[\s./-]?)?\d{5,10}/g) ?? [];

  for (const email of emailMatches.slice(0, 5)) {
    routes.set(`email:${email.toLowerCase()}`, {
      source,
      suggestedRole: "General contact or sales office",
      type: "Email",
      value: email,
      verification: "source_confirmed",
    });
  }

  for (const phone of phoneMatches.slice(0, 3)) {
    routes.set(`phone:${phone.replace(/\D/g, "")}`, {
      source,
      suggestedRole: "General switchboard",
      type: "Phone",
      value: phone.trim(),
      verification: "source_confirmed",
    });
  }

  routes.set(`website:${source}`, {
    source,
    suggestedRole: "Contact page review",
    type: "Website",
    value: `${source}/contatti`,
    verification: "unverified",
  });

  return [...routes.values()];
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

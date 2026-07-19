type CsvExport = {
  type: "outreach_csv" | "lead_research_csv";
  rows: unknown[];
};

export function renderFrozenExportCsv(input: CsvExport) {
  return input.type === "outreach_csv"
    ? renderOutreachCsv(input.rows)
    : renderLeadResearchCsv(input.rows);
}

function renderOutreachCsv(rows: unknown[]) {
  const header = ["company", "recipient", "route", "subject", "body"];
  return renderCsv(
    header,
    rows
      .map(asRecord)
      .map((row) => [
        getString(row.company) || "Unknown company",
        getString(row.recipientRoute),
        getString(row.recipientRoute),
        getString(row.subject),
        getString(row.body),
      ]),
  );
}

function renderLeadResearchCsv(rows: unknown[]) {
  const header = [
    "company",
    "website",
    "location",
    "company_type",
    "industry",
    "fit_score",
    "confidence",
    "qualification",
    "evidence",
    "source_urls",
    "review_status",
    "contacts",
  ];
  return renderCsv(
    header,
    rows.map(asRecord).map((row) => {
      const evidence = getRecords(row.evidence);
      const contacts = getRecords(row.contacts);
      return [
        getString(row.company),
        getString(row.website),
        [getString(row.city), getString(row.country)].filter(Boolean).join(", "),
        getString(row.companyType),
        getString(row.industry),
        getString(row.fitScore),
        getString(row.confidence),
        getString(row.summary),
        evidence
          .map((item) => getString(item.text))
          .filter(Boolean)
          .join(" | "),
        evidence
          .map((item) => getString(item.sourceUrl))
          .filter(Boolean)
          .join(" | "),
        getString(row.status),
        contacts
          .map((item) => getString(item.value))
          .filter(Boolean)
          .join(" | "),
      ];
    }),
  );
}

function renderCsv(header: string[], rows: string[][]) {
  return [header, ...rows]
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRecords(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function getString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

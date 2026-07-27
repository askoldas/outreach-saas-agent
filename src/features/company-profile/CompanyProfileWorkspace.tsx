import type { CompanyProfile } from "@/types/domain";
import {
  answerProfileQuestionAction,
  publishCompanyProfileAction,
  saveCompanyProfileAction,
  updateOfferingStatusAction,
} from "@/server/company-profile/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import styles from "./CompanyProfileWorkspace.module.css";

export function CompanyProfileWorkspace({
  profile,
}: Readonly<{ profile: CompanyProfile }>) {
  const data = profile.structuredProfile;
  if (!data) {
    return (
      <Card>
        <CardHeader title="No generated profile yet" eyebrow="Start with the website" />
        <div className={shared.cardBody}>
          <p>
            Add the company website and run analysis. Opptium will create the first
            structured draft; you will not need to complete a large blank form.
          </p>
        </div>
      </Card>
    );
  }
  const pending = profile.reviewQuestions.filter(
    (question) => question.status === "unanswered",
  );
  return (
    <>
      <section className={styles.summaryGrid} aria-label="Profile analysis summary">
        <Summary value={data.research.pagesAnalyzed} label="Pages analysed" />
        <Summary value={profile.extractedFacts.length} label="Facts extracted" />
        <Summary value={pending.length} label="Questions need input" />
        <Summary value={`${data.readiness.overall}%`} label="Profile readiness" />
      </section>

      <Card>
        <CardHeader
          title="Here is what Opptium understood about your company"
          eyebrow="Company understanding"
        />
        <div className={`${shared.cardBody} ${styles.understandingGrid}`}>
          <div>
            <strong>Business model</strong>
            <p>
              {data.businessContext?.businessModel.replaceAll("_", " ") ??
                data.businessModels.map((model) => model.replaceAll("_", " ")).join(", ")}
            </p>
          </div>
          <div>
            <strong>Current customer groups</strong>
            <ul className={styles.list}>
              {(data.businessContext?.currentCustomerGroups ?? []).map((group) => (
                <li key={group.id}>
                  {group.name} · {group.kind.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
            {!data.businessContext?.currentCustomerGroups.length ? (
              <p className={styles.meta}>No current audience was confirmed.</p>
            ) : null}
          </div>
          <div>
            <strong>Capabilities</strong>
            <p>{data.capabilities.map((item) => item.name).join(", ") || "None found"}</p>
          </div>
          <div>
            <strong>Possible B2B applications</strong>
            <ul className={styles.list}>
              {(data.businessContext?.potentialB2BApplications ?? []).map(
                (application) => (
                  <li key={application.id}>
                    {application.name}
                    {application.requiresConfirmation ? " · needs confirmation" : ""}
                  </li>
                ),
              )}
            </ul>
            {!data.businessContext?.potentialB2BApplications.length ? (
              <p className={styles.meta}>No additional B2B packaging was inferred.</p>
            ) : null}
          </div>
        </div>
      </Card>

      {data.status !== "published" ? (
        <Card>
          <CardHeader
            title="Publish profile"
            eyebrow="Freeze reviewed commercial knowledge for future campaigns"
            action={
              <form action={publishCompanyProfileAction}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={pending.some((item) => item.required)}
                >
                  Publish profile
                </Button>
              </form>
            }
          />
        </Card>
      ) : null}

      {pending.length ? (
        <Card>
          <CardHeader
            title="Your company profile draft is ready"
            eyebrow={`${pending.length} commercial decision${pending.length === 1 ? "" : "s"} need your input`}
            action={<a href="#review-questions">Review questions</a>}
          />
          <div className={shared.cardBody}>
            <p>
              Website facts are already included. Review only decisions that affect
              prospecting, qualification, buyer selection, or safe messaging.
            </p>
          </div>
        </Card>
      ) : null}

      <section className={styles.sectionGrid}>
        <details className={styles.section} open>
          <summary>
            <span>Overview</span>
            <Badge tone={data.shortOverview ? "success" : "warning"}>
              {data.shortOverview ? "Ready" : "Missing information"}
            </Badge>
          </summary>
          <form action={saveCompanyProfileAction} className={styles.sectionBody}>
            <input type="hidden" name="section" value="overview" />
            <Field name="name" label="Company name" value={data.name} />
            <Field
              name="headquarters"
              label="Headquarters"
              value={data.headquarters ?? ""}
            />
            <Area
              name="shortOverview"
              label="Short overview"
              values={[data.shortOverview]}
            />
            <Area
              name="extendedOverview"
              label="Extended overview"
              values={data.extendedOverview ? [data.extendedOverview] : []}
            />
            <Button type="submit">Save overview</Button>
          </form>
        </details>

        <details className={styles.section} open>
          <summary>
            <span>Markets and languages</span>
            <Badge tone={data.prospectingMarkets.length ? "success" : "warning"}>
              {data.prospectingMarkets.length ? "Ready" : "Needs review"}
            </Badge>
          </summary>
          <form action={saveCompanyProfileAction} className={styles.sectionBody}>
            <input type="hidden" name="section" value="markets" />
            <Area
              name="operatingMarkets"
              label="Current operating markets · discovered"
              values={data.operatingMarkets}
            />
            <Area
              name="exportMarkets"
              label="Export markets · discovered"
              values={data.exportMarkets ?? []}
            />
            <Area
              name="prospectingMarkets"
              label="Markets to prospect · selected by you"
              values={data.prospectingMarkets}
            />
            <Area
              name="excludedMarkets"
              label="Excluded markets"
              values={data.excludedMarkets}
            />
            <Area
              name="supportedLanguages"
              label="Supported languages · discovered"
              values={data.supportedLanguages}
            />
            <Area
              name="outreachLanguages"
              label="Outreach languages · selected by you"
              values={data.outreachLanguages}
            />
            <Button type="submit">Save markets</Button>
          </form>
        </details>
      </section>

      <Card>
        <CardHeader
          title="Offerings"
          eyebrow={`${data.offerings.length} structured commercial offering${data.offerings.length === 1 ? "" : "s"}`}
        />
        <div className={`${shared.cardBody} ${shared.stack}`}>
          {data.offerings.length ? (
            data.offerings.map((offering) => (
              <details
                className={`${styles.section} ${styles.offering}`}
                key={offering.id}
              >
                <summary>
                  <span>
                    {offering.name}
                    <small className={styles.meta}>
                      {" "}
                      · {offering.priority} ·{" "}
                      {offering.businessModel.replaceAll("_", " ")}
                    </small>
                  </span>
                  <Badge
                    tone={
                      offering.status === "confirmed"
                        ? "success"
                        : offering.status === "excluded" || offering.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {offering.status}
                  </Badge>
                </summary>
                <div className={styles.sectionBody}>
                  <form action={saveCompanyProfileAction} className={shared.stack}>
                    <input type="hidden" name="section" value="offering" />
                    <input type="hidden" name="offeringId" value={offering.id} />
                    <Field name="name" label="Offering name" value={offering.name} />
                    <Area
                      name="shortDescription"
                      label="Description"
                      values={[offering.shortDescription]}
                    />
                    <Area
                      name="valueProposition"
                      label="Value proposition"
                      values={
                        offering.valueProposition ? [offering.valueProposition] : []
                      }
                    />
                    <Area
                      name="targetCustomerTypes"
                      label="ICP · customer types"
                      values={offering.targetCustomerTypes}
                    />
                    <Area
                      name="targetIndustries"
                      label="ICP · industries"
                      values={offering.targetIndustries}
                    />
                    <Area
                      name="targetCompanySizes"
                      label="ICP · company sizes"
                      values={offering.targetCompanySizes}
                    />
                    <Area
                      name="prospectingMarkets"
                      label="Relevant prospecting markets"
                      values={offering.prospectingMarkets}
                    />
                    <Area
                      name="qualificationRequirements"
                      label="Qualification requirements"
                      values={offering.qualificationRequirements}
                    />
                    <Area
                      name="disqualifyingConditions"
                      label="Disqualifying conditions"
                      values={offering.disqualifyingConditions}
                    />
                    <Area
                      name="commercialConstraints"
                      label="Commercial constraints"
                      values={offering.commercialConstraints}
                    />
                    <div>
                      <strong>Product categories</strong>
                      <p className={styles.meta}>
                        {offering.productCategories?.join(", ") || "None detected"}
                      </p>
                    </div>
                    <div>
                      <strong>Supporting capabilities</strong>
                      <p className={styles.meta}>
                        {data.capabilities
                          .filter((item) =>
                            offering.supportingCapabilityIds.includes(item.id),
                          )
                          .map((item) => item.name)
                          .join(", ") || "None linked"}
                      </p>
                    </div>
                    <div>
                      <strong>Buyer personas</strong>
                      {offering.buyerPersonas.length ? (
                        <ul className={styles.list}>
                          {offering.buyerPersonas.map((persona) => (
                            <li key={persona.titleGroup}>
                              {persona.titleGroup}: {persona.exampleTitles.join(", ")}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.meta}>No buyer roles confirmed.</p>
                      )}
                    </div>
                    {Object.keys(offering.adaptiveFields).length ? (
                      <div>
                        <strong>Model-specific details</strong>
                        <ul className={styles.list}>
                          {Object.entries(offering.adaptiveFields).map(([key, value]) => (
                            <li key={key}>
                              {key.replaceAll("_", " ")}:{" "}
                              {Array.isArray(value) ? value.join(", ") : value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Button type="submit">Save offering</Button>
                  </form>
                  <form action={updateOfferingStatusAction} className={styles.actions}>
                    <input type="hidden" name="offeringId" value={offering.id} />
                    {offering.status === "excluded" || offering.status === "rejected" ? (
                      <Button
                        type="submit"
                        name="intent"
                        value="restore"
                        variant="primary"
                      >
                        Restore offering
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        name="intent"
                        value="confirm"
                        variant="primary"
                      >
                        Confirm offering
                      </Button>
                    )}
                    <Button
                      type="submit"
                      name="intent"
                      value="capability"
                      variant="ghost"
                    >
                      Convert to capability
                    </Button>
                    {offering.status !== "excluded" && offering.status !== "rejected" ? (
                      <Button
                        type="submit"
                        name="intent"
                        value="exclude"
                        variant="danger"
                      >
                        Mark as not relevant
                      </Button>
                    ) : null}
                  </form>
                </div>
              </details>
            ))
          ) : (
            <p>
              No offerings are available yet. Re-run analysis or add concise website
              content before continuing.
            </p>
          )}
        </div>
      </Card>

      <section className={styles.sectionGrid}>
        <ReadOnlySection
          title="Capabilities"
          values={data.capabilities.map((item) => item.name)}
          status={data.capabilities.length ? "Ready" : "Optional"}
        />
        <ReadOnlySection
          title="Customer landscape"
          values={[
            ...(data.customerLandscape?.customerTypes ?? []).map(
              (item) => `Customer type: ${item}`,
            ),
            ...(data.customerLandscape?.buyerIndustries ?? []).map(
              (item) => `Industry: ${item}`,
            ),
            ...(data.customerLandscape?.customerNeeds ?? []).map(
              (item) => `Need: ${item}`,
            ),
            ...(data.customerLandscape?.relationshipTypes ?? []).map(
              (item) => `Relationship: ${item}`,
            ),
          ]}
          status={data.customerLandscape?.customerTypes.length ? "Ready" : "Optional"}
        />
        <ReadOnlySection
          title="Differentiators"
          values={(data.differentiators ?? []).map((item) => item.title)}
          status={data.differentiators?.length ? "Ready" : "Optional"}
        />
        <ReadOnlySection
          title="Credibility"
          values={[
            ...data.companyProof
              .slice(0, 8)
              .map(
                (item) => `${item.title}${item.approvedForOutreach ? " · approved" : ""}`,
              ),
            ...data.existingCustomers.map((item) => item.companyName),
          ]}
          status={data.companyProof.length ? "Ready" : "Optional"}
        />
        {data.companyProof.length > 8 ? (
          <ReadOnlySection
            title="Credibility · view all"
            values={data.companyProof.map(
              (item) => `${item.type.replaceAll("_", " ")}: ${item.title}`,
            )}
            status={`${data.companyProof.length} proof points`}
          />
        ) : null}
        <ReadOnlySection
          title="Business models"
          values={data.businessModels.map((item) => item.replaceAll("_", " "))}
          status={data.businessModels.length ? "Ready" : "Needs review"}
        />
        <ReadOnlySection
          title="Advanced"
          values={[
            ...(data.verifiedClaims ?? []).map((item) => `Verified: ${item}`),
            ...data.strategicDirection.map((item) => `Direction: ${item}`),
            ...(data.commercialConstraints ?? []).map(
              (item) => `Commercial constraint: ${item}`,
            ),
            ...(data.regulatoryLimitations ?? []).map(
              (item) => `Regulatory limitation: ${item}`,
            ),
            ...(data.unverifiedInformation ?? []).map(
              (item) => `Needs verification: ${item}`,
            ),
            ...data.communicationRules.approvedClaims.map(
              (item) => `Approved claim: ${item}`,
            ),
            ...data.communicationRules.prohibitedClaims.map(
              (item) => `Do not claim: ${item}`,
            ),
            ...data.research.sources.map(
              (item) =>
                `Source: ${item.pageTitle ?? item.url ?? "Uploaded material"} · ${item.extractedAt}${item.extractedText ? ` · ${item.extractedText}` : ""}`,
            ),
          ]}
          status="Optional"
        />
      </section>

      <Card>
        <CardHeader
          title="Profile review"
          eyebrow={`${pending.filter((item) => (item.priority ?? (item.required ? "blocking" : "optional")) === "blocking").length} blocking · ${pending.filter((item) => item.priority === "important").length} important · one decision expanded`}
        />
        <div
          className={`${shared.cardBody} ${styles.questionList}`}
          id="review-questions"
        >
          {pending.length ? (
            pending.slice(0, 1).map((question) => (
              <form
                action={answerProfileQuestionAction}
                className={styles.question}
                key={question.id}
              >
                <input type="hidden" name="questionId" value={question.id} />
                <strong>{question.title}</strong>
                {question.description ? <p>{question.description}</p> : null}
                <div className={styles.options}>
                  {question.options?.length ? (
                    question.options.map((option) => (
                      <label key={option.id}>
                        <input
                          type={
                            question.inputType === "multi_select" ? "checkbox" : "radio"
                          }
                          name="answer"
                          value={option.label}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))
                  ) : (
                    <input
                      className={form.input}
                      name="answer"
                      type={question.inputType === "number" ? "number" : "text"}
                    />
                  )}
                </div>
                <div className={styles.actions}>
                  <Button type="submit" name="intent" value="answer" variant="primary">
                    Save answer
                  </Button>
                  {!question.required ? (
                    <>
                      <Button type="submit" name="intent" value="skip" variant="ghost">
                        Skip for now
                      </Button>
                      <Button type="submit" name="intent" value="dismiss" variant="ghost">
                        Dismiss suggestion
                      </Button>
                    </>
                  ) : null}
                </div>
              </form>
            ))
          ) : (
            <p>No review questions remain. The profile is commercially ready.</p>
          )}
        </div>
      </Card>
    </>
  );
}

function Summary({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.summaryItem}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function Field({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className={form.field}>
      <span>{label}</span>
      <input className={form.input} name={name} defaultValue={value} required />
    </label>
  );
}
function Area({
  name,
  label,
  values,
}: {
  name: string;
  label: string;
  values: string[];
}) {
  return (
    <label className={form.field}>
      <span>{label}</span>
      <textarea className={form.textarea} name={name} defaultValue={values.join("\n")} />
    </label>
  );
}
function ReadOnlySection({
  title,
  values,
  status,
}: {
  title: string;
  values: string[];
  status: string;
}) {
  return (
    <details className={styles.section}>
      <summary>
        <span>{title}</span>
        <Badge
          tone={
            status === "Ready"
              ? "success"
              : status === "Needs review"
                ? "warning"
                : "neutral"
          }
        >
          {status}
        </Badge>
      </summary>
      <div className={styles.sectionBody}>
        {values.length ? (
          <ul className={styles.list}>
            {values.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.meta}>No information found.</p>
        )}
      </div>
    </details>
  );
}

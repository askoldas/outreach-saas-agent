import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import type { CompanyProfileV3Review } from "@/server/company-profile-v3/repository";
import {
  answerCompanyProfileV3QuestionAction,
  publishCompanyProfileV3Action,
  reviewCompanyProfileV3ArchetypeAction,
  reviewCompanyProfileV3OfferingAction,
  reviewCompanyProfileV3RuleAction,
  skipCompanyProfileV3QuestionAction,
  updateCompanyProfileV3CoreAction,
  updateCompanyProfileV3OfferingAction,
} from "@/server/company-profile-v3/actions";
import styles from "./CompanyProfileWorkspace.module.css";

export function CompanyProfileV3Workspace({
  review,
}: Readonly<{ review: CompanyProfileV3Review }>) {
  const pending = review.questions.filter((question) => question.status === "pending");
  const reviewable = ["needs_input", "ready_for_review"].includes(review.state);
  const publishable =
    reviewable && review.offerings.some((offering) => offering.status === "active");
  return (
    <>
      <section
        id="profile-v3-review"
        className={styles.summaryGrid}
        aria-label="V3 profile review summary"
      >
        <Summary value={review.offerings.length} label="Offerings" />
        <Summary value={review.businessRoles.length} label="Business roles" />
        <Summary value={review.rules.length} label="Commercial rules" />
        <Summary value={pending.length} label="Questions need input" />
      </section>

      <Card>
        <CardHeader
          title="Company Intelligence review"
          eyebrow={`${review.contractVersion} · ${label(review.state)}`}
          action={<StateBadge state={review.state} />}
        />
        <div className={shared.cardBody}>
          <p>
            Review the commercial model, offering-specific buyer logic, assumptions,
            unknowns, and scoped rules before publishing this profile for campaigns.
          </p>
          {pending.length ? (
            <Badge tone="warning">
              {pending.length} optional clarification
              {pending.length === 1 ? "" : "s"} remain. Answer only what is useful.
            </Badge>
          ) : null}
        </div>
      </Card>

      {reviewable ? (
        <Card>
          <CardHeader
            title="Publish reviewed profile"
            eyebrow="Create an immutable Company Intelligence version"
            action={
              <form action={publishCompanyProfileV3Action}>
                <input type="hidden" name="draftId" value={review.id} />
                <Button type="submit" variant="primary" disabled={!publishable}>
                  Publish V3 profile
                </Button>
              </form>
            }
          />
          <div className={shared.cardBody}>
            <p>
              Publishing freezes the reviewed business model, offerings, buyer archetypes,
              and accepted rules for future campaign strategies.
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Business model" eyebrow="How the company creates value" />
        <div className={shared.cardBody}>
          {reviewable ? (
            <form
              action={updateCompanyProfileV3CoreAction}
              className={styles.sectionBody}
            >
              <input type="hidden" name="draftId" value={review.id} />
              <CoreField
                name="publicName"
                label="Public company name"
                value={review.publicName}
              />
              <CoreField
                name="canonicalDomain"
                label="Canonical domain"
                value={review.canonicalDomain}
              />
              <label>
                Commercial summary
                <textarea
                  className={form.control}
                  name="commercialSummary"
                  rows={4}
                  defaultValue={review.commercialSummary}
                  required
                />
              </label>
              <div className={styles.understandingGrid}>
                <CoreField
                  name="primaryRole"
                  label="Primary role"
                  value={review.businessModel?.primary_role ?? ""}
                />
                <CoreField
                  name="revenueModel"
                  label="Revenue model"
                  value={review.businessModel?.revenue_model ?? ""}
                />
                <CoreField
                  name="transactionModel"
                  label="Transaction model"
                  value={review.businessModel?.transaction_model ?? ""}
                />
                <CoreField
                  name="customerUsageMode"
                  label="Customer use mode"
                  value={review.businessModel?.customer_usage_mode ?? ""}
                />
              </div>
              <Button type="submit">Save reviewed core</Button>
            </form>
          ) : (
            <div className={styles.understandingGrid}>
              <Info label="Company" value={review.publicName} />
              <Info label="Domain" value={review.canonicalDomain} />
              <Info
                label="Primary role"
                value={review.businessModel?.primary_role ?? "Not established"}
              />
              <Info
                label="Revenue model"
                value={review.businessModel?.revenue_model ?? "Unknown"}
              />
              <Info
                label="Transaction model"
                value={review.businessModel?.transaction_model ?? "Unknown"}
              />
              <Info
                label="Customer use"
                value={review.businessModel?.customer_usage_mode ?? "Unknown"}
              />
            </div>
          )}
          <div>
            <strong>Commercial roles</strong>
            <ul className={styles.list}>
              {review.businessRoles.map((role) => (
                <li key={role.id}>
                  {label(role.role_type)} · {role.priority} · {percent(role.confidence)}{" "}
                  confidence
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Offerings and buyer logic"
          eyebrow="Campaign-worthy commercial units"
        />
        <div className={`${shared.cardBody} ${shared.stack}`}>
          {review.offerings.map((offering) => (
            <details className={`${styles.section} ${styles.offering}`} key={offering.id}>
              <summary>
                <span>{offering.name}</span>
                <Badge tone={offering.status === "active" ? "success" : "warning"}>
                  {label(offering.status)}
                </Badge>
              </summary>
              <div className={styles.sectionBody}>
                <p>{offering.short_description}</p>
                <Info label="Offering type" value={offering.offering_type} />
                <Info
                  label="Confidence"
                  value={`${percent(offering.confidence)} confidence`}
                />
                <JsonList
                  label="Value proposition"
                  value={path(offering.commercial_mechanics_json, "valueProposition")}
                />
                <JsonList
                  label="Customer problems"
                  value={path(offering.commercial_mechanics_json, "customerProblems")}
                />
                <JsonList
                  label="Expected outcomes"
                  value={path(offering.commercial_mechanics_json, "expectedOutcomes")}
                />
                <JsonList
                  label="Why buyers act"
                  value={path(offering.buyer_logic_json, "whyBuy")}
                />
                <JsonList
                  label="Required conditions"
                  value={path(offering.buyer_logic_json, "requiredConditions")}
                />
                <JsonList
                  label="Preferred conditions"
                  value={path(offering.buyer_logic_json, "preferredConditions")}
                />
                <JsonList
                  label="Likely triggers"
                  value={path(offering.buyer_logic_json, "likelyTriggers")}
                />
                <JsonList
                  label="Incompatible conditions"
                  value={path(offering.buyer_logic_json, "incompatibleConditions")}
                />
                <JsonList
                  label="Likely decision roles"
                  value={path(offering.buyer_logic_json, "likelyDecisionRoles")}
                />
                <Info
                  label="Procurement pattern"
                  value={String(
                    path(offering.buyer_logic_json, "procurementPattern") || "Unknown",
                  )}
                />
                <JsonList
                  label="Positive evidence signals"
                  value={path(offering.buyer_logic_json, "positiveEvidenceSignals")}
                />
                <JsonList
                  label="Negative evidence signals"
                  value={path(offering.buyer_logic_json, "negativeEvidenceSignals")}
                />
                <Info
                  label="Buyer-logic confidence"
                  value={`${percent(Number(path(offering.buyer_logic_json, "confidence") || 0))} confidence`}
                />
                <JsonList
                  label="Buyer-logic evidence"
                  value={path(offering.buyer_logic_json, "evidenceIds")}
                />
                {reviewable ? (
                  <details className={styles.section}>
                    <summary>Correct offering and buyer logic</summary>
                    <form
                      action={updateCompanyProfileV3OfferingAction}
                      className={shared.stack}
                    >
                      <input type="hidden" name="draftId" value={review.id} />
                      <input type="hidden" name="entityId" value={offering.id} />
                      <CoreField
                        name="name"
                        label="Offering boundary / name"
                        value={offering.name}
                      />
                      <CoreField
                        name="offeringType"
                        label="Offering type"
                        value={offering.offering_type}
                      />
                      <CoreField
                        name="shortDescription"
                        label="Summary"
                        value={offering.short_description}
                      />
                      <CoreField
                        name="buyingMotion"
                        label="Transaction / buying motion"
                        value={String(
                          path(offering.commercial_mechanics_json, "buyingMotion") ||
                            "unknown",
                        )}
                      />
                      <CoreField
                        name="customerConsumptionMode"
                        label="Customer consumption / use mode"
                        value={String(
                          path(
                            offering.commercial_mechanics_json,
                            "customerConsumptionMode",
                          ) || "unknown",
                        )}
                      />
                      {[
                        [
                          "valueProposition",
                          "Value proposition",
                          offering.commercial_mechanics_json,
                        ],
                        [
                          "customerProblems",
                          "Customer problems",
                          offering.commercial_mechanics_json,
                        ],
                        [
                          "expectedOutcomes",
                          "Expected outcomes",
                          offering.commercial_mechanics_json,
                        ],
                        ["whyBuy", "Why buyers buy", offering.buyer_logic_json],
                        [
                          "requiredConditions",
                          "Required conditions",
                          offering.buyer_logic_json,
                        ],
                        [
                          "preferredConditions",
                          "Preferred conditions",
                          offering.buyer_logic_json,
                        ],
                        ["likelyTriggers", "Triggers", offering.buyer_logic_json],
                        [
                          "incompatibleConditions",
                          "Incompatible conditions",
                          offering.buyer_logic_json,
                        ],
                        [
                          "likelyDecisionRoles",
                          "Likely decision roles",
                          offering.buyer_logic_json,
                        ],
                        [
                          "positiveEvidenceSignals",
                          "Positive evidence signals",
                          offering.buyer_logic_json,
                        ],
                        [
                          "negativeEvidenceSignals",
                          "Negative evidence signals",
                          offering.buyer_logic_json,
                        ],
                      ].map(([name, fieldLabel, source]) => (
                        <label className={form.field} key={String(name)}>
                          <span>{String(fieldLabel)}</span>
                          <textarea
                            className={form.textarea}
                            name={String(name)}
                            defaultValue={jsonLines(source, String(name))}
                          />
                        </label>
                      ))}
                      <CoreField
                        name="procurementPattern"
                        label="Procurement pattern"
                        value={String(
                          path(offering.buyer_logic_json, "procurementPattern") || "",
                        )}
                      />
                      <Button type="submit">Save offering intelligence</Button>
                    </form>
                  </details>
                ) : null}
                <strong>Buyer archetypes</strong>
                {offering.archetypes.length ? (
                  <ul className={styles.list}>
                    {offering.archetypes.map((archetype) => (
                      <li key={archetype.id}>
                        {archetype.name} · {label(archetype.relationship_type)} ·{" "}
                        {label(archetype.priority)} · {percent(archetype.confidence)} ·{" "}
                        {label(archetype.status)}
                        {reviewable ? (
                          <form
                            action={reviewCompanyProfileV3ArchetypeAction}
                            className={styles.actions}
                          >
                            <input type="hidden" name="draftId" value={review.id} />
                            <input type="hidden" name="entityId" value={archetype.id} />
                            <Button type="submit" name="intent" value="confirm">
                              Confirm
                            </Button>
                            <Button type="submit" name="intent" value="reject">
                              Reject
                            </Button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.meta}>No buyer archetype was linked.</p>
                )}
                {reviewable ? (
                  <form
                    action={reviewCompanyProfileV3OfferingAction}
                    className={styles.actions}
                  >
                    <input type="hidden" name="draftId" value={review.id} />
                    <input type="hidden" name="entityId" value={offering.id} />
                    <Button type="submit" name="intent" value="activate">
                      Keep active
                    </Button>
                    <Button type="submit" name="intent" value="deactivate">
                      Mark inactive
                    </Button>
                  </form>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Commercial rules" eyebrow="Scoped proposed constraints" />
        <div className={shared.cardBody}>
          {review.rules.length ? (
            <ul className={styles.list}>
              {review.rules.map((rule) => (
                <li key={rule.id}>
                  <strong>{label(rule.rule_key)}</strong> · {rule.scope} · {rule.strength}
                  {" · "}
                  {rule.status}
                  <br />
                  {rule.description}
                  {reviewable ? (
                    <form
                      action={reviewCompanyProfileV3RuleAction}
                      className={styles.actions}
                    >
                      <input type="hidden" name="draftId" value={review.id} />
                      <input type="hidden" name="entityId" value={rule.id} />
                      <Button type="submit" name="intent" value="confirm">
                        Confirm
                      </Button>
                      <Button type="submit" name="intent" value="reject">
                        Reject
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.meta}>No reusable commercial rules were proposed.</p>
          )}
        </div>
      </Card>

      {pending.length ? (
        <Card>
          <CardHeader
            title="Clarification questions"
            eyebrow="Only decisions that materially affect future campaigns"
          />
          <div className={`${shared.cardBody} ${styles.questionList}`}>
            {pending.map((question) => (
              <form
                action={answerCompanyProfileV3QuestionAction}
                className={styles.question}
                key={question.id}
              >
                <input type="hidden" name="questionId" value={question.id} />
                <div>
                  <Badge tone={question.impact === "blocking" ? "danger" : "warning"}>
                    {question.impact === "blocking" ? "high impact" : question.impact}
                  </Badge>
                  <strong> {question.question}</strong>
                  <p>{question.explanation}</p>
                </div>
                <QuestionInput question={question} />
                <div className={styles.actions}>
                  <Button type="submit" variant="primary">
                    Save answer
                  </Button>
                  <Button type="submit" formAction={skipCompanyProfileV3QuestionAction}>
                    Skip
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function QuestionInput({
  question,
}: Readonly<{ question: CompanyProfileV3Review["questions"][number] }>) {
  const options = arrayObjects(question.options_json);
  if (options.length) {
    return (
      <div className={styles.options}>
        {options.map((option) => (
          <label key={String(option.optionKey)}>
            <input
              type={question.answer_type === "multi_select" ? "checkbox" : "radio"}
              name="answer"
              value={String(option.optionKey)}
              required={question.answer_type !== "multi_select"}
            />
            <span>
              {String(option.label)}
              {option.consequenceSummary ? (
                <small className={styles.meta}>
                  {" "}
                  · {String(option.consequenceSummary)}
                </small>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    );
  }
  return <textarea className={form.control} name="answer" rows={3} required />;
}

function Summary({ value, label: itemLabel }: { value: number; label: string }) {
  return (
    <div className={styles.summaryItem}>
      <strong>{value}</strong>
      <span>{itemLabel}</span>
    </div>
  );
}

function Info({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{itemLabel}</strong>
      <p>{label(value)}</p>
    </div>
  );
}

function CoreField({
  name,
  label: itemLabel,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label>
      {itemLabel}
      <input
        className={form.control}
        name={name}
        defaultValue={value}
        required={name === "publicName" || name === "canonicalDomain"}
      />
    </label>
  );
}

function JsonList({ label: itemLabel, value }: { label: string; value: unknown }) {
  const entries = Array.isArray(value) ? value.map(String) : [];
  return (
    <div>
      <strong>{itemLabel}</strong>
      <p className={styles.meta}>{entries.join(", ") || "Not established"}</p>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone =
    state === "ready_for_review" ? "success" : state === "failed" ? "danger" : "warning";
  return <Badge tone={tone}>{label(state)}</Badge>;
}

function path(value: unknown, key: string) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function jsonLines(value: unknown, key: string) {
  const selected = path(value, key);
  return Array.isArray(selected)
    ? selected.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

function arrayObjects(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

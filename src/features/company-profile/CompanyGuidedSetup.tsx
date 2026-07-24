import type { CompanyProfile } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import {
  AiGuidedWorkspace,
  GuidedOptionCard,
  GuidedStatus,
} from "@/features/guided/AiGuidedWorkspace";
import {
  answerProfileQuestionAction,
  publishCompanyProfileAction,
  updateOfferingStatusAction,
} from "@/server/company-profile/actions";
import styles from "./CompanyProfileWorkspace.module.css";

export function CompanyGuidedSetup({ profile }: { profile: CompanyProfile }) {
  const data = profile.structuredProfile;
  if (!data) return null;
  const pending = profile.reviewQuestions.filter((item) => item.status === "unanswered");
  const detected = data.offerings.filter((item) => item.status === "detected");
  const activeQuestion = pending[0];
  const step = pending.length ? 5 : 9;
  const requiresItemClassification = false;

  return (
    <AiGuidedWorkspace
      context={`Company — ${data.name}`}
      currentStep={step}
      totalSteps={10}
      summary={
        <>
          <GuidedStatus
            label="Business models"
            value={data.businessModels.map(label)}
            state="saved"
          />
          <GuidedStatus
            label="Active offerings"
            value={data.offerings
              .filter((item) => item.status === "confirmed")
              .map((item) => item.name)}
            state={detected.length ? "needs_review" : "saved"}
          />
          <GuidedStatus
            label="Prospecting markets"
            value={data.prospectingMarkets}
            state={data.prospectingMarkets.length ? "saved" : "needs_review"}
          />
          <GuidedStatus
            label="Commercial decisions"
            value={pending.length ? `${pending.length} remaining` : "Complete"}
            state={pending.length ? "needs_review" : "applied"}
          />
        </>
      }
    >
      {requiresItemClassification ? (
        <>
          <div>
            <h2>Classify detected offerings</h2>
            <p>
              I found items that may be sold independently. Confirm how each should be
              represented before defining its customers and buyer roles.
            </p>
          </div>
          <div className={styles.questionList}>
            {detected.map((offering) => (
              <form
                action={updateOfferingStatusAction}
                className={styles.question}
                key={offering.id}
              >
                <input type="hidden" name="offeringId" value={offering.id} />
                <strong>{offering.name}</strong>
                <p>{offering.shortDescription}</p>
                <div className={styles.actions}>
                  <Button type="submit" name="intent" value="confirm" variant="primary">
                    Standalone offering
                  </Button>
                  <Button type="submit" name="intent" value="capability" variant="ghost">
                    Supporting capability
                  </Button>
                  <Button type="submit" name="intent" value="exclude" variant="danger">
                    Not relevant
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </>
      ) : activeQuestion ? (
        <form action={answerProfileQuestionAction} className={styles.question}>
          <input type="hidden" name="questionId" value={activeQuestion.id} />
          <div>
            <h2>{activeQuestion.title}</h2>
            <p>{activeQuestion.description ?? explanation(activeQuestion.category)}</p>
          </div>
          <div className={styles.options}>
            {activeQuestion.options?.map((option, index) => (
              <label key={option.id}>
                <input
                  type={
                    activeQuestion.inputType === "multi_select" ? "checkbox" : "radio"
                  }
                  name="answer"
                  value={option.label}
                />
                <GuidedOptionCard recommended={index === 0}>
                  {option.label}
                </GuidedOptionCard>
              </label>
            ))}
          </div>
          <label className={form.field}>
            <span>Other or explain it in your own words</span>
            <input
              className={form.input}
              name="answer"
              placeholder="Describe a custom commercial requirement"
            />
          </label>
          <div className={styles.actions}>
            <Button type="submit" name="intent" value="answer" variant="primary">
              Apply answer
            </Button>
            {!activeQuestion.required ? (
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
      ) : (
        <>
          <div>
            <h2>Review and publish</h2>
            <p>
              The commercially important decisions are complete. Publishing freezes this
              reviewed version for future campaign setup.
            </p>
          </div>
          <form action={publishCompanyProfileAction}>
            <Button type="submit" variant="primary">
              Publish Company Profile
            </Button>
          </form>
        </>
      )}
    </AiGuidedWorkspace>
  );
}

function label(value: string) {
  return value.replaceAll("_", " ");
}
function explanation(category: string) {
  const messages: Record<string, string> = {
    customer: "Confirm who can realistically buy this offering.",
    buyer_persona: "Confirm the roles that own or influence the buying decision.",
    market: "Website presence is not the same as your prospecting priority.",
    qualification: "Define the evidence a company needs to become a strong match.",
    constraint: "Add limits that should prevent unsuitable companies being selected.",
  };
  return (
    messages[category] ??
    "Review this interpretation before it changes the saved profile."
  );
}

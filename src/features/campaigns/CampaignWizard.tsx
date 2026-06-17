"use client";

import { useState } from "react";
import { offers } from "@/data/mock/prospecting";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

const steps = ["Select offer", "Define market", "Ideal companies", "Review strategy"];

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const currentStep = steps[step] ?? "Select offer";

  return (
    <Card>
      <CardHeader
        title={currentStep}
        eyebrow="Campaign wizard"
        action={<Badge tone="accent">Step {step + 1} of {steps.length}</Badge>}
      />
      <div className={styles.cardBody}>
        <ol className={styles.pillList} aria-label="Campaign wizard steps">
          {steps.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>

        <div className={styles.stack} style={{ marginTop: "var(--space-5)" }}>
          {step === 0 ? <OfferStep /> : null}
          {step === 1 ? <MarketStep /> : null}
          {step === 2 ? <CompanyStep /> : null}
          {step === 3 ? <StrategyStep /> : null}
          {notice ? <Badge tone="success">{notice}</Badge> : null}
          <div className={styles.filters}>
            <Button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((value) => value + 1)}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setNotice("Strategy reviewed in prototype")}>
                Confirm mock strategy
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function OfferStep() {
  return (
    <label className={form.field} htmlFor="campaign-offer">
      <span>Selected offer</span>
      <select className={form.select} id="campaign-offer" defaultValue={offers[0]?.id}>
        {offers.map((offer) => (
          <option key={offer.id} value={offer.id}>
            {offer.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function MarketStep() {
  return (
    <>
      <label className={form.field} htmlFor="objective">
        <span>Campaign objective</span>
        <select className={form.select} id="objective" defaultValue="direct-buyers">
          <option value="direct-buyers">Direct buyers</option>
          <option value="distributors">Distributors</option>
          <option value="partners">Partners</option>
          <option value="subcontracting">Subcontracting clients</option>
        </select>
      </label>
      <label className={form.field} htmlFor="region">
        <span>Country or region</span>
        <input className={form.input} id="region" defaultValue="Sweden and Denmark" />
      </label>
      <label className={form.field} htmlFor="language">
        <span>Campaign language</span>
        <input className={form.input} id="language" defaultValue="English" />
      </label>
    </>
  );
}

function CompanyStep() {
  return (
    <>
      <label className={form.field} htmlFor="types">
        <span>Preferred company types</span>
        <textarea className={form.textarea} id="types" defaultValue="Equipment manufacturers, automation integrators" />
      </label>
      <label className={form.field} htmlFor="industries">
        <span>Industries</span>
        <textarea className={form.textarea} id="industries" defaultValue="Factory automation, industrial equipment, production systems" />
      </label>
      <label className={form.field} htmlFor="size">
        <span>Company-size preference</span>
        <input className={form.input} id="size" defaultValue="50-500 employees" />
      </label>
      <label className={form.field} htmlFor="exclusions">
        <span>Exclusions</span>
        <textarea className={form.textarea} id="exclusions" defaultValue="Retail-only sellers; prototype-only hobby shops" />
      </label>
      <label className={form.field} htmlFor="lead-count">
        <span>Desired lead count</span>
        <input className={form.input} id="lead-count" type="number" defaultValue="40" min="1" />
      </label>
    </>
  );
}

function StrategyStep() {
  const strategy = [
    ["Target segments", "Equipment builders, automation integrators, and industrial OEMs"],
    ["Search terminology", "custom machined parts, OEM component supplier, automation equipment"],
    ["Local-language terms", "maskinkomponenter, industrikomponenter, underleverandor"],
    ["Expected sources", "Company sites, industry directories, association lists"],
    ["Qualification criteria", "Equipment production, recurring component needs, visible contact route"],
    ["Exclusions", "Retail-only businesses and companies below prototype stage"],
    ["Known limitations", "Employee counts may be incomplete for private firms"],
  ];

  return (
    <div className={styles.stack}>
      {strategy.map(([label, value]) => (
        <label className={form.field} key={label}>
          <span>{label}</span>
          <textarea className={form.textarea} defaultValue={value} />
        </label>
      ))}
    </div>
  );
}

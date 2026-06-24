import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractContactRoutesFromEvidence } from "./contact-extractor.ts";

describe("extractContactRoutesFromEvidence", () => {
  it("extracts public Italian emails and phone numbers from source text", () => {
    const routes = extractContactRoutesFromEvidence({
      sourceUrl: "https://viafarmaciaonline.it/contatti",
      text: "Recapiti ; +39 0546 21237 \u00b7 +39 0546 21069 ; +39 335 6690757 ; info@viafarmaciaonline.it \u00b7 farmaciazanotti@gmail.com.",
      website: "https://viafarmaciaonline.it",
    });
    const values = routes.map((route) => route.value);

    assert(values.includes("info@viafarmaciaonline.it"));
    assert(values.includes("farmaciazanotti@gmail.com"));
    assert(values.includes("+39 0546 21237"));
    assert(values.includes("+39 0546 21069"));
    assert(values.includes("+39 335 6690757"));
  });
});

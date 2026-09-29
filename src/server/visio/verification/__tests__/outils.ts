/** Outils communs aux tests des gardes (scénario fictif « Menuiserie »). */

import { entrelacer } from "../../dialogue";
import { verifierFaits, type EntreeV1 } from "../verifier-faits";
import type { ExtractionV1, FaitExtrait } from "../../schemas/extraction";
import {
  DATE_ECHANGE,
  extraction,
  FAITS,
  SEGMENTS,
} from "../../../../../tests/fixtures/visio/scenario-menuiserie";
import { catalogueDeTest } from "../../../../../tests/outils/faux-circuit-visio";

export { DATE_ECHANGE, extraction, FAITS, SEGMENTS };

export function verifier(
  faits: readonly FaitExtrait[],
  surcharge: Partial<ExtractionV1> = {},
  e: Partial<EntreeV1> = {},
) {
  return verifierFaits({
    extraction: extraction(faits, surcharge),
    segments: entrelacer(SEGMENTS).segments,
    catalogue: catalogueDeTest().refs,
    connus: new Set(["H001"]),
    dateEchange: DATE_ECHANGE,
    ...e,
  });
}

export function leFait(bilan: ReturnType<typeof verifier>, ref: string) {
  const f = bilan.faits.find((x) => x.ref === ref);
  if (!f) throw new Error(`fait ${ref} absent`);
  return f;
}

export function avec(ref: string, change: Partial<FaitExtrait>): FaitExtrait[] {
  return FAITS.map((f) => (f.ref === ref ? { ...f, ...change } : f));
}

// L0c-1 — les données structurées d'une offre de formateur indépendant
// (JobPosting + FAQPage), telles que la page les émet interrupteur allumé :
// même lexique que la FAQ affichée, `CONTRACTOR` seul, aucun salaire de base.
// Interrupteur coupé / offre salariée / apporteur : sortie inchangée.
import { describe, expect, it } from "vitest";

import type { JobOffer } from "../../../../prisma/generated/client";
import { buildFaqJsonLd } from "@/lib/seo";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";

import { buildOfferFaq } from "../faq-offre";
import { buildOfferFaqFreelance } from "../faq-offre-freelance";
import { modeFormateurFreelance } from "../formulaire-formateur-freelance";

const MOTS_INTERDITS =
  /poste|entretien|recrutement|salaire|r[ée]mun[ée]ration|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i;

// L14 — la FAQ nomme les étapes réelles (entretien noté, formation obligatoire) ;
// l'annonce JobPosting, elle, reste sans ces mots.
const MOTS_INTERDITS_FAQ = new RegExp(
  MOTS_INTERDITS.source.replace("|entretien", "").replace("|obligatoire", ""),
  "i",
);

const offre = (surcharge: Record<string, unknown> = {}): JobOffer =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    slug: "formateur-ia-independant",
    status: "published",
    titleFr: "Formateur IA indépendant",
    titleEn: "Independent AI trainer",
    bodyFr: "<p>Animation de formations à l'intelligence artificielle, à la journée.</p>",
    bodyEn: "<p>AI training sessions, paid by the day.</p>",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
    workMode: "remote",
    city: "Grenoble",
    region: "Auvergne-Rhône-Alpes",
    country: "FR",
    jobLocations: null,
    applicantCountries: [],
    salaryMin: 350,
    salaryMax: null,
    salaryPeriod: "DAY",
    salaryCurrency: "EUR",
    salaryVisible: true,
    isCommission: false,
    contractLabel: null,
    perks: [{ labelFr: "Mutuelle et salaire garanti", labelEn: "Health cover" }],
    indexationTier: "tier_1_indexable",
    datePosted: new Date("2026-06-01T00:00:00.000Z"),
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    validThrough: null,
    filledAt: null,
    ...surcharge,
  }) as unknown as JobOffer;

/** Les valeurs texte (les clés sont le vocabulaire schema.org, ex. `datePosted`). */
function valeurs(noeud: unknown, out: string[] = []): string[] {
  if (typeof noeud === "string") out.push(noeud);
  else if (Array.isArray(noeud)) noeud.forEach((n) => valeurs(n, out));
  else if (noeud && typeof noeud === "object") Object.values(noeud).forEach((n) => valeurs(n, out));
  return out;
}

/** Ce que la page émet, interrupteur allumé (même chemin que `page.tsx`). */
function donneesDeLaPage(o: JobOffer, isFr: boolean) {
  const freelance = modeFormateurFreelance({ formulaireAllume: true, natureLue: false, offre: o });
  const jobPosting = buildJobPostingJsonLd(
    o,
    isFr ? "fr" : "en",
    freelance ? { formateurFreelance: true } : {},
  );
  const items = freelance ? buildOfferFaqFreelance(o, isFr) : buildOfferFaq(o, o.titleFr, isFr);
  return { freelance, jobPosting, faq: buildFaqJsonLd({ items }) };
}

const cas: Array<[string, JobOffer]> = [
  ["à distance", offre()],
  ["présentiel, une ville", offre({ workMode: "on_site" })],
  ["hybride", offre({ workMode: "hybrid" })],
  ["zone nationale", offre({ jobLocations: [{ city: "Grenoble" }, { city: "Lyon" }] })],
  ["multi-pays", offre({ applicantCountries: ["FR", "BE", "CH"] })],
  ["à la commission déclarée", offre({ isCommission: true })],
];

describe("JSON-LD d'une offre freelance, interrupteur allumé", () => {
  for (const [nom, o] of cas) {
    for (const isFr of [true, false]) {
      it(`${nom} (${isFr ? "fr" : "en"}) : aucun mot interdit, CONTRACTOR seul, pas de salaire`, () => {
        const { freelance, jobPosting, faq } = donneesDeLaPage(o, isFr);
        expect(freelance).toBe(true);
        expect(jobPosting).not.toBeNull();
        expect(valeurs(jobPosting).join("\n")).not.toMatch(MOTS_INTERDITS);
        expect(valeurs(faq).join("\n")).not.toMatch(MOTS_INTERDITS_FAQ);
        expect(jobPosting!.employmentType).toBe("CONTRACTOR");
        expect(jobPosting).not.toHaveProperty("baseSalary");
        expect(jobPosting).not.toHaveProperty("incentiveCompensation");
        expect(jobPosting).not.toHaveProperty("jobBenefits");
        expect(JSON.stringify(jobPosting)).not.toMatch(/baseSalary/);
      });
    }
  }

  it("un second type d'emploi déclaré ne fait pas revenir un contrat salarié", () => {
    const { jobPosting } = donneesDeLaPage(offre({ secondaryEmploymentType: "FULL_TIME" }), true);
    expect(jobPosting!.employmentType).toBe("CONTRACTOR");
  });

  it("le lexique discrimine : une offre salariée, elle, garde ses mots", () => {
    const salariee = offre({
      slug: "developpeur-fullstack",
      titleFr: "Développeur Fullstack",
      employmentType: "FULL_TIME",
      salaryMin: 41000,
      salaryPeriod: "YEAR",
    });
    const { freelance, jobPosting, faq } = donneesDeLaPage(salariee, true);
    expect(freelance).toBe(false);
    expect(jobPosting).toHaveProperty("baseSalary");
    expect(valeurs(faq).join("\n")).toMatch(MOTS_INTERDITS);
  });
});

describe("JSON-LD — non-régression (interrupteur coupé, offre salariée, apporteur)", () => {
  it("sans option, le JobPosting est celui d'avant (salaire de base, ville, avantages)", () => {
    const o = offre({
      employmentType: "FULL_TIME",
      workMode: "on_site",
      salaryMin: 41000,
      salaryMax: 85000,
      salaryPeriod: "YEAR",
    });
    const j = buildJobPostingJsonLd(o, "fr")!;
    expect(buildJobPostingJsonLd(o, "fr", {})).toEqual(j);
    expect(buildJobPostingJsonLd(o, "fr", { formateurFreelance: false })).toEqual(j);
    expect(j.employmentType).toBe("FULL_TIME");
    expect(j.baseSalary).toBeTruthy();
    expect(j.jobBenefits).toBe("Mutuelle et salaire garanti");
    expect(JSON.stringify(j.jobLocation)).toContain("Grenoble");
  });

  it("apporteur (commission) : incentiveCompensation, sans baseSalary", () => {
    const j = buildJobPostingJsonLd(
      offre({ employmentType: "FULL_TIME", isCommission: true }),
      "fr",
    )!;
    expect(j.incentiveCompensation).toBeTruthy();
    expect(j).not.toHaveProperty("baseSalary");
  });

  it("un freelance 'CONTRACTOR' sans l'interrupteur garde sa sortie d'aujourd'hui", () => {
    const o = offre({ workMode: "on_site" });
    const j = buildJobPostingJsonLd(o, "fr")!;
    expect(j.baseSalary).toBeTruthy();
    expect(JSON.stringify(j.jobLocation)).toContain("Grenoble");
  });
});

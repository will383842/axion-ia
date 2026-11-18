// @vitest-environment node

/**
 * Exemplaire signé d'un devis à formules — RENDU PDF RÉEL (AD-C1).
 *
 * Les autres specs lisent l'arbre React avant rendu (`collectPdfTextNormalized`). Celui-ci
 * produit le vrai PDF (`renderToBuffer`, rien n'est simulé) puis en relit le texte : il prouve
 * que le bloc « Formule retenue par le client » ET les signatures arrivent bien sur la page,
 * entiers, en v6 courante comme en v5 archivée. Aucune assertion sur le nombre de pages.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { DevisPdf, type DevisData } from "../devis";
import { DevisPdf as DevisPdfV5 } from "../archives/devis.v5";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import type { OrganismeIdentite } from "../../organisme";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const BASE: DevisData = {
  numero: "AXI-DEV-2026-014",
  dateEmission: "05/11/2026",
  dateValidite: "05/12/2026",
  identite: IDENTITE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  lignes: [
    { designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
    { designation: "Audit de maturité IA", quantite: 2, prixUnitaireHtCents: 90000 },
  ],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
};

const SIGNATAIRE_CLIENT = "Camille Durand";
const SIGNATAIRE_ORGANISME = "Alexis Martin";

const SIGNATURES: NonNullable<DevisData["signatures"]> = {
  client: {
    signataireNom: SIGNATAIRE_CLIENT,
    signataireQualite: "Gérante",
    signeAtLisible: "06/11/2026 14:32",
    empreinte: "c".repeat(64),
    methode: "confirmation_accessible",
    imageSrc: null,
  },
  axionia: {
    signataireNom: SIGNATAIRE_ORGANISME,
    signataireQualite: "Président",
    signeAtLisible: "06/11/2026 15:10",
    empreinte: "d".repeat(64),
    methode: "confirmation_accessible",
    imageSrc: null,
  },
};

const EMPREINTE_CHOIX = "ab".repeat(32);

const FORMULE_A = {
  formuleLibelle: "Formule A · Mise en place + maintenance",
  automatisations: ["Relance des impayés"],
  totalPonctuelHtLisible: "1 000,00 €",
  totalPonctuelTtcLisible: "1 200,00 €",
  recurrent: ["Maintenance : 40,00 € HT / mois, payée 6 mois d'avance"],
  empreinteChoix: EMPREINTE_CHOIX,
};

const FORMULE_B = {
  formuleLibelle: "Formule B · Mise en place + abonnement",
  automatisations: ["Relance des impayés", "Tri du courrier"],
  totalPonctuelHtLisible: "300,00 €",
  totalPonctuelTtcLisible: "360,00 €",
  recurrent: ["Abonnement : 90,00 € HT / mois, payé 1 mois d'avance"],
  empreinteChoix: EMPREINTE_CHOIX,
};

const aFormules = (choix?: typeof FORMULE_A): DevisData => ({
  ...BASE,
  lignes: [],
  formules: vueFormules(offreFictive()),
  signatures: SIGNATURES,
  ...(choix !== undefined ? { choixRetenu: choix as never } : {}),
});

const CLASSIQUE: DevisData = {
  ...BASE,
  conditionsParticulieres:
    "Les ateliers ont lieu chez le client.\n\nLe client fournit un accès réseau.",
  signatures: SIGNATURES,
};

/** Rendu PDF réel, puis relecture du texte imprimé (espaces compressés). */
async function texteRendu(
  Composant: typeof DevisPdf | typeof DevisPdfV5,
  data: DevisData,
): Promise<string> {
  const buffer = await renderToBuffer(Composant({ data }) as Parameters<typeof renderToBuffer>[0]);
  expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.replace(/\s+/g, " ");
}

/** Contient la chaîne, sans tenir compte des espaces (une empreinte longue peut être cassée). */
const contientSansEspaces = (t: string, s: string) =>
  t.replace(/\s+/g, "").includes(s.replace(/\s+/g, ""));

const VERSIONS = [
  ["v6 courante", DevisPdf],
  ["v5 archivée", DevisPdfV5],
] as const;

for (const [version, Composant] of VERSIONS) {
  describe(`exemplaire signé — rendu PDF réel — ${version}`, () => {
    for (const [nom, choix, ligneRecurrente] of [
      [
        "formule A (maintenance)",
        FORMULE_A,
        "Maintenance : 40,00 € HT / mois, payée 6 mois d'avance",
      ],
      ["formule B (abonnement)", FORMULE_B, "Abonnement : 90,00 € HT / mois, payé 1 mois d'avance"],
    ] as const) {
      it(`${nom} : bloc de la formule retenue ET signatures, texte entier`, async () => {
        const t = await texteRendu(Composant, aFormules(choix));
        expect(t).toContain("Formule retenue par le client");
        expect(t).toContain(choix.formuleLibelle);
        expect(t).toContain(ligneRecurrente);
        expect(t).toContain("Total ponctuel : " + choix.totalPonctuelHtLisible + " HT");
        for (const a of choix.automatisations) expect(t).toContain(a);
        expect(t).toContain("Choix scellé avec la signature du client - empreinte");
        expect(contientSansEspaces(t, `empreinte ${EMPREINTE_CHOIX}`)).toBe(true);
        expect(t).toContain(SIGNATAIRE_CLIENT);
        expect(t).toContain(SIGNATAIRE_ORGANISME);
      }, 60_000);
    }

    it("devis classique avec conditions particulières : signatures, pas de « Formule retenue »", async () => {
      const t = await texteRendu(Composant, CLASSIQUE);
      expect(t).not.toContain("Formule retenue par le client");
      expect(t).not.toContain("Choix scellé");
      expect(t).toContain("Les ateliers ont lieu chez le client.");
      expect(t).toContain("Le client fournit un accès réseau.");
      expect(t).toContain(SIGNATAIRE_CLIENT);
      expect(t).toContain(SIGNATAIRE_ORGANISME);
    }, 60_000);

    it("témoin : sans choixRetenu, le bloc est absent (les signatures restent)", async () => {
      const t = await texteRendu(Composant, aFormules());
      expect(t).not.toContain("Formule retenue par le client");
      expect(t).not.toContain("Choix scellé");
      expect(t).toContain(SIGNATAIRE_CLIENT);
      expect(t).toContain(SIGNATAIRE_ORGANISME);
    }, 60_000);
  });
}

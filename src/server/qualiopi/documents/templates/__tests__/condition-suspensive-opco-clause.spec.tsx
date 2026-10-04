/**
 * 🔴 TÉMOIN ROUGE — INT-T65-A : la clause de condition suspensive OPCO est
 * imprimée MOT POUR MOT par les DEUX conventions quand la condition est posée,
 * et rien n'est imprimé sinon.
 *
 * Le texte attendu est celui de la juriste (A07), VALIDÉ par Williams le
 * 2026-10-04 à 09:19 UTC (« clause validée, on garde le point 5 ») et transmis
 * par la coordination Partners (issue axion-apporteurs#656, commentaire
 * 5978462914, 2026-10-04 09:20 UTC). Il ne se reformule pas ici : une
 * différence d'un mot doit rougir.
 *
 * Les paramètres `{opco}`, `{dateLimite}` et `{seuil}` sont posés par la
 * convention ; aucun nombre n'est écrit dans le texte. Rendu de `{seuil}` fixé
 * par ce témoin (⚠️ à confirmer par A07 avant la fusion) :
 *   - pourcentage : « 50 % du prix toutes taxes comprises de la présente convention » ;
 *   - montant : « 3 000,00 € ».
 *
 * Comparaison : sur le texte de l'arbre @react-pdf (`collectPdfText`), espaces
 * RETIRÉS des deux côtés — les retours à la ligne et le découpage en nœuds
 * `Text` (gras du point 3) ne sont pas du texte ; chaque lettre et chaque signe
 * de ponctuation, eux, sont comparés dans l'ordre.
 */
import { beforeAll, describe, expect, it } from "vitest";
import React from "react";

import { collectPdfText } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";

import { ConventionPdf, type ConventionData } from "../convention";
import { ConventionTripartitePdf, type ConventionTripartiteData } from "../convention-tripartite";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "XX00000000000",
  qualiopi: "FR-2024-00000",
  siret: "12345678900000",
  adresseSiege: "1 rue de la Formation, 75001 Paris",
  adresseExercice: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://axion-ia.fr",
};

const bipartite: ConventionData = {
  numero: "AXI-DOC-2026-900",
  estCopie: false,
  client: {
    raisonSociale: "ACME SAS",
    siret: "98765432100000",
    adresse: "10 avenue du Client, 69001 Lyon",
    contact: "Alice Martin",
  },
  intitule: "Introduction à l'IA générative",
  objectifs: ["Comprendre les fondamentaux des LLM"],
  publicVise: "Managers",
  dureeHeures: 7,
  dateDebut: "15/01/2027",
  dateFin: "15/01/2027",
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: 8,
  prixHt: 10000,
  dateConvention: "05/10/2026",
};

const tripartite: ConventionTripartiteData = {
  numero: "AXI-DOC-2026-901",
  estCopie: false,
  client: bipartite.client,
  opco: {
    nom: "OPCO Atlas",
    numeroPriseEnCharge: "PC-2026-1",
    adresse: "25 quai Panhard et Levassor, 75013 Paris",
    contact: "contact@opco-atlas.fr",
  },
  intitule: bipartite.intitule,
  objectifs: bipartite.objectifs,
  publicVise: bipartite.publicVise,
  dureeHeures: 7,
  dateDebut: bipartite.dateDebut,
  dateFin: bipartite.dateFin,
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: 8,
  prixHt: 10000,
  montantPrisEnCharge: 6000,
  resteAChargeClient: 4000,
  dateConvention: bipartite.dateConvention,
};

/** Paramètres posés par la convention (forme attendue de la prop). */
const condPourcentage = {
  opco: "OPCO Atlas",
  dateLimite: "15/12/2026",
  seuil: { type: "pourcentage", bps: 5000 },
} as const;
const condMontant = {
  opco: "OPCO Atlas",
  dateLimite: "15/12/2026",
  seuil: { type: "montant", cents: 300_000 },
} as const;

const SEUIL_POURCENTAGE = "50 % du prix toutes taxes comprises de la présente convention";
const SEUIL_MONTANT = "3 000,00 €";

/** Texte de la juriste validé par Williams, MOT POUR MOT (gras retiré). */
function clause(p: { opco: string; dateLimite: string; seuil: string }): string {
  return `Condition suspensive de prise en charge par l'opérateur de compétences

1. La condition. La présente convention est conclue sous la condition suspensive que l'opérateur de
compétences du Client, ${p.opco}, accorde par écrit, au plus tard le ${p.dateLimite}, une prise en charge de
l'action au moins égale à ${p.seuil}.

2. Les diligences. Le Client dépose sa demande de prise en charge auprès de son opérateur de
compétences dans les délais et selon les modalités fixés par celui-ci ; Axion-IA lui remet sans délai les
pièces nécessaires. La condition est réputée accomplie si le Client en a empêché l'accomplissement
(article 1304-3 du code civil).

3. L'accomplissement. Si l'accord écrit est obtenu dans le délai, la condition est accomplie et la
convention produit ses effets à compter de sa date de signature (article 1304-6 du code civil). La part
du prix non prise en charge reste due par le Client, dans les conditions des conditions générales de
vente.

4. La renonciation. La condition est stipulée dans l'intérêt exclusif du Client. Il peut y renoncer
par écrit tant qu'elle n'est ni accomplie ni défaillie (article 1304-4 du code civil) : la convention
produit alors ses effets à compter de sa date de signature, et le prix est dû dans les conditions des
conditions générales de vente.

5. La défaillance. À défaut d'accord écrit au moins égal à ${p.seuil} au ${p.dateLimite}, ou en cas de refus
ou d'accord inférieur notifié avant cette date, la condition défaille : la convention est caduque de plein
droit et réputée n'avoir jamais existé. Aucune somme n'est due par le Client et les sommes versées lui sont
restituées. Aucune action n'est exécutée avant l'accomplissement de la condition ou la renonciation du
Client.

6. Après la défaillance. Un accord de prise en charge obtenu après la défaillance ne fait pas revivre la
présente convention. Les parties peuvent conclure une nouvelle convention, qui prend effet à sa propre date
de signature.

7. Champ de la clause. La présente clause ne s'applique que si elle figure à la convention. À défaut, la
prise en charge par l'opérateur de compétences ne conditionne pas la convention, et elle est régie par les
conditions générales de vente.`;
}

/** Espaces de toute nature retirés : seuls les caractères et leur ordre comptent. */
const sansEspaces = (s: string): string => s.replace(/\s+/g, "");

const GABARITS = [
  {
    nom: "convention.tsx (bipartite)",
    rendre: (cond?: unknown) =>
      collectPdfText(
        <ConventionPdf
          data={{ ...bipartite, conditionSuspensiveOpco: cond } as ConventionData}
          identite={identite}
        />,
      ),
  },
  {
    nom: "convention-tripartite.tsx",
    rendre: (cond?: unknown) =>
      collectPdfText(
        <ConventionTripartitePdf
          data={{ ...tripartite, conditionSuspensiveOpco: cond } as ConventionTripartiteData}
          identite={identite}
        />,
      ),
  },
] as const;

describe.each(GABARITS)("$nom — clause de condition suspensive OPCO", ({ rendre }) => {
  it("seuil en pourcentage : la clause est imprimée MOT POUR MOT", () => {
    const attendu = clause({
      opco: "OPCO Atlas",
      dateLimite: "15/12/2026",
      seuil: SEUIL_POURCENTAGE,
    });
    expect(sansEspaces(rendre(condPourcentage))).toContain(sansEspaces(attendu));
  });

  it("seuil en montant : la clause est imprimée MOT POUR MOT", () => {
    const attendu = clause({ opco: "OPCO Atlas", dateLimite: "15/12/2026", seuil: SEUIL_MONTANT });
    expect(sansEspaces(rendre(condMontant))).toContain(sansEspaces(attendu));
  });

  it("la clause n'est imprimée qu'UNE fois", () => {
    const texte = sansEspaces(rendre(condPourcentage));
    const titre = sansEspaces(
      "Condition suspensive de prise en charge par l'opérateur de compétences",
    );
    expect(texte.split(titre).length - 1).toBe(1);
  });

  it("condition non posée (absente ou null) : RIEN n'est imprimé", () => {
    for (const cond of [undefined, null]) {
      const texte = rendre(cond);
      expect(texte.length).toBeGreaterThan(500);
      expect(texte).not.toMatch(/condition suspensive/i);
      expect(texte).not.toMatch(/1304-/);
    }
  });
});

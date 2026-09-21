/**
 * Le kit apporteur (document de présentation + catalogue) part avec CHAQUE
 * e-mail du réseau d'apporteurs — et le lien de réservation d'appel ne part
 * QUE dans l'invitation (décisions Will 2026-09-19).
 *
 * Rendu RÉEL des gabarits, pas une lecture du source : c'est le HTML reçu qui
 * compte, et un bloc importé mais jamais rendu serait vert à la lecture.
 */
import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

import { LeadApporteurRecuEmail } from "../lead-apporteur-recu";
import { LeadApporteurRelanceEmail } from "../lead-apporteur-relance";
import { CandidatureCommercialConfirmeeEmail } from "../candidature-commercial-confirmee";
import { ApporteurInvitationAppelEmail } from "../apporteur-invitation-appel";
import { REGIME_FAMILLE } from "../_layout";
import {
  DOCUMENT_APPORTEUR_CHEMIN,
  VARIANTE_DOSSIER_COMMENCE,
} from "@/lib/commercial-application/kit-apporteur";

const DOSSIER = "https://axion-ia.com/fr/devenir-commercial-ia/candidature";
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";

async function html(el: React.ReactElement): Promise<string> {
  return render(el);
}

/** Texte visible, sans balises ni entités — pour lire ce que la personne lit. */
function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const GABARITS_AUTOMATIQUES: Array<[string, React.ReactElement]> = [
  [
    "accusé du premier contact",
    <LeadApporteurRecuEmail
      key="a"
      locale="fr"
      payload={{ contactName: "Nadia", dossierUrl: DOSSIER }}
    />,
  ],
  [
    "kit du dossier commencé",
    <LeadApporteurRecuEmail
      key="b"
      locale="fr"
      payload={{ contactName: "Nadia", dossierUrl: DOSSIER, variante: VARIANTE_DOSSIER_COMMENCE }}
    />,
  ],
  [
    "relance J+2",
    <LeadApporteurRelanceEmail
      key="c"
      locale="fr"
      payload={{ dossierUrl: DOSSIER, etape: "j2" }}
    />,
  ],
  [
    "relance J+7",
    <LeadApporteurRelanceEmail
      key="d"
      locale="fr"
      payload={{ dossierUrl: DOSSIER, etape: "j7" }}
    />,
  ],
  [
    "confirmation du dossier complet",
    <CandidatureCommercialConfirmeeEmail key="e" locale="fr" payload={{ contactName: "Nadia" }} />,
  ],
];

describe("le kit part avec chaque e-mail automatique — le lien d'appel, jamais", () => {
  it.each(GABARITS_AUTOMATIQUES)("%s : document + catalogue, aucun Calendly", async (_nom, el) => {
    const h = await html(el);
    expect(h).toContain(DOCUMENT_APPORTEUR_CHEMIN);
    expect(h).toMatch(/\/fr\/catalogue"/);
    // ⛔ Distribué à tous, le lien de réservation saturerait l'agenda de Will.
    expect(h.toLowerCase()).not.toContain("calendly");
  });
});

describe("l'invitation — le seul e-mail qui porte le lien de réservation", () => {
  it("porte le lien Calendly en bouton, le kit, et le dossier s'il est fourni", async () => {
    const h = await html(
      <ApporteurInvitationAppelEmail
        locale="fr"
        payload={{ contactName: "Nadia Ben", calendlyUrl: CALENDLY, dossierUrl: DOSSIER }}
      />,
    );
    expect(h).toContain(CALENDLY);
    expect(h).toContain(DOCUMENT_APPORTEUR_CHEMIN);
    expect(h).toContain(DOSSIER);
    expect(texte(h)).toMatch(/15 minutes/);
    expect(texte(h)).toMatch(/Aucun engagement/);
  });

  it("sans dossier fourni (dossier déjà arrivé), ne le réclame pas", async () => {
    const h = await html(
      <ApporteurInvitationAppelEmail locale="fr" payload={{ calendlyUrl: CALENDLY }} />,
    );
    expect(h).not.toContain(DOSSIER);
  });
});

/**
 * 🔴 LE BUDGET DE LIENS, MESURÉ SUR LA VARIANTE LA PLUS CHARGÉE DE CHAQUE
 * GABARIT — et non sur le payload d'aperçu.
 *
 * `lien-opposition.spec.tsx` et `familles-email.spec.tsx` mesurent déjà ce
 * budget, mais avec `PAYLOAD_EXEMPLE`, qui donne LA MÊME URL de démonstration à
 * `calendlyUrl` et à `dossierUrl` et ne porte aucune `provenance`. Deux liens y
 * fusionnent donc en un, et le troisième n'apparaît pas : l'invitation y est
 * comptée à 10 URL quand la vraie en porte 12. Un budget mesuré sur un payload
 * qui fait fusionner les liens ne mesure pas le budget.
 *
 * On compte donc ici la variante la plus chargée qui part POUR DE VRAI :
 * invitation à une personne recommandée par un tiers (art. 14 RGPD), dont le
 * dossier n'est pas encore arrivé, avec le créneau Calendly.
 *
 * Le lien d'opposition, posé par `renderEmailTemplate` quand il connaît le
 * destinataire, n'est pas rendu par `render` direct : on l'ajoute au compte.
 */
describe("le budget de liens de la famille B tient sur la variante la plus chargée", () => {
  const OPPOSITION = 1;

  const CAS: Array<[string, React.ReactElement]> = [
    [
      "invitation — recommandée par un tiers, dossier à compléter, créneau",
      <ApporteurInvitationAppelEmail
        key="i"
        locale="fr"
        payload={{
          contactName: "Nadia Ben",
          calendlyUrl: CALENDLY,
          dossierUrl: DOSSIER,
          provenance: { mode: "indirecte", libelle: "par une personne qui te recommande" },
        }}
      />,
    ],
    [
      "accusé du premier contact — avec référence de dossier",
      <LeadApporteurRecuEmail
        key="r"
        locale="fr"
        payload={{ contactName: "Nadia", dossierUrl: DOSSIER, submissionId: "sub-1" }}
      />,
    ],
    [
      "relance J+7",
      <LeadApporteurRelanceEmail
        key="j"
        locale="fr"
        payload={{ dossierUrl: DOSSIER, etape: "j7" }}
      />,
    ],
    [
      "confirmation du dossier complet",
      <CandidatureCommercialConfirmeeEmail
        key="c"
        locale="fr"
        payload={{ contactName: "Nadia" }}
      />,
    ],
  ];

  it.each(CAS)("%s", async (_nom, el) => {
    const h = await html(el);
    const liens = new Set((h.match(/href="([^"]+)"/g) ?? []).map((x) => x.slice(6, -1)));
    expect(
      liens.size + OPPOSITION,
      `${liens.size + OPPOSITION} URL distinctes (dont le lien d'opposition) pour un budget ` +
        `de ${REGIME_FAMILLE.B.budgetLiens}. Liens : ${[...liens].join(", ")}`,
    ).toBeLessThanOrEqual(REGIME_FAMILLE.B.budgetLiens);
  });

  it("⛔ et aucun lien social n'y revient : ce sont eux qui ont cédé", async () => {
    for (const [nom, el] of CAS) {
      const h = await html(el);
      expect(h, `${nom} : lien social revenu dans le pied de page`).not.toContain("linkedin.com");
      expect(h, `${nom} : lien social revenu dans le pied de page`).not.toContain("facebook.com");
    }
  });
});

describe("la confirmation du dossier suit les décisions du 2026-09-19", () => {
  it("parle du réseau d'apporteurs, répond « dans les prochaines heures », propose 15 minutes", async () => {
    const t = texte(
      await html(
        <CandidatureCommercialConfirmeeEmail locale="fr" payload={{ contactName: "Nadia" }} />,
      ),
    );
    expect(t).toMatch(/réseau d'apporteurs d'affaires/);
    expect(t).toMatch(/dans les prochaines heures/);
    expect(t).toMatch(/15 minutes/);
    // Retirés : le métier de vendeur pour autrui, et le délai en semaines.
    expect(t).not.toMatch(/commercial ind/i);
    expect(t).not.toMatch(/semaines/);
  });
});

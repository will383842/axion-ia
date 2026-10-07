/**
 * Les messages A1, A2, A3 et B1 du tunnel apporteurs avec vidéo
 * (`03-MESSAGES-ET-DECISIONS.md` §2) — rendu RÉEL des variantes.
 *
 *   R4  B1 dit « choisissez votre créneau » ; il ne dit JAMAIS « votre
 *       candidature est retenue » (c'est le texte de l'invitation du filet) ;
 *   R7  vouvoiement, vocabulaire « échange / recommander / présenter » ;
 *   R8  aucun délai chiffré promis, aucun gain, aucun Qualiopi, aucun numéro ;
 *   le lien de réservation ne part QUE dans B1 (et dans l'invitation) — jamais
 *   dans A1, A2, A3.
 */
import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

import { LeadApporteurRecuEmail, leadApporteurRecuSubject } from "../lead-apporteur-recu";
import { LeadApporteurRelanceEmail } from "../lead-apporteur-relance";
import { REGIME_FAMILLE } from "../_layout";
import {
  VARIANTE_VSL_ABANDON,
  VARIANTE_VSL_ETAPE2,
  VARIANTE_VSL_RELANCE,
} from "@/lib/commercial-application/vsl-apporteur";
import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";

const REPRISE = "https://axion-ia.com/fr/apporteur-affaires/video?r=jeton";
const DOSSIER = "https://axion-ia.com/fr/devenir-commercial-ia/candidature";
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";

const html = (el: React.ReactElement): Promise<string> => render(el);

/** Le CORPS lu par la personne : ni la feuille de style, ni le pied légal du châssis. */
function corps(h: string): string {
  const t = texte(h);
  const debut = t.indexOf("Bonjour");
  const fin = t.indexOf("Le bouton ne fonctionne pas");
  return t.slice(debut < 0 ? 0 : debut, fin < 0 ? undefined : fin);
}

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const A1 = (
  <LeadApporteurRecuEmail
    locale="fr"
    payload={{ contactName: "Nadia", dossierUrl: REPRISE, variante: VARIANTE_VSL_ABANDON }}
  />
);
const B1 = (
  <LeadApporteurRecuEmail
    locale="fr"
    payload={{
      contactName: "Nadia",
      dossierUrl: DOSSIER,
      calendlyUrl: CALENDLY,
      variante: VARIANTE_VSL_ETAPE2,
      submissionId: "sub-1",
    }}
  />
);
const A2 = (
  <LeadApporteurRelanceEmail
    locale="fr"
    payload={{
      contactName: "Nadia",
      dossierUrl: REPRISE,
      etape: "j2",
      variante: VARIANTE_VSL_RELANCE,
    }}
  />
);
const A3 = (
  <LeadApporteurRelanceEmail
    locale="fr"
    payload={{
      contactName: "Nadia",
      dossierUrl: REPRISE,
      etape: "j7",
      variante: VARIANTE_VSL_RELANCE,
    }}
  />
);

const TOUS: Array<[string, React.ReactElement]> = [
  ["A1 abandon", A1],
  ["B1 « C'est noté » + créneau", B1],
  ["A2 J+2", A2],
  ["A3 J+7", A3],
];

describe("objets", () => {
  it("A1 « Votre inscription n'est pas terminée » ; B1 « C'est noté »", () => {
    expect(leadApporteurRecuSubject("fr", { variante: VARIANTE_VSL_ABANDON })).toBe(
      "Votre inscription n'est pas terminée",
    );
    expect(leadApporteurRecuSubject("fr", { variante: VARIANTE_VSL_ETAPE2 })).toBe("C'est noté");
  });
});

describe("le lien de réservation", () => {
  it("part dans B1, en bouton principal", async () => {
    const h = await html(B1);
    // 2026-10-05 : le bouton mène à NOTRE page de réservation.
    expect(h).toContain("/fr/appel/apporteur");
    expect(h).not.toContain(CALENDLY);
    expect(texte(h)).toMatch(/Choisir mon créneau/);
  });

  it.each([
    ["A1", A1],
    ["A2", A2],
    ["A3", A3],
  ])("ne part JAMAIS dans %s (l'agenda de Will resterait saturé)", async (_n, el) => {
    expect((await html(el)).toLowerCase()).not.toContain("calendly");
  });

  it("B1 sans lien exploitable ne montre pas un bouton « créneau » qui ne mène nulle part", async () => {
    const h = await html(
      <LeadApporteurRecuEmail
        locale="fr"
        payload={{ contactName: "Nadia", dossierUrl: DOSSIER, variante: VARIANTE_VSL_ETAPE2 }}
      />,
    );
    expect(texte(h)).not.toMatch(/Choisir mon créneau/);
  });
});

describe("R4 — B1 invite à choisir, il ne dit pas « retenue »", () => {
  it("dit « choisissez … le créneau » et ne dit ni « retenue » ni « sélectionné »", async () => {
    const t = texte(await html(B1));
    expect(t).toMatch(/choisissez dès maintenant le créneau/i);
    expect(t).not.toMatch(/retenue|retenu|sélectionn/i);
  });

  it("ne propose PAS le dossier : la suite se décide après l'appel (ordre de Will, 06/10)", async () => {
    const h = await html(B1);
    expect(h).not.toContain(DOSSIER);
    expect(texte(h)).not.toMatch(/dossier/i);
  });
});

describe("A1 / A2 / A3 — « il vous manque une étape »", () => {
  it("A1 ramène à la page par le lien de reprise", async () => {
    const h = await html(A1);
    expect(h).toContain(REPRISE);
    expect(texte(h)).toMatch(/Terminer mon inscription/);
    expect(texte(h)).toMatch(/une étape/);
  });

  it("A2 dit qu'il manque une étape ; A3 est le dernier rappel", async () => {
    expect(texte(await html(A2))).toMatch(/Il vous manque une étape/);
    const t3 = texte(await html(A3));
    expect(t3).toMatch(/dernier rappel/i);
    expect(t3).toMatch(/Terminer mon inscription/);
  });

  it("l'ancienne relance (sans variante) garde son texte et son bouton", async () => {
    const t = texte(
      await html(
        <LeadApporteurRelanceEmail locale="fr" payload={{ dossierUrl: DOSSIER, etape: "j2" }} />,
      ),
    );
    expect(t).toMatch(/Compléter mon dossier/);
    expect(t).not.toMatch(/Terminer mon inscription/);
  });
});

describe("R7 / R8 — vocabulaire et promesses", () => {
  it.each(TOUS)(
    "%s : vouvoiement, aucun mot interdit, aucun délai ni gain promis",
    async (_n, el) => {
      const h = await html(el);
      const t = corps(h);
      expect(t).toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
      // Jamais de tutoiement.
      // Lookarounds Unicode : `\b` coupe « êtes » en « ê » + « tes ».
      expect(t).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu);
      // Vocabulaire anti-requalification.
      expect(t).not.toMatch(/entretien|recrut|\bposte\b|commercial|vendre|vendeur/i);
      // Aucun délai de réponse chiffré, aucun gain, aucun Qualiopi.
      expect(t).not.toMatch(/sous \d|dans les \d|\d+ ?h\b|\d+ heures|24 ?h|48 ?h/i);
      expect(t).not.toMatch(/Qualiopi|commission|€|euros?|gagn/i);
      // Aucun numéro de téléphone publié.
      expect(t).not.toMatch(/\b0\d([ .]?\d{2}){4}\b|\+33/);
      // Le document de présentation est retiré du kit (JUR-T44) ; le catalogue part.
      expect(h).not.toContain(DOCUMENT_APPORTEUR_CHEMIN);
      expect(h).toMatch(/\/fr\/catalogue"/);
    },
  );
});

describe("budget de liens de la famille B", () => {
  it.each(TOUS)("%s tient dans le budget (lien d'opposition compris)", async (_n, el) => {
    const h = await html(el);
    const liens = new Set((h.match(/href="([^"]+)"/g) ?? []).map((x) => x.slice(6, -1)));
    expect(liens.size + 1, [...liens].join(", ")).toBeLessThanOrEqual(REGIME_FAMILLE.B.budgetLiens);
  });
});

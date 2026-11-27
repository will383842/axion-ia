// @vitest-environment node
// Lot 7b — les GARDES de vocabulaire des textes de la validation par rendez-vous.
//
//   · aucun gabarit envoyé à une ENTREPRISE ne contient « vérif », « contrôl » ni « confirmer » ;
//   · aucun texte ne relance l'apporteur à l'approche de la fin des 60 jours, ne fixe d'objectif
//     ni de nombre ;
//   · jamais « Aucun gain garanti » ; jamais « Grenoble » (hors adresse légale du pied de page).
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import { comment, commentRendezVous } from "./textes-comment";

import {
  ApporteurPresentationRecueRendezVousEmail,
  COPY_PRESENTATION_RECUE_RENDEZ_VOUS,
  apporteurPresentationRecueRendezVousSubject,
} from "@/lib/email/templates/apporteur-presentation-recue-rendez-vous";
import {
  EntrepriseConfirmationApporteurEmail,
  entrepriseConfirmationApporteurSubject,
} from "@/lib/email/templates/apporteur-demarrage";
import { EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";

const PRENOM = { contactName: "Camille Martin", nomApporteur: "Ana Bel", entreprise: "Acme" };

async function rendu(el: React.ReactElement): Promise<string> {
  return (await render(el, { plainText: true })) + "\n" + (await render(el, { pretty: false }));
}
/** Le pied de page légal porte l'adresse immatriculée : on la retire avant de chercher. */
const sansPied = (t: string): string =>
  t.replaceAll(EMAIL_LEGAL.address, "").replaceAll(/RCS[^<\n]*/g, "");

async function textesEntreprise(): Promise<string[]> {
  const contact = <EntrepriseConfirmationApporteurEmail locale="fr" payload={PRENOM} />;
  return [entrepriseConfirmationApporteurSubject("fr", PRENOM), sansPied(await rendu(contact))];
}

async function textesApporteurRendezVous(): Promise<string[]> {
  const payload = { ...PRENOM, dateFinReservation: "24 janvier 2027" };
  return [
    apporteurPresentationRecueRendezVousSubject("fr", payload),
    sansPied(
      await rendu(<ApporteurPresentationRecueRendezVousEmail locale="fr" payload={payload} />),
    ),
    ...commentRendezVous(60, 6),
  ];
}

describe("gabarits envoyés à une entreprise", () => {
  it("ne disent jamais « vérif », « contrôl » ni « confirmer »", async () => {
    for (const t of await textesEntreprise()) {
      expect(t).not.toMatch(/v[ée]rif|contr[ôo]l|confirmer/i);
    }
  });

  it("le registre : tout gabarit « entreprise-* » du réseau est couvert par cette garde", () => {
    const noms = EMAIL_TEMPLATE_NAMES.filter((n) => /^entreprise-(prise|information)/.test(n));
    expect(noms.sort()).toEqual(["entreprise-prise-de-contact-apporteur"]);
  });
});

describe("textes de la validation par rendez-vous (apporteur et page)", () => {
  it("jamais « Aucun gain garanti » ni « Grenoble »", async () => {
    const tous = [...(await textesApporteurRendezVous()), ...(await textesEntreprise())];
    for (const t of tous) {
      expect(t).not.toMatch(/aucun gain garanti/i);
      expect(t).not.toMatch(/grenoble/i);
    }
  });

  it("aucune relance à l'approche de la fin, aucun objectif, aucun nombre exigé", async () => {
    const interdits =
      /relanc|rappel|il vous reste|plus que|avant (la )?fin|derniers? jours|bient[ôo]t|n'oubliez|objectif|quota|minimum|au moins|au plus|à atteindre|chaque (mois|semaine)|par (mois|semaine)|exigé|obligat/i;
    for (const t of await textesApporteurRendezVous()) {
      expect(t).not.toMatch(interdits);
    }
    for (const v of Object.values(COPY_PRESENTATION_RECUE_RENDEZ_VOUS)) {
      const s =
        typeof v === "function" ? (v as (...a: unknown[]) => string)("x", 60, "date", 6) : v;
      expect(s).not.toMatch(interdits);
    }
  });

  it("les seuls nombres écrits sont 60 (jours), 6 (mois) et 30 (délai avant une nouvelle présentation)", () => {
    // Les textes eux-mêmes, pas le rendu : le pied de page légal porte SIREN et code postal.
    const corps = [
      ...commentRendezVous(60, 6),
      ...Object.values(COPY_PRESENTATION_RECUE_RENDEZ_VOUS).map((v) =>
        typeof v === "function" ? (v as (...a: unknown[]) => string)("x", 60, null, 6) : v,
      ),
    ].join("\n");
    const nombres = corps.match(/\d+/g) ?? [];
    // Aucun 30 : le contrat 2.8 n'impose à l'apporteur aucun délai d'attente (art. 3.4 bis).
    for (const n of nombres) expect(["60", "6"]).toContain(n);
  });

  it("le texte de la page des apporteurs sous la règle actuelle n'est pas touché", () => {
    expect(comment(6)).toEqual([
      "Après votre déclaration, nous prenons contact avec l'entreprise de votre part.",
      "Cet établissement vous est réservé 6 mois à compter de votre déclaration. Si vous avez rencontré la direction de l'entreprise, écrivez-nous : nous pouvons étendre votre réservation à toute l'entreprise.",
      "Si elle a déjà été présentée ou nous est déjà connue, nous vous le disons.",
      "Toute commande signée pendant cette période vous est commissionnée, dès que le client a payé l'intégralité, même si la prestation n'est pas encore livrée.",
    ]);
  });
});

// L'issue de l'échange apporteur — les trois e-mails (2026-09-28).
//
// Rendu RÉEL par le registre, pour un prénom d'exemple : objet, contenu exigé
// par Will, montants lus dans le SSOT (jamais recopiés), mot personnel,
// signature du fondateur, famille B — et le VOCABULAIRE ANTI-REQUALIFICATION,
// balayé sur le rendu texte complet des trois messages.

import { beforeAll, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { COPY_ISSUE_ECHANGE } from "../apporteur-issue-echange";
import { REGIME_FAMILLE } from "../_layout";
import { OBJET_MAX } from "../../objet-email";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, getCommissionById } from "@/content/pricing";
import {
  DOCUMENT_APPORTEUR_CHEMIN,
  FENETRE_ATTRIBUTION_APPORTEUR_MOIS,
} from "@/lib/commercial-application/kit-apporteur";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import {
  GABARITS_ISSUE_APPORTEUR,
  type GabaritIssueApporteur,
} from "@/features/admin-rendezvous/issue-apporteur";

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";
const DESTINATAIRE = "camille@exemple.fr";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function payload(g: GabaritIssueApporteur, extra: Record<string, unknown> = {}) {
  return {
    contactName: "Camille Martin",
    ...(g === "apporteur-issue-absent"
      ? { calendlyUrl: CALENDLY, dateEchange: "mardi 22 septembre" }
      : {}),
    ...extra,
  };
}

async function rendu(g: GabaritIssueApporteur, locale: "fr" | "en" = "fr", extra = {}) {
  return renderEmailTemplate(g, locale, payload(g, extra), { destinataire: DESTINATAIRE });
}

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("Absent — « nous vous avons attendu »", () => {
  it("objet, ton bienveillant, date de l'échange, bouton vers le lien de réservation apporteur", async () => {
    const r = await rendu("apporteur-issue-absent");
    expect(r.subject).toBe("Nous vous avons attendu : un autre créneau ?");
    const t = texte(r.html);
    expect(t).toContain("Bonjour Camille,");
    expect(t).toContain(
      "Nous vous avons attendu pour notre échange en visio du mardi 22 septembre.",
    );
    expect(t).toContain("un imprévu arrive à tout le monde");
    expect(t).toContain("Choisir un nouveau créneau");
    // 2026-10-05 : le bouton mène à NOTRE page de réservation.
    expect(r.html).toContain("/fr/appel/apporteur");
    expect(r.html).not.toContain(CALENDLY);
    // Aucune relance automatique ensuite, et c'est dit.
    expect(t).toContain("nous ne vous relancerons pas");
  });

  it("sans lien de réservation, pas de bouton mort", async () => {
    const r = await renderEmailTemplate("apporteur-issue-absent", "fr", { contactName: "Camille" });
    expect(texte(r.html)).not.toContain("Choisir un nouveau créneau");
    expect(texte(r.html)).toContain("Nous vous avons attendu pour notre échange en visio.");
  });
});

describe("Retenu — bienvenue dans le réseau", () => {
  it("objet et contenu exigés par Will", async () => {
    const r = await rendu("apporteur-issue-retenu");
    expect(r.subject).toBe("Bienvenue parmi les apporteurs d'Axion-IA");
    const t = texte(r.html);
    expect(t).toContain(
      "Merci pour notre échange. Nous sommes ravis de vous accueillir dans le réseau d'apporteurs d'affaires indépendants d'Axion-IA.",
    );
    expect(t).toContain("Vous nous mettez en relation avec une entreprise qui a un besoin");
    expect(t).toContain("Nous gérons tout le reste : rendez-vous, devis et réalisation.");
    expect(t).toContain(
      "Vous touchez une commission. Le barème ci-dessous est donné à titre indicatif : votre contrat d'apporteur fait foi.",
    );
    expect(t).toContain("versée dès que le client a réglé l'intégralité de sa facture");
    expect(t).toContain("sans objectif ni exclusivité");
    expect(t).toContain("numéro SIRET");
    expect(t).toContain("votre contrat d'apporteur, à signer en ligne");
    expect(t).not.toContain("prochains jours");
    // 2026-10-05 (Will) : plus aucune date promise pour l'espace en ligne (démarrage à la main).
    expect(t).not.toContain("d'ici un mois");
    expect(t).toContain("Dès votre contrat signé, vous pourrez nous présenter des entreprises");
    // 2026-10-06 : le dossier signé renvoie au formulaire du lien personnel : « par simple
    // e-mail » ne disait que la moitié du chemin (et promettait un canal que l'espace ne garantit pas).
    // Contrat 2.2 (art. 3.2) : la déclaration passe par le seul formulaire du lien personnel.
    expect(t).toContain(
      "depuis votre lien personnel, avec le formulaire « Déclarer une entreprise »",
    );
    expect(t).not.toContain("par e-mail ou depuis");
    expect(t).not.toContain("par simple e-mail");
    // (La consigne « répondez avec son nom et celui de votre contact » allait avec la date
    // promise : elle est retirée avec elle ; la présentation par e-mail reste dite ci-dessus.)
    // Le châssis porte « Une question ? Répondez simplement à cet e-mail » : une
    // seule fois, pas deux.
    expect(t.match(/Une question \?/g)).toHaveLength(1);
    // Le kit : le catalogue seul, le document de présentation est retiré
    // jusqu'à sa réécriture (JUR-T44, `kit-apporteur-sans-pdf.spec.ts`).
    expect(r.html).toMatch(/\/fr\/catalogue"/);
    expect(r.html).not.toContain(DOCUMENT_APPORTEUR_CHEMIN);
  });

  it("🔑 les montants viennent du SSOT : 500 € la journée, 30 % l'audit, 15 % l'intégration, 6 mois", async () => {
    const t = texte((await rendu("apporteur-issue-retenu")).html);
    const audit = getCommissionById("com-audit").percent;
    const integration = getCommissionById("com-integration").percent;
    expect(t).toContain(
      `Formation : ${COMMISSION_FORMATION_PAR_JOURNEE_EUR} € HT par journée de formation au tarif public (réduite au prorata en cas de remise accordée au client).`,
    );
    expect(t).toContain(`Audit : ${audit} % du montant HT de la facture.`);
    expect(t).toContain(`Intégration : ${integration} % du montant HT de la facture.`);
    // Décision de Will (2026-10-05) : la durée d'attribution ne s'écrit PAS dans cet e-mail.
    expect(t).toContain("réglé l'intégralité de sa facture.");
    expect(t).not.toContain("attribuée");
    expect(t).not.toContain("6 mois");
    // Témoin des valeurs décidées : si le SSOT bouge, ce test le dit.
    expect([
      COMMISSION_FORMATION_PAR_JOURNEE_EUR,
      audit,
      integration,
      FENETRE_ATTRIBUTION_APPORTEUR_MOIS,
    ]).toEqual([500, 30, 15, 6]);
  });
});

describe("Non retenu — refus courtois, porte ouverte", () => {
  it("merci, pas de suite pour le moment, sans justification, porte ouverte", async () => {
    const r = await rendu("apporteur-issue-non-retenu");
    expect(r.subject).toBe("Suite à notre échange");
    const t = texte(r.html);
    expect(t).toContain("Merci pour le temps que vous nous avez accordé");
    expect(t).toContain("nous ne donnons pas suite pour le moment");
    expect(t).toContain("Si votre situation évolue, n'hésitez pas à revenir vers nous");
    expect(t).toContain("Nous vous souhaitons sincèrement le meilleur");
    // Pas de bouton, pas de kit : ce message ne sollicite rien.
    expect(r.html).not.toContain(DOCUMENT_APPORTEUR_CHEMIN);
    expect(r.html).not.toContain("calendly.com");
  });
});

describe("les trois, les deux langues", () => {
  const CAS = GABARITS_ISSUE_APPORTEUR.flatMap((g) =>
    (["fr", "en"] as const).map((l) => [g, l] as const),
  );

  it.each(CAS)("%s (%s) : famille B, sans rangée sociale, budget de liens tenu", async (g, l) => {
    const r = await rendu(g, l);
    expect(r.famille).toBe("B");
    expect(r.html).toMatch(/\/api\/unsubscribe\?token=op1\./);
    expect(r.html).not.toContain("facebook.com");
    const liens = new Set((r.html.match(/href="([^"]+)"/g) ?? []).map((x) => x.slice(6, -1)));
    expect(liens.size).toBeLessThanOrEqual(REGIME_FAMILLE.B.budgetLiens);
  });

  it.each(CAS)("%s (%s) : signé Williams Jullin, sans téléphone", async (g, l) => {
    const r = await rendu(g, l);
    expect(r.html).toContain("Williams Jullin");
    expect(r.html).not.toMatch(/Prendre rendez-vous|Book a call/);
    expect(r.html).not.toContain(EMAIL_LEGAL.phone);
  });

  it.each(CAS)("%s (%s) : objet court, sans « ! »", async (g, l) => {
    const { subject } = await rendu(g, l);
    expect(subject.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(subject).not.toContain("!");
  });

  it.each(CAS)(
    "%s (%s) : le mot personnel s'affiche en haut, juste après le bonjour",
    async (g, l) => {
      const r = await rendu(g, l, { motPersonnel: "Encore merci pour votre franchise." });
      const t = texte(r.html);
      const bonjour = t.indexOf(l === "fr" ? "Bonjour Camille," : "Hello Camille,");
      const mot = t.indexOf("Encore merci pour votre franchise.");
      expect(bonjour).toBeGreaterThan(-1);
      expect(mot).toBeGreaterThan(bonjour);
      // Sans mot personnel, rien de vide ni d'« undefined ».
      expect(texte((await rendu(g, l)).html)).not.toMatch(/undefined|null/);
    },
  );
});

/**
 * 🔴 ANTI-REQUALIFICATION — balayé sur le RENDU TEXTE complet des trois
 * messages (corps, objet, pied de page compris), en français.
 *
 * « sans objectif ni exclusivité » est la SEULE occurrence admise du mot
 * « objectif » : c'est la phrase qui dit précisément qu'il n'y en a pas. Elle
 * est retirée avant le balayage, et sa présence est exigée plus haut.
 */
const MOTS_INTERDITS: ReadonlyArray<RegExp> = [
  /\bentretiens?\b/i,
  /\bpostes?\b/i,
  /\bembauch/i,
  /\brecrut/i,
  /\bobjectifs?\b/i,
  /\bhoraires?\b/i,
  /\bsalaires?\b/i,
  /\bsalariés?\b/i,
  /\bmissions?\b/i,
  /\bmanager\b/i,
  /\bvendeurs?\b/i,
  /\bvend(re|u|ue|us|ues)\b/i,
  /\bagent commercial\b/i,
  /\bta hiérarchie\b/i,
];

describe("🔴 vocabulaire interdit — jamais dans les trois e-mails rendus", () => {
  it.each(GABARITS_ISSUE_APPORTEUR)("%s : rendu texte complet, objet compris", async (g) => {
    const r = await rendu(g, "fr", { motPersonnel: "" });
    const balaye = `${r.subject}\n${r.text}\n${texte(r.html)}`.replace(
      /sans objectif ni exclusivit[ée]/gi,
      "",
    );
    for (const mot of MOTS_INTERDITS) {
      expect(balaye, `« ${mot.source} » trouvé dans ${g}`).not.toMatch(mot);
    }
  });

  it("le témoin : la liste attrape bien un mot interdit (sinon le balayage serait vert à vide)", () => {
    expect(MOTS_INTERDITS.some((m) => m.test("Suite à notre entretien pour le poste"))).toBe(true);
  });

  it("les textes propres au gabarit, anglais compris, ne disent ni job, ni hiring, ni salary", () => {
    const tout = JSON.stringify(COPY_ISSUE_ECHANGE, (_k, v: unknown) =>
      typeof v === "function" ? (v as (x: unknown) => string)("X") : v,
    );
    expect(tout).toContain("Welcome to the network");
    expect(tout).not.toMatch(/\b(job|hiring|recruit\w*|salary|interview|employee)s?\b/i);
  });
});

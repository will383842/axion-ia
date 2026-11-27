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
import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import {
  GABARITS_ISSUE_APPORTEUR,
  type GabaritIssueApporteur,
} from "@/features/admin-rendezvous/issue-apporteur";

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur-affaires";
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
      "L'entreprise vous est réservée 60 jours à partir de votre déclaration. Elle vous est attribuée dès son premier rendez-vous avec nous, s'il a été pris pendant ces 60 jours (même s'il a lieu après ; un rendez-vous annulé par Axion-IA compte comme tenu), ou dès qu'elle signe une commande pendant ces 60 jours ; elle est alors commissionnée pendant la durée prévue à compter de ce rendez-vous ou de cette commande. Nous gérons tout le reste : rendez-vous, devis et réalisation.",
    );
    expect(t).toContain(
      "Vous touchez une commission quand l'entreprise a payé l'intégralité de sa commande. Les montants à jour sont dans la fiche des commissions ci-dessous ; votre contrat fait foi.",
    );
    expect(t).toContain("sans objectif ni exclusivité");
    expect(t).toContain(
      "Pour signer votre contrat et facturer vos commissions, il vous faut un numéro SIREN",
    );
    expect(t).not.toContain("prochains jours");
    // 2026-10-05 (Will) : plus aucune date promise pour l'espace en ligne.
    expect(t).not.toContain("d'ici un mois");
    expect(t).toContain(
      "Dès votre contrat signé, vous pourrez nous présenter des entreprises depuis votre espace, avec le formulaire « Déclarer une entreprise »",
    );
    expect(t).not.toContain("par e-mail ou depuis");
    expect(t).not.toContain("par simple e-mail");
    // Le châssis porte « Une question ? Répondez simplement à cet e-mail » : une seule fois.
    expect(t.match(/Une question \?/g)).toHaveLength(1);
    // Plus de kit ni de catalogue : les documents passent par des liens personnels.
    expect(r.html).not.toContain("/catalogue");
    expect(r.html).not.toContain(DOCUMENT_APPORTEUR_CHEMIN);
    // Sans lien de dossier, pas de section de documents (jamais de lien mort).
    expect(t).not.toContain("Vos documents, toujours à jour");
  });

  it("avec le lien du dossier : 4 liens personnels, qui commencent tous par ce lien", async () => {
    const dossierUrl = "https://axion-ia.com/apporteur/dossier/abc/jeton123";
    const r = await rendu("apporteur-issue-retenu", "fr", { dossierUrl });
    const t = texte(r.html);
    expect(t).toContain("Vos documents, toujours à jour");
    expect(t).toContain(
      "Ces liens ouvrent toujours la dernière version. Ils vous sont personnels : gardez cet e-mail.",
    );
    const attendus: Array<[string, string, string]> = [
      [
        "La fiche des commissions",
        "/fiche-commissions",
        "ce que vous touchez, prestation par prestation, et quand c'est versé",
      ],
      ["Le livret d'accueil", "/livret", "le réseau et son fonctionnement"],
      ["Le guide de démarrage", "/guide", "des idées pour bien commencer, à votre rythme"],
      [
        "Mon espace apporteur",
        "/documents",
        "votre dossier, votre contrat et tous vos documents au même endroit",
      ],
    ];
    for (const [libelle, chemin, detail] of attendus) {
      expect(r.html).toContain(`href="${dossierUrl}${chemin}"`);
      expect(t).toContain(`→ ${libelle} ${detail}`);
    }
    const hrefs = (r.html.match(/href="([^"]+)"/g) ?? []).map((x) => x.slice(6, -1));
    expect(hrefs.filter((h) => h.startsWith(`${dossierUrl}/`))).toHaveLength(4);
    // Le texte « Nous vous enverrons votre contrat… » n'a plus lieu d'être avec le lien.
    expect(t).not.toContain("Nous vous enverrons votre contrat");
    // Budget de liens de la famille B tenu.
    expect(new Set(hrefs).size).toBeLessThanOrEqual(REGIME_FAMILLE.B.budgetLiens);
  });

  it.each(["fr", "en"] as const)(
    "🔑 aucun montant ni catalogue dans l'e-mail retenu (%s) : ni « € », ni « %% », ni « catalogue »",
    async (l) => {
      const r = await rendu("apporteur-issue-retenu", l, {
        dossierUrl: "https://axion-ia.com/apporteur/dossier/abc/jeton123",
      });
      const brut = `${r.subject}\n${r.text}\n${texte(r.html)}`;
      expect(brut).not.toContain("€");
      expect(brut).not.toContain("%");
      expect(brut).not.toMatch(/catalogue/i);
      expect(brut).not.toMatch(/catalog/i);
    },
  );
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

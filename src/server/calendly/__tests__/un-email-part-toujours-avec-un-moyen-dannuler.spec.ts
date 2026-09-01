// @vitest-environment node

/**
 * Verrou — un e-mail ne part JAMAIS sans moyen d'annuler.
 *
 * ## Ce qui se joue
 *
 * Les e-mails de confirmation et de rappel portent deux liens : annuler,
 * déplacer. Ils viennent aujourd'hui de Calendly, lus en base. Ils viendront de
 * chez nous quand le drapeau sera allumé — et les nôtres sont **calculés à
 * l'envoi**, parce que leur durée de vie dépend de l'heure du rendez-vous.
 *
 * Ce changement de nature — d'une donnée lue à une donnée calculée — introduit
 * une façon d'échouer qui n'existait pas : le calcul peut rater. Une lecture en
 * base, non.
 *
 * ## 🔴 LA PROPRIÉTÉ QUI COMPTE
 *
 * Quand le calcul échoue, on retombe sur les liens Calendly. On ne laisse
 * JAMAIS partir un e-mail sans aucun moyen d'annuler.
 *
 * Le coût de l'oublier est asymétrique et silencieux : **un prospect qui ne peut
 * pas se décommander ne prévient pas — il ne vient pas.** Personne ne reçoit de
 * plainte, personne ne voit d'erreur, et le créneau reste bloqué jusqu'à
 * l'heure. On l'apprend en attendant quelqu'un qui ne viendra pas.
 *
 * ## ⚠️ Et le contrôle d'assemblage, dès le premier jet
 *
 * Deux fois aujourd'hui, sur deux fichiers, j'ai écrit des gardes qui
 * éprouvaient une fonction sans vérifier que quiconque l'appelle. Débrancher
 * l'appel ne les faisait pas rougir. Le dernier `describe` de ce fichier existe
 * pour que le troisième cas n'arrive pas.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { liensPourEmail } from "../liens-rendez-vous";

const RDV_ID = "clx9k2m4a0001qw8h7yz3n5vb";
const DEBUT = new Date(Date.now() + 21 * 86_400_000);
const ORIGINE = "https://axion-ia.com";
const CALENDLY = {
  cancelUrl: "https://calendly.com/cancellations/abc",
  rescheduleUrl: "https://calendly.com/reschedulings/abc",
};

beforeAll(() => {
  process.env["AUTH_SECRET"] = "un-secret-de-test-suffisamment-long-pour-passer";
});

describe("🔴 drapeau ÉTEINT — les liens Calendly, exactement comme avant", () => {
  it("rien ne change", async () => {
    const r = await liensPourEmail({
      rendezVousId: RDV_ID,
      debut: DEBUT,
      locale: "fr",
      origine: ORIGINE,
      replis: CALENDLY,
      actif: false,
    });
    expect(r.cancelUrl).toBe(CALENDLY.cancelUrl);
    expect(r.rescheduleUrl).toBe(CALENDLY.rescheduleUrl);
  });
});

describe("🔴 drapeau ALLUMÉ — nos liens, et ABSOLUS", () => {
  it("ils pointent chez nous", async () => {
    const r = await liensPourEmail({
      rendezVousId: RDV_ID,
      debut: DEBUT,
      locale: "fr",
      origine: ORIGINE,
      replis: CALENDLY,
      actif: true,
    });
    expect(r.cancelUrl).toContain("/fr/appel/annuler?t=");
    expect(r.rescheduleUrl).toContain("/fr/appel/reporter?t=");
    expect(r.cancelUrl).not.toContain("calendly.com");
  });

  it("🔴 ils sont ABSOLUS — un lien relatif ne mène nulle part dans un e-mail", () => {
    // Le client de messagerie n'a aucune origine à laquelle rattacher un chemin.
    // Un `/fr/appel/annuler?t=…` s'afficherait comme du texte, ou pointerait
    // vers le domaine du webmail. Invisible en développement, où l'on clique
    // dans un navigateur qui a déjà une origine.
    return liensPourEmail({
      rendezVousId: RDV_ID,
      debut: DEBUT,
      locale: "fr",
      origine: ORIGINE,
      replis: CALENDLY,
      actif: true,
    }).then((r) => {
      expect(r.cancelUrl?.startsWith("https://")).toBe(true);
      expect(r.rescheduleUrl?.startsWith("https://")).toBe(true);
    });
  });

  it("une origine avec barre finale ne produit pas de double barre", async () => {
    const r = await liensPourEmail({
      rendezVousId: RDV_ID,
      debut: DEBUT,
      locale: "fr",
      origine: "https://axion-ia.com/",
      replis: CALENDLY,
      actif: true,
    });
    expect(r.cancelUrl).not.toContain("com//");
  });

  it("🔑 les deux liens portent des jetons DIFFÉRENTS", () => {
    // Un jeton d'annulation qui servirait aussi au report annulerait la
    // séparation des gestes — et un lien transféré vaudrait pour les deux.
    return liensPourEmail({
      rendezVousId: RDV_ID,
      debut: DEBUT,
      locale: "fr",
      origine: ORIGINE,
      replis: CALENDLY,
      actif: true,
    }).then((r) => {
      const jeton = (u?: string) => (u ?? "").split("t=")[1] ?? "";
      expect(jeton(r.cancelUrl)).not.toBe(jeton(r.rescheduleUrl));
      expect(jeton(r.cancelUrl).length).toBeGreaterThan(20);
    });
  });
});

describe("🔴 jamais d'e-mail sans moyen d'annuler", () => {
  it("sans horaire, on retombe sur Calendly", async () => {
    // Sans horaire, on ne sait pas quelle durée de vie donner au lien. Le repli
    // est le seul choix honnête — inventer une durée produirait un lien mort ou
    // éternel, et on ne saurait pas lequel.
    const r = await liensPourEmail({
      rendezVousId: RDV_ID,
      debut: null,
      locale: "fr",
      origine: ORIGINE,
      replis: CALENDLY,
      actif: true,
    });
    expect(r.cancelUrl).toBe(CALENDLY.cancelUrl);
  });

  it("🔴 une signature IMPOSSIBLE retombe sur Calendly, elle ne vide pas", async () => {
    // Le cas que le changement de nature introduit : un calcul peut rater, une
    // lecture en base non. Sans repli, l'e-mail partirait sans aucun lien — et
    // personne ne s'en apercevrait, parce qu'un prospect qui ne peut pas se
    // décommander ne se plaint pas : il ne vient pas.
    const secret = process.env["AUTH_SECRET"];
    delete process.env["AUTH_SECRET"];
    try {
      const r = await liensPourEmail({
        rendezVousId: RDV_ID,
        debut: DEBUT,
        locale: "fr",
        origine: ORIGINE,
        replis: CALENDLY,
        actif: true,
      });
      expect(
        r.cancelUrl,
        "l'e-mail partirait SANS moyen d'annuler — le pire échec possible, " +
          "parce qu'il est parfaitement silencieux",
      ).toBe(CALENDLY.cancelUrl);
    } finally {
      if (secret !== undefined) process.env["AUTH_SECRET"] = secret;
    }
  });

  it("sans repli NI signature, on rend un objet vide plutôt que de lever", async () => {
    // Il n'y a alors rien à proposer, mais l'e-mail doit partir quand même :
    // une confirmation sans lien vaut mieux qu'aucune confirmation.
    const secret = process.env["AUTH_SECRET"];
    delete process.env["AUTH_SECRET"];
    try {
      const r = await liensPourEmail({
        rendezVousId: RDV_ID,
        debut: DEBUT,
        locale: "fr",
        origine: ORIGINE,
        replis: { cancelUrl: null, rescheduleUrl: null },
        actif: true,
      });
      expect(r).toEqual({});
    } finally {
      if (secret !== undefined) process.env["AUTH_SECRET"] = secret;
    }
  });
});

/**
 * 🔑 LE CONTRÔLE D'ASSEMBLAGE, ÉCRIT D'EMBLÉE.
 *
 * Tout ce qui précède éprouve `liensPourEmail`. Rien n'y prouve que l'envoi des
 * e-mails l'appelle — et une fonction correcte et débranchée est indiscernable
 * d'une fonction correcte et branchée, tant qu'on ne mesure que la fonction.
 *
 * Ce défaut s'est produit DEUX FOIS aujourd'hui, sur deux fichiers, dont une
 * fois après l'avoir nommé. Nommer un piège ne suffit pas à l'éviter.
 */
describe("🔴 l'envoi des e-mails l'appelle réellement", () => {
  const source = readFileSync(join(process.cwd(), "src/server/calendly/rappels-appel.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  it("🔑 CONTRE-TÉMOIN : le filtre n'a pas vidé la source", () => {
    expect(code).toContain("enqueueEmail(");
    expect(code.length).toBeGreaterThan(source.length / 4);
  });

  it("🔴 `liensPourEmail` est appelée", () => {
    expect(
      code.includes("liensPourEmail("),
      "les e-mails continueraient d'envoyer vers Calendly quel que soit le " +
        "drapeau — et le travail serait invisible plutôt que cassé",
    ).toBe(true);
  });

  it("🔴 son résultat est bien POSÉ dans la charge de l'e-mail", () => {
    // Appeler sans utiliser serait le même défaut d'un cran plus loin.
    expect(code).toContain("...liens,");
  });

  it("🔴 les anciens liens ne sont plus posés en parallèle", () => {
    // Deux sources pour le même lien : le dernier écrit gagnerait, et lequel
    // dépendrait de l'ordre des clés — invisible en relecture.
    //
    // ⚠️ LE MOTIF VISE LA FORME EXACTE DE L'ANCIEN CÂBLAGE, et pas le nom des
    // champs. Premier jet : `/cancelUrl: rdv\.cancelUrl/`, qui mordait sur la
    // ligne `replis: { cancelUrl: rdv.cancelUrl, … }` — le repli, parfaitement
    // légitime, et dont la présence est même exigée par les tests plus haut.
    // Une garde trop large ne se contente pas de crier à tort : elle pousse à
    // « corriger » du code correct.
    const ancienCablage = /\.\.\.\(rdv\.(cancelUrl|rescheduleUrl)\s*\?/;
    expect(
      ancienCablage.test(code),
      "l'ancien câblage subsiste à côté du nouveau : deux sources pour le même " +
        "lien, et le gagnant dépend de l'ordre des clés",
    ).toBe(false);
  });

  it("🔑 CONTRE-TÉMOIN : ce motif reconnaît bien l'ancien câblage", () => {
    // Sans lui, un motif qui ne reconnaîtrait RIEN rendrait le test ci-dessus
    // vert pour toujours — le piège de la garde qui ne regarde pas.
    const ancien = "...(rdv.cancelUrl ? { cancelUrl: rdv.cancelUrl } : {}),";
    expect(/\.\.\.\(rdv\.(cancelUrl|rescheduleUrl)\s*\?/.test(ancien)).toBe(true);
  });
});

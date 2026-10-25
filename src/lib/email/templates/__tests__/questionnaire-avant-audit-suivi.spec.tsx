/**
 * Les 7 e-mails du questionnaire avant audit (2026-10-26) : invitation standard et Oury,
 * relances 1, 2 et 3, confirmation au dirigeant et au collaborateur. Textes du plan §7, objet de
 * 45 caractères au plus (repli sur l'objet standard), lien à jeton jamais en clair, lien d'arrêt
 * des rappels sur les relances (et alors PAS le lien d'opposition), budget de liens de la famille C.
 */

import { describe, expect, it } from "vitest";

import { familleDuHtml, renderEmailTemplate } from "../index";
import { REGIME_FAMILLE } from "../_layout";
import { OBJET_MAX } from "../../objet-email";
import type { EmailJobName } from "@/server/queue/types";

const JETON = "Jt0kEnSecretDuQuestionnaire_0123456789abcdef";
const LIEN = `https://axion-ia.com/questionnaire/preaudit/q1/${JETON}?ref=AB12`;
const JETON_ARRET = "ArReTsEcReT_9876543210zyxwvu";
const LIEN_ARRET = `https://axion-ia.com/questionnaire/rappels/q1/${JETON_ARRET}`;
const OURY = {
  auditTexte: "vendredi 6 novembre à 8 h 30",
  auditCourt: "6 novembre",
  lieuAudit: "dans vos locaux",
};
const RGPD = {
  conservation:
    "5 ans, puis supprimées par notre équipe ; vous pouvez demander leur suppression à tout moment",
  contactRgpd: "contact@axion-ia.com",
};

const VARIANTES: ReadonlyArray<{
  nom: string;
  gabarit: EmailJobName;
  payload: Record<string, unknown>;
}> = [
  {
    nom: "invitation standard",
    gabarit: "questionnaire-avant-audit",
    payload: { prenom: "Claire", lien: LIEN },
  },
  {
    nom: "invitation Oury",
    gabarit: "questionnaire-avant-audit",
    payload: { prenom: "Flora", lien: LIEN, ...OURY },
  },
  {
    nom: "relance 1",
    gabarit: "questionnaire-avant-audit-relance",
    payload: {
      rang: 1,
      prenom: "Flora",
      lien: LIEN,
      lienArret: LIEN_ARRET,
      ...OURY,
      brouillonEnCours: true,
    },
  },
  {
    nom: "relance 2",
    gabarit: "questionnaire-avant-audit-relance",
    payload: { rang: 2, prenom: "Flora", lien: LIEN, lienArret: LIEN_ARRET, ...OURY },
  },
  {
    nom: "relance 3",
    gabarit: "questionnaire-avant-audit-relance",
    payload: { rang: 3, lien: LIEN, lienArret: LIEN_ARRET, ...OURY },
  },
  {
    nom: "confirmation dirigeant",
    gabarit: "questionnaire-avant-audit-confirmation",
    payload: {
      role: "dirigeant",
      prenom: "Flora",
      recuLeTexte: "27 octobre",
      auditCourt: "6 novembre",
      ...RGPD,
    },
  },
  {
    nom: "confirmation collaborateur",
    gabarit: "questionnaire-avant-audit-confirmation",
    payload: { role: "collaborateur", prenom: "Marine", societe: "OURY CRÉATION", ...RGPD },
  },
];

/** Le CORPS seul (titre → soupape commune) : le pied légal porte l'adresse du siège. */
function corps(html: string): string {
  const t = texteVisible(html);
  const fin = t.indexOf("Une question ?");
  return fin === -1 ? t : t.slice(0, fin);
}

function texteVisible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("les 7 e-mails du questionnaire avant audit", () => {
  for (const v of VARIANTES) {
    describe(v.nom, () => {
      it("vocabulaire : ni Grenoble, ni garanti, ni « J'aide », ni durée, ni facultatif ; signature", async () => {
        const { html, subject } = await renderEmailTemplate(v.gabarit, "fr", { ...v.payload });
        const t = corps(html);
        for (const interdit of [/grenoble/i, /garanti/i, /j'aide/i, /minute/i, /facultati/i]) {
          expect(t).not.toMatch(interdit);
          expect(subject).not.toMatch(interdit);
        }
        expect(t).not.toMatch(/Axion IA(?!-)/);
        expect(t).toContain("À très bientôt,");
        expect(t).toContain("Williams Jullin, Axion-IA");
        expect(t).not.toContain("undefined");
        expect(subject.length).toBeLessThanOrEqual(OBJET_MAX);
      });

      it("le jeton n'est jamais imprimé en clair ; budget de liens de la famille C", async () => {
        // Le texte brut (`text`) garde le lien cliquable : c'est le rendu VISIBLE qui ne
        // l'imprime pas (`ctaSecret`).
        const { html } = await renderEmailTemplate(
          v.gabarit,
          "fr",
          { ...v.payload },
          { destinataire: "flora@exemple-fictif.fr" },
        );
        expect(texteVisible(html)).not.toContain(JETON);
        const famille = familleDuHtml(html);
        expect(famille).toBe("C");
        const liens = new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
        expect(liens.size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
      });
    });
  }

  it("invitation : textes et bouton « Ouvrir mon questionnaire », note sous le bouton", async () => {
    const std = await renderEmailTemplate("questionnaire-avant-audit", "fr", { lien: LIEN });
    expect(std.subject).toBe("Préparons votre audit : votre questionnaire");
    const t = texteVisible(std.html);
    expect(t).toContain("Bonjour,");
    expect(t).toContain("Ouvrir mon questionnaire");
    expect(t).toContain("Ce lien vous est personnel : merci de ne pas le transférer.");
    // Le bouton d'abord, la signature ensuite (vérification E1).
    expect(t.indexOf("Ouvrir mon questionnaire")).toBeLessThan(t.indexOf("À très bientôt,"));
    // Espace insécable avant les deux-points, dans le HTML rendu.
    expect(std.html).toMatch(/personnel( |&nbsp;|&#xa0;|&#160;):/);
    expect(t).toContain("Merci pour notre échange. Pour préparer notre audit nous avons préparé");
    expect(std.html).toContain(`href="${LIEN.replace(/&/g, "&amp;")}"`);

    const oury = await renderEmailTemplate("questionnaire-avant-audit", "fr", {
      prenom: "Flora",
      lien: LIEN,
      ...OURY,
    });
    expect(oury.subject).toBe("Audit du 6 novembre : votre questionnaire");
    expect(texteVisible(oury.html)).toContain(
      "Pour préparer notre audit, prévu le vendredi 6 novembre à 8 h 30, dans vos locaux, nous avons préparé",
    );
    // Vérification F : « à 10 h, en visio », jamais « à 10 h En visio ».
    const visio = await renderEmailTemplate("questionnaire-avant-audit", "fr", {
      lien: LIEN,
      ...OURY,
      lieuAudit: "En visio",
    });
    expect(texteVisible(visio.html)).toContain("à 8 h 30, en visio, nous avons préparé");
  });

  it("relances : lien d'arrêt « Ne plus recevoir de rappel », PAS de lien d'opposition", async () => {
    for (const rang of [1, 2, 3]) {
      const { html } = await renderEmailTemplate(
        "questionnaire-avant-audit-relance",
        "fr",
        { rang, lien: LIEN, lienArret: LIEN_ARRET },
        { destinataire: "flora@exemple-fictif.fr" },
      );
      expect(html).toContain(`href="${LIEN_ARRET}"`);
      expect(texteVisible(html)).toContain("Ne plus recevoir de rappel");
      expect(html).not.toMatch(/opposition/i);
    }
  });

  it("relances : objets datés, et repli sur l'objet standard au-delà de 45 caractères", async () => {
    const objet = async (p: Record<string, unknown>) =>
      (await renderEmailTemplate("questionnaire-avant-audit-relance", "fr", { lien: LIEN, ...p }))
        .subject;
    expect(await objet({ rang: 1, auditCourt: "6 novembre" })).toBe(
      "6 novembre : votre questionnaire vous attend",
    );
    expect(await objet({ rang: 1, auditCourt: "30 septembre" })).toBe(
      "Votre questionnaire vous attend",
    );
    expect(await objet({ rang: 2, auditCourt: "6 novembre" })).toBe(
      "Votre questionnaire : où en êtes-vous ?",
    );
    expect(await objet({ rang: 3, auditCourt: "6 novembre" })).toBe(
      "Avant le 6 novembre : dernier rappel",
    );
    expect(await objet({ rang: 3 })).toBe("Dernier rappel : votre questionnaire");
  });

  it("relance 1 : « Reprendre mon questionnaire » si un brouillon est en cours", async () => {
    const avec = await renderEmailTemplate("questionnaire-avant-audit-relance", "fr", {
      rang: 1,
      lien: LIEN,
      brouillonEnCours: true,
    });
    expect(texteVisible(avec.html)).toContain("Reprendre mon questionnaire");
    expect(texteVisible(avec.html)).toContain(
      "vous reprendrez exactement là où vous vous étiez arrêté",
    );
    const sans = await renderEmailTemplate("questionnaire-avant-audit-relance", "fr", {
      rang: 1,
      lien: LIEN,
    });
    expect(texteVisible(sans.html)).toContain("Ouvrir mon questionnaire");
    const ts = texteVisible(sans.html);
    expect(ts.indexOf("Ouvrir mon questionnaire")).toBeLessThan(ts.indexOf("À très bientôt,"));
  });

  it("confirmations : sans bouton, conservation et contact ; collaborateur neutre", async () => {
    const dir = texteVisible(
      (
        await renderEmailTemplate(
          "questionnaire-avant-audit-confirmation",
          "fr",
          VARIANTES[5]!.payload,
        )
      ).html,
    );
    expect(dir).toContain("Vos réponses nous sont bien parvenues le 27 octobre");
    expect(dir).toContain("préparer notre audit du 6 novembre");
    expect(dir).toContain("Vos réponses sont conservées 5 ans");
    expect(dir).toContain("contact@axion-ia.com");
    const col = await renderEmailTemplate(
      "questionnaire-avant-audit-confirmation",
      "fr",
      VARIANTES[6]!.payload,
    );
    const t = texteVisible(col.html);
    expect(t).toContain("Merci d'avoir répondu au questionnaire préparé pour OURY CRÉATION.");
    expect(t).not.toMatch(/dirigeant|lit vos|lira/i);
    expect(col.html).not.toMatch(/class="[^"]*ax-cta/);
    expect(col.subject).toBe("Vos réponses sont bien arrivées");
  });
});

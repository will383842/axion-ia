/**
 * L'invitation au questionnaire avant audit, texte MODIFIABLE (2026-10-25) : objet, message
 * personnel, corps. Le lien, le bouton, la note du lien, la formule de fin et le pied légal restent
 * ceux du gabarit ; le texte saisi est échappé (jamais du HTML).
 */
import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { CORPS_PAR_DEFAUT } from "../../questionnaire-avant-audit-texte";

const LIEN =
  "https://axion-ia.com/questionnaire/preaudit/q1/Jt0kEnSecretDuQuestionnaire_0123456789abcdef?ref=AB12";
const BASE = {
  prenom: "Claire",
  lien: LIEN,
  auditTexte: "vendredi 6 novembre à 8 h 30",
  auditCourt: "6 novembre",
  lieuAudit: "dans vos locaux",
};
const rendre = (extra: Record<string, unknown> = {}) =>
  renderEmailTemplate(
    "questionnaire-avant-audit",
    "fr",
    { ...BASE, ...extra },
    { destinataire: "c@exemple.fr" },
  );

describe("invitation : texte modifiable", () => {
  it("sans surcharge, rien ne change ; le texte d'origine rendu explicitement donne le même e-mail", async () => {
    const a = await rendre();
    const b = await rendre({ corpsPerso: CORPS_PAR_DEFAUT });
    expect(b.html).toBe(a.html);
    expect(b.subject).toBe(a.subject);
    expect(a.html).toContain("prévu le vendredi 6 novembre à 8 h 30, dans vos locaux,");
  });

  it("l'objet saisi remplace l'objet automatique, sur une seule ligne", async () => {
    const m = await rendre({ objetPerso: "Claire, votre audit du 6\r\nBcc: x@y.fr" });
    expect(m.subject).toBe("Claire, votre audit du 6 Bcc: x@y.fr");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });

  it("un objet saisi vide garde l'objet automatique", async () => {
    expect((await rendre({ objetPerso: "  " })).subject).toBe((await rendre()).subject);
  });

  it("le message personnel s'insère entre « Bonjour » et le corps", async () => {
    const m = await rendre({ messagePerso: "Ravi de notre échange de ce matin.\n\nÀ vendredi !" });
    const i = m.html.indexOf("Bonjour Claire,");
    const j = m.html.indexOf("Ravi de notre échange de ce matin.");
    const k = m.html.indexOf("À vendredi !");
    const l = m.html.indexOf("Merci pour notre échange");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(k).toBeGreaterThan(j);
    expect(l).toBeGreaterThan(k);
  });

  it("un corps saisi remplace le corps ; bouton, note du lien et formule de fin restent", async () => {
    const m = await rendre({ corpsPerso: "Voici mon texte à moi.\n\nDeuxième paragraphe." });
    expect(m.html).toContain("Voici mon texte à moi.");
    expect(m.html).toContain("Deuxième paragraphe.");
    expect(m.html).not.toContain("Merci pour notre échange");
    expect(m.html).toContain("Ouvrir mon questionnaire");
    expect(m.html).toContain("Ce lien vous est personnel");
    expect(m.html).toContain("À très bientôt");
    expect(m.html).toContain("Williams Jullin");
  });

  it("le jeton {audit} du corps saisi reçoit la date ; sans date il disparaît", async () => {
    const avec = await rendre({ corpsPerso: "Pour notre audit{audit} voici le lien." });
    expect(avec.html).toContain(
      "Pour notre audit, prévu le vendredi 6 novembre à 8 h 30, dans vos locaux, voici le lien.",
    );
    const sans = await renderEmailTemplate(
      "questionnaire-avant-audit",
      "fr",
      { prenom: "Claire", lien: LIEN, corpsPerso: "Pour notre audit{audit} voici le lien." },
      { destinataire: "c@exemple.fr" },
    );
    expect(sans.html).toContain("Pour notre audit voici le lien.");
    expect(sans.html).not.toContain("{audit}");
  });

  it("le texte saisi est échappé : aucune balise, aucun lien actif ajouté", async () => {
    const m = await rendre({
      messagePerso: '<script>alert(1)</script><a href="https://evil.example">clic</a>',
      corpsPerso: "<img src=x onerror=alert(1)>",
      objetPerso: "<b>Objet</b>",
    });
    expect(m.html).not.toContain("<script>alert(1)");
    expect(m.html).not.toContain('href="https://evil.example"');
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("une charge non texte est ignorée", async () => {
    const m = await rendre({ messagePerso: 42, corpsPerso: { a: 1 }, objetPerso: ["x"] });
    expect(m.html).toContain("Merci pour notre échange");
  });

  it("le texte saisi ne peut pas changer le lien du bouton", async () => {
    const m = await rendre({
      messagePerso: "https://evil.example/x",
      corpsPerso: "Allez sur https://evil.example",
    });
    const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1] ?? "");
    expect(hrefs.some((h) => h.includes("evil.example"))).toBe(false);
    expect(hrefs.some((h) => h.includes("questionnaire/preaudit/q1"))).toBe(true);
  });
});

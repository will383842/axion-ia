import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OngletEmails } from "../OngletEmails";
import { OngletQuestionnaire } from "../OngletQuestionnaire";

const CID = "33333333-3333-4333-8333-333333333333";
const ligne = (o: Partial<Parameters<typeof OngletEmails>[0]["lignes"][number]> = {}) =>
  ({
    id: "e1",
    template: "questionnaire-avant-audit",
    recipient: "dirigeant@exemple-fictif.fr",
    status: "sent",
    attempts: 1,
    error: null,
    entityType: "QuestionnaireAvantAudit",
    entityId: "q1",
    providerMessageId: null,
    sentAt: new Date("2026-10-25T13:30:00Z"),
    failedAt: null,
    createdAt: new Date("2026-10-25T13:29:00Z"),
    jobId: null,
    bounceType: null,
    bounceReason: null,
    objet: "Votre questionnaire avant audit",
    ...o,
  }) as Parameters<typeof OngletEmails>[0]["lignes"][number];

describe("onglet « E-mails » de la fiche", () => {
  it("montre l'objet, le statut, l'heure de Paris et le lien vers la copie, et dit les 5 ans", () => {
    const html = renderToStaticMarkup(
      <OngletEmails lignes={[ligne()]} total={1} clientId={CID} adminPrefix="adm" />,
    );
    expect(html).toContain("Votre questionnaire avant audit");
    expect(html).toContain('href="/fr/adm/emails-envoyes/e1"');
    expect(html).toContain("25/10/2026");
    expect(html).toContain("14:30");
    expect(html).toContain("gardés 5 ans");
    expect(html).not.toContain("12 mois");
  });

  it("dit « Objet non conservé » sans copie, et renvoie au journal filtré quand il y en a plus", () => {
    const html = renderToStaticMarkup(
      <OngletEmails lignes={[ligne({ objet: null })]} total={9} clientId={CID} adminPrefix="adm" />,
    );
    expect(html).toContain("Objet non conservé");
    expect(html).toContain(`emails-envoyes?client=${CID}&amp;fenetre=0`);
  });

  it("vide : une phrase, pas un tableau vide", () => {
    const html = renderToStaticMarkup(
      <OngletEmails lignes={[]} total={0} clientId={CID} adminPrefix="adm" />,
    );
    expect(html).toContain("Aucun e-mail envoyé à ce client");
  });
});

describe("onglet « Questionnaire » de la fiche", () => {
  it("sans questionnaire : une phrase et le bouton d'envoi sans rendez-vous", () => {
    const html = renderToStaticMarkup(
      <OngletQuestionnaire questionnaires={[]} clientId={CID} adminPrefix="adm" />,
    );
    expect(html).toContain("Aucun questionnaire avant audit pour cette fiche");
    expect(html).toContain(`href="/fr/adm/qualiopi/clients/${CID}/questionnaire"`);
    expect(html).toContain("Envoyer un questionnaire");
  });
});

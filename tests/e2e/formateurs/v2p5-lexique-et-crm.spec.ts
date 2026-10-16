// @formateurs V2P5 — Un formateur freelance n'est ni un salarié recruté, ni un client.
//
//   · Du dépôt de la candidature jusqu'à « Retenu » (lien du dossier F5), rien en base
//     ne parle d'embauche : ni statut `hired`/`offer`, ni date d'embauche, ni événement
//     de candidature qui le dise ; la fiche ouverte est celle d'un sous-traitant.
//   · Les e-mails RÉELLEMENT reçus (puits SMTP) vouvoient, ne parlent ni d'embauche ni
//     de salaire, ne promettent rien d'intenable, et ne disent jamais « Grenoble » ni
//     « Aucun gain garanti ».
//   · Un échange formateur capté par l'iframe de la page de réservation SANS le
//     marqueur de l'invitation (lien partagé, page ouverte directement) : n'entre pas
//     au CRM comme un client. (Avec marqueur : E33.)

import { expect, test } from "@playwright/test";

import { adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";

import { prisma } from "../fixtures/formateurs/base";
import { eventUriDe, rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import { formateurRetenu } from "../fixtures/formateurs/parcours";
import { corpsDuMessage, messagesCaptes } from "../fixtures/formateurs/puits-smtp";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";

/** Ce qu'un e-mail à un formateur indépendant ne dit jamais. */
const INTERDITS: ReadonlyArray<[string, RegExp]> = [
  ["tutoiement", /\b(tu|toi|ton|ta|tes|t'as)\b/i],
  ["embauche", /embauch/i],
  ["salaire", /\bsalaires?\b/i],
  ["contrat de travail", /contrat de travail|\bCDI\b|\bCDD\b/],
  ["période d'essai", /p[ée]riode d'essai/i],
  ["Grenoble", /Grenoble/i],
  ["Aucun gain garanti", /aucun gain garanti/i],
  ["revenu garanti", /(revenus?|missions?|volume) garanti/i],
];

/**
 * Le texte lisible d'un e-mail capté (sans balises ni liens), SANS la mention légale
 * du pied : l'adresse du siège immatriculé (Kbis) est à Grenoble et doit y figurer.
 * « Jamais Grenoble » vise ce que le message DIT, pas l'adresse légale de l'émetteur.
 */
function lisible(html: string, texte: string): string {
  const brut = texte.trim() !== "" ? texte : html.replace(/<[^>]+>/g, " ");
  return brut
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .split(adresseSiegeUneLigne())
    .join(" ");
}

test.describe("@formateurs V2P5 — ni recrutement, ni client", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p5");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("jusqu'à « Retenu » : aucun mot de recrutement en base, des e-mails justes", async () => {
    const email = decor.adresse("retenue");
    const { cand, fiche } = await formateurRetenu(email, "Maëlys", decor.admin);

    // La candidature n'est pas un recrutement.
    const apres = await prisma.jobApplication.findUniqueOrThrow({ where: { id: cand.id } });
    expect(["hired", "offer"]).not.toContain(apres.status);
    expect((apres as unknown as { hiredAt: Date | null }).hiredAt ?? null).toBeNull();
    const evenements = await prisma.jobApplicationEvent.findMany({
      where: { applicationId: cand.id },
      select: { type: true },
    });
    expect(evenements.map((e) => String(e.type)).filter((t) => /hire|offer/i.test(t))).toEqual([]);
    // La fiche ouverte est celle d'un sous-traitant, sans contrat de travail.
    const t = await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } });
    expect(t.statut).toBe("sous_traitant");
    expect((t as unknown as { contratType: string | null }).contratType ?? null).toBeNull();

    // Les e-mails tels que reçus.
    const recus = await messagesCaptes(email);
    expect(recus.length).toBeGreaterThanOrEqual(2);
    const fautes: string[] = [];
    for (const m of recus) {
      const { html, texte } = await corpsDuMessage(m.id);
      const corps = lisible(html, texte);
      for (const [nom, motif] of INTERDITS) {
        if (motif.test(`${m.sujet} ${corps}`)) fautes.push(`« ${m.sujet} » : ${nom}`);
      }
      // Vouvoiement : chaque e-mail s'adresse à la personne par « vous ».
      if (!/\bvous\b|\bvotre\b|\bvos\b/i.test(corps)) fautes.push(`« ${m.sujet} » : sans vous`);
    }
    expect(fautes).toEqual([]);
  });

  test("échange capté par l'iframe sans marqueur d'invitation : hors CRM", async () => {
    const email = decor.adresse("iframe-sans-marqueur");
    const rdv = rendezVousFictif({
      nomType: "Échange formateur indépendant (20 min)",
      typeConnu: null,
      prenom: "Ilan",
      email,
      joursPlusTard: 3,
    });
    const capture = await etape<{ statut: number; corps: string }>({
      etape: "capter-iframe",
      args: {
        cle: rdv.cle,
        slug: "echange-formateur-independant",
        pageUrl: "https://axion-ia.com/fr/appel/formateur-independant",
      },
      calendly: [rdv],
      ip: "198.18.201.7",
    });
    expect(capture.valeur.statut, capture.valeur.corps).toBe(200);
    const ligne = await prisma.calendlyEvent.findFirstOrThrow({
      where: { eventUri: eventUriDe(rdv) },
    });
    const crm = await prisma.crmSyncOutbox.findMany({
      where: { subjectRef: `site:calendly_event:${ligne.id}` },
      select: { eventType: true, universe: true },
    });
    expect(crm).toEqual([]);
    // Aucune fiche « prospect » n'a été ouverte pour lui.
    expect(ligne.linkedSubmissionId).toBeNull();
  });
});

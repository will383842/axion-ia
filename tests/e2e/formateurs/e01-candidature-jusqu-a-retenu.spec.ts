// @formateurs — E01 · Candidature freelance → F0 → F1 → échange → « Retenu » → F5.
//
// Le parcours d'entrée complet d'un formateur indépendant, par les chemins réels :
//   1. le formulaire court de l'offre (action publique `submitJobApplicationAction`) :
//      accusé F0 « mission » (`candidature-recue`, `mission: true`) ;
//   2. le balayage F1 du worker : rien à +14 min, l'invitation à +16 min ;
//   3. la réservation par le lien de F1 (`depuis=fa-<id>` → `utm_content`), reçue
//      par le webhook signé : rattachée à SA candidature, hors CRM ;
//   4. F3 (confirmation) puis F4 (la veille, une heure avant) ;
//   5. « Retenu » en console, après aperçu et confirmation : fiche INACTIVE
//      `sous_traitant`, `candidatureId` posé, dossier ouvert, F5 parti.
// Ce qui NE doit PAS se produire : « poste pourvu », proposition ou fiche
// apporteur, ligne CRM, signal Meta ou Plausible, changement de `status`.
// Enfin, les données Google de l'offre : `CONTRACTOR`, aucun `baseSalary`.
//
// ⚠️ Horloge : l'issue d'un échange se note après son début, lu sur l'horloge
// RÉELLE (`preparerIssueFormateur` ne reçoit pas d'instant). L'échange du banc
// est donc placé dans le passé réel ; F3 et F4 sont passés avec le `maintenant`
// qui précède cet échange.

import { expect, test } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "../fixtures/formateurs/allumage";
import { prisma } from "../fixtures/formateurs/base";
import { eventUriDe, rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import type { AppelReseau } from "../fixtures/formateurs/reseau-simule";
import {
  attendreLeWorker,
  candidaturesDe,
  gabaritsVers,
  ouvrirScenario,
  plus,
  sujetsCaptes,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

/** Les hôtes qu'aucune étape de ce parcours ne doit même tenter d'appeler. */
const SIGNAUX_INTERDITS = /facebook|meta|plausible|google-analytics|googletagmanager/i;

test.describe("@formateurs E01 — candidature freelance jusqu'à « Retenu »", () => {
  test.setTimeout(600_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    decor = await ouvrirScenario("e01");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("le parcours complet, ce qui part, ce qui ne part pas, l'état en base", async () => {
    const reseau: AppelReseau[] = [];
    const email = decor.adresse("candidate");

    // 1. Le formulaire court.
    const depot = await etape<{ ok: boolean; applicationId?: string }>({
      etape: "deposer-candidature",
      args: { offre: SLUG_OFFRE_BANC, prenom: "Maëlle", nom: "Banc-Essai", email },
      ip: "192.0.2.101",
    });
    reseau.push(...depot.reseau);
    expect(depot.valeur.ok).toBe(true);
    const [cand] = await candidaturesDe(email);
    expect(cand, "la candidature est en base").toBeDefined();
    if (!cand) return;
    expect(cand.natureCollaboration).toBe("freelance");
    expect(cand.origine).toBe("formulaire");
    expect(cand.status).toBe("new");

    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    // F0 est la variante « mission » : la copie de l'envoi en porte la phrase.
    const f0 = await prisma.emailLog.findFirst({
      where: { recipient: email, template: "candidature-recue" },
      select: { status: true, contenu: { select: { text: true } } },
    });
    expect(f0?.status).toBe("sent");
    expect(f0?.contenu?.text).toContain("missions de formateur IA indépendant");

    // 2. F1 : pas avant 15 minutes, puis une fois.
    const t0 = cand.submittedAt;
    await etape({ etape: "passage-invitations", args: { maintenant: plus(t0, { minutes: 14 }) } });
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);
    const f1 = await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(t0, { minutes: 16 }) },
    });
    reseau.push(...f1.reseau);
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
    ]);
    expect(
      (await prisma.jobApplication.findUnique({ where: { id: cand.id } }))?.invitationFormateurAt,
    ).toEqual(plus(t0, { minutes: 16 }));

    // 3. La réservation par le lien de F1 : `depuis=fa-<id>` devient `utm_content`.
    const debut = plus(new Date(), { minutes: -40 });
    const rdv = rendezVousFictif({
      nomType: "Échange formateur indépendant (20 min)",
      typeConnu: null,
      prenom: "Maëlle",
      email,
      debut: debut.toISOString(),
      dureeMinutes: 20,
      tracking: { utm_content: `formateur:fa-${cand.id}` },
    });
    const livraison = await etape<{ statut: number }>({
      etape: "livrer-webhook",
      args: { cle: rdv.cle },
      calendly: [rdv],
    });
    reseau.push(...livraison.reseau);
    expect(livraison.valeur.statut).toBe(200);
    const ligne = await prisma.calendlyEvent.findFirst({ where: { eventUri: eventUriDe(rdv) } });
    expect(ligne?.linkedJobApplicationId).toBe(cand.id);
    expect(ligne?.linkedSubmissionId).toBeNull();
    expect(["diagnostic", "echange_projet", "apporteur"]).not.toContain(ligne?.typeRendezVous);
    if (!ligne) return;

    // 4. F3 puis F4 (la veille, une heure avant), sur l'instant qui précède l'échange.
    for (const avant of [{ jours: -2 }, { minutes: -1445 }, { minutes: -65 }]) {
      const r = await etape({
        etape: "passage-echanges-formateur",
        args: { maintenant: plus(debut, avant) },
      });
      reseau.push(...r.reseau);
    }
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-echange-confirme",
      "formateur-echange-rappel",
      "formateur-echange-rappel",
    ]);

    // 5. « Retenu » : jamais sans aperçu ni confirmation.
    const apercu = await etape<{ etat: string; email: { destinataire: string } | null }>({
      etape: "apercu-issue",
      args: { calendlyEventId: ligne.id, issue: "retenu" },
      session: decor.admin,
    });
    expect(apercu.valeur.etat).toBe("apercu");
    expect(apercu.valeur.email?.destinataire).toBe(email);
    const sansConfirmation = await etape<{ etat: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: ligne.id, issue: "retenu" },
      session: decor.admin,
    });
    expect(sansConfirmation.valeur.etat).toBe("erreur");
    expect(await prisma.trainer.count({ where: { candidatureId: cand.id } })).toBe(0);

    const retenu = await etape<{ etat: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: ligne.id, issue: "retenu", confirmer: true },
      session: decor.admin,
    });
    reseau.push(...retenu.reseau);
    expect(retenu.valeur.etat).not.toBe("erreur");

    // L'état en base.
    const fiche = await prisma.trainer.findFirst({ where: { candidatureId: cand.id } });
    expect(fiche).toMatchObject({
      statut: "sous_traitant",
      actif: false,
      dossierStatut: "en_cours",
    });
    const apres = await prisma.jobApplication.findUnique({ where: { id: cand.id } });
    expect(apres?.status).toBe("new");
    const offre = await prisma.jobOffer.findUnique({ where: { slug: SLUG_OFFRE_BANC } });
    expect(offre?.filledAt).toBeNull();
    expect(offre?.status).toBe("published");
    expect(
      await prisma.submission.count({ where: { contactEmailHash: cand.emailHash ?? "∅" } }),
    ).toBe(0);
    expect(
      await prisma.crmSyncOutbox.count({
        where: {
          subjectRef: {
            in: [`site:calendly_event:${ligne.id}`, `site:job_application:${cand.id}`],
          },
        },
      }),
    ).toBe(0);

    // Ce qui est parti : F5 en dernier, vers la fiche — et rien d'autre.
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-echange-confirme",
      "formateur-echange-rappel",
      "formateur-echange-rappel",
      "formateur-issue-retenu",
    ]);
    const f5 = await prisma.emailLog.findFirst({
      where: { recipient: email, template: "formateur-issue-retenu" },
      select: { entityType: true, entityId: true, status: true },
    });
    expect(f5).toEqual({ entityType: "Trainer", entityId: fiche?.id, status: "sent" });
    await expect.poll(async () => (await sujetsCaptes(email)).length, { timeout: 30_000 }).toBe(6);

    // Aucun signal publicitaire ni de mesure d'audience n'a même été tenté.
    expect(reseau.filter((a) => SIGNAUX_INTERDITS.test(new URL(a.url).host))).toEqual([]);

    // Les données Google de l'offre : une mission, pas un emploi salarié.
    const jsonLd = await etape<Record<string, unknown>>({
      etape: "json-ld-offre",
      args: { offre: SLUG_OFFRE_BANC },
    });
    expect(jsonLd.valeur["employmentType"]).toBe("CONTRACTOR");
    expect(jsonLd.valeur).not.toHaveProperty("baseSalary");
  });
});

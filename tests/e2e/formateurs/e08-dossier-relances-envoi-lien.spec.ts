// @formateurs — E08 · Le dossier en ligne en 4 étapes : relances, envoi, lien.
//
//   (1) F9 à J+3 (dossier pas envoyé) ; la personne remplit et envoie (signé) ;
//       à J+7 plus aucune F9. L'IBAN est chiffré, il n'apparaît dans AUCUN
//       historique (journal d'activité, copies des e-mails, puits) ; aucun lien
//       du dossier ne figure ailleurs que sur le bouton de l'e-mail qui le porte.
//   (2) une F9 déjà EN FILE au moment de l'envoi est retenue au départ : le
//       worker relit l'état, rien n'atteint le puits.
//   (3) un lien révoqué (« Renvoyer le lien ») mène à la page neutre : aucune
//       lecture, aucune écriture ; le nouveau lien (F8) fonctionne.
//
// Toutes les étapes passent par les portes PUBLIQUES du dossier (les actions que
// la page appelle), avec le registre des entreprises simulé.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  IBAN_BANC,
  actionDossier,
  formateurRetenu,
  lienDuDernierMessage,
  demanderCode,
  preparerDossier,
  signerAvecCode,
  signerDossier,
} from "../fixtures/formateurs/parcours";
import { corpsDuMessage, messagesCaptes } from "../fixtures/formateurs/puits-smtp";
import {
  attendreLeWorker,
  gabaritsVers,
  jourOuvre,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

/** Ce qui précède chaque occurrence de `motif` (300 caractères au plus). */
function occurrences(texte: string, motif: string): string[] {
  const sortie: string[] = [];
  for (let i = texte.indexOf(motif); i >= 0; i = texte.indexOf(motif, i + 1)) {
    sortie.push(texte.slice(Math.max(0, i - 300), i));
  }
  return sortie;
}

/** Les gabarits qui PORTENT le lien du dossier (sur leur bouton). */
const PORTENT_LE_LIEN = new Set([
  "formateur-issue-retenu",
  "formateur-dossier-lien",
  "formateur-dossier-relance",
]);

test.describe("@formateurs E08 — dossier : relances, envoi, lien", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(20 * 60_000);
    decor = await ouvrirScenario("e08", { organisme: true });
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("(1) F9 à J+3, envoi signé, plus rien à J+7 ; IBAN et lien jamais ailleurs", async () => {
    const email = decor.adresse("dossier");
    const { fiche, lien } = await formateurRetenu(email, "Lou", decor.admin);
    const f5 = await prisma.emailLog.findFirstOrThrow({
      where: { recipient: email, template: "formateur-issue-retenu" },
    });

    await etape({
      etape: "passage-campagnes",
      args: { maintenant: jourOuvre(f5.createdAt, 3).toISOString() },
    });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-issue-retenu",
      "formateur-dossier-relance",
    ]);

    const registre = await preparerDossier(lien, "Lou");
    await signerDossier(lien, email, registre);
    const envoye = await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } });
    expect(envoye.dossierStatut).toBe("a_verifier");
    expect(envoye.dossierEnvoyeAt).not.toBeNull();

    for (const j of [7, 8, 14]) {
      await etape({
        etape: "passage-campagnes",
        args: { maintenant: jourOuvre(f5.createdAt, j).toISOString() },
      });
    }
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-issue-retenu",
      "formateur-dossier-relance",
      "formateur-code-signature",
      "formateur-dossier-recu",
    ]);

    // L'IBAN : chiffré en base, lié à la fiche ; jamais en clair nulle part.
    expect(envoye.iban).toMatch(/^enc:v2:/);
    expect(envoye.iban).not.toContain(IBAN_BANC);
    expect(envoye.ibanEmpreinte).toMatch(/^[0-9a-f]{64}$/);
    const fragments = [IBAN_BANC, IBAN_BANC.slice(4), IBAN_BANC.slice(-11)];
    const journal = await prisma.activityLog.findMany({ where: { targetId: fiche.id } });
    expect(journal.length).toBeGreaterThan(0);
    const copies = await prisma.emailLogContent.findMany({
      where: { emailLog: { recipient: email } },
      select: { subject: true, html: true, text: true },
    });
    const capte: string[] = [];
    for (const m of await messagesCaptes(email)) {
      const c = await corpsDuMessage(m.id);
      capte.push(m.sujet, c.html, c.texte);
    }
    for (const trace of [JSON.stringify(journal), JSON.stringify(copies), capte.join("\n")]) {
      for (const f of fragments) expect(trace).not.toContain(f);
    }

    // Le lien du dossier : sur le bouton des seuls e-mails qui le portent, jamais
    // dans un pied ni dans un autre e-mail.
    const chemin = `/formateur/dossier/${fiche.id}/`;
    const logs = await prisma.emailLog.findMany({
      where: { recipient: email },
      select: { template: true, contenu: { select: { subject: true } } },
    });
    for (const m of await messagesCaptes(email)) {
      const { html, texte } = await corpsDuMessage(m.id);
      const gabarit = logs.find((l) => l.contenu?.subject === m.sujet)?.template ?? "?";
      const dansHtml = html.split(chemin).length - 1;
      const dansTexte = texte.split(chemin).length - 1;
      if (PORTENT_LE_LIEN.has(gabarit)) {
        // Le BLOC DU BOUTON seulement : son `href`, et la ligne « Le bouton ne
        // fonctionne pas ? Copiez cette adresse » juste dessous. Jamais ailleurs.
        expect(dansHtml, `${gabarit} : le lien est sur le bouton`).toBeGreaterThanOrEqual(1);
        for (const avant of occurrences(html, chemin)) {
          expect(
            /href="https:\/\/[^"]*$/.test(avant) ||
              /Copiez cette adresse :<br\/>https:\/\/[^<]*$/.test(avant),
            `${gabarit} : une occurrence du lien hors du bloc du bouton`,
          ).toBe(true);
        }
        expect(dansTexte, `${gabarit} : version texte`).toBeLessThanOrEqual(2);
      } else {
        expect(dansHtml + dansTexte, `${gabarit} ne porte aucun lien du dossier`).toBe(0);
      }
    }
  });

  test("(2) une F9 déjà en file au moment de l'envoi est retenue au départ", async () => {
    const email = decor.adresse("en-file");
    const { fiche, lien } = await formateurRetenu(email, "Nils", decor.admin);
    const registre = await preparerDossier(lien, "Nils");

    const code = await demanderCode(lien, email, registre);

    // La relance est posée en file (départ dans 75 s), puis la personne signe et envoie.
    const enfile = await etape<{ enqueued: boolean }>({
      etape: "enfiler-relance-dossier",
      args: {
        email,
        prenom: "Nils",
        trainerId: fiche.id,
        lien: `https://axion-ia.com/formateur/dossier/${fiche.id}/${lien.jeton}`,
        delaiMs: 75_000,
      },
    });
    expect(enfile.valeur.enqueued).toBe(true);
    await signerAvecCode(lien, email, registre, code, ["formateur-dossier-relance"]);
    const envoye = await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } });
    expect(envoye.dossierStatut).toBe("a_verifier");

    await expect
      .poll(
        async () =>
          (
            await prisma.emailLog.findFirst({
              where: { recipient: email, template: "formateur-dossier-relance" },
              select: { status: true },
            })
          )?.status,
        { timeout: 120_000, intervals: [1_000, 2_000] },
      )
      .toBe("cancelled");
    const ligne = await prisma.emailLog.findFirstOrThrow({
      where: { recipient: email, template: "formateur-dossier-relance" },
      select: { error: true, sentAt: true, updatedAt: true },
    });
    expect(ligne.error).toBe("Retenu à l'envoi : le dossier n'est plus à compléter");
    expect(ligne.sentAt).toBeNull();
    // Retenue AU DÉPART (relecture du worker), donc après l'envoi du dossier.
    expect(ligne.updatedAt.getTime()).toBeGreaterThan(
      envoye.dossierEnvoyeAt?.getTime() ?? Infinity,
    );
    const sujets = (await messagesCaptes(email)).map((m) => m.sujet);
    const f9 = await prisma.emailLog.count({
      where: { recipient: email, template: "formateur-dossier-relance", status: "sent" },
    });
    expect(f9).toBe(0);
    expect(sujets).toHaveLength(4); // F0, F5, F17, F10 — pas de F9.
  });

  test("(3) un lien révoqué mène à la page neutre ; le nouveau lien fonctionne", async () => {
    const email = decor.adresse("revoque");
    const { fiche, lien } = await formateurRetenu(email, "Côme", decor.admin);
    expect(
      await etape({ etape: "lire-dossier", args: { ...lien } }).then((r) => r.valeur),
    ).not.toBeNull();

    const renvoi = await etape<{ redirige: string | null }>({
      etape: "renvoyer-lien",
      args: { trainerId: fiche.id },
      session: decor.admin,
    });
    expect(renvoi.valeur.redirige ?? "").toContain("dossier=lien_envoye");
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toContain("formateur-dossier-lien");

    // L'ancien lien : la page neutre (404), et aucune écriture possible.
    expect((await etape({ etape: "lire-dossier", args: { ...lien } })).valeur).toBeNull();
    const ecriture = await actionDossier(lien, "vous", {
      telephone: "0600000000",
      codePostal: "69003",
    });
    expect(ecriture.valeur.ok).toBe(false);
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).codePostalPro,
    ).toBeNull();
    // Un jeton forgé : la même page neutre.
    expect(
      (await etape({ etape: "lire-dossier", args: { id: fiche.id, jeton: `${lien.jeton}x` } }))
        .valeur,
    ).toBeNull();

    // Le nouveau lien, lu dans F8, ouvre le dossier.
    const nouveau = await lienDuDernierMessage(
      email,
      /\/formateur\/dossier\/([0-9a-f-]{36})\/([^"'\s<>?#]+)/,
      "formateur-dossier-lien",
    );
    expect(nouveau.jeton).not.toBe(lien.jeton);
    expect((await etape({ etape: "lire-dossier", args: { ...nouveau } })).valeur).toMatchObject({
      etat: "modifiable",
    });
  });
});

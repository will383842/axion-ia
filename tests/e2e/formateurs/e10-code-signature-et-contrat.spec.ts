// @formateurs — E10 · Étape 4 : le code F17, la signature, F10 avec la copie.
//
//   · cinq codes faux → le code est bloqué : même le bon est ensuite refusé ;
//   · un nouveau code (après le délai de 2 minutes entre deux codes) signe ;
//   · un code déjà utilisé est refusé (relu par le moteur commun), et le lien,
//     révoqué par l'envoi, ne rouvre rien ;
//   · F10 part avec la copie de la signature en pièce jointe ;
//   · le contrat signé est le texte EN VIGUEUR (contrat-cadre v4), et l'empreinte
//     scellée est celle du PDF exact archivé ;
//   · une adresse différente (changement d'adresse en console après l'envoi du
//     code) : le code envoyé à l'ancienne adresse ne signe plus.
//
// Décision du dirigeant (c) : contrat-cadre v4.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { maillonDocumentDepuisLigne } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  OBJETS_R2_BANC,
  actionDossier,
  demanderCode,
  formateurRetenu,
  lienDuDernierMessage,
  preparerDossier,
} from "../fixtures/formateurs/parcours";
import { corpsDuMessage, messagesCaptes } from "../fixtures/formateurs/puits-smtp";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

/** Deux codes du même contrat sont espacés d'au moins 2 minutes (`code-signature-envoi.ts`). */
const DELAI_ENTRE_DEUX_CODES_MS = 125_000;

test.describe("@formateurs E10 — code de signature, contrat signé, F10", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(900_000);
  let decor: DecorScenario;
  /** La fiche qui a signé dans le premier test : sa preuve est relue par V1-A-7. */
  let ficheSignee: string | undefined;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e10", { organisme: true });
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("code faux ×5 bloqué, nouveau code, signature v4, F10 avec la copie, code réutilisé refusé", async () => {
    const email = decor.adresse("signe");
    const { fiche, lien } = await formateurRetenu(email, "Anouk", decor.admin);
    ficheSignee = fiche.id;
    const registre = await preparerDossier(lien, "Anouk");
    const premier = await demanderCode(lien, email, registre);
    const signer = (code: string) =>
      actionDossier(lien, "signer", { certifie: "1", accepte: "1", code }, { registre });

    // Cinq codes faux : refusés ; puis le BON est refusé aussi (code bloqué).
    const faux = premier === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await signer(faux)).valeur.ok).toBe(false);
    expect((await signer(premier)).valeur.ok).toBe(false);
    const contrat = await prisma.documentGenere.findFirstOrThrow({
      where: { trainerId: fiche.id, type: "contrat_sous_traitance", annuleeAt: null },
    });
    expect(await prisma.documentSignature.count({ where: { documentGenereId: contrat.id } })).toBe(
      0,
    );
    const bloque = await prisma.documentSignatureCode.findFirstOrThrow({
      where: { documentGenereId: contrat.id },
      orderBy: { createdAt: "asc" },
    });
    expect(bloque.utiliseAt).toBeNull();
    expect(bloque.invalideAt).not.toBeNull();

    // Un nouveau code, passé le délai entre deux codes ; il signe et le dossier part.
    await new Promise((r) => setTimeout(r, DELAI_ENTRE_DEUX_CODES_MS));
    const second = await demanderCode(lien, email, registre);
    expect(second).not.toBe(premier);
    const signe = await signer(second);
    expect(signe.valeur.ok, signe.valeur.message).toBe(true);
    await attendreLeWorker(email);

    // F10 est parti, avec la copie de la signature en pièce jointe.
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-issue-retenu",
      "formateur-code-signature",
      "formateur-code-signature",
      "formateur-dossier-recu",
    ]);
    const lireF10 = () =>
      prisma.emailLog.findFirstOrThrow({
        where: { recipient: email, template: "formateur-dossier-recu" },
        select: {
          status: true,
          entityId: true,
          contenu: { select: { subject: true, attachmentNames: true } },
        },
      });
    // La copie est écrite par le worker JUSTE APRÈS la clôture « envoyé » : on l'attend.
    await expect
      .poll(async () => (await lireF10()).contenu !== null, { timeout: 10_000 })
      .toBe(true);
    const f10 = await lireF10();
    expect(f10.status).toBe("sent");
    expect(f10.entityId).toBe(fiche.id);
    expect(f10.contenu?.attachmentNames.length).toBe(1);
    expect(f10.contenu?.attachmentNames[0]).toMatch(/\.pdf$/);
    const recu = (await messagesCaptes(email)).find((m) => m.sujet === f10.contenu?.subject);
    expect(recu, "F10 capté par le puits").toBeDefined();

    // Le texte en vigueur : contrat-cadre v4 ; l'empreinte scellée est celle du PDF archivé.
    const signature = await prisma.documentSignature.findFirstOrThrow({
      where: { documentGenereId: contrat.id, partie: "sous_traitant", revokedAt: null },
    });
    const meta = contrat.metadata as Record<string, unknown>;
    expect(versionGabaritInstantane(meta["renderData"])).toBe(4);
    expect(signature.consentementVersion).toBe("doc-consent-code-v1");
    const annee = contrat.createdAt.getFullYear();
    const pdf = readFileSync(
      path.join(
        OBJETS_R2_BANC,
        `banc-formateurs__documents__${annee}__contrat_sous_traitance__${contrat.numero}.pdf`,
      ),
    );
    expect(signature.documentHashSha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    const utilise = await prisma.documentSignatureCode.findFirstOrThrow({
      where: { documentGenereId: contrat.id, utiliseAt: { not: null } },
    });
    expect(utilise.utiliseAt).not.toBeNull();

    // Le code déjà utilisé : refusé par le moteur commun ; et le lien, révoqué par
    // l'envoi, ne rouvre rien.
    const reutilise = await etape<{ ok: boolean }>({
      etape: "verifier-code",
      args: { documentGenereId: contrat.id, code: second },
    });
    expect(reutilise.valeur.ok).toBe(false);
    expect((await signer(second)).valeur.ok).toBe(false);
    expect(await prisma.documentSignature.count({ where: { documentGenereId: contrat.id } })).toBe(
      1,
    );
    const html = recu ? (await corpsDuMessage(recu.id)).html : "";
    expect(html).not.toContain(second);
  });

  // V1-A-8 — corrigé (lot 2 de la vérification 1). Le changement d'adresse en console
  // invalide, dans la MÊME transaction que l'adresse, les codes de signature vivants
  // (`ecrireFicheAvecChangementEmail` → `invaliderCodesSignatureFormateur`) : le code
  // F17 reçu à l'ANCIENNE adresse ne signe plus, même sur le nouveau lien.
  test("V1-A-8 — adresse différente : le code envoyé à l'ancienne adresse ne signe plus", async () => {
    const email = decor.adresse("ancienne");
    const nouvelle = decor.adresse("nouvelle");
    const { fiche, lien } = await formateurRetenu(email, "Basile", decor.admin);
    const registre = await preparerDossier(lien, "Basile");
    const code = await demanderCode(lien, email, registre);

    // La direction change l'adresse de la fiche, puis renvoie le lien (F8, nouvelle adresse).
    const modifie = await etape<{ error?: string }>({
      etape: "modifier-fiche",
      args: { champs: { id: fiche.id, email: nouvelle } },
      session: decor.admin,
    });
    expect(modifie.valeur.error).toBeUndefined();
    const renvoi = await etape<{ redirige: string | null }>({
      etape: "renvoyer-lien",
      args: { trainerId: fiche.id },
      session: decor.admin,
    });
    expect(renvoi.valeur.redirige ?? "").toContain("dossier=lien_envoye");
    await attendreLeWorker(nouvelle);
    const nouveauLien = await lienDuDernierMessage(
      nouvelle,
      /\/formateur\/dossier\/([0-9a-f-]{36})\/([^"'\s<>?#]+)/,
      "formateur-dossier-lien",
    );

    // L'ancien lien est révoqué.
    expect((await etape({ etape: "lire-dossier", args: { ...lien } })).valeur).toBeNull();
    // Le code de l'ANCIENNE adresse, sur le nouveau lien : refusé, rien n'est signé.
    const tentative = await actionDossier(
      nouveauLien,
      "signer",
      { certifie: "1", accepte: "1", code },
      { registre },
    );
    expect(tentative.valeur.ok).toBe(false);
    const contrat = await prisma.documentGenere.findFirst({
      where: { trainerId: fiche.id, type: "contrat_sous_traitance" },
      select: { id: true },
    });
    expect(
      await prisma.documentSignature.count({ where: { documentGenereId: contrat?.id ?? "∅" } }),
    ).toBe(0);
  });

  // V1-A-7 — corrigé (lot 2). Oracle réécrit (la synthèse le signalait : il testait un
  // nom de colonne) : la preuve écrite par le PREMIER test de ce fichier — signée avec
  // un code reçu par e-mail — porte `facteurVerification = code_email`, ET ce facteur
  // est SCELLÉ (tuple v2) : la chaîne se vérifie, et retirer le facteur après coup la
  // casse. Les preuves antérieures ne sont pas réécrites (facteur nul, tuple v1).
  test("V1-A-7 — la preuve porte le facteur `code_email`, scellé dans l'empreinte", async () => {
    expect(ficheSignee, "le premier test a signé").toBeDefined();
    const contrat = await prisma.documentGenere.findFirstOrThrow({
      where: { trainerId: ficheSignee ?? "∅", type: "contrat_sous_traitance", annuleeAt: null },
      select: { id: true, numero: true, type: true },
    });
    const preuve = await prisma.documentSignature.findFirstOrThrow({
      where: { documentGenereId: contrat.id, partie: "sous_traitant", revokedAt: null },
    });
    expect(preuve.facteurVerification).toBe("code_email");
    expect(preuve.hashVersion).toBe(2);
    const piece = { documentNumero: contrat.numero, documentType: contrat.type };
    expect(verifierChaine([maillonDocumentDepuisLigne(preuve, piece)]).valide).toBe(true);
    const falsifiee = { ...preuve, facteurVerification: null };
    expect(verifierChaine([maillonDocumentDepuisLigne(falsifiee, piece)]).valide).toBe(false);
  });
});

// V2-S03 — Le code de signature F17 du contrat-cadre, attaqué.
//
// Codes émis et vérifiés par le code du dépôt (`emettreCodeSignature`,
// `verifierCodeSignature`), sur de vrais contrats-cadres v3 de la base du banc :
//   · forcé (essais en série, puis en rafale simultanée), puis le BON code ;
//   · rejoué après usage ; remplacé par un code plus récent ; échu ;
//   · présenté sur le contrat d'un AUTRE formateur ;
//   · émis avant un changement d'adresse fait en console ;
//   · demandé par un lien de signature figé sur l'ANCIENNE adresse.
// Témoin : un code neuf, juste, la première fois, est accepté.

import { demanderCodeSignatureAction } from "@/server/actions/qualiopi/piece-signature";
import { updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import {
  CODE_ESSAIS_MAX,
  emettreCodeSignature,
  verifierCodeSignature,
} from "@/server/qualiopi/documents/signature/code-signature";
import { creerTokenDocument } from "@/server/qualiopi/documents/signature/token-document";

import {
  adresse,
  avecVerrouInterrupteurs,
  CLE,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
  seConnecter,
} from "../donnees";

let n = 0;
async function contratV3(trainerId: string): Promise<string> {
  n += 1;
  const d = await prisma.documentGenere.create({
    data: {
      type: "contrat_sous_traitance",
      numero: `BANC-SECU-${CLE}-F17-${n}`,
      hashSha256: "0".repeat(64),
      suppressionPrevueAt: new Date(Date.now() + 10 * 365 * 86_400_000),
      trainerId,
      statutSignature: "en_attente",
      metadata: { renderData: { gabaritVersion: 3 } },
    } as never,
    select: { id: true },
  });
  return d.id;
}

const PARTIE = "sous_traitant" as const;
const faux = (code: string) => (code === "000000" ? "111111" : "000000");

export default async function v2s03(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const a = await creerIndependant({ actif: true });
      const b = await creerIndependant({ actif: true });
      const docA = await contratV3(a.id);
      const docB = await contratV3(b.id);
      const verifier = (documentGenereId: string, code: string, maintenant?: Date) =>
        verifierCodeSignature({
          documentGenereId,
          partie: PARTIE,
          code,
          ...(maintenant ? { maintenant } : {}),
        }).then((r) => r.ok);

      // Forcé en série.
      const c1 = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      const serie: boolean[] = [];
      for (let i = 0; i < CODE_ESSAIS_MAX; i++) serie.push(await verifier(docA, faux(c1.code)));
      const bonApresSerie = await verifier(docA, c1.code);

      // Forcé en rafale : dix essais simultanés, puis le bon.
      const c2 = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      const rafale = await Promise.all(
        Array.from({ length: 10 }, () => verifier(docA, faux(c2.code))),
      );
      const essaisCompte = await prisma.documentSignatureCode.findFirst({
        where: { documentGenereId: docA },
        orderBy: { createdAt: "desc" },
        select: { essais: true },
      });
      const bonApresRafale = await verifier(docA, c2.code);

      // Témoin, puis rejeu.
      const c3 = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      const temoin = await verifier(docA, c3.code);
      const rejeu = await verifier(docA, c3.code);

      // Remplacé par un plus récent.
      const ancien = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      const recent = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      const ancienApresRecent = await verifier(docA, ancien.code);
      const recentOk = await verifier(docA, recent.code);

      // Échu : émis il y a 16 minutes.
      const echu = await emettreCodeSignature({
        documentGenereId: docA,
        partie: PARTIE,
        maintenant: new Date(Date.now() - 16 * 60_000),
      });
      const apresEcheance = await verifier(docA, echu.code);

      // Le code du contrat de A, présenté sur celui de B (qui a son propre code vivant).
      const deA = await emettreCodeSignature({ documentGenereId: docA, partie: PARTIE });
      await emettreCodeSignature({ documentGenereId: docB, partie: PARTIE });
      const surB = deA.code === "" ? true : await verifier(docB, deA.code);

      // Lien de signature figé sur l'adresse de B, puis changement d'adresse en console.
      const lien = await creerTokenDocument({
        documentGenereId: docB,
        partie: PARTIE,
        signataireNom: "Signataire banc",
        signataireEmail: b.email,
        borneMetier: new Date(Date.now() + 7 * 86_400_000),
      });
      const avantChangement = await emettreCodeSignature({
        documentGenereId: docB,
        partie: PARTIE,
      });
      seConnecter(direction);
      const changement = await updateTrainerAction({ id: b.id, email: adresse("nouvelle-b") });
      seConnecter(null);
      const apresChangement = await verifier(docB, avantChangement.code);
      const codesAvant = await prisma.documentSignatureCode.count({
        where: { documentGenereId: docB },
      });
      const demande = await demanderCodeSignatureAction({ token: lien.token });
      const codesApres = await prisma.documentSignatureCode.count({
        where: { documentGenereId: docB },
      });
      const versAncienne = await prisma.emailLog.count({
        where: { recipient: b.email, template: { contains: "code" } },
      });

      await prisma.documentSignatureCode.deleteMany({
        where: { documentGenereId: { in: [docA, docB] } },
      });
      return {
        serie,
        bonApresSerie,
        rafale: rafale.filter(Boolean).length,
        essaisCompte: essaisCompte?.essais ?? null,
        bonApresRafale,
        temoin,
        rejeu,
        ancienApresRecent,
        recentOk,
        apresEcheance,
        surB,
        changement: "error" in changement ? changement.error : "ok",
        apresChangement,
        demande: { ok: demande.ok, raison: "raison" in demande ? demande.raison : null },
        nouveauxCodes: codesApres - codesAvant,
        versAncienne,
        essaisMax: CODE_ESSAIS_MAX,
      };
    });
  } finally {
    await menage();
  }
}

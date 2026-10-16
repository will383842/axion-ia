// V2-S04 — Le lien de signature d'une pièce (lettre de mission), rejoué.
//
// Liens fabriqués par le code du dépôt (`creerTokenDocument`), présentés à
// l'action publique de signature (`signerPieceParJetonAction`) et à la lecture
// du lien (`verifierTokenDocument`) : révoqué, remplacé par un lien plus récent,
// échu, altéré, et émis vers l'adresse d'avant un changement fait en console.
// Témoin : un lien neuf est reconnu. Aucune signature ne doit naître d'un refus.

import { signerPieceParJetonAction } from "@/server/actions/qualiopi/piece-signature";
import { updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import {
  creerTokenDocument,
  revoquerTokensDocument,
  verifierTokenDocument,
} from "@/server/qualiopi/documents/signature/token-document";

import {
  adresse,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  menage,
  prisma,
  seConnecter,
} from "../donnees";

const PARTIE = "formateur" as const;

export default async function v2s04(): Promise<unknown> {
  let pieceId: string | null = null;
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const t = await creerIndependant({ actif: true });
      const piece = await creerPieceASigner(t.id, "lettre_mission", "en_attente");
      pieceId = piece.id;
      const lien = () =>
        creerTokenDocument({
          documentGenereId: piece.id,
          partie: PARTIE,
          signataireNom: `${t.prenom} ${t.nom}`,
          signataireEmail: t.email,
          borneMetier: new Date(Date.now() + 7 * 86_400_000),
        }).then((r) => r.token);
      const lire = async (jeton: string) => {
        const v = await verifierTokenDocument(jeton);
        return v.ok ? "ok" : v.raison;
      };
      const signer = async (jeton: string) => {
        const r = await signerPieceParJetonAction({
          token: jeton,
          methode: "confirmation_accessible",
        } as never);
        return r.ok ? "signe" : (r as { raison: string }).raison;
      };

      const neuf = await lien();
      const temoin = await lire(neuf);

      await revoquerTokensDocument({ documentGenereId: piece.id, motif: "banc" } as never);
      const revoque = { lecture: await lire(neuf), signature: await signer(neuf) };

      const premier = await lien();
      const second = await lien();
      const remplace = { lecture: await lire(premier), signature: await signer(premier) };

      await prisma.documentSignatureToken.updateMany({
        where: { documentGenereId: piece.id, revokedAt: null },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      const echu = { lecture: await lire(second), signature: await signer(second) };

      const altere = await signer(`${second.slice(0, -4)}AAAA`);

      // Lien émis vers l'adresse d'avant un changement fait en console.
      const avantChangement = await lien();
      const avant = await lire(avantChangement);
      seConnecter(direction);
      const changement = await updateTrainerAction({ id: t.id, email: adresse("nouvelle") });
      seConnecter(null);
      const apresChangement = {
        lecture: await lire(avantChangement),
        signature: await signer(avantChangement),
      };

      const signatures = await prisma.documentSignature.count({
        where: { documentGenereId: piece.id },
      });
      return {
        temoin,
        revoque,
        remplace,
        echu,
        altere,
        avant,
        changement: "error" in changement ? changement.error : "ok",
        apresChangement,
        signatures,
      };
    });
  } finally {
    // Une signature née d'un défaut (RESTRICT) empêcherait le ménage de la pièce.
    if (pieceId !== null) {
      await prisma.documentSignature
        .deleteMany({ where: { documentGenereId: pieceId } })
        .catch((e: unknown) => console.error("banc : signature non effacée", e));
    }
    await menage();
  }
}

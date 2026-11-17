/**
 * A4 — l'expiration des devis épargne UNIQUEMENT le devis dont la pièce est
 * signée par le client (signature non révoquée) ET non annulée, contre un VRAI
 * Postgres (Gate D : étape « Expiration des devis signés client — filtre positif » de
 * `.github/workflows/ci.yml`, `pnpm test:integration tests/integration/devis`).
 *
 * Quatre devis échus (« envoye », date de validité dépassée) :
 *   1. sans pièce générée                       → « expire »
 *   2. pièce sans signature                     → « expire »
 *   3. pièce signée client, non annulée          → reste « envoye »
 *   4. pièce ANNULÉE portant une signature client → « expire »
 *
 * La clause est la MÊME que celle du worker (`pasSigneParLeClient`, importée).
 * La transaction est TOUJOURS annulée : la base reste vide.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { pasSigneParLeClient } from "../../../src/server/qualiopi/devis/pas-signe-par-le-client";

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");
const HASH = "a".repeat(64);

describe("expiration des devis contre un vrai Postgres (Gate D)", () => {
  it("seul le devis « pièce signée client non annulée » reste « envoye »", async () => {
    const db = new PrismaClient();
    try {
      await expect(
        db.$transaction(async (tx) => {
          const dansUnAn = new Date(Date.now() + 365 * 86_400_000);
          const hier = new Date(Date.now() - 86_400_000);
          const client = await tx.client.create({
            data: { numero: "TEST-CLI-A4", raisonSociale: "Client test A4" },
          });

          const piece = async (suffixe: string, annulee: boolean) =>
            tx.documentGenere.create({
              data: {
                type: "devis",
                numero: `TEST-DOC-A4-${suffixe}`,
                hashSha256: HASH,
                suppressionPrevueAt: dansUnAn,
                annuleeAt: annulee ? new Date() : null,
                // CHECK documents_generes_annulation_motif_check : motif ≥ 10 caractères.
                annuleeMotif: annulee ? "Annulation de test A4" : null,
              },
            });
          const signerClient = async (documentGenereId: string) =>
            tx.documentSignature.create({
              data: {
                documentGenereId,
                provider: "interne",
                partie: "client",
                signataireNom: "Client test",
                methode: "trace",
                // CHECK ck_document_signature_image_par_methode : empreinte d'image obligatoire hors confirmation_accessible.
                signatureSha256: HASH,
                documentHashSha256: HASH,
                selfHash: HASH,
                hashVersion: 1,
                mentionVersion: "test",
                consentementVersion: "test",
                signeAt: new Date(),
                suppressionPrevueAt: dansUnAn,
              },
            });
          const devis = async (suffixe: string, documentGenereId: string | null) =>
            tx.devis.create({
              data: {
                numero: `TEST-DEV-A4-${suffixe}`,
                clientId: client.id,
                lignes: [],
                montantTotalHtCents: 100000,
                mentionTva: "TVA 20 %",
                statut: "envoye",
                dateValidite: hier,
                sentAt: hier,
                documentGenereId,
              },
            });

          const sansPiece = await devis("1", null);
          const pieceNonSignee = await piece("2", false);
          const nonSigne = await devis("2", pieceNonSignee.id);
          const pieceSignee = await piece("3", false);
          await signerClient(pieceSignee.id);
          const signe = await devis("3", pieceSignee.id);
          const pieceAnnulee = await piece("4", true);
          await signerClient(pieceAnnulee.id);
          const annule = await devis("4", pieceAnnulee.id);

          const ids = [sansPiece.id, nonSigne.id, signe.id, annule.id];
          await tx.devis.updateMany({
            where: {
              id: { in: ids }, // borne le test à SES lignes ; la clause testée est celle du worker
              statut: "envoye",
              dateValidite: { lt: new Date() },
              ...pasSigneParLeClient,
            },
            data: { statut: "expire" },
          });

          const apres = await tx.devis.findMany({
            where: { id: { in: ids } },
            select: { id: true, statut: true },
          });
          const statut = (id: string) => apres.find((d) => d.id === id)?.statut;
          expect(statut(sansPiece.id)).toBe("expire");
          expect(statut(nonSigne.id)).toBe("expire");
          expect(statut(signe.id)).toBe("envoye");
          expect(statut(annule.id)).toBe("expire");

          throw ANNULE;
        }),
      ).rejects.toBe(ANNULE);
    } finally {
      await db.$disconnect();
    }
  });
});

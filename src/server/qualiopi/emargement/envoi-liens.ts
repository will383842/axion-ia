/**
 * Émission + envoi des liens de signature — le SERVICE, appelable des deux côtés.
 *
 * 🔴 Il existe parce que deux appelants en ont besoin et qu'aucun des deux ne
 * peut appeler l'autre :
 *
 *  · la Server Action `envoyerLiensEmargementAction`, derrière `requireAdminWrite` ;
 *  · le cron `formation-crons.liens-emargement-j0`, qui n'a pas de session admin.
 *
 * Recopier la logique dans le worker aurait produit exactement le défaut que ce
 * chantier corrige ailleurs : deux exemplaires d'une même règle, dont l'un
 * cesse un jour de suivre l'autre. Le `dossiers-pipeline.ts` du 16/08 en est
 * l'exemple — une règle recopiée « à l'identique » avait divergé au premier
 * changement.
 *
 * ⚠️ Ce module n'AUTORISE rien : l'habilitation se vérifie chez l'appelant.
 * Émettre et envoyer un lien de signature n'engage pas l'organisme — c'est
 * signer qui engage —, donc l'automatiser est légitime. La frontière du plan
 * est respectée.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import {
  creerTokenInscription,
  TokenEmargementError,
} from "@/server/qualiopi/emargement/token-service";

export interface EchecEnvoiLien {
  stagiaireNom: string;
  motif: string;
}

export type ResultatEnvoiLiens =
  { ok: true; envoyes: number; echecs: EchecEnvoiLien[] } | { ok: false; motif: string };

/**
 * Émet un jeton neuf pour chaque stagiaire visé et le lui envoie.
 *
 * ⚠️ Chaque envoi RÉVOQUE le lien précédent du même stagiaire — conséquence
 * directe de « un seul jeton vivant par inscription » (`creerTokenInscription`).
 * L'appelant doit le dire à l'utilisateur ; le service, lui, ne peut pas le
 * deviner.
 */
export async function envoyerLiensPourSession(input: {
  sessionId: string;
  /** Absent = tous les inscrits actifs. */
  enrollmentId?: string | undefined;
  origine: "console" | "cron-j0";
}): Promise<ResultatEnvoiLiens> {
  const formation = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId },
    select: {
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      enrollments: {
        where: {
          statut: { notIn: ["abandon", "exclu"] },
          trainee: { deletedAt: null },
          ...(input.enrollmentId !== undefined ? { id: input.enrollmentId } : {}),
        },
        select: { id: true, trainee: { select: { email: true, nom: true, prenom: true } } },
        orderBy: { trainee: { nom: "asc" } },
      },
    },
  });

  if (formation === null) return { ok: false, motif: "Session introuvable" };
  if (formation.enrollments.length === 0) {
    return {
      ok: false,
      motif:
        input.enrollmentId !== undefined
          ? "Ce stagiaire n'est plus inscrit à cette session."
          : "Aucun stagiaire actif inscrit à cette session.",
    };
  }

  const base = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  const echecs: EchecEnvoiLien[] = [];
  let envoyes = 0;

  for (const inscription of formation.enrollments) {
    const nom = `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim();
    try {
      const { token } = await creerTokenInscription({
        enrollmentId: inscription.id,
        dateFinSession: formation.dateFin,
      });
      const envoi = await enqueueEmail(
        "qualiopi-emargement-lien",
        inscription.trainee.email,
        "fr",
        {
          stagiairePrenomNom: nom,
          titreFormation: formation.titreSession,
          dateDebutFormation: formation.dateDebut.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          lienEmargement: `${base}/fr/portail/emarger/${token}`,
          numeroSession: formation.numero,
        },
        // 🔴 `jobId` horodaté : le cas d'usage principal EST le renvoi (un
        // stagiaire qui a perdu son lien). Un jobId stable ferait dédoublonner
        // BullMQ — l'admin lirait « envoyé » et rien ne partirait.
        {
          jobId: `qualiopi-emargement-lien-${inscription.id}-${Date.now()}`,
          entityType: "Enrollment",
          entityId: inscription.id,
        },
      );
      // 🔴 2026-08-19 (constat `D5-3-01`, même famille que la convocation) —
      // `envoyes++` était inconditionnel. `enqueueEmail` ne lève pas : elle rend
      // `{ enqueued: false }` si la file est absente, et
      // `{ enqueued: false, garePourValidation: true }` si l'envoi part en
      // corbeille de validation.
      //
      // L'admin lisait donc « 8 liens envoyés » alors que rien n'était parti —
      // et ce compteur est la SEULE chose qui lui dit si ses stagiaires peuvent
      // émarger le jour J. Le mécanisme d'échec nommé existait déjà juste en
      // dessous (`echecs.push`) : il suffisait de s'en servir.
      if (!envoi.enqueued) {
        echecs.push({
          stagiaireNom: nom,
          motif:
            envoi.garePourValidation === true
              ? "E-mail garé en corbeille de validation — le lien ne partira qu'après approbation."
              : "File de messages indisponible — le lien n'est pas parti, réessayez.",
        });
        continue;
      }
      envoyes++;
    } catch (err) {
      if (err instanceof TokenEmargementError) {
        // Le motif le plus fréquent, et le seul actionnable : aucune journée
        // déclarée. Le message du service dit déjà quoi faire.
        echecs.push({ stagiaireNom: nom, motif: err.message });
      } else {
        Sentry.captureException(err, {
          tags: { service: "envoyerLiensPourSession", origine: input.origine },
          extra: { sessionId: input.sessionId, enrollmentId: inscription.id },
        });
        echecs.push({
          stagiaireNom: nom,
          motif: "Envoi impossible — l'incident a été enregistré. Réessayez pour cette personne.",
        });
      }
    }
  }

  if (envoyes === 0) {
    return {
      ok: false,
      motif:
        echecs[0]?.motif ??
        "Aucun lien n'a pu être envoyé. Vérifiez que les journées de la session sont déclarées.",
    };
  }

  return { ok: true, envoyes, echecs };
}

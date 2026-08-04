/**
 * AFEST 1-to-1 — Signature d'une séance recueillie SUR LE POSTE DU FORMATEUR.
 *
 * `signerSeanceAfest` existait depuis la PR 410 sans aucune surface d'appel :
 * aucune Server Action, aucun écran. Autrement dit, personne ne pouvait signer —
 * le reproche exact que ce chantier adressait à l'ancien AFEST, dont les quatre
 * booléens posés au clic mentaient à la place des signataires. Le faux positif a
 * été retiré ; ce module est ce qui le remplace pour de vrai.
 *
 * ## Un seul canal ici : le poste du formateur
 *
 * Le formateur, déjà authentifié, ouvre la séance sur son propre appareil et
 * fait signer le bénéficiaire ou le tuteur devant lui, puis signe lui-même.
 * C'est le mode réaliste de l'AFEST : la séance a lieu dans l'entreprise du
 * bénéficiaire, souvent sur un poste de travail, et le tuteur passe cinq minutes
 * entre deux tâches.
 *
 * ⚠️ Conséquence juridique ASSUMÉE, et écrite à l'écran : dans ce mode,
 * `tokenId` est nul, `recueilliParTrainerId` porte le formateur, et
 * l'identification repose sur LUI — comme avec une feuille papier qu'il fait
 * circuler. Quand les trois rôles signent ainsi, la chaîne prouve l'INTÉGRITÉ,
 * pas l'INDÉPENDANCE. C'est `MENTION_RECUEIL_ATTESTE_PAR_OF`, affichée au
 * signataire et scellée dans son tuple.
 *
 * ## 🔴 Le canal par LIEN n'est PAS implémenté ici, et ce n'est pas un oubli
 *
 * `PorteurSignatureAfest` prévoit un canal `lien` avec `tokenId` et binding
 * `destinataireEmailSha256`. Il exige un registre de jetons AFEST qui n'existe
 * pas dans ce dépôt : l'improviser produirait des liens sans binding réel, donc
 * transférables — soit exactement le trou que le service refuse en dur
 * (`email_binding_invalide`). Une absence assumée vaut mieux qu'un canal qui
 * paraît sûr et ne l'est pas.
 *
 * Node runtime (Prisma + R2 via le service).
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { requireFormateurAction } from "@/server/formateur/guard";
import {
  signerSeanceAfest,
  type RefusSignatureAfest,
} from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

export type RefusSeanceAfestFormateur =
  RefusSignatureAfest | "non_membre" | "requete_invalide" | "stockage";

export type ResultatSignatureSeanceAfest =
  | { ok: true; signatureId: string }
  | { ok: false; raison: RefusSeanceAfestFormateur; message: string };

/**
 * ⚠️ Le formateur est authentifié, mais ses arguments ne le sont pas.
 *
 * `role` et `methode` entrent tous deux dans le tuple HACHÉ : une valeur hors
 * énumération y serait scellée définitivement, sur une table append-only. Le
 * `z.enum` est donc une garde de PREUVE, pas une politesse de formulaire.
 *
 * `imageDataUrl` est plafonné comme partout ailleurs : le plafond réel est celui
 * du stockage (2 Mio décodés), celui-ci évite seulement de transporter
 * plusieurs mégaoctets avant de se les faire refuser.
 */
const entreeSchema = z.object({
  coachingSessionId: z.string().uuid(),
  compteRenduSeanceId: z.string().uuid(),
  role: z.enum(["beneficiaire", "formateur", "tuteur"]),
  methode: z.enum(["trace", "papier_scanne", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
  nomConfirme: z.string().max(200).optional(),
});

/** Empreintes de contexte, hors tuple haché donc effaçables (RGPD art. 17). */
async function contexteRequete(): Promise<{
  ipHash: string | null;
  userAgentSha256: string | null;
}> {
  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = entetes.get("user-agent");
  return {
    ipHash: hashIp(ipBrute),
    userAgentSha256: ua === null ? null : createHash("sha256").update(ua).digest("hex"),
  };
}

/**
 * Le formateur fait signer une séance de SON parcours AFEST, sur son poste.
 *
 * `coachingSessionId` est exigé EN PLUS de `compteRenduSeanceId` : l'écran sait
 * sur quel parcours il croit agir, et une discordance entre les deux est soit un
 * bug de rendu, soit une tentative de signer la séance d'un autre parcours. Le
 * service recoupe de son côté (`porteur.trainerId === coachingSession.trainerId`)
 * et refuserait de toute façon — mais il refuserait `porteur_non_autorise`, un
 * message que personne en salle ne saurait interpréter.
 *
 * ⚠️ Les trois rôles sont acceptés parce que le SERVICE les accepte sur ce
 * canal : c'est le mode « feuille papier qu'on fait circuler », et le plafond
 * probant est dit à l'écran. On ne redonde pas les gardes du service (garde
 * temporelle, identité des signataires, déjà-signé, horaires réels) : elles y
 * sont, symétriques sur les trois rôles, et les dupliquer ici créerait deux
 * copies qui divergeraient en silence.
 */
export async function signerSeanceAfestFormateurAction(input: {
  coachingSessionId: string;
  compteRenduSeanceId: string;
  role: "beneficiaire" | "formateur" | "tuteur";
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
  nomConfirme?: string;
}): Promise<ResultatSignatureSeanceAfest> {
  const formateur = await requireFormateurAction();

  const parse = entreeSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const seance = await prisma.compteRenduSeance.findUnique({
    where: { id: donnees.compteRenduSeanceId },
    select: {
      coachingSessionId: true,
      coachingSession: { select: { trainerId: true } },
    },
  });
  if (seance === null) {
    return { ok: false, raison: "seance_introuvable", message: "Séance introuvable." };
  }

  // 🔴 Deux recoupements, et aucun n'est de trop : la séance doit appartenir au
  // parcours annoncé, et ce parcours doit être animé par le formateur connecté.
  // Sans le premier, un identifiant de séance deviné suffirait à faire signer la
  // séance d'un autre parcours du même formateur — avec les mentions du parcours
  // affiché à l'écran, et l'empreinte scellée sur l'autre.
  if (
    seance.coachingSessionId !== donnees.coachingSessionId ||
    seance.coachingSession.trainerId !== formateur.trainerId
  ) {
    Sentry.captureException(new Error("Signature AFEST tentée hors du parcours du formateur"), {
      tags: { action: "signerSeanceAfestFormateurAction:non_membre" },
      extra: {
        compteRenduSeanceId: donnees.compteRenduSeanceId,
        coachingSessionId: donnees.coachingSessionId,
      },
    });
    return {
      ok: false,
      raison: "non_membre",
      message: "Vous n'animez pas ce parcours, ou cette séance n'en fait pas partie.",
    };
  }

  try {
    const res = await signerSeanceAfest({
      compteRenduSeanceId: donnees.compteRenduSeanceId,
      porteur: {
        type: "poste_formateur",
        trainerId: formateur.trainerId,
        role: donnees.role,
      },
      methode: donnees.methode,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(donnees.nomConfirme === undefined ? {} : { nomConfirme: donnees.nomConfirme }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;
    return { ok: true, signatureId: res.signatureId };
  } catch (err) {
    // 🔴 `storeSignatureImage` LÈVE quand R2 est absent ou l'écriture ratée, et
    // c'est sa raison d'être : une signature dont l'image n'a pas été écrite est
    // une preuve qui n'existe pas. On REFUSE, on ne simule pas — et on dit quoi
    // faire, parce qu'en entreprise le repli papier est toujours disponible.
    //
    // ⚠️ Le repli proposé est la feuille PAPIER versée au dossier, pas la
    // modalité « feuille photographiée » : celle-ci passe par le même stockage
    // et échouerait pareillement. Proposer un repli qui ne marche pas serait
    // pire que de n'en proposer aucun.
    if (err instanceof SignatureStockageError) {
      return {
        ok: false,
        raison: "stockage",
        message: err.imputableAuClient
          ? err.message
          : "La signature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, faites signer une feuille papier et versez-la au dossier du parcours.",
      };
    }
    Sentry.captureException(err, { tags: { action: "signerSeanceAfestFormateurAction" } });
    throw err;
  }
}

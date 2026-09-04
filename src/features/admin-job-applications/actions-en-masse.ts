// Les gestes qui portent sur PLUSIEURS candidatures à la fois.
//
// 🔴 UN MODULE À PART, ET PAS UNE FONCTION DE PLUS DANS `actions.ts`. Ce qui
//    est en jeu ici est différent : une erreur unitaire abîme un dossier, une
//    erreur en masse en abîme cinquante. Les garde-fous propres à ce risque
//    (plafond, refus total plutôt que partiel, trace par dossier) méritent
//    d'être lisibles ensemble plutôt que noyés dans un fichier de six cents
//    lignes.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { getClientIp } from "@/lib/client-ip";
import {
  LIBELLE_MOTIF_REFUS,
  LIBELLE_STATUT,
  MOTIFS_REFUS,
  STATUTS_CANDIDATURE,
  estUneDecision,
  incoherenceDeLaDecision,
} from "@/content/recrutement/statuts";
import { consignerEvenement, resumeChangementStatut } from "./journal";
import { requireAdminWrite } from "./session";
// Le plafond et le type de retour vivent hors de ce fichier : un module
// `"use server"` ne peut exporter que des fonctions asynchrones.
import { PLAFOND_EN_MASSE, type EtatEnMasse } from "./en-masse";
import type { JobApplicationStatus } from "../../../prisma/generated/client";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(PLAFOND_EN_MASSE),
  status: z.enum(STATUTS_CANDIDATURE),
  rejectionReason: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(MOTIFS_REFUS).optional(),
  ),
});

/**
 * Change le statut d'une sélection de candidatures.
 *
 * 🔴 TROIS REFUS DÉLIBÉRÉS.
 *
 * 1. **La cohérence statut ↔ motif est vérifiée UNE FOIS, avant d'écrire quoi
 *    que ce soit.** Elle porte sur le geste, pas sur les dossiers : le même
 *    statut et le même motif s'appliquent à tous. Un contrôle par dossier
 *    laisserait passer les vingt premiers avant de refuser le vingt-et-unième.
 *
 * 2. **TOUT PASSE OU RIEN NE PASSE** — une seule transaction. Un échec au
 *    milieu laisserait une sélection à moitié traitée, dont personne ne saurait
 *    dire où elle s'est arrêtée : ni l'écran, ni le journal, qui n'aurait
 *    consigné que la moitié des lignes.
 *
 * 3. **Un dossier déjà dans l'état visé N'EST PAS réécrit.** Il ne gagne ni
 *    ligne de journal, ni date de décision : consigner « Statut : Écartée →
 *    Écartée » remplirait la frise de bruit, et redater la décision effacerait
 *    la vraie date au profit de celle du clic.
 */
export async function changerStatutEnMasseAction(
  _prev: EtatEnMasse,
  formData: FormData,
): Promise<EtatEnMasse> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = schema.safeParse({
    ids: formData.getAll("ids").map(String),
    status: formData.get("status"),
    rejectionReason: formData.get("rejectionReason"),
  });
  if (!parsed.success) {
    // Le cas le plus fréquent est « aucune case cochée » : le dire, plutôt que
    // « champs invalides », qui envoie relire le formulaire.
    const aucun = formData.getAll("ids").length === 0;
    return {
      ok: false,
      error: aucun
        ? "Aucune candidature sélectionnée."
        : `Sélection invalide (${PLAFOND_EN_MASSE} dossiers au maximum par geste).`,
    };
  }

  const incoherence = incoherenceDeLaDecision(parsed.data.status, parsed.data.rejectionReason);
  if (incoherence) return { ok: false, error: incoherence };

  const cible = parsed.data.status;
  const motif = parsed.data.rejectionReason;
  const maintenant = new Date();

  const avant = await prisma.jobApplication.findMany({
    where: { id: { in: parsed.data.ids } },
    select: { id: true, status: true, hiredAt: true },
  });
  if (avant.length === 0) return { ok: false, error: "Aucune candidature trouvée." };

  const aChanger = avant.filter((a) => a.status !== cible);
  const inchangees = avant.length - aChanger.length;
  if (aChanger.length === 0) {
    return { ok: true, traitees: 0, inchangees };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const dossier of aChanger) {
        await tx.jobApplication.update({
          where: { id: dossier.id },
          data: {
            status: cible,
            // `?? null` et non `?? undefined` : ramener un dossier écarté vers
            // un état en cours doit EFFACER le motif, sinon la contrainte SQL
            // le refuse — et l'écran afficherait un état en cours portant un
            // motif de sortie.
            rejectionReason: motif ?? null,
            ...(estUneDecision(cible)
              ? { decidedAt: maintenant, decidedById: session.userId }
              : { decidedAt: null, decidedById: null }),
            ...(cible === "hired" && dossier.hiredAt === null ? { hiredAt: maintenant } : {}),
          },
        });

        // 🔑 Une ligne de journal PAR DOSSIER, dans la MÊME transaction.
        // Un geste groupé qui ne laisserait qu'une trace globale rendrait
        // chaque dossier incapable de dire pourquoi il a changé — et c'est
        // précisément dans le dossier qu'on cherchera, six mois plus tard.
        await consignerEvenement(
          {
            applicationId: dossier.id,
            type: estUneDecision(cible) ? "decision" : "statut_change",
            authorId: session.userId,
            authorName: session.nom,
            summary: resumeChangementStatut(
              dossier.status,
              cible,
              (st) => LIBELLE_STATUT[st as JobApplicationStatus] ?? st,
            ),
            body: motif
              ? `Motif : ${LIBELLE_MOTIF_REFUS[motif]} · geste groupé sur ${aChanger.length} dossiers`
              : `Geste groupé sur ${aChanger.length} dossiers`,
            meta: { enMasse: aChanger.length, ...(motif ? { motif } : {}) },
          },
          tx,
        );
      }
    });
  } catch {
    return {
      ok: false,
      error:
        "Rien n'a été modifié — le geste a été refusé en bloc. Vérifiez le statut et son motif.",
    };
  }

  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "jobapplication.masse.statut",
      targetType: "job_application",
      targetId: null,
      changes: { statut: cible, motif: motif ?? null, dossiers: aChanger.length },
      ipAddress: await getClientIp(),
    },
  });

  revalidatePath(adminPath("fr", "contacts/candidatures"));
  // Les fiches touchées portent la frise : sans cette revalidation, ouvrir un
  // dossier juste après le geste montrerait l'état précédent.
  for (const d of aChanger) {
    revalidatePath(adminPath("fr", `contacts/candidatures/${d.id}`));
  }

  return { ok: true, traitees: aChanger.length, inchangees };
}

/**
 * Le message d'un formateur reçu APRÈS l'échéance de réponse.
 *
 * ## Pourquoi ce module existe SÉPARÉMENT de `mission-formateur.ts`
 *
 * 🔴 Il y vivait, et il a cassé trois suites de tests d'un coup. La raison
 * n'est pas anodine et elle vaut pour la PRODUCTION, pas seulement pour les
 * tests : lever une alerte demande `alertes-service`, qui importe l'évaluateur,
 * qui tire toute la chaîne admin — jusqu'à `next-auth`. Or
 * `mission-formateur.ts` est importé par le WORKER (`relancerEtExpirerMissions`),
 * qui tourne sous `tsx`, hors de Next.
 *
 * Autrement dit : un import statique de plus dans ce fichier fait entrer
 * `next-auth` dans le graphe du worker. C'est la même famille de défaut que le
 * `server-only` qui a tué deux crons en silence le 2026-09-04 — et le dépôt a
 * déjà extrait `job-ia-echoue.ts` du worker pour exactement ce motif.
 *
 * La règle qui en découle, et que garde
 * `__tests__/le-worker-ne-tire-pas-la-chaine-admin.spec.ts` : **rien de ce que
 * le worker importe ne doit importer `alertes-service`**. Les alertes levées
 * depuis un chemin worker passent par un module à part, comme celui-ci.
 */

import { prisma } from "@/lib/prisma";
import { verifyMagicToken } from "@/lib/magic-token";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { LIBELLE_STATUT_MISSION } from "@/server/qualiopi/trainers/mission-formateur";

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

/**
 * Le formateur nous écrit APRÈS l'échéance, depuis son lien devenu inerte.
 *
 * 🔴 Sans ce chemin, la seule chose qu'un formateur pouvait faire une fois le
 * délai passé était de subir un message d'erreur. Or c'est précisément le
 * moment où il a quelque chose d'utile à dire — « j'étais en intervention, je
 * suis disponible, la session est-elle encore libre ? ». Une réponse tardive
 * vaut mieux qu'un silence, tant que personne d'autre n'a été affecté.
 *
 * Le message atterrit en ALERTE, pas dans une boîte : il doit se présenter à
 * côté de la session concernée, chez la personne qui peut encore décider.
 *
 * ⚠️ N'accepte QUE les propositions échues ou clôturées : une proposition
 * encore ouverte a un bouton « Accepter », et détourner ce canal pour répondre
 * laisserait la réponse hors du registre des accords.
 */
export async function ecrireApresDelai(input: {
  token: string;
  message: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const MESSAGE_MIN = 5;
  const MESSAGE_MAX = 2000;
  const texte = input.message.trim();
  if (texte.length < MESSAGE_MIN) {
    return { ok: false, erreur: "Écrivez au moins quelques mots — nous les lirons." };
  }
  if (isStub()) return { ok: false, erreur: "Service indisponible." };

  const verified = await verifyMagicToken(input.token, { scope: "formateur_mission" });
  if (!verified.ok) return { ok: false, erreur: "Ce lien n'est plus valide." };

  const mission = await prisma.missionFormateur.findUnique({
    where: { id: verified.resourceId },
    select: {
      id: true,
      statut: true,
      trainer: { select: { prenom: true, nom: true, email: true } },
      session: { select: { id: true, numero: true, titreSession: true, dateDebut: true } },
    },
  });
  if (mission === null) return { ok: false, erreur: "Cette proposition n'existe pas." };
  if (mission.statut === "en_attente") {
    return {
      ok: false,
      erreur:
        "Cette proposition attend encore votre réponse : utilisez « Accepter » ou « Refuser ».",
    };
  }

  const date = mission.session.dateDebut.toLocaleDateString("fr-FR");
  await creerOuDedup({
    code: "formateur_message_apres_delai",
    niveau: "important",
    titre: "Message d'un formateur après l'échéance de réponse",
    message:
      `${mission.trainer.prenom} ${mission.trainer.nom} (${mission.trainer.email}) écrit au sujet de ` +
      `« ${mission.session.titreSession} » (${mission.session.numero}, ${date}), dont la proposition ` +
      `est ${LIBELLE_STATUT_MISSION[mission.statut].toLowerCase()} : « ${texte.slice(0, MESSAGE_MAX)} »`,
    cibleType: "TrainingSession",
    cibleId: mission.session.id,
    metadata: { missionId: mission.id, statutMission: mission.statut },
  });
  return { ok: true };
}

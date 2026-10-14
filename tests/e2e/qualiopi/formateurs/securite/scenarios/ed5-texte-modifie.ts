// E-D5 — Un texte modifié APRÈS sa validation ne part plus : ni à l'enfilage,
// ni au départ d'un e-mail déjà en file.
//
// La validation est posée par la console (empreinte du texte relu). « Le texte
// a été modifié » est l'état que laisse une mise en ligne qui change le texte
// du code : l'empreinte enregistrée ne correspond plus. Le banc ne peut pas
// changer le code ; il pose donc l'empreinte d'un texte PRÉCÉDENT sur la ligne
// validée — exactement la ligne qu'une telle mise en ligne laisserait.
//
// Deux textes : un gabarit entier (F20) et une VARIANTE validée à part
// (F30, « lettre non signée »).

import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { envoyer, texteValide } from "@/server/qualiopi/formateurs-independants/envois";
import { cleTexteValide } from "@/server/email/textes-valides";

import {
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
  validerTextesParLaConsole,
  valeursDuBanc,
} from "../donnees";

const EMPREINTE_ANCIENNE = "0".repeat(64);

export default async function ed5(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides"]);
      await validerTextesParLaConsole(direction, [
        { gabarit: "formateur-espace-ouvert" },
        { gabarit: "formateur-mission-retiree" },
        { gabarit: "formateur-mission-retiree", variante: "lettre-non-signee" },
      ]);
      const t = await creerIndependant({ actif: true });

      const textes = {
        entier: {
          gabarit: "formateur-espace-ouvert",
          payload: { prenom: t.prenom, valeurs: await valeursDuBanc("formateur-espace-ouvert") },
          cle: cleTexteValide("formateur-espace-ouvert"),
        },
        variante: {
          gabarit: "formateur-mission-retiree",
          payload: {
            prenom: t.prenom,
            etape: 2,
            valeurs: await valeursDuBanc("formateur-mission-retiree"),
          },
          cle: cleTexteValide("formateur-mission-retiree", "lettre-non-signee"),
        },
      } as const;

      const envoi = (x: (typeof textes)[keyof typeof textes]) =>
        envoyer({
          gabarit: x.gabarit as never,
          destinataire: t.email,
          payload: x.payload,
          entityType: "Trainer",
          entityId: t.id,
        });

      // Témoins, LUS sans rien envoyer (le worker du banc est bridé à 40 e-mails par
      // heure, partagés par tous les specs) : validés, les deux textes peuvent partir.
      const temoins = {
        entier: await texteValide("formateur-espace-ouvert"),
        variante: await texteValide("formateur-mission-retiree", "lettre-non-signee"),
      };
      // Deux e-mails déjà EN FILE (relances programmées) au moment de la modification.
      const enFile = async (x: (typeof textes)[keyof typeof textes]) => {
        const r = await enqueueEmail(x.gabarit as EmailJobName, t.email, "fr", x.payload, {
          entityType: "Trainer",
          entityId: t.id,
          delayMs: 15_000,
        });
        const ligne = await prisma.emailLog.findFirst({
          where: { recipient: t.email, template: x.gabarit, status: "pending" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        return { r, id: ligne?.id ?? null };
      };
      const fileEntier = await enFile(textes.entier);
      const fileVariante = await enFile(textes.variante);

      // « Le texte a changé » : l'empreinte validée n'est plus celle du code.
      for (const x of Object.values(textes)) {
        await prisma.setting.update({
          where: { key: x.cle },
          data: { value: { valide: true, empreinte: EMPREINTE_ANCIENNE } },
        });
      }

      const apresModification = {
        entier: await envoi(textes.entier),
        variante: await envoi(textes.variante),
      };
      const issue = (id: string | null) =>
        attendre(
          () =>
            prisma.emailLog.findUnique({
              where: { id: id ?? "" },
              select: { status: true, error: true },
            }),
          (l) => l !== null && l.status !== "pending",
          60_000,
        );
      const auDepart = {
        entier: await issue(fileEntier.id),
        variante: await issue(fileVariante.id),
      };
      await attendre(
        () => prisma.emailLog.count({ where: { recipient: t.email, status: "pending" } }),
        (n) => n === 0,
      );
      await prisma.emailLog.deleteMany({ where: { recipient: t.email } });
      return { adresse: t.email, temoins, fileEntier, fileVariante, apresModification, auDepart };
    });
  } finally {
    await menage();
  }
}

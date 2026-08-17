/**
 * Qualiopi — Server Actions : journées réellement animées d'une session (D14).
 *
 * `dateDebut..dateFin` ne décrit pas les jours d'une session : ils peuvent se
 * suivre ou non. Cette table est la seule façon de le SAVOIR au lieu de le
 * supposer. Sans écran de saisie elle resterait vide, et rien ne changerait —
 * d'où ces actions.
 *
 * ⚠️ Ces actions ne touchent JAMAIS `PresenceCreneau`.
 *
 * Retirer une journée déclarée ne supprime donc pas les créneaux déjà générés
 * pour ce jour, ni les signatures qui y sont attachées. C'est délibéré : en
 * base, une absence émargée et un créneau vierge sont indiscernables, et
 * supprimer « ce qui ne correspond plus » détruirait des feuilles d'émargement
 * signées. L'incohérence résiduelle est visible à l'écran et corrigeable à la
 * main ; une preuve effacée ne l'est pas.
 *
 * Pattern EXACT de `src/server/actions/qualiopi/presence.ts` :
 *   requireAdminWrite() + Zod safeParse + ActionResult<T> + logQualiopiActivity.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  messageRefus,
  verdictRequalification,
} from "@/server/qualiopi/presence/requalification-jours";

type ActionResult<T> = { data: T } | { error: string };

/** Plafond de journées déclarables. Au-delà, c'est une erreur de saisie, pas un parcours. */
const MAX_JOURS = 200;

const jourSchema = z
  .object({
    /** Jour civil ISO. Le fuseau est celui de Paris, comme `PresenceCreneau.date`. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
    // `[0-2]\d` accepterait « 25:30 » et « 29:00 ». Un `<input type="time">` ne
    // les produit pas, mais une Server Action est appelable directement — et ces
    // chaînes finissent sur une pièce à valeur probante.
    heureDebut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM"),
    heureFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM"),
  })
  // Miroir exact du CHECK `ck_session_jour_horaires`. Le doublon est voulu :
  // la base garantit l'invariant, Zod produit le message lisible.
  .refine((j) => j.heureFin > j.heureDebut, {
    message: "L'heure de fin doit être postérieure à l'heure de début",
    path: ["heureFin"],
  });

const saveSessionJoursSchema = z.object({
  sessionId: z.string().uuid(),
  jours: z.array(jourSchema).max(MAX_JOURS),
  /**
   * 🔴 Motif de REQUALIFICATION — exigé seulement quand des pièces s'appuient
   * déjà sur les journées (feuille d'émargement émise, émargements signés,
   * créneaux générés).
   *
   * Sur une session vierge il reste absent : corriger une coquille de date ne
   * doit pas devenir une cérémonie — c'est le défaut D4 du plan, celui qui
   * oblige aujourd'hui à créer une session pour une faute de frappe.
   */
  motifRequalification: z.string().trim().min(10).max(500).optional(),
});

/**
 * Remplace l'intégralité des journées déclarées d'une session.
 *
 * Sémantique « remplacer », et non « fusionner » : l'écran présente la liste
 * complète, donc ce qui n'y figure plus a été retiré volontairement. Une
 * fusion obligerait à inventer une action « supprimer » séparée, et laisserait
 * des journées fantômes en cas d'erreur de saisie.
 *
 * Transaction : sans elle, une session pourrait rester sans aucune journée
 * déclarée entre le `deleteMany` et le `createMany` — état dans lequel la
 * génération des créneaux retomberait silencieusement sur le repli.
 */
export async function saveSessionJoursAction(input: {
  sessionId: string;
  jours: Array<{ date: string; heureDebut: string; heureFin: string }>;
  /**
   * Motif de REQUALIFICATION — exigé seulement quand des pièces s'appuient déjà
   * sur les journées. Voir la garde plus bas et
   * `presence/requalification-jours.ts`.
   */
  motifRequalification?: string;
}): Promise<ActionResult<{ nbJours: number }>> {
  const session = await requireAdminWrite();
  const parsed = saveSessionJoursSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  // Doublons : `session_jour_unique` les rejetterait avec une erreur Prisma
  // brute, illisible pour l'admin qui a saisi deux fois le même jour.
  const dates = v.jours.map((j) => j.date);
  const uniques = new Set(dates);
  if (uniques.size !== dates.length) {
    const doublon = dates.find((d, i) => dates.indexOf(d) !== i);
    return { error: `La journée du ${doublon} est déclarée deux fois.` };
  }

  const exists = await prisma.trainingSession.findUnique({
    where: { id: v.sessionId },
    select: { id: true },
  });
  if (!exists) return { error: "Session introuvable" };

  // 🔴 GARDE DE REQUALIFICATION (2026-08-17).
  //
  // Cette action faisait `deleteMany` + `createMany` SANS regarder ce qui
  // s'appuie déjà sur ces journées. Or elles ne sont pas une donnée de
  // confort : la FEUILLE D'ÉMARGEMENT les imprime, et elle est opposable.
  // Réécrire après émission faisait diverger la pièce et le dossier, en
  // silence — l'auditeur qui rapproche les deux trouvait deux vérités.
  //
  // On n'INTERDIT pas : corriger une coquille doit rester possible (défaut D4).
  // On refuse le changement SILENCIEUX. La règle est pure et testée dans
  // `presence/requalification-jours.ts`.
  const [avant, feuillesEmargement, emargementsSignes, creneaux] = await Promise.all([
    prisma.sessionJour.findMany({
      where: { sessionId: v.sessionId },
      select: { date: true, heureDebut: true, heureFin: true },
      orderBy: { date: "asc" },
    }),
    prisma.documentGenere.count({
      where: { sessionId: v.sessionId, type: "emargement", annuleeAt: null },
    }),
    prisma.enrollment.count({
      where: { sessionId: v.sessionId, emargementSigneAt: { not: null } },
    }),
    prisma.presenceCreneau.count({ where: { enrollment: { sessionId: v.sessionId } } }),
  ]);

  const verdict = verdictRequalification({
    // `@db.Date` stocke minuit UTC : on retombe sur l'ISO du jour civil, la
    // même convention que celle du formulaire.
    avant: avant.map((j) => ({
      date: j.date.toISOString().slice(0, 10),
      heureDebut: j.heureDebut,
      heureFin: j.heureFin,
    })),
    apres: v.jours,
    preuves: { feuillesEmargement, emargementsSignes, creneaux },
  });

  if (verdict.motifRequis && (v.motifRequalification ?? "") === "") {
    return { error: messageRefus(verdict.enJeu) };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionJour.deleteMany({ where: { sessionId: v.sessionId } });
    if (v.jours.length > 0) {
      await tx.sessionJour.createMany({
        data: v.jours.map((j) => ({
          sessionId: v.sessionId,
          // `@db.Date` : minuit UTC, même convention que `PresenceCreneau.date`.
          date: new Date(`${j.date}T00:00:00.000Z`),
          heureDebut: j.heureDebut,
          heureFin: j.heureFin,
          // Passer par cet écran EST la confirmation : l'admin a vu les horaires
          // et les a validés ou corrigés. C'est ce qui distingue une proposition
          // générée à la création d'un horaire assumé.
          horairesConfirmes: true,
        })),
      });
    }
  });

  await logQualiopiActivity({
    action: "qualiopi.session.jours.save",
    targetType: "TrainingSession",
    targetId: v.sessionId,
    changes: {
      nbJours: v.jours.length,
      dates,
      // Le motif et l'enjeu vont au JOURNAL, pas seulement à l'écran : c'est
      // là que l'auditeur ira chercher pourquoi la pièce et le dossier ont
      // divergé, et il doit y trouver une phrase écrite par un humain.
      ...(verdict.motifRequis
        ? {
            requalification: {
              motif: v.motifRequalification,
              enJeu: verdict.enJeu,
            },
          }
        : {}),
    },
    session,
  });

  return { data: { nbJours: v.jours.length } };
}

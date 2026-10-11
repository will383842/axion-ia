// Fin de collaboration d'un formateur indépendant — Server Actions (lot L14, ADR 0066 E25).
//
// Rôles : ceux qui habilitent un formateur (`habiliter_formateur`). Livré ÉTEINT :
// interrupteur `formateurs.fin_collaboration` absent = refus, rien d'écrit, rien d'envoyé.
// Tout e-mail est montré en APERÇU avant l'envoi et ne part que si son texte est validé
// (adaptateur `envois.ts`). Aucune donnée personnelle dans Sentry : seul le nom de l'action.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { apercu, envoyer, texteValide } from "@/server/qualiopi/formateurs-independants/envois";
import {
  MESSAGES_REFUS_FIN,
  MOTIFS_FIN,
  avecPreavis,
  conservationApresFin,
  dateEffetParDefaut,
  jourParis,
  preavisJours,
  refusFin,
  texteFinCollaboration,
  valeursAvertissement,
} from "@/server/qualiopi/formateurs-independants/fin-collaboration";
import {
  deciderFinCollaboration,
  desactiverApresFin,
  estIndependant,
  lireContexteFin,
  missionsApres,
  type ContexteFin,
} from "@/server/qualiopi/formateurs-independants/fin-collaboration-service";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

type Refus = { readonly error: string };

async function autorise(): Promise<{ userId: string; role: string } | Refus> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "habiliter_formateur")) {
    return { error: "Vous n'avez pas le droit de mettre fin à une collaboration." };
  }
  if (!(await interrupteurAllume("fin_collaboration"))) {
    return { error: "La fin de collaboration n'est pas encore ouverte (interrupteur coupé)." };
  }
  return { userId: session.user.id, role: role ?? "" };
}

const DATE_ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const versDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const jourIso = (d: Date) => d.toISOString().slice(0, 10);
const DATE_VALIDE = DATE_ISO.refine((x) => jourIso(versDate(x)) === x, "date invalide");

const schemaFin = z.object({
  trainerId: z.string().uuid(),
  motif: z.enum(MOTIFS_FIN),
  dateEffet: DATE_VALIDE.optional(),
  note: z.string().max(2000).default(""),
  irreparable: z.boolean().default(false),
});

const fiche = (trainerId: string) => adminPath("fr", `qualiopi/formateurs/${trainerId}`);

export interface ApercuFin {
  readonly preavis: 30 | 60 | 90;
  readonly avecPreavis: boolean;
  readonly dateEffetDefaut: string;
  readonly refus: string[];
  readonly missionsApresEffet: number;
  readonly conservation: { contratEtVigilance: string; piecesComptables: string };
  /** `null` : aucun e-mail (décès). */
  readonly email: { sujet: string; html: string; destinataire: string } | null;
  /** Le texte F47 est-il validé ? Sinon l'e-mail ne partira pas (il pourra être renvoyé). */
  readonly texteValide: boolean;
}

/** Ce qui se passerait, sans rien écrire ni envoyer. */
export async function apercuFinCollaborationAction(
  input: z.input<typeof schemaFin>,
): Promise<{ data: ApercuFin } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  const p = schemaFin.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const ctx = await lireContexteFin(p.data.trainerId);
    if (ctx === null) return { error: "Formateur introuvable." };
    if (!estIndependant(ctx.trainer)) {
      return { error: "Réservé aux formateurs indépendants en nom propre." };
    }
    if (ctx.trainer.finCollaborationDecideeAt !== null || ctx.trainer.finCollaborationAt !== null) {
      return { error: "La fin de cette collaboration est déjà décidée." };
    }
    const maintenant = new Date();
    const defaut = dateEffetParDefaut(p.data.motif, ctx.debutRelation, maintenant);
    const dateEffet = p.data.dateEffet ? versDate(p.data.dateEffet) : defaut;
    const preavis = preavisJours(ctx.debutRelation, maintenant);
    const missions = await missionsApres(p.data.trainerId, dateEffet);
    const refus = refusFin({
      motif: p.data.motif,
      dateEffet,
      decision: maintenant,
      debutRelation: ctx.debutRelation,
      avertissementEnvoyeAt: ctx.avertissementEnvoyeAt,
      irreparable: p.data.irreparable,
      note: p.data.note,
      missionsApresEffet: missions,
    }).map((r) => MESSAGES_REFUS_FIN[r]);
    const texte = texteFinCollaboration(p.data.motif, dateEffet, preavis);
    const email =
      texte === null
        ? null
        : await apercu({
            gabarit: "formateur-fin-collaboration",
            destinataire: ctx.trainer.email,
            payload: { prenom: ctx.trainer.prenom, texteLibre: texte },
          });
    const c = conservationApresFin(dateEffet);
    return {
      data: {
        preavis,
        avecPreavis: avecPreavis(p.data.motif),
        dateEffetDefaut: jourIso(defaut),
        refus,
        missionsApresEffet: missions.length,
        conservation: {
          contratEtVigilance: jourIso(c.contratEtVigilance),
          piecesComptables: jourIso(c.piecesComptables),
        },
        email: email && { sujet: email.sujet, html: email.html, destinataire: email.destinataire },
        texteValide: await texteValide("formateur-fin-collaboration"),
      },
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apercuFinCollaboration" } });
    return { error: "Aperçu impossible pour le moment." };
  }
}

const schemaTerminer = schemaFin.extend({
  dateEffet: DATE_VALIDE,
  /** Envoyer F47 après la fin (jamais pour un décès). */
  envoyerEmail: z.boolean().default(true),
});

/** F47 tel qu'il part, pour une fin décidée. `null` : aucun e-mail (décès). */
function envoiF47(ctx: ContexteFin): Parameters<typeof envoyer>[0] | null {
  const t = ctx.trainer;
  if (t.finCollaborationMotifPrevu === null || t.finCollaborationEffetAt === null) return null;
  const preavis = preavisJours(ctx.debutRelation, t.finCollaborationDecideeAt ?? new Date());
  const texte = texteFinCollaboration(
    t.finCollaborationMotifPrevu,
    t.finCollaborationEffetAt,
    preavis,
  );
  if (texte === null) return null;
  return {
    gabarit: "formateur-fin-collaboration",
    destinataire: t.email,
    payload: { prenom: t.prenom, texteLibre: texte },
    entityType: "Trainer",
    entityId: t.id,
    // Une seule fin par fiche : un renvoi après échec reprend la même clé.
    jobId: `fi-fin-collaboration-${t.id}`,
  };
}

export async function terminerCollaborationFormateurAction(
  input: z.input<typeof schemaTerminer>,
): Promise<{ data: { email: string; close: boolean; desactivee: boolean } } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  const p = schemaTerminer.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  const maintenant = new Date();
  const dateEffet = versDate(p.data.dateEffet);
  try {
    const auteur = await prisma.adminUser.findUnique({
      where: { id: a.userId },
      select: { name: true },
    });
    const annuleePar = auteur?.name?.trim() || a.role || "Administrateur";
    const r = await deciderFinCollaboration(
      {
        trainerId: p.data.trainerId,
        motif: p.data.motif,
        dateEffet,
        note: p.data.note,
        irreparable: p.data.irreparable,
        userId: a.userId,
        role: a.role,
        annuleePar,
      },
      maintenant,
    );
    if (!r.ok) {
      if (r.raison === "refus") {
        return { error: r.refus.map((x) => MESSAGES_REFUS_FIN[x]).join(" ") };
      }
      return {
        error:
          r.raison === "introuvable"
            ? "Formateur introuvable."
            : r.raison === "pas-independant"
              ? "Réservé aux formateurs indépendants en nom propre."
              : "La fin de cette collaboration est déjà décidée.",
      };
    }
    revalidatePath(fiche(p.data.trainerId));
    const etat = { close: r.close, desactivee: r.desactivee };

    const texte = texteFinCollaboration(p.data.motif, dateEffet, r.preavis);
    if (texte === null || !p.data.envoyerEmail) return { data: { email: "aucun", ...etat } };
    const envoi = await envoyer({
      gabarit: "formateur-fin-collaboration",
      destinataire: r.contexte.trainer.email,
      payload: { prenom: r.contexte.trainer.prenom, texteLibre: texte },
      entityType: "Trainer",
      entityId: p.data.trainerId,
      jobId: `fi-fin-collaboration-${p.data.trainerId}`,
    });
    return { data: { email: envoi, ...etat } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "terminerCollaborationFormateur" } });
    return { error: "La fin de collaboration n'a pas pu être enregistrée." };
  }
}

const schemaAvertissement = z.object({
  trainerId: z.string().uuid(),
  fait: z.string().trim().min(10).max(2000),
});

async function preparerAvertissement(input: z.input<typeof schemaAvertissement>) {
  const p = schemaAvertissement.safeParse(input);
  if (!p.success) return { error: "Décrivez le fait constaté (10 caractères au moins)." } as Refus;
  const ctx = await lireContexteFin(p.data.trainerId);
  if (ctx === null) return { error: "Formateur introuvable." } as Refus;
  if (
    !estIndependant(ctx.trainer) ||
    ctx.trainer.finCollaborationAt !== null ||
    ctx.trainer.finCollaborationDecideeAt !== null
  ) {
    return { error: "Réservé à un formateur indépendant en cours de collaboration." } as Refus;
  }
  return {
    trainerId: p.data.trainerId,
    destinataire: ctx.trainer.email,
    payload: {
      prenom: ctx.trainer.prenom,
      valeurs: valeursAvertissement(p.data.fait, new Date()),
    },
  };
}

/** F49 en aperçu, sans rien envoyer. */
export async function apercuAvertissementAction(
  input: z.input<typeof schemaAvertissement>,
): Promise<{ data: { sujet: string; html: string; destinataire: string } } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  try {
    const e = await preparerAvertissement(input);
    if ("error" in e) return e;
    const r = await apercu({
      gabarit: "formateur-avertissement",
      destinataire: e.destinataire,
      payload: e.payload,
    });
    return { data: { sujet: r.sujet, html: r.html, destinataire: r.destinataire } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apercuAvertissement" } });
    return { error: "Aperçu impossible pour le moment." };
  }
}

/** F49 : l'avertissement avant une fin pour manquement (décision de Will, après aperçu). */
export async function envoyerAvertissementFormateurAction(
  input: z.input<typeof schemaAvertissement>,
): Promise<{ data: { email: string } } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  try {
    const e = await preparerAvertissement(input);
    if ("error" in e) return e;
    const envoi = await envoyer({
      gabarit: "formateur-avertissement",
      destinataire: e.destinataire,
      payload: e.payload,
      entityType: "Trainer",
      entityId: e.trainerId,
      // Un avertissement par jour au plus (double clic, rechargement).
      jobId: `fi-avertissement-${e.trainerId}-${jourParis(new Date()).replace(/-/g, "")}`,
    });
    revalidatePath(fiche(e.trainerId));
    return { data: { email: envoi } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerAvertissementFormateur" } });
    return { error: "L'avertissement n'a pas pu être envoyé." };
  }
}

const schemaFiche = z.object({ trainerId: z.string().uuid() });

/** Renvoie F47 (fin décidée, e-mail non parti : texte non validé, file coupée…). */
export async function renvoyerFinCollaborationAction(
  input: z.input<typeof schemaFiche>,
): Promise<{ data: { email: string } } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  const p = schemaFiche.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const ctx = await lireContexteFin(p.data.trainerId);
    if (
      ctx === null ||
      !estIndependant(ctx.trainer) ||
      ctx.trainer.finCollaborationDecideeAt === null
    ) {
      return { error: "Aucune fin de collaboration décidée pour ce formateur." };
    }
    const e = envoiF47(ctx);
    if (e === null) return { data: { email: "aucun" } };
    // Déjà remis : jamais un second F47 (le job terminé peut avoir quitté la file).
    const dejaParti = await prisma.emailLog.findFirst({
      where: { jobId: e.jobId ?? "", status: { in: ["sent", "pending"] } },
      select: { id: true },
    });
    if (dejaParti !== null) return { error: "L'e-mail de fin est déjà parti." };
    return { data: { email: await envoyer(e) } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "renvoyerFinCollaboration" } });
    return { error: "L'e-mail n'a pas pu être renvoyé." };
  }
}

/** Désactive une fiche CLOSE restée active (clôture par le passage quotidien, ou échec). */
export async function desactiverApresFinAction(
  input: z.input<typeof schemaFiche>,
): Promise<{ data: { desactivee: boolean } } | Refus> {
  const a = await autorise();
  if ("error" in a) return a;
  const p = schemaFiche.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const ctx = await lireContexteFin(p.data.trainerId);
    if (ctx === null || !estIndependant(ctx.trainer) || ctx.trainer.finCollaborationAt === null) {
      return { error: "La collaboration de ce formateur n'est pas close." };
    }
    const desactivee = await desactiverApresFin(p.data.trainerId, {
      userId: a.userId,
      role: a.role,
    });
    revalidatePath(fiche(p.data.trainerId));
    return { data: { desactivee } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "desactiverApresFin" } });
    return { error: "La désactivation n'a pas pu aboutir." };
  }
}

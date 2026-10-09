/**
 * Réseau d'apporteurs — FIN DE VIE du contrat : « Résilier » et « Enregistrer une reprise ».
 *
 * Contrat v2, article 12 :
 *   · 12.1 les attributions provisoires (réservées, en attente) sont annulées, les attributions
 *     définitives non converties prennent fin ;
 *   · 12.2 les commissions déjà acquises sont facturées et payées comme les autres (plus de
 *     seuil ni de « dernier relevé » : chaque commission due est facturée dès qu'elle l'est) ;
 *   · 12.3 les commandes signées AVANT la fin continuent d'ouvrir droit à commission : le
 *     passage quotidien lit les présentations protégées, y compris terminées, et
 *     `commandeCouverte` compare la date de commande au terme de la protection. On ramène donc
 *     ce terme à la date de résiliation (jamais plus tard) : rien d'antérieur n'est perdu.
 *
 * ⛔ Une commission déjà créée (à qualifier, en attente de vigilance, due) est ACQUISE : elle
 * n'est jamais annulée ni supprimée ici. Le brief parlait de « provisoires » ; le contrat (12.2
 * et 12.3) ne connaît de provisoire que l'attribution, pas la commission.
 *
 * Reprise (art. 4.5 et 12.4) : une ligne `reprise` de montant NÉGATIF, déduite de la prochaine autofacture du même apporteur.
 * Elle est enregistrée à la main (montant + motif) : savoir si la restitution donne lieu à reprise
 * (client qui réclame, ou restitution décidée par la Société) est un jugement, pas un calcul.
 *
 * ⚠️ Module sans `server-only` : testable directement, appelé seulement par la console.
 */

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

import { jourParis } from "./autofacture-donnees";
import { euros, ajouterMois } from "./regles";

// ── Résiliation ──────────────────────────────────────────────────────────

export interface PresentationARegler {
  id: string;
  statut: string;
  protegeeJusquAt: Date | null;
}

/** Ce qu'il faut écrire sur chaque présentation en cours. Pur. */
export function planResiliation(
  presentations: readonly PresentationARegler[],
  maintenant: Date,
): Array<{ id: string; protegeeJusquAt: Date | null }> {
  return presentations
    .filter((p) => p.statut === "reservee" || p.statut === "confirmee")
    .map((p) => ({
      id: p.id,
      // Le terme ne recule que s'il était plus tard : une commande antérieure reste couverte.
      protegeeJusquAt:
        p.protegeeJusquAt && p.protegeeJusquAt.getTime() > maintenant.getTime()
          ? maintenant
          : p.protegeeJusquAt,
    }));
}

const STATUTS_RESILIABLES = ["signe"] as const;

export async function resilierApporteur(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, statut: true },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (!(STATUTS_RESILIABLES as readonly string[]).includes(a.statut))
    return { ok: false, message: "Seul un contrat signé peut être résilié." };

  const termine = await prisma.$transaction(
    async (tx) => {
      // Écriture conditionnelle : deux clics ne résilient pas deux fois.
      const r = await tx.apporteurReseau.updateMany({
        where: { id: apporteurId, statut: "signe" },
        data: { statut: "resilie", resilieAt: maintenant, versionLien: { increment: 1 } },
      });
      if (r.count !== 1) return null;
      const presentations = await tx.presentationEntreprise.findMany({
        where: { apporteurId, statut: { in: ["reservee", "confirmee"] } },
        select: { id: true, statut: true, protegeeJusquAt: true },
      });
      const plan = planResiliation(presentations, maintenant);
      for (const p of plan) {
        await tx.presentationEntreprise.update({
          where: { id: p.id },
          data: { statut: "terminee", protegeeJusquAt: p.protegeeJusquAt },
        });
      }
      return plan.length;
    },
    { timeout: 15_000 },
  );
  if (termine === null) return { ok: false, message: "Ce contrat vient déjà d'être résilié." };
  return {
    ok: true,
    message: `Contrat résilié : ${termine} attribution(s) terminée(s), liens révoqués, rappels coupés. Les commissions acquises restent à verser : elles sont facturées comme les autres.`,
  };
}

// ── Reprise ──────────────────────────────────────────────────────────────

/** Art. 4.5 (contrat 2.3) : la reprise ne peut intervenir que dans les vingt-quatre mois suivant l'annulation. */
export const DELAI_REPRISE_MOIS = 24;

export function verifierReprise(e: {
  statutOrigine: string;
  montantOrigineCents: number | null;
  reprisesDejaCents: number;
  demandeeCents: number;
  motif: string;
  annulationLe: Date;
  maintenant: Date;
}): { ok: true } | { ok: false; message: string } {
  if (e.statutOrigine !== "versee")
    return { ok: false, message: "Une reprise ne porte que sur une commission déjà versée." };
  if (!Number.isInteger(e.demandeeCents) || e.demandeeCents <= 0)
    return { ok: false, message: "Indiquez un montant positif." };
  if (!e.motif.trim()) return { ok: false, message: "Indiquez le motif de la reprise." };
  const restant = (e.montantOrigineCents ?? 0) - e.reprisesDejaCents;
  if (e.demandeeCents > restant)
    return {
      ok: false,
      message: `La reprise ne peut dépasser ${euros(Math.max(0, restant))} (commission versée, moins les reprises déjà faites).`,
    };
  if (e.maintenant.getTime() > ajouterMois(e.annulationLe, DELAI_REPRISE_MOIS).getTime())
    return {
      ok: false,
      message: "Plus de vingt-quatre mois depuis l'annulation : reprise impossible (art. 4.5).",
    };
  // Des JOURS de Paris : la date du jour, saisie dans la console, est toujours admise.
  if (jourParis(e.annulationLe) > jourParis(e.maintenant))
    return { ok: false, message: "La date d'annulation ne peut pas être dans le futur." };
  return { ok: true };
}

/** « 150,50 » ou « 150.5 » → 15050 centimes ; `null` si ce n'est pas un montant. */
export function montantEnCentimes(brut: string): number | null {
  const s = brut.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Préfixe du champ `palier` d'une ligne de reprise : il porte l'id de la commission d'origine. */
export const PREFIXE_PALIER_REPRISE = "reprise-de:";

export async function enregistrerReprise(e: {
  commissionId: string;
  /** L'apporteur dont on ouvre la fiche : la commission doit être la sienne. */
  apporteurId?: string;
  demandeeCents: number;
  motif: string;
  /** Date de l'annulation (remboursement, avoir) ; par défaut aujourd'hui. */
  annulationLe?: Date;
  maintenant?: Date;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const maintenant = e.maintenant ?? new Date();
  const origine = await prisma.commissionApporteur.findUnique({
    where: { id: e.commissionId },
    select: {
      id: true,
      apporteurId: true,
      presentationId: true,
      statut: true,
      parrainage: true,
      montantCents: true,
      autofactureNumero: true,
    },
  });
  if (!origine || (e.apporteurId && origine.apporteurId !== e.apporteurId))
    return { ok: false, message: "Commission introuvable." };
  const deja = await prisma.commissionApporteur.findMany({
    where: { apporteurId: origine.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${origine.id}` },
    select: { montantCents: true },
  });
  const reprisesDejaCents = deja.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  const verdict = verifierReprise({
    statutOrigine: origine.statut,
    montantOrigineCents: origine.montantCents,
    reprisesDejaCents,
    demandeeCents: e.demandeeCents,
    motif: e.motif,
    annulationLe: e.annulationLe ?? maintenant,
    maintenant,
  });
  if (!verdict.ok) return verdict;
  const motif = e.motif.trim().slice(0, 500);
  const refusTardif = await prisma.$transaction(
    async (tx) => {
      // Relecture de a1 (09/10) : deux passages concurrents (ou un clic et un passage) ne reprennent
      // pas deux fois. Verrou par commission d'origine, puis RELECTURE des reprises sous le verrou.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reprise:${origine.id}`}))`;
      const sousVerrou = await tx.commissionApporteur.findMany({
        where: {
          apporteurId: origine.apporteurId,
          palier: `${PREFIXE_PALIER_REPRISE}${origine.id}`,
        },
        select: { montantCents: true },
      });
      const dejaSousVerrou = sousVerrou.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
      if (dejaSousVerrou !== reprisesDejaCents) {
        const v = verifierReprise({
          statutOrigine: origine.statut,
          montantOrigineCents: origine.montantCents,
          reprisesDejaCents: dejaSousVerrou,
          demandeeCents: e.demandeeCents,
          motif: e.motif,
          annulationLe: e.annulationLe ?? maintenant,
          maintenant,
        });
        if (!v.ok) return v;
      }
      // `factureId` n'a pas de clé étrangère : la ligne de reprise porte son propre identifiant, la
      // ligne d'origine est conservée telle quelle (art. 4.5) et la contrainte d'unicité est tenue.
      await tx.commissionApporteur.create({
        data: {
          apporteurId: origine.apporteurId,
          presentationId: origine.presentationId,
          factureId: randomUUID(),
          parrainage: origine.parrainage,
          activite: "reprise",
          palier: `${PREFIXE_PALIER_REPRISE}${origine.id}`,
          factureHtCents: 0,
          montantCents: -e.demandeeCents,
          statut: "reprise",
        },
        select: { id: true },
      });
      const a = await tx.apporteurReseau.findUnique({
        where: { id: origine.apporteurId },
        select: { noteInterne: true },
      });
      const ligne = `[${maintenant.toISOString().slice(0, 10)}] Reprise de ${euros(e.demandeeCents)} sur une commission versée${origine.autofactureNumero ? ` (${origine.autofactureNumero})` : ""} : ${motif}`;
      await tx.apporteurReseau.update({
        where: { id: origine.apporteurId },
        data: { noteInterne: [a?.noteInterne, ligne].filter(Boolean).join("\n").slice(0, 5000) },
      });
      return null;
    },
    { timeout: 15_000 },
  );
  if (refusTardif) return refusTardif;
  return {
    ok: true,
    message: `Reprise de ${euros(e.demandeeCents)} enregistrée : elle sera déduite de la prochaine autofacture de cet apporteur.`,
  };
}

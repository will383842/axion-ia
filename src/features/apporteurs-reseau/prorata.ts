/**
 * Réseau d'apporteurs — COMMANDE PARTAGÉE (contrat 2.7, art. 3.6, décision de Will du 09/10).
 *
 * Quand une commande rattachée à l'établissement attribué profite aussi à d'autres établissements,
 * la commission est celle de la commande entière × participants de l'établissement attribué ÷
 * participants de la commande, arrondie au centime SUPÉRIEUR (en faveur de l'apporteur). Exemple :
 * 4 participants de Grenoble sur 10 → 4/10 de la commission.
 *
 * Les données ne disent pas à quel établissement appartient chaque participant (`Trainee.entreprise`
 * est un texte libre ; seul l'inter-entreprises relie une inscription à un client) : Williams saisit
 * les deux nombres d'après la liste d'inscription, dans la console des commissions, tant que la ligne
 * n'est pas facturée. Rien de saisi = commande entière (comportement d'avant). La part du parrain
 * suit (10 % du nouveau montant, art. 4.6).
 *
 * ⚠️ Module sans `server-only` : testable directement, lu par le worker (autofacture).
 */

import { prisma } from "@/lib/prisma";

import { PARRAINAGE_BPS, euros } from "./regles";
import { signalerErreurReseau } from "./signaler";

export interface Prorata {
  participantsEtablissement: number;
  participantsCommande: number;
}

/** Les deux nombres sont-ils cohérents (entiers, 1 ≤ établissement ≤ commande) ? */
export function validerProrata(p: Prorata): string | null {
  const { participantsEtablissement: e, participantsCommande: t } = p;
  if (!Number.isInteger(e) || !Number.isInteger(t) || e < 1 || t < 1)
    return "Indiquez deux nombres entiers de participants (au moins 1).";
  if (e > t)
    return "Les participants de l'établissement attribué ne peuvent dépasser ceux de la commande.";
  if (t > 10_000) return "Nombre de participants invraisemblable.";
  return null;
}

/** Commission × établissement ÷ commande, au centime SUPÉRIEUR (entiers, sans flottant). */
export function appliquerProrata(commandeEntiereCents: number, p: Prorata | null): number {
  if (!p || validerProrata(p) || p.participantsEtablissement === p.participantsCommande)
    return commandeEntiereCents;
  const n = commandeEntiereCents * p.participantsEtablissement;
  return Math.floor((n + p.participantsCommande - 1) / p.participantsCommande);
}

/** « 4/10 des participants » ; `null` pour une commande entière. */
export function libelleProrata(p: Prorata | null | undefined): string | null {
  if (!p || p.participantsEtablissement === p.participantsCommande) return null;
  return `${p.participantsEtablissement}/${p.participantsCommande} des participants`;
}

/** La table n'existe pas encore (migration pas jouée) : Prisma P2021. */
function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Les proratas de ces commissions (vide si aucun, ou si la table n'existe pas encore). */
export async function lireProratas(ids: readonly string[]): Promise<Map<string, Prorata>> {
  if (ids.length === 0) return new Map();
  try {
    const ls = await prisma.commissionProrata.findMany({
      where: { commissionId: { in: [...new Set(ids)] } },
      select: { commissionId: true, participantsEtablissement: true, participantsCommande: true },
    });
    return new Map(
      ls.map((l) => [
        l.commissionId,
        {
          participantsEtablissement: l.participantsEtablissement,
          participantsCommande: l.participantsCommande,
        },
      ]),
    );
  } catch (err) {
    // Lecture d'AFFICHAGE (console, pièce, espace de l'apporteur) : le montant, lui, est déjà
    // enregistré sur la commission. Une erreur ne bloque donc jamais une autofacture : elle est
    // signalée, et la ligne se lit comme une commande entière.
    if (!tableAbsente(err)) signalerErreurReseau("lecture des proratas (art. 3.6)", err);
    return new Map();
  }
}

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

/**
 * Fixe (ou corrige) le prorata d'une commission PAS ENCORE FACTURÉE. La base est toujours la
 * commission de la commande entière (gardée à la première saisie) : corriger 4/10 en 5/10 ne
 * cumule pas deux réductions, et 10/10 rend la commande entière.
 */
export async function fixerProrata(
  id: string,
  p: Prorata,
  acteurId: string | null = null,
): Promise<
  { ok: true; montantCents: number; avertissement?: string } | { ok: false; message: string }
> {
  const refus = validerProrata(p);
  if (refus) return { ok: false, message: refus };
  const c = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      parrainage: true,
      montantCents: true,
      autofactureNumero: true,
      factureId: true,
    },
  });
  if (!c) return { ok: false, message: "Commission introuvable." };
  if (c.autofactureNumero)
    return {
      ok: false,
      message:
        "Cette commission est déjà facturée : le prorata ne s'applique plus. Après son versement, enregistrez une reprise.",
    };
  if (!(MODIFIABLES as readonly string[]).includes(c.statut))
    return { ok: false, message: "Seule une commission ni versée ni reprise reçoit un prorata." };
  if (c.parrainage)
    return {
      ok: false,
      message:
        "Une part de parrainage suit la commission du filleul : fixez le prorata sur celle-ci.",
    };
  if (c.montantCents === null)
    return {
      ok: false,
      message: "Le montant n'est pas encore arrêté : qualifiez d'abord la ligne.",
    };
  const existant = await prisma.commissionProrata.findUnique({
    where: { commissionId: id },
    select: { montantAvantCents: true },
  });
  const base = existant?.montantAvantCents ?? c.montantCents;
  const nouveau = appliquerProrata(base, p);
  const r = await prisma.commissionApporteur.updateMany({
    where: {
      id,
      montantCents: c.montantCents,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    data: { montantCents: nouveau },
  });
  if (r.count !== 1)
    return { ok: false, message: "La commission a changé entre-temps : rechargez la page." };
  const ligne = {
    participantsEtablissement: p.participantsEtablissement,
    participantsCommande: p.participantsCommande,
    montantAvantCents: base,
    majPar: acteurId?.slice(0, 64) ?? null,
  };
  await prisma.commissionProrata.upsert({
    where: { commissionId: id },
    create: { commissionId: id, ...ligne },
    update: ligne,
  });
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: "commission_apporteur.reduite",
        targetType: "commission_apporteur",
        targetId: id,
        changes: {
          avantCents: c.montantCents,
          apresCents: nouveau,
          commandeEntiereCents: base,
          prorata: `${p.participantsEtablissement}/${p.participantsCommande}`,
          motif: "Commande partagée avec d'autres établissements (art. 3.6)",
        },
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
  // Part du parrain née de la même commande : 10 % du nouveau montant (art. 4.6).
  const avertissements: string[] = [];
  const parts = await prisma.commissionApporteur.findMany({
    where: { factureId: c.factureId, parrainage: true },
    select: { id: true, statut: true, montantCents: true, autofactureNumero: true },
  });
  const part = Math.floor((nouveau * PARRAINAGE_BPS) / 10_000);
  for (const x of parts) {
    if (x.montantCents === part) continue;
    if ((MODIFIABLES as readonly string[]).includes(x.statut) && !x.autofactureNumero) {
      if (x.montantCents === null) continue; // encore à qualifier : suivra la qualification
      const m = await prisma.commissionApporteur.updateMany({
        where: { id: x.id, montantCents: x.montantCents, autofactureNumero: null },
        data: { montantCents: part },
      });
      if (m.count !== 1)
        avertissements.push("La part du parrain a changé entre-temps : vérifiez-la.");
    } else {
      avertissements.push(
        `La part du parrain est déjà facturée (${euros(x.montantCents ?? 0)}) : elle n'est pas modifiée ; ajustez-la à la main si besoin (reprise après versement).`,
      );
    }
  }
  return {
    ok: true,
    montantCents: nouveau,
    ...(avertissements.length ? { avertissement: avertissements.join(" ") } : {}),
  };
}

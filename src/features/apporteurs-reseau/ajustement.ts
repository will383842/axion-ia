// Réseau d'apporteurs — RÉDUIRE ou ANNULER une commission pas encore facturée (contrat 2.3).
//
// Pour une commission « due », « à qualifier » ou « en attente de vigilance » qui n'a pas encore
// d'autofacture : le prix finalement conservé baisse (art. 4.2 bis), la commande est annulée ou la
// prestation n'a pas lieu (art. 4.2), la présentation est démentie ou frauduleuse (art. 4.5 bis).
// Une commission déjà FACTURÉE ne se modifie plus : après son versement, c'est une reprise (4.5).
//
// Rien ne disparaît : la ligne reste en base (statut « annulee » ou montant réduit) et chaque geste
// est tracé au journal d'audit (qui, quand, avant, après, motif). La part du PARRAIN née de la
// même facture suit la commission : annulée avec elle, réduite dans la même proportion (art. 4.6).

import { prisma } from "@/lib/prisma";

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

type Resultat = { ok: true } | { ok: false; message: string };

async function tracer(
  action: "commission_apporteur.reduite" | "commission_apporteur.annulee",
  id: string,
  acteurId: string | null,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action,
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
}

async function lire(id: string) {
  return prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      montantCents: true,
      autofactureNumero: true,
      factureId: true,
      parrainage: true,
    },
  });
}

const DEJA_FACTUREE =
  "Cette commission est déjà facturée : elle ne se modifie plus. Après son versement, enregistrez une reprise.";

/** Parts du parrain nées de la même facture, encore modifiables. */
async function partsDuParrain(factureId: string) {
  return prisma.commissionApporteur.findMany({
    where: {
      factureId,
      parrainage: true,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    select: { id: true, montantCents: true, statut: true },
  });
}

export async function reduireCommission(
  id: string,
  nouveauCents: number,
  motif: string,
  acteurId: string | null = null,
): Promise<Resultat> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez le motif de la réduction." };
  if (!Number.isInteger(nouveauCents) || nouveauCents <= 0)
    return { ok: false, message: "Indiquez un montant positif (pour tout retirer, annulez)." };
  const avant = await lire(id);
  if (!avant) return { ok: false, message: "Commission introuvable." };
  if (avant.autofactureNumero) return { ok: false, message: DEJA_FACTUREE };
  if (!(MODIFIABLES as readonly string[]).includes(avant.statut))
    return { ok: false, message: "Seule une commission ni versée ni reprise se réduit." };
  if (avant.montantCents === null)
    return { ok: false, message: "Le montant n'est pas encore arrêté : classez d'abord la ligne." };
  if (nouveauCents >= avant.montantCents)
    return { ok: false, message: "Le nouveau montant doit être inférieur au montant actuel." };
  // Valeurs figées AVANT l'écriture (la ligne lue peut être modifiée sous nos yeux).
  const ancien = avant.montantCents;
  const facture = avant.factureId;
  const estParrainage = avant.parrainage;
  const r = await prisma.commissionApporteur.updateMany({
    where: {
      id,
      montantCents: ancien,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    data: { montantCents: nouveauCents },
  });
  if (r.count !== 1)
    return { ok: false, message: "La commission a changé entre-temps : rechargez la page." };
  await tracer("commission_apporteur.reduite", id, acteurId, {
    avantCents: ancien,
    apresCents: nouveauCents,
    motif: m,
  });
  if (!estParrainage) {
    for (const p of await partsDuParrain(facture)) {
      if (p.montantCents === null || p.montantCents <= 0) continue;
      const apres = Math.round((p.montantCents * nouveauCents) / ancien);
      const rp = await prisma.commissionApporteur.updateMany({
        where: { id: p.id, montantCents: p.montantCents, autofactureNumero: null },
        data: { montantCents: apres },
      });
      if (rp.count === 1) {
        await tracer("commission_apporteur.reduite", p.id, acteurId, {
          avantCents: p.montantCents,
          apresCents: apres,
          motif: m,
          suitLaCommission: id,
        });
      }
    }
  }
  return { ok: true };
}

export async function annulerCommission(
  id: string,
  motif: string,
  acteurId: string | null = null,
): Promise<Resultat> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez le motif de l'annulation." };
  const avant = await lire(id);
  if (!avant) return { ok: false, message: "Commission introuvable." };
  if (avant.autofactureNumero) return { ok: false, message: DEJA_FACTUREE };
  if (!(MODIFIABLES as readonly string[]).includes(avant.statut))
    return { ok: false, message: "Seule une commission ni versée ni reprise s'annule." };
  const cibles = [
    { id, statut: avant.statut, montantCents: avant.montantCents, suit: null as string | null },
    ...(avant.parrainage
      ? []
      : (await partsDuParrain(avant.factureId)).map((p) => ({ ...p, suit: id }))),
  ];
  let premiere = true;
  for (const c of cibles) {
    const r = await prisma.commissionApporteur.updateMany({
      where: { id: c.id, autofactureNumero: null, statut: { in: [...MODIFIABLES] } },
      data: { statut: "annulee" },
    });
    if (premiere && r.count !== 1)
      return { ok: false, message: "La commission a changé entre-temps : rechargez la page." };
    premiere = false;
    if (r.count === 1) {
      await tracer("commission_apporteur.annulee", c.id, acteurId, {
        statutAvant: c.statut,
        montantAvantCents: c.montantCents,
        motif: m,
        ...(c.suit ? { suitLaCommission: c.suit } : {}),
      });
    }
  }
  return { ok: true };
}

/**
 * Réseau d'apporteurs — contrôle PÉRIODIQUE du registre public (PR L, #2464, point 20).
 *
 * Un apporteur sous contrat (statut `signe`, préavis compris, ou `resilie` avec de l'argent en jeu)
 * dont l'entreprise ferme au registre public doit se voir. Ce passage relit le registre, sans cache,
 * pour 50 apporteurs au plus par passage, les contrôles les plus anciens d'abord (au plus un par 7 jours).
 *
 * ⛔ Aucun e-mail à l'apporteur et aucun effet sur le contrat : Williams décide. La facturation garde
 * son blocage existant. Seule une alerte INTERNE part, après deux contrôles consécutifs.
 * « indisponible » n'écrit rien : on retente au passage suivant.
 * Journaux et Sentry : identifiants seulement. Aucun `server-only` : tourne dans le WORKER.
 */

import { prisma } from "@/lib/prisma";

import { alerteInterne } from "./alerte-interne";
import { lireEntrepriseParSiren, lireRegistre } from "./annuaire";
import { argentEnJeu } from "./retrait";
import { signalerErreurReseau } from "./signaler";

export const PLAFOND_CONTROLES = 50;
export const INTERVALLE_CONTROLE_JOURS = 7;
/** Deux contrôles consécutifs en défaut avant d'alerter (un registre qui trébuche une fois n'alarme pas). */
export const CONTROLES_AVANT_ALERTE = 2;

export type EtatRegistre = "active" | "fermee" | "introuvable";

const JOUR_MS = 86_400_000;

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

interface LigneControle {
  apporteurId: string;
  dernierControleAt: Date;
  etat: string;
  etatDepuis: Date;
  consecutifs: number;
  alerteeAt: Date | null;
}

/** Le contrôle d'un apporteur ; rend `true` si une ligne a été écrite. */
async function controlerUn(
  a: { id: string; siren: string; siret: string | null },
  avant: LigneControle | undefined,
  maintenant: Date,
): Promise<boolean> {
  // Sans cache : lecture directe. Avec un SIRET (plusieurs activités), c'est l'ÉTABLISSEMENT qui compte.
  const r = a.siret ? await lireRegistre(a.siret) : await lireEntrepriseParSiren(a.siren);
  if (!r.ok && (r.raison === "indisponible" || r.raison === "siren_invalide")) return false;
  const nouvel: EtatRegistre = r.ok ? (r.entreprise.active ? "active" : "fermee") : "introuvable";
  const memeEtat = avant?.etat === nouvel;
  const consecutifs = memeEtat && avant ? avant.consecutifs + 1 : 1;
  const etatDepuis = memeEtat && avant ? avant.etatDepuis : maintenant;
  let alerteeAt: Date | null = memeEtat && avant ? avant.alerteeAt : null;

  if (nouvel !== "active" && consecutifs >= CONTROLES_AVANT_ALERTE && !alerteeAt) {
    const partie = await alerteInterne({
      jobId: `apporteur-registre-ferme:${a.id}:${etatDepuis.toISOString()}`,
      code: "apporteur_registre_ferme",
      titre: "Apporteur : l'entreprise n'est plus active au registre public",
      message:
        nouvel === "fermee"
          ? "L'entreprise (ou l'établissement) d'un apporteur sous contrat est fermée au registre public depuis deux contrôles consécutifs. Aucune action automatique : le contrat et les paiements restent en l'état, la décision vous revient."
          : "L'entreprise d'un apporteur sous contrat est introuvable au registre public depuis deux contrôles consécutifs. Aucune action automatique : le contrat et les paiements restent en l'état, la décision vous revient.",
      cibleType: "ApporteurReseau",
      cibleId: a.id,
      niveau: "critique",
      maintenant,
    });
    if (partie) alerteeAt = maintenant;
  }

  const donnees = {
    dernierControleAt: maintenant,
    etat: nouvel,
    etatDepuis,
    consecutifs,
    alerteeAt,
  };
  await prisma.apporteurControleRegistre.upsert({
    where: { apporteurId: a.id },
    create: { apporteurId: a.id, ...donnees },
    update: donnees,
  });
  return true;
}

/** Le passage : rend le nombre d'apporteurs contrôlés. Ne lève pas (table absente : 0). */
export async function controlerRegistreApporteurs(maintenant: Date): Promise<number> {
  let lignes: LigneControle[];
  try {
    lignes = (await prisma.apporteurControleRegistre.findMany()) as LigneControle[];
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return 0; // migration pas encore passée : rien à contrôler, rien à casser
  }
  const parId = new Map(lignes.map((l) => [l.apporteurId, l]));

  const apporteurs = await prisma.apporteurReseau.findMany({
    where: { statut: { in: ["signe", "resilie"] }, siren: { not: null } },
    select: { id: true, statut: true, siren: true },
  });
  const limite = maintenant.getTime() - INTERVALLE_CONTROLE_JOURS * JOUR_MS;
  const echus = apporteurs
    .filter((a) => {
      const l = parId.get(a.id);
      return !l || l.dernierControleAt.getTime() <= limite;
    })
    .sort(
      (x, y) =>
        (parId.get(x.id)?.dernierControleAt.getTime() ?? 0) -
        (parId.get(y.id)?.dernierControleAt.getTime() ?? 0),
    );

  // Les résiliés ne sont contrôlés que s'il reste de l'argent en jeu : on le vérifie en descendant la liste.
  const retenus: Array<{ id: string; siren: string }> = [];
  for (const a of echus) {
    if (retenus.length >= PLAFOND_CONTROLES) break;
    if (!a.siren) continue;
    if (a.statut === "resilie" && !(await argentEnJeu(a.id))) continue;
    retenus.push({ id: a.id, siren: a.siren });
  }
  if (retenus.length === 0) return 0;

  const sirets = new Map(
    (
      await prisma.apporteurReseauSiret.findMany({
        where: { apporteurId: { in: retenus.map((r) => r.id) } },
        select: { apporteurId: true, siret: true },
      })
    ).map((s) => [s.apporteurId, s.siret.trim()]),
  );

  let controles = 0;
  for (const r of retenus) {
    try {
      if (await controlerUn({ ...r, siret: sirets.get(r.id) ?? null }, parId.get(r.id), maintenant))
        controles += 1;
    } catch (err) {
      signalerErreurReseau("controle registre apporteur", err);
    }
  }
  return controles;
}

/** Pour la page console : les apporteurs dont l'état n'est pas `active`. */
export async function listerRegistreEnDefaut(): Promise<LigneControle[]> {
  try {
    return (await prisma.apporteurControleRegistre.findMany({
      where: { etat: { not: "active" } },
      orderBy: { etatDepuis: "asc" },
    })) as LigneControle[];
  } catch (err) {
    if (tableAbsente(err)) return [];
    throw err;
  }
}

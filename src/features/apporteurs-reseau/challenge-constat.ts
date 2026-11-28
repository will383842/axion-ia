/**
 * Challenges d'apporteurs — le CONSTAT, après la fin de la période (lot I, #2464).
 *
 * Appelé par le WORKER seul (aucun `server-only`). Pour chaque challenge publié dans sa fenêtre de
 * constat, on compte, par apporteur, les Journées IA qui comptent ; tout apporteur qui atteint le
 * seuil a UNE prime `a_valider`. Rien n'est conservé pour les autres. La prime n'est jamais versée
 * ici : elle attend la validation du dirigeant.
 *
 * Source unique des Journées : les `CommissionApporteur` non parrainage (une commission n'existe
 * qu'après paiement intégral et revient au seul attributaire). Jamais une copie de l'attribution.
 */
import type { Prisma } from "../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";

import { alerteInterne } from "./alerte-interne";
import { fenetreDeConstat, journeeCompte, jourParisDe, seuilAtteint } from "./challenge-regles";
import { netDeLaCommande } from "./commandes";
import { ACTIVITE_PRIME_CHALLENGE } from "./prime-challenge";
import { lirePaiementsIntegrauxParFacture } from "./paiement-integral";
import { analyserLignesJourneeIa } from "./regles";
import { tableAbsente } from "./reservation-presentation";
import { signalerErreurReseau } from "./signaler";

export interface PreuveJournee {
  factureId: string;
  numero: string;
  jourFacture: string;
  journees: number;
  payeeIntegralementLe: string | null;
}

export interface JourneeLue extends PreuveJournee {
  apporteurId: string;
  netHtCents: number;
}

interface Periode {
  debutLe: string;
  finLe: string;
  paiementJusquAu: string | null;
  seuil: number;
}

/** Pur : par apporteur, les Journées qui comptent, et le jour où le seuil est atteint. */
export function compterParApporteur(
  lues: readonly JourneeLue[],
  c: Periode,
): Map<string, { nbJournees: number; atteintLe: string | null; preuves: PreuveJournee[] }> {
  const retenues = lues
    .filter((l) => journeeCompte({ ...l, ...c }))
    .sort(
      (a, b) =>
        a.jourFacture.localeCompare(b.jourFacture) || a.factureId.localeCompare(b.factureId),
    );
  const out = new Map<
    string,
    { nbJournees: number; atteintLe: string | null; preuves: PreuveJournee[] }
  >();
  for (const l of retenues) {
    const cur = out.get(l.apporteurId) ?? { nbJournees: 0, atteintLe: null, preuves: [] };
    cur.nbJournees += l.journees;
    if (cur.atteintLe === null && seuilAtteint(cur.nbJournees, c.seuil))
      cur.atteintLe = l.jourFacture;
    cur.preuves.push({
      factureId: l.factureId,
      numero: l.numero,
      jourFacture: l.jourFacture,
      journees: l.journees,
      payeeIntegralementLe: l.payeeIntegralementLe,
    });
    out.set(l.apporteurId, cur);
  }
  return out;
}

const STATUTS_SANS_EFFET = ["brouillon", "annulee"];

/** Lit les Journées IA des commissions (hors parrainage, hors annulée / reprise / retenue). */
async function lireJournees(): Promise<JourneeLue[]> {
  const commissions = await prisma.commissionApporteur.findMany({
    where: {
      parrainage: false,
      activite: { not: ACTIVITE_PRIME_CHALLENGE },
      statut: { notIn: ["annulee", "reprise", "retenue"] },
    },
    select: { apporteurId: true, factureId: true },
  });
  if (commissions.length === 0) return [];
  const cles = [...new Set(commissions.map((c) => c.factureId))];
  const cle = await prisma.factureFormation.findMany({
    where: { OR: [{ id: { in: cles } }] },
    select: { id: true, devisId: true },
  });
  const devisIds = [...new Set(cle.map((f) => f.devisId).filter((d): d is string => !!d))];
  if (devisIds.length === 0) return [];
  const devis = await prisma.devis.findMany({
    where: { id: { in: devisIds }, journeeIa: true },
    select: { id: true, lignes: true },
  });
  const lignesDuDevis = new Map(devis.map((d) => [d.id, d.lignes]));
  const membres = await prisma.factureFormation.findMany({
    where: { OR: [{ devisId: { in: [...lignesDuDevis.keys()] } }] },
    select: {
      id: true,
      devisId: true,
      numero: true,
      statut: true,
      avoirDeId: true,
      montantHtCents: true,
      emiseAt: true,
    },
  });
  // Lecture stricte : une source en échec ou incomplète interrompt le constat (jamais « pas payé »).
  const paiements = await lirePaiementsIntegrauxParFacture(cles);
  if (paiements.size < cles.length) throw new Error("paiements incomplets");
  const devisDeLaFacture = new Map(cle.map((f) => [f.id, f.devisId]));
  const lues: JourneeLue[] = [];
  const vues = new Set<string>();
  for (const c of commissions) {
    const devisId = devisDeLaFacture.get(c.factureId);
    if (!devisId || !lignesDuDevis.has(devisId)) continue;
    const dedoublon = `${c.apporteurId}:${devisId}`;
    if (vues.has(dedoublon)) continue;
    vues.add(dedoublon);
    const duDevis = membres.filter((m) => m.devisId === devisId);
    const actives = duDevis.filter(
      (m) => !STATUTS_SANS_EFFET.includes(m.statut) && m.avoirDeId === null,
    );
    const premiere = [...actives]
      .filter((m) => m.emiseAt)
      .sort((a, b) => a.emiseAt!.getTime() - b.emiseAt!.getTime() || a.id.localeCompare(b.id))[0];
    if (!premiere?.emiseAt) continue;
    const { netCents } = netDeLaCommande(
      duDevis.map((m) => ({ ...m, emiseAt: m.emiseAt, devisId })) as never,
      duDevis as never,
    );
    const journees = analyserLignesJourneeIa(lignesDuDevis.get(devisId)).journees;
    if (journees < 1) continue;
    const paye = paiements.get(c.factureId) ?? null;
    lues.push({
      apporteurId: c.apporteurId,
      factureId: premiere.id,
      numero: premiere.numero,
      jourFacture: jourParisDe(premiere.emiseAt),
      journees,
      payeeIntegralementLe: paye ? jourParisDe(paye) : null,
      netHtCents: netCents,
    });
  }
  return lues;
}

const jour = (d: Date): string => d.toISOString().slice(0, 10);

/** Le constat de tous les challenges publiés dans leur fenêtre. Ne lève pas : une table absente = rien. */
export async function constaterChallenges(maintenant: Date): Promise<number> {
  let creees = 0;
  try {
    const aujourdhui = jourParisDe(maintenant);
    const challenges = await prisma.challengeApporteur.findMany({ where: { statut: "publie" } });
    const aConstater = challenges.filter((c) =>
      fenetreDeConstat(
        {
          finLe: jour(c.finLe),
          paiementJusquAu: c.paiementJusquAu ? jour(c.paiementJusquAu) : null,
        },
        aujourdhui,
      ),
    );
    if (aConstater.length === 0) return 0;
    let lues: JourneeLue[];
    try {
      lues = await lireJournees();
    } catch (err) {
      if (tableAbsente(err)) return creees;
      signalerErreurReseau("constat challenge : source manquante", err);
      await alerteInterne({
        jobId: `challenge-constat-interrompu:${aujourdhui}`,
        code: "challenge_constat_interrompu",
        titre: "Constat des challenges interrompu",
        message:
          "Constat interrompu, source manquante : une lecture a échoué ou rendu une carte incomplète. Aucune prime n'a été modifiée ; le prochain passage recommence.",
        cibleType: "challenge",
        cibleId: aConstater[0]!.id,
        niveau: "critique",
        maintenant,
      });
      return creees;
    }
    for (const c of aConstater) {
      const periode: Periode = {
        debutLe: jour(c.debutLe),
        finLe: jour(c.finLe),
        paiementJusquAu: c.paiementJusquAu ? jour(c.paiementJusquAu) : null,
        seuil: c.seuil,
      };
      const comptes = compterParApporteur(lues, periode);
      const existantes = await prisma.challengePrime.findMany({ where: { challengeId: c.id } });
      for (const [apporteurId, r] of comptes) {
        if (!seuilAtteint(r.nbJournees, c.seuil) || r.atteintLe === null) continue;
        const prime = existantes.find((p) => p.apporteurId === apporteurId);
        const donnees = {
          nbJournees: r.nbJournees,
          atteintLe: new Date(`${r.atteintLe}T00:00:00.000Z`),
          preuves: r.preuves as unknown as Prisma.InputJsonValue,
        };
        try {
          if (!prime) {
            await prisma.challengePrime.create({
              data: { challengeId: c.id, apporteurId, statut: "a_valider", ...donnees },
            });
            creees += 1;
          } else if (prime.statut === "a_valider") {
            await prisma.challengePrime.update({ where: { id: prime.id }, data: donnees });
          }
        } catch (err) {
          signalerErreurReseau("constat challenge : prime refusée", err);
          await alerteInterne({
            jobId: `challenge-prime-refusee:${c.id}:${apporteurId}`,
            code: "challenge_prime_refusee",
            titre: "Prime de challenge refusée par la base",
            message:
              "La base a refusé une prime de challenge (déjà une prime sur cette période ?). À vérifier dans la console.",
            cibleType: "challenge",
            cibleId: c.id,
            maintenant,
          });
        }
      }
      // Une prime validée dont le recompte retombe sous le seuil (remboursement) : à reprendre.
      for (const p of existantes) {
        if (p.statut !== "validee") continue;
        const r = comptes.get(p.apporteurId);
        if (r && seuilAtteint(r.nbJournees, c.seuil)) continue;
        await prisma.challengePrime.update({
          where: { id: p.id },
          data: { statut: "a_reprendre" },
        });
        await alerteInterne({
          jobId: `challenge-prime-a-reprendre:${p.id}`,
          code: "challenge_prime_a_reprendre",
          titre: "Prime de challenge à reprendre",
          message:
            "Le recompte d'une prime validée est repassé sous le seuil (remboursement). Confirmer la reprise dans la console.",
          cibleType: "challenge_prime",
          cibleId: p.id,
          niveau: "critique",
          maintenant,
        });
      }
    }
  } catch (err) {
    if (tableAbsente(err)) return creees;
    signalerErreurReseau("constat challenge", err);
  }
  return creees;
}

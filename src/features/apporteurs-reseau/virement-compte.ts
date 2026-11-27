/**
 * Lot 7 (plan §4.2, §4.3) : lectures et écritures du GEL et du COMPTE RÉELLEMENT PAYÉ.
 *
 * ⛔ Aucun IBAN entier ne sort d'ici : seules la fin (4 caractères) et l'empreinte circulent. L'IBAN de
 * la fiche n'est déchiffré que pour en tirer ces deux valeurs, côté serveur, sans rien rendre.
 * Ce module est aussi chargé par le worker (via `facturation.ts`) : toute lecture tolère la table
 * absente (P2021) et se comporte alors comme avant le chantier. Toute AUTRE erreur est relancée :
 * en cas de panne on ne vire jamais « par défaut ».
 */

import { decryptPii } from "@/lib/pii-crypto";
import { ibanNormalise, empreinteIban } from "@/lib/iban-empreinte";
import { prisma } from "@/lib/prisma";

import {
  choixDuCompteDemande,
  gelActif,
  quatreDerniersCaracteres,
  type StatutChangementIban,
} from "./changement-iban-regles";
import { etatGelDesLignes, MESSAGE_GEL, type EtatGel } from "./gel-virements-regles";

export { MESSAGE_GEL };

const absente = (err: unknown) => (err as { code?: unknown })?.code === "P2021";

export interface DemandeGel {
  readonly id: string;
  readonly statut: StatutChangementIban;
  readonly demandeeAt: Date;
  readonly confirmeeAt: Date | null;
}

/** Les apporteurs dont une demande OUVERTE (et non expirée) gèle les virements, par identifiant. */
export async function demandesQuiGelent(
  apporteurIds: ReadonlyArray<string>,
  maintenant: Date,
  /** Une transaction en cours : la lecture se fait alors DANS elle (au plus près de l'écriture). */
  db: Pick<typeof prisma, "apporteurChangementIban"> = prisma,
): Promise<Map<string, DemandeGel>> {
  const sortie = new Map<string, DemandeGel>();
  if (apporteurIds.length === 0) return sortie;
  try {
    const lues = await db.apporteurChangementIban.findMany({
      where: {
        apporteurId: { in: [...apporteurIds] },
        statut: { in: ["a_confirmer", "confirmee"] },
      },
      select: { id: true, apporteurId: true, statut: true, demandeeAt: true, confirmeeAt: true },
    });
    for (const d of lues) {
      const demande = { ...d, statut: d.statut as StatutChangementIban };
      if (gelActif(demande, maintenant)) sortie.set(d.apporteurId, demande);
    }
  } catch (err) {
    if (!absente(err)) throw err;
  }
  return sortie;
}

export async function gelDe(apporteurId: string, maintenant: Date): Promise<DemandeGel | null> {
  return (await demandesQuiGelent([apporteurId], maintenant)).get(apporteurId) ?? null;
}

// ── Compte à virer ───────────────────────────────────────────────────────

export interface CompteLu {
  readonly fin4: string;
  readonly empreinte: string | null;
}

export interface ComptesVirement {
  /** Le compte de la fiche : le nouveau après une validation, l'ancien sinon (refus, opposition, annulation). */
  readonly actuel: CompteLu | null;
  /** Le compte d'avant la dernière validation, tant qu'elle date de moins de 10 jours. */
  readonly precedent: CompteLu | null;
  /** Vrai dans les 10 jours qui suivent une validation : le formulaire demande sur quel compte le virement est parti. */
  readonly choixExige: boolean;
}

export function compteDeLaFiche(ibanChiffre: string | null | undefined): CompteLu | null {
  if (!ibanChiffre) return null;
  const clair = decryptPii(ibanChiffre);
  if (!clair) return null;
  const fin4 = quatreDerniersCaracteres(clair);
  if (!fin4) return null;
  return { fin4, empreinte: empreinteIban(ibanNormalise(clair)) };
}

export async function lireComptesVirement(
  apporteurId: string,
  ibanFicheChiffre: string | null | undefined,
  maintenant: Date,
): Promise<ComptesVirement> {
  const actuel = compteDeLaFiche(ibanFicheChiffre);
  const sans: ComptesVirement = { actuel, precedent: null, choixExige: false };
  try {
    const lignes = await prisma.apporteurIbanHistorique.findMany({
      where: { apporteurId },
      orderBy: { creeAt: "desc" },
      select: {
        ibanEmpreinte: true,
        ibanFin4: true,
        enVigueurDe: true,
        enVigueurJusqua: true,
        origine: true,
      },
    });
    const courante = lignes.find((l) => l.enVigueurJusqua === null);
    // Le choix n'existe que si la ligne en vigueur vient d'une VALIDATION, et si la fiche la porte encore.
    if (!courante || courante.origine !== "changement") return sans;
    if (actuel?.empreinte && courante.ibanEmpreinte !== actuel.empreinte) return sans;
    if (!choixDuCompteDemande(courante.enVigueurDe, maintenant)) return sans;
    const avant = lignes.find((l) => l.enVigueurJusqua !== null);
    if (!avant) return sans;
    return {
      actuel,
      precedent: { fin4: avant.ibanFin4, empreinte: avant.ibanEmpreinte },
      choixExige: true,
    };
  } catch (err) {
    if (absente(err)) return sans;
    throw err;
  }
}

export type ChoixCompte = "actuel" | "precedent";

export interface SaisieCompte {
  /** Les quatre derniers caractères lus sur le RIB ouvert. */
  readonly fin4Lue?: string | null;
  readonly compte?: ChoixCompte | null;
}

/**
 * Le compte sur lequel « Virement fait » est enregistré. `exiger` : interrupteur allumé (le contrôle
 * est alors obligatoire). Une saisie fournie est TOUJOURS contrôlée. Le choix du compte est exigé
 * pendant les 10 jours qui suivent une validation, interrupteur ou non.
 */
export function trancherCompte(
  comptes: ComptesVirement,
  saisie: SaisieCompte,
  exiger: boolean,
): { ok: true; compte: CompteLu | null } | { ok: false; message: string } {
  const lue = (saisie.fin4Lue ?? "").replace(/\s+/g, "").toUpperCase();
  const fournie = lue !== "";
  if (comptes.choixExige && !saisie.compte) {
    return { ok: false, message: "Indiquez sur quel compte le virement est parti." };
  }
  const choisi: CompteLu | null =
    comptes.choixExige && saisie.compte === "precedent" ? comptes.precedent : comptes.actuel;
  if (!choisi) {
    return exiger || fournie
      ? {
          ok: false,
          message: "Le compte attendu n'est pas lisible sur la fiche : vérifiez-la d'abord.",
        }
      : { ok: true, compte: null };
  }
  if (exiger || comptes.choixExige) {
    if (!/^[A-Z0-9]{4}$/.test(lue)) {
      return {
        ok: false,
        message: "Saisissez les quatre derniers caractères de l'IBAN lus sur le RIB ouvert.",
      };
    }
  }
  if (fournie && lue !== choisi.fin4) {
    return { ok: false, message: "Le RIB ouvert ne correspond pas au compte attendu." };
  }
  return { ok: true, compte: choisi };
}

/** La table de preuve existe-t-elle ? (une requête refusée dans une transaction l'annulerait : on sonde avant). */
export async function tablePreuveDisponible(): Promise<boolean> {
  try {
    await prisma.apporteurVirementCompte.count({
      where: { apporteurId: "00000000-0000-4000-8000-000000000000" },
    });
    return true;
  } catch (err) {
    if (absente(err)) return false;
    throw err;
  }
}

type Tx = Pick<typeof prisma, "apporteurVirementCompte">;

/** Une ligne de preuve par autofacture versée : empreinte et fin du compte, jamais l'IBAN. */
export async function ecrirePreuveDeCompte(
  tx: Tx,
  e: {
    apporteurId: string;
    numeros: ReadonlyArray<string>;
    verseAt: Date;
    compte: CompteLu & { empreinte: string };
    declarePar: string;
  },
): Promise<void> {
  const dejaSurCeCompte = await tx.apporteurVirementCompte.count({
    where: { apporteurId: e.apporteurId, ibanEmpreinte: e.compte.empreinte },
  });
  let premier = dejaSurCeCompte === 0;
  for (const numero of e.numeros) {
    await tx.apporteurVirementCompte.create({
      data: {
        autofactureNumero: numero,
        apporteurId: e.apporteurId,
        ibanEmpreinte: e.compte.empreinte,
        ibanFin4: e.compte.fin4,
        verseAt: e.verseAt,
        declarePar: e.declarePar.slice(0, 64),
        premierSurCeCompte: premier,
      },
    });
    premier = false;
  }
}

// ── Enrichissement des lignes « Virements à faire » ─────────────────────

export interface VirementEnrichi {
  readonly gel: (EtatGel & { readonly demandeeAt: Date; readonly confirmeeAt: Date | null }) | null;
  /** « 5678 » : le compte de la fiche, masqué. Rien si la ligne est gelée. */
  readonly compteFin4: string | null;
  /** « 1234 » : le compte d'avant, seulement dans les 10 jours qui suivent une validation (choix exigé). */
  readonly precedentFin4: string | null;
}

/** Le gel (état de la demande, plus proche échéance) et le compte masqué de chaque ligne, par numéro. */
export async function enrichirVirements(
  lignes: ReadonlyArray<{
    numero: string;
    apporteurId: string;
    emissionAt: Date;
    paiementIntegralAt: Date | null;
  }>,
  maintenant: Date,
): Promise<Map<string, VirementEnrichi>> {
  const sortie = new Map<string, VirementEnrichi>();
  const ids = [...new Set(lignes.map((l) => l.apporteurId))];
  if (ids.length === 0) return sortie;
  const gels = await demandesQuiGelent(ids, maintenant);
  const libres = ids.filter((i) => !gels.has(i));
  const fiches = libres.length
    ? await prisma.apporteurReseau.findMany({
        where: { id: { in: libres } },
        select: { id: true, iban: true },
      })
    : [];
  const comptes = new Map<string, ComptesVirement>();
  for (const f of fiches) {
    comptes.set(f.id, await lireComptesVirement(f.id, f.iban, maintenant));
  }
  for (const id of ids) {
    const siennes = lignes.filter((l) => l.apporteurId === id);
    const demande = gels.get(id);
    const etat = demande ? etatGelDesLignes(demande, siennes, maintenant) : null;
    const c = comptes.get(id);
    for (const l of siennes) {
      sortie.set(l.numero, {
        gel:
          demande && etat
            ? { ...etat, demandeeAt: demande.demandeeAt, confirmeeAt: demande.confirmeeAt }
            : null,
        compteFin4: c?.actuel?.fin4 ?? null,
        precedentFin4: c?.choixExige ? (c.precedent?.fin4 ?? null) : null,
      });
    }
  }
  return sortie;
}

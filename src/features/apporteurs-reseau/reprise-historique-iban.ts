/**
 * Lot 9 : REPRISE de l'historique des comptes (plan §3.3).
 *
 * Inscrit le compte courant de chaque fiche signée dans `apporteur_iban_historique` (origine
 * `dossier_initial`), pour que la comparaison « compte déjà connu » couvre tout le réseau dès le premier jour.
 * Ne MODIFIE AUCUNE fiche. Rejouable : une fiche dont le compte est déjà dans l'historique est sautée.
 * Essai à blanc par défaut (`appliquer: false`). Le compte rendu ne contient aucun IBAN, aucun identifiant de fiche.
 *
 * Appelé par la console (`actions-reprise-empreintes-iban.ts`, super_admin seul) ET par
 * `scripts/apporteurs/reprise-historique-iban.ts`. Par petits lots ; un échec sur une fiche est compté par
 * MOTIF (jamais de message ni d'identifiant) et n'arrête pas le lot. Sans `IBAN_EMPREINTE_SECRET` : refus,
 * rien n'est lu ni écrit (une empreinte sans le vrai secret ne se comparerait plus jamais).
 *
 * Pas de `server-only` : le script `tsx` l'importe.
 */
import { randomUUID } from "node:crypto";

import { empreinteIban, ibanNormalise } from "@/lib/iban-empreinte";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { quatreDerniersCaracteres } from "./changement-iban-regles";

export interface CompteRenduReprise {
  readonly appliquer: boolean;
  /** `secret_absent` : rien n'a été lu ni écrit. */
  readonly refus: "secret_absent" | null;
  readonly vus: number;
  readonly dejaAJour: number;
  readonly aCalculer: number;
  readonly calcules: number;
  readonly ignores: {
    readonly sansIban: number;
    readonly illisible: number;
    readonly ecritureEchouee: number;
  };
}

const TAILLE_LOT = 200;

export async function repriseEmpreintesIban(o: {
  appliquer: boolean;
}): Promise<CompteRenduReprise> {
  const ignores = { sansIban: 0, illisible: 0, ecritureEchouee: 0 };
  const rendu = (c: Partial<CompteRenduReprise>): CompteRenduReprise => ({
    appliquer: o.appliquer,
    refus: null,
    vus: 0,
    dejaAJour: 0,
    aCalculer: 0,
    calcules: 0,
    ignores,
    ...c,
  });
  if (empreinteIban("FR00") === null) return rendu({ refus: "secret_absent" });

  const presents = await prisma.apporteurIbanHistorique.findMany({
    select: { apporteurId: true, ibanEmpreinte: true },
  });
  const deja = new Set(presents.map((p) => `${p.apporteurId}:${p.ibanEmpreinte}`));
  let vus = 0;
  let dejaAJour = 0;
  let aCalculer = 0;
  let calcules = 0;
  let curseur: string | undefined;
  for (;;) {
    const lot = await prisma.apporteurReseau.findMany({
      where: { statut: "signe" },
      select: { id: true, iban: true },
      orderBy: { id: "asc" },
      take: TAILLE_LOT,
      ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
    });
    for (const f of lot) {
      vus += 1;
      let clair: string | null;
      try {
        clair = decryptPii(f.iban);
      } catch {
        ignores.illisible += 1;
        continue;
      }
      const empreinte = clair ? empreinteIban(clair) : null;
      const fin4 = clair ? quatreDerniersCaracteres(clair) : null;
      if (!clair || !empreinte || !fin4) {
        ignores.sansIban += 1;
        continue;
      }
      if (deja.has(`${f.id}:${empreinte}`)) {
        dejaAJour += 1;
        continue;
      }
      aCalculer += 1;
      if (!o.appliquer) continue;
      try {
        const id = randomUUID();
        await prisma.apporteurIbanHistorique.create({
          data: {
            id,
            apporteurId: f.id,
            // v1 de la fiche déchiffré puis rechiffré en v2 (le CHECK refuse un v1 copié tel quel).
            iban: encryptPii(ibanNormalise(clair), {
              aad: `iban-historique:${id}`,
              cleExigee: true,
            }),
            ibanEmpreinte: empreinte,
            ibanFin4: fin4,
            origine: "dossier_initial",
          },
        });
        deja.add(`${f.id}:${empreinte}`);
        calcules += 1;
      } catch {
        ignores.ecritureEchouee += 1;
      }
    }
    const dernier = lot[lot.length - 1];
    if (lot.length < TAILLE_LOT || !dernier) break;
    curseur = dernier.id;
  }
  return rendu({ vus, dejaAJour, aCalculer, calcules });
}

/** Ancien nom, gardé pour le script. */
export const reprendreHistoriqueIban = repriseEmpreintesIban;

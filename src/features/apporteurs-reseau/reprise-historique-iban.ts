/**
 * Lot 9 : REPRISE de l'historique des comptes (plan §3.3).
 *
 * Inscrit le compte courant de chaque fiche signée dans `apporteur_iban_historique` (origine
 * `dossier_initial`), pour que la comparaison « compte déjà connu » couvre tout le réseau dès le premier jour.
 * Ne MODIFIE AUCUNE fiche. Rejouable : une fiche dont le compte est déjà dans l'historique est sautée.
 * Essai à blanc par défaut (`appliquer: false`). Le compte rendu ne contient aucun IBAN, aucun identifiant de fiche.
 *
 * Pas de `server-only` : lancé à la main par `scripts/apporteurs/reprise-historique-iban.ts`.
 */
import { randomUUID } from "node:crypto";

import { empreinteIban, ibanNormalise } from "@/lib/iban-empreinte";
import { encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { quatreDerniersCaracteres } from "./changement-iban-regles";
import { lireIbanClair } from "./iban-purge";

export interface CompteRenduReprise {
  readonly appliquer: boolean;
  readonly fichesLues: number;
  readonly aCreer: number;
  readonly crees: number;
  readonly dejaPresents: number;
  readonly sansIban: number;
}

export async function reprendreHistoriqueIban(o: {
  appliquer: boolean;
}): Promise<CompteRenduReprise> {
  const fiches = await prisma.apporteurReseau.findMany({
    where: { statut: "signe" },
    select: { id: true, iban: true },
  });
  const presents = await prisma.apporteurIbanHistorique.findMany({
    select: { apporteurId: true, ibanEmpreinte: true },
  });
  const deja = new Set(presents.map((p) => `${p.apporteurId}:${p.ibanEmpreinte}`));
  let aCreer = 0;
  let crees = 0;
  let dejaPresents = 0;
  let sansIban = 0;
  for (const f of fiches) {
    const clair = lireIbanClair(f.iban);
    const empreinte = clair ? empreinteIban(clair) : null;
    const fin4 = clair ? quatreDerniersCaracteres(clair) : null;
    if (!clair || !empreinte || !fin4) {
      sansIban += 1;
      continue;
    }
    if (deja.has(`${f.id}:${empreinte}`)) {
      dejaPresents += 1;
      continue;
    }
    aCreer += 1;
    if (!o.appliquer) continue;
    const id = randomUUID();
    await prisma.apporteurIbanHistorique.create({
      data: {
        id,
        apporteurId: f.id,
        // v1 de la fiche déchiffré puis rechiffré en v2 (le CHECK refuse un v1 copié tel quel).
        iban: encryptPii(ibanNormalise(clair), { aad: `iban-historique:${id}`, cleExigee: true }),
        ibanEmpreinte: empreinte,
        ibanFin4: fin4,
        origine: "dossier_initial",
      },
    });
    deja.add(`${f.id}:${empreinte}`);
    crees += 1;
  }
  return {
    appliquer: o.appliquer,
    fichesLues: fiches.length,
    aCreer,
    crees,
    dejaPresents,
    sansIban,
  };
}

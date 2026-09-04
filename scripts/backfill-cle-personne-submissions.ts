#!/usr/bin/env tsx
/**
 * Rattrapage de `Submission.contactEmailHash` — la clé de personne.
 *
 * POURQUOI
 * --------
 * `Submission.contactEmail` est chiffré avec un IV ALÉATOIRE : deux lignes
 * portant la même adresse ne se ressemblent pas, donc aucune égalité SQL n'y est
 * possible. `contactEmailHash` (HMAC déterministe) est le SEUL moyen de
 * retrouver une personne — et le schéma raconte lui-même ce qui arrive sans lui :
 * « l'export art. 15 et l'effacement art. 17 renvoyaient donc VIDE en répondant
 * "succès" » (`prisma/schema.prisma`, ~l. 515).
 *
 * Une colonne nullable qui reste nulle ne casse rien, ne lève rien, et fait
 * répondre « succès » à un effacement qui n'efface pas. C'est le défaut le plus
 * silencieux du dossier, et c'est pour ça qu'il a duré.
 *
 * Trouvé le 2026-09-04 : sur six chemins de création, DEUX l'oubliaient — les
 * deux formulaires du tunnel apporteurs (`commercial-application/
 * lead-actions.ts` et `actions.ts`). Le code est corrigé ; ce script répare les
 * lignes DÉJÀ écrites, que le correctif ne touche pas.
 *
 * ⚠️ CE SCRIPT NE REMPLACE PAS LE CORRECTIF
 * -----------------------------------------
 * Le mécanisme principal est la ligne posée dans les deux actions, verrouillée
 * par `tests/unit/ci/toute-submission-porte-sa-cle-personne.spec.ts`. Un
 * correctif qui suppose qu'on pense à lancer un script à la main se rouvre au
 * premier chemin de création oublié — et c'est exactement ce qui s'est passé ici.
 *
 * MÉTHODE
 * -------
 * Pour chaque `Submission` à `contactEmailHash` NULL : déchiffrer
 * `contactEmail`, calculer `hashEmailForLookup`, écrire. Même fonction que le
 * code de production — aucune ré-implémentation, donc aucune divergence
 * possible entre les lignes rattrapées et les lignes neuves.
 *
 * IDEMPOTENT : ne lit que les lignes NULL, et l'écriture est CONDITIONNÉE à
 * cette même nullité (`updateMany` avec `contactEmailHash: null` dans le
 * `where`). Deux exécutions simultanées, ou une exécution pendant qu'une
 * personne remplit le formulaire, ne peuvent pas écraser une valeur fraîche.
 *
 * 🔴 CE QU'IL NE FAUT PAS FAIRE : rattraper une ligne dont l'adresse a été
 * effacée. `rgpd-erase.ts` remet `contactEmailHash` à NULL *volontairement*,
 * « pour que la personne redevienne introuvable » (schéma, l. 519-520). Une
 * ligne effacée porte `contactEmail` vidé ou pseudonymisé ; on la reconnaît à
 * un déchiffrement qui ne rend pas une adresse plausible, et on la SAUTE. Sans
 * cette précaution, le rattrapage ressusciterait la trouvabilité de personnes
 * qui ont demandé son contraire — un effacement défait par un script de
 * réparation, ce qui est pire que le défaut d'origine.
 *
 * USAGE
 * -----
 *   pnpm backfill:cle-personne            # essai à blanc, n'écrit RIEN
 *   pnpm backfill:cle-personne --appliquer
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/** Taille de lot : assez grand pour être rapide, assez petit pour rester lisible. */
const LOT = 500;

/**
 * Une adresse plausible, au sens « on peut en tirer une empreinte utile ».
 *
 * Volontairement plus strict qu'un simple `includes("@")` : après un effacement
 * RGPD, `contactEmail` peut porter un marqueur de pseudonymisation qui contient
 * malgré tout une arobase. On exige donc une forme d'adresse complète.
 */
function adressePlausible(valeur: string | null | undefined): valeur is string {
  if (!valeur) return false;
  if (valeur.startsWith("[efface")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur.trim());
}

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  console.log(
    appliquer
      ? "== RATTRAPAGE DE LA CLÉ DE PERSONNE — écriture RÉELLE =="
      : "== RATTRAPAGE DE LA CLÉ DE PERSONNE — essai à blanc (aucune écriture) ==",
  );

  const total = await prisma.submission.count({ where: { contactEmailHash: null } });
  console.log(`lignes sans clé de personne : ${total}`);
  if (total === 0) {
    console.log("rien à faire.");
    return;
  }

  let vues = 0;
  let ecrites = 0;
  let sautees_effacees = 0;
  let sautees_illisibles = 0;
  let curseur: string | undefined;

  for (;;) {
    const lot = await prisma.submission.findMany({
      where: { contactEmailHash: null },
      select: { id: true, contactEmail: true, type: true, submittedAt: true },
      orderBy: { id: "asc" },
      take: LOT,
      ...(curseur ? { skip: 1, cursor: { id: curseur } } : {}),
    });
    if (lot.length === 0) break;
    curseur = lot[lot.length - 1]?.id;

    for (const ligne of lot) {
      vues += 1;
      let clair: string | null = null;
      try {
        clair = decryptPii(ligne.contactEmail);
      } catch {
        clair = null;
      }

      if (!adressePlausible(clair)) {
        // Effacée, pseudonymisée, ou illisible : on ne ressuscite rien.
        if (clair === null || clair === "") sautees_illisibles += 1;
        else sautees_effacees += 1;
        continue;
      }

      const empreinte = hashEmailForLookup(clair);
      if (!empreinte) {
        sautees_illisibles += 1;
        continue;
      }

      if (!appliquer) {
        ecrites += 1;
        continue;
      }

      // 🔑 `contactEmailHash: null` dans le WHERE : si le correctif de
      // production ou un autre passage l'a posée entre-temps, on ne l'écrase
      // pas. L'idempotence est portée par la requête, pas par l'ordonnancement.
      const res = await prisma.submission.updateMany({
        where: { id: ligne.id, contactEmailHash: null },
        data: { contactEmailHash: empreinte },
      });
      ecrites += res.count;
    }

    console.log(`  … ${vues}/${total} examinées, ${ecrites} ${appliquer ? "écrites" : "à écrire"}`);
  }

  console.log("");
  console.log(`examinées           : ${vues}`);
  console.log(`${appliquer ? "écrites             " : "à écrire            "}: ${ecrites}`);
  console.log(`sautées (effacées)  : ${sautees_effacees}   ← RGPD : ne pas ressusciter`);
  console.log(`sautées (illisibles): ${sautees_illisibles}`);
  if (!appliquer) {
    console.log("");
    console.log("Essai à blanc. Relancer avec --appliquer pour écrire.");
  }
}

main()
  .catch((err) => {
    console.error("[backfill-cle-personne] échec :", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

/**
 * RAPPORT À BLANC — ce que la rétention de 5 ans SUPPRIMERAIT, si elle existait.
 *
 * ## Pourquoi ce script existe
 *
 * 🔴 Chaque pièce signée par un stagiaire porte, imprimée dessus, la mention
 * « Conservation : 5 ans » (`server/qualiopi/legal/legal-mentions.ts`,
 * `DOCUMENT_RETENTION_YEARS`). Trois services calculent et écrivent une date
 * d'échéance `suppressionPrevueAt` à la création de chaque pièce.
 *
 * **Et rien ne la lit.** Aucune purge, aucun worker, aucun cron : mesuré le
 * 2026-08-24 sur `src/server/queue/`, `scripts/` et `prisma/`. Le seul lecteur
 * applicatif s'en sert comme borne de validité d'un lien de signature, pas
 * comme critère d'effacement.
 *
 * L'organisme annonce donc par écrit une durée de conservation qu'il
 * n'applique pas. C'est un écart, dans un sens ou dans l'autre — soit la purge
 * manque, soit la mention est fausse. **Trancher est une décision, pas une
 * tâche de code** : supprimer une pièce légale signée est irréversible, et la
 * pièce peut être exigée bien après cinq ans (litige prud'homal, contrôle
 * fiscal, contrôle de la DREETS, redressement d'un financeur).
 *
 * ⛔ **Ce script n'efface RIEN et ne doit jamais le faire.** Il compte, il
 * date, il chiffre — pour que l'arbitrage se prenne sur des volumes réels et
 * non sur une intuition.
 *
 * ## Ce qu'il mesure
 *
 * Pour chaque modèle portant `suppressionPrevueAt` : combien de lignes sont
 * déjà échues, combien le seront sous 12 mois, et la plus ancienne échéance.
 *
 * 🔑 **La liste des modèles est DÉRIVÉE du schéma Prisma au moment de
 * l'exécution** (`Prisma.dmmf`), jamais écrite à la main. Une liste énumérée
 * prend du retard sur le schéma sans que rien ne le signale : ce dépôt l'a payé
 * quatre fois. Si un cinquième modèle reçoit la colonne demain, ce rapport le
 * comptera sans qu'on y touche — et le test associé exige qu'il en trouve au
 * moins autant qu'aujourd'hui.
 *
 * Usage : `pnpm qualiopi:retention-dry-run`
 */

// ⚠️ Client généré dans `prisma/generated/client`, jamais `@prisma/client`.
import { Prisma, PrismaClient } from "../prisma/generated/client";

import {
  COLONNE_ECHEANCE,
  modelesAvecEcheance,
  nomDelegue,
} from "../src/server/qualiopi/legal/retention-echeance";

interface LigneRapport {
  modele: string;
  total: number;
  echues: number;
  echuesSous12Mois: number;
  plusAncienneEcheance: Date | null;
  colonneObligatoire: boolean;
}

async function mesurer(prisma: PrismaClient, modele: string): Promise<LigneRapport> {
  // Accès dynamique : le nom du modèle vient du schéma, pas d'une constante.
  // Le nom du modèle vient du schéma : l'accès est forcément dynamique. On type
  // les deux seules méthodes appelées plutôt que `Function`, qui accepte
  // n'importe quoi et masquerait une faute d'appel.
  type DelegueLecture = {
    count: (args: Record<string, unknown>) => Promise<number>;
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, Date> | null>;
  };
  const delegate = (prisma as unknown as Record<string, DelegueLecture | undefined>)[
    nomDelegue(modele)
  ];
  if (delegate === undefined) {
    throw new Error(
      `Modèle « ${modele} » dérivé du schéma mais absent du client Prisma. ` +
        `Le client généré est probablement périmé : relancer \`pnpm prisma:generate\`.`,
    );
  }

  const maintenant = new Date();
  const dansUnAn = new Date(maintenant);
  dansUnAn.setFullYear(dansUnAn.getFullYear() + 1);

  const champ = Prisma.dmmf.datamodel.models
    .find((m) => m.name === modele)
    ?.fields.find((f) => f.name === COLONNE_ECHEANCE);

  const [total, echues, echuesSous12Mois, plusAncienne] = await Promise.all([
    delegate.count({}),
    delegate.count({ where: { [COLONNE_ECHEANCE]: { lt: maintenant } } }),
    delegate.count({
      where: { [COLONNE_ECHEANCE]: { gte: maintenant, lt: dansUnAn } },
    }),
    delegate.findFirst({
      orderBy: { [COLONNE_ECHEANCE]: "asc" },
      select: { [COLONNE_ECHEANCE]: true },
    }),
  ]);

  return {
    modele,
    total,
    echues,
    echuesSous12Mois,
    plusAncienneEcheance: plusAncienne?.[COLONNE_ECHEANCE] ?? null,
    colonneObligatoire: champ?.isRequired ?? false,
  };
}

async function main(): Promise<void> {
  const modeles = modelesAvecEcheance();

  console.log("");
  console.log("RAPPORT À BLANC — RÉTENTION DES PIÈCES QUALIOPI");
  console.log("═".repeat(78));
  console.log("");
  console.log("⛔ CE SCRIPT N'EFFACE RIEN. Il mesure ce qu'une purge supprimerait.");
  console.log("");
  console.log(`Modèles porteurs de « ${COLONNE_ECHEANCE} », dérivés du schéma Prisma :`);
  console.log(`  ${modeles.join(", ")}`);
  console.log("");

  if (modeles.length === 0) {
    console.error(
      `❌ AUCUN modèle ne porte « ${COLONNE_ECHEANCE} ». C'est un ÉCHEC, pas un ` +
        `bon résultat : soit la colonne a été renommée, soit le client Prisma est ` +
        `périmé. Un rapport vide serait rassurant à tort.`,
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const lignes: LigneRapport[] = [];
    for (const modele of modeles) {
      lignes.push(await mesurer(prisma, modele));
    }

    const col = (s: string, n: number): string => s.padEnd(n);
    const num = (n: number, w: number): string => String(n).padStart(w);

    console.log(
      col("MODÈLE", 28) +
        num(0, 0) +
        col("TOTAL", 10) +
        col("ÉCHUES", 10) +
        col("< 12 MOIS", 12) +
        "PLUS ANCIENNE ÉCHÉANCE",
    );
    console.log("─".repeat(78));
    for (const l of lignes) {
      console.log(
        col(l.modele, 28) +
          col(String(l.total), 10) +
          col(String(l.echues), 10) +
          col(String(l.echuesSous12Mois), 12) +
          (l.plusAncienneEcheance?.toISOString().slice(0, 10) ?? "—"),
      );
    }
    console.log("─".repeat(78));

    const totalEchues = lignes.reduce((s, l) => s + l.echues, 0);
    const totalLignes = lignes.reduce((s, l) => s + l.total, 0);
    console.log("");
    console.log(`TOTAL : ${totalLignes} pièce(s) conservée(s), dont ${totalEchues} échue(s).`);
    console.log("");

    if (totalEchues === 0) {
      console.log(
        "✅ Aucune pièce n'a dépassé son échéance à ce jour. L'écart entre la mention\n" +
          "   imprimée et la pratique n'a donc encore effacé aucune donnée — mais il\n" +
          "   reste un écart déclaratif, et il grandira.",
      );
    } else {
      console.log(
        `⚠️  ${totalEchues} pièce(s) sont conservées AU-DELÀ de la durée annoncée au\n` +
          "   stagiaire sur la pièce elle-même. Deux issues, toutes deux légitimes :\n" +
          "   purger, ou aligner la mention sur la pratique réelle. C'est un arbitrage.",
      );
    }
    console.log("");
    console.log("⛔ RIEN N'A ÉTÉ SUPPRIMÉ.");
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("qualiopi-retention-dry-run")) {
  void main();
}

#!/usr/bin/env tsx
/**
 * Console éditoriale — amorçage des référentiels (lot 0).
 *
 * Idempotent et NON destructif, exactement comme le seed Qualiopi : chaque
 * objet manquant est créé ; **aucune valeur existante n'est réécrite**. C'est
 * ce qui permet de rejouer le seed après une évolution du registre sans
 * écraser un seuil que Will a corrigé depuis la console.
 *
 * Ce que ce seed NE fait PAS, volontairement :
 *
 * - **Aucun pilier.** La liste définitive est une question ouverte du §14 (#4),
 *   tranchée au lot 1. Semer une liste spéculative créerait des données à
 *   nettoyer plus tard, et le protocole interdit d'interpréter un critère
 *   ambigu — on le fait préciser.
 * - **Aucune publication.** L'amorçage pose les référentiels ; les 61
 *   publications viennent de l'IMPORT, qui est une autre commande, avec sa
 *   propre garantie de non-répétition.
 * - **Aucun calendrier pour le site.** Le compte n°11 existe et reste vide :
 *   décision §14 #2, pour ne pas créer la seconde source de vérité que le §13
 *   classe en risque rouge.
 *
 * Usage : `pnpm editorial:seed`.
 */

import { PrismaClient, Prisma } from "../../generated/client";
import {
  ED_MARQUES,
  ED_COMPTES,
  ED_COMPTES_ATTENDUS,
} from "../../../src/server/editorial/referentiels/comptes";
import {
  ED_REGLES_CONFORMITE,
  ED_REGLES_CONFORMITE_ATTENDUES,
} from "../../../src/server/editorial/referentiels/conformite";
import {
  ED_REGLES_ALERTE,
  ED_REGLES_ALERTE_ATTENDUES,
} from "../../../src/server/editorial/referentiels/alertes";
import {
  ED_FAMILLES,
  ED_SPECS_PLATEFORME,
} from "../../../src/server/editorial/referentiels/familles";
import { ED_RECETTES, totalDerives } from "../../../src/server/editorial/referentiels/recettes";

const prisma = new PrismaClient();

/** Compte rendu d'une étape : ce qui a été créé, ce qui a été préservé. */
interface Bilan {
  cree: number;
  preserve: number;
}

function ligne(etape: string, bilan: Bilan, total: number): string {
  return `   ${etape.padEnd(24)} ${String(bilan.cree).padStart(3)} créé(s), ${String(
    bilan.preserve,
  ).padStart(3)} préservé(s)  (total ${total})`;
}

async function seedMarques(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const m of ED_MARQUES) {
    const existant = await prisma.edMarque.findUnique({ where: { slug: m.slug } });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    await prisma.edMarque.create({
      data: { slug: m.slug, nom: m.nom, description: m.description },
    });
    bilan.cree += 1;
  }
  return bilan;
}

async function seedComptes(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const c of ED_COMPTES) {
    const existant = await prisma.edCompte.findUnique({ where: { slug: c.slug } });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    // La marque est résolue par slug : un compte personnel n'en a pas.
    let marqueId: string | null = null;
    if (c.marqueSlug) {
      const marque = await prisma.edMarque.findUnique({ where: { slug: c.marqueSlug } });
      if (!marque) {
        throw new Error(
          `[editorial:seed] compte « ${c.slug} » référence la marque « ${c.marqueSlug} », absente. ` +
            `Les marques doivent être semées avant les comptes.`,
        );
      }
      marqueId = marque.id;
    }
    await prisma.edCompte.create({
      data: {
        slug: c.slug,
        plateforme: c.plateforme,
        libelle: c.libelle,
        identite: c.identite,
        marqueId,
        urlPublique: c.urlPublique,
        cadenceCible: c.cadenceCible,
        actif: c.actif,
      },
    });
    bilan.cree += 1;
  }
  return bilan;
}

async function seedFamilles(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const f of ED_FAMILLES) {
    const existant = await prisma.edFamille.findUnique({ where: { slug: f.slug } });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    await prisma.edFamille.create({
      data: {
        slug: f.slug,
        nom: f.nom,
        type: f.type,
        dureeMinSec: f.dureeMinSec,
        dureeMaxSec: f.dureeMaxSec,
        description: f.description,
      },
    });
    bilan.cree += 1;
  }
  return bilan;
}

async function seedSpecs(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const s of ED_SPECS_PLATEFORME) {
    const famille = await prisma.edFamille.findUnique({ where: { slug: s.familleSlug } });
    if (!famille) {
      throw new Error(
        `[editorial:seed] spec ${s.plateforme}/${s.familleSlug} : famille absente. ` +
          `Les familles doivent être semées avant les specs.`,
      );
    }
    const existant = await prisma.edSpecPlateforme.findUnique({
      where: { plateforme_familleId: { plateforme: s.plateforme, familleId: famille.id } },
    });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    await prisma.edSpecPlateforme.create({
      data: {
        plateforme: s.plateforme,
        familleId: famille.id,
        ratio: s.ratio,
        dureeMinSec: s.dureeMinSec,
        dureeMaxSec: s.dureeMaxSec,
        poidsMaxMo: s.poidsMaxMo,
        sousTitresIncrust: s.sousTitresIncrust,
        zoneSecuriteHaut: s.zoneSecuriteHaut,
        zoneSecuriteBas: s.zoneSecuriteBas,
        note: s.note || null,
      },
    });
    bilan.cree += 1;
  }
  return bilan;
}

/**
 * Les recettes de dérivation.
 *
 * 🔴 `ed_recettes` était VIDE, et les deux vérificateurs à l'aveugle du
 * protocole l'ont constaté séparément. Le critère 1 du lot 2 — « un asset
 * enregistré avec une recette crée automatiquement ses dérivés » — ne
 * pouvait donc pas être exercé : `appliquerRecetteAction` était écrite et
 * testée, et le sélecteur de la médiathèque n'avait rien à proposer.
 *
 * Une fonctionnalité correcte dont la donnée de référence manque est aussi
 * inutilisable qu'une fonctionnalité absente — et plus trompeuse, parce que
 * le code laisse croire qu'elle marche.
 *
 * ⚠️ Les lignes sont créées MÊME si la recette existait déjà, quand elle
 * n'en a aucune. Un semis interrompu entre la recette et ses lignes
 * laisserait sinon une recette qui ne produit rien, et chaque rejeu la
 * compterait « préservée » sans jamais la réparer. C'est exactement le
 * piège de l'écho manquant, trouvé dans l'import par la passe 5.
 */
async function seedRecettes(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const r of ED_RECETTES) {
    const source = await prisma.edFamille.findUnique({
      where: { slug: r.familleSourceSlug },
    });
    if (!source) {
      throw new Error(
        `[editorial:seed] recette ${r.slug} : famille source « ${r.familleSourceSlug} » ` +
          `absente. Les familles doivent être semées avant les recettes.`,
      );
    }

    const trouvee = await prisma.edRecette.findFirst({
      where: { nom: r.nom, familleSourceId: source.id },
      select: { id: true, _count: { select: { lignes: true } } },
    });

    let recetteId: string;
    let nbLignes: number;

    if (trouvee) {
      recetteId = trouvee.id;
      nbLignes = trouvee._count.lignes;
      bilan.preserve += 1;
    } else {
      const creee = await prisma.edRecette.create({
        data: { nom: r.nom, familleSourceId: source.id, actif: true },
        select: { id: true },
      });
      recetteId = creee.id;
      nbLignes = 0;
      bilan.cree += 1;
    }

    // ⚠️ Atteint MÊME quand la recette existait déjà — voir l'en-tête.
    if (nbLignes === 0) {
      for (const l of r.lignes) {
        const cible = await prisma.edFamille.findUnique({ where: { slug: l.familleSlug } });
        if (!cible) {
          throw new Error(
            `[editorial:seed] recette ${r.slug} : famille « ${l.familleSlug} » absente.`,
          );
        }
        await prisma.edRecetteLigne.create({
          data: {
            recetteId,
            familleId: cible.id,
            quantite: l.quantite,
            note: l.note,
          },
        });
      }
    }
  }
  return bilan;
}

async function seedReglesConformite(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const r of ED_REGLES_CONFORMITE) {
    const existant = await prisma.edRegleConformite.findUnique({ where: { code: r.code } });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    await prisma.edRegleConformite.create({
      data: {
        code: r.code,
        libelle: r.libelle,
        motif: r.motif,
        motifRegex: r.motifRegex,
        interdit: r.interdit,
        gravite: r.gravite,
        message: r.message,
        parametres: (r.parametres ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    bilan.cree += 1;
  }
  return bilan;
}

async function seedReglesAlerte(): Promise<Bilan> {
  const bilan: Bilan = { cree: 0, preserve: 0 };
  for (const r of ED_REGLES_ALERTE) {
    const existant = await prisma.edRegleAlerte.findUnique({ where: { code: r.code } });
    if (existant) {
      bilan.preserve += 1;
      continue;
    }
    await prisma.edRegleAlerte.create({
      data: {
        code: r.code,
        libelle: r.libelle,
        description: r.description,
        parametres: r.parametres as Prisma.InputJsonValue,
        gravite: r.gravite,
        actif: r.actif,
      },
    });
    bilan.cree += 1;
  }
  return bilan;
}

/**
 * Vérifie que la base porte bien ce que le plan annonce.
 *
 * Un seed qui se termine sans erreur mais laisse une règle de côté est
 * exactement le « témoin négatif qui ne vaut rien » du protocole : vert,
 * et ne gardant rien. On compte donc, et on refuse de mentir.
 */
async function verifier(): Promise<void> {
  const [comptes, conformite, alertes] = await Promise.all([
    prisma.edCompte.count(),
    prisma.edRegleConformite.count(),
    prisma.edRegleAlerte.count(),
  ]);

  const ecarts: string[] = [];
  if (comptes < ED_COMPTES_ATTENDUS) {
    ecarts.push(`comptes : ${comptes} en base pour ${ED_COMPTES_ATTENDUS} attendus`);
  }
  if (conformite < ED_REGLES_CONFORMITE_ATTENDUES) {
    ecarts.push(
      `règles de conformité : ${conformite} en base pour ${ED_REGLES_CONFORMITE_ATTENDUES} attendues`,
    );
  }
  if (alertes < ED_REGLES_ALERTE_ATTENDUES) {
    ecarts.push(
      `règles d'alerte : ${alertes} en base pour ${ED_REGLES_ALERTE_ATTENDUES} attendues`,
    );
  }
  if (ecarts.length > 0) {
    throw new Error(`[editorial:seed] amorçage incomplet —\n   - ${ecarts.join("\n   - ")}`);
  }
}

async function main(): Promise<void> {
  console.warn("🌱 [editorial:seed] amorçage des référentiels de la console éditoriale");

  // L'ordre compte : les comptes résolvent une marque, les specs une famille.
  const marques = await seedMarques();
  console.warn(ligne("marques", marques, ED_MARQUES.length));

  const comptes = await seedComptes();
  console.warn(ligne("comptes", comptes, ED_COMPTES.length));

  const familles = await seedFamilles();
  console.warn(ligne("familles d'assets", familles, ED_FAMILLES.length));

  const specs = await seedSpecs();
  console.warn(ligne("specs de plateforme", specs, ED_SPECS_PLATEFORME.length));

  const recettes = await seedRecettes();
  console.warn(
    ligne("recettes de dérivation", recettes, ED_RECETTES.length) +
      ` (${ED_RECETTES.reduce((n, r) => n + totalDerives(r), 0)} dérivés au total)`,
  );

  const conformite = await seedReglesConformite();
  console.warn(ligne("règles de conformité", conformite, ED_REGLES_CONFORMITE.length));

  const alertes = await seedReglesAlerte();
  console.warn(ligne("règles d'alerte", alertes, ED_REGLES_ALERTE.length));

  await verifier();

  console.warn(
    "✅ [editorial:seed] terminé.\n" +
      "   Piliers : 0 — la liste définitive est une décision ouverte du §14 (#4), lot 1.\n" +
      "   Calendrier du site : vide — décision §14 #2, le branchement content-gen viendra plus tard.",
  );
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

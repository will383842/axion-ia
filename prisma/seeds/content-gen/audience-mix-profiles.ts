/**
 * Seed AudienceMixProfile — 4 profils audience (§ 25 v1.7 + auto-pilot.md).
 *
 * Mix Json clé = "<CompanySize>:<OrganisationType>" — somme = 100 (validé Zod).
 * CompanySize valeurs MAJUSCULES (enum existant DB : TPE / PME / ETI / GRANDE_ENTREPRISE).
 *
 * "Mixte équilibré" isDefault=true (cf. auto-pilot.md § Défauts d'autorité v1.7).
 */

import type { PrismaClient } from "../../generated/client";

export async function seedAudienceMixProfiles(prisma: PrismaClient): Promise<number> {
  const rows = [
    {
      slug: "mixte-equilibre",
      name: "Mixte équilibré",
      description:
        "Profil défaut V1 — PME et TPE entreprise privée dominantes + écoles/universités/mairies/CSE équilibrés (§ 25 auto-pilot).",
      isDefault: true,
      mix: {
        "PME:entreprise_privee": 40,
        "TPE:entreprise_privee": 20,
        "ETI:entreprise_privee": 15,
        "PME:ecole": 5,
        "GRANDE_ENTREPRISE:universite": 5,
        "PME:mairie": 5,
        "PME:comite_entreprise": 5,
        "PME:autre": 5,
      },
    },
    {
      slug: "tertiaire-urbain",
      name: "Tertiaire urbain",
      description:
        "Concentration entreprises privées (TPE/PME/ETI) — secteurs services et tertiaires en zones urbaines.",
      isDefault: false,
      mix: {
        "PME:entreprise_privee": 50,
        "TPE:entreprise_privee": 25,
        "ETI:entreprise_privee": 20,
        "GRANDE_ENTREPRISE:entreprise_privee": 5,
      },
    },
    {
      slug: "industriel-regional",
      name: "Industriel régional",
      description:
        "ETI + GRANDE_ENTREPRISE industrielles + comités d'entreprise / CSE — orienté Auvergne-Rhône-Alpes, Grand-Est, Hauts-de-France.",
      isDefault: false,
      mix: {
        "ETI:entreprise_privee": 40,
        "GRANDE_ENTREPRISE:entreprise_privee": 30,
        "PME:entreprise_privee": 15,
        "ETI:comite_entreprise": 10,
        "GRANDE_ENTREPRISE:comite_entreprise": 5,
      },
    },
    {
      slug: "public-parapublic",
      name: "Public et parapublic",
      description:
        "Mairies / collectivités / hôpitaux / OPCO / établissements publics / associations.",
      isDefault: false,
      mix: {
        "PME:mairie": 25,
        "ETI:collectivite": 20,
        "ETI:hopital": 15,
        "PME:association": 15,
        "PME:opco": 10,
        "ETI:etablissement_public": 10,
        "PME:carsat": 5,
      },
    },
  ];

  let count = 0;
  for (const r of rows) {
    await prisma.audienceMixProfile.upsert({
      where: { slug: r.slug },
      create: r,
      update: r,
    });
    count++;
  }
  return count;
}

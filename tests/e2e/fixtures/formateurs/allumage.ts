// Banc @formateurs — ALLUMER le chantier pour un spec, comme la console l'aurait fait.
//
// ── Ce que la console écrit, et rien d'autre ────────────────────────────────
// Les valeurs posées sont celles des actes de la console, calculées par LEURS
// fonctions et jamais recopiées :
//   · un interrupteur : `valeurJson(cle, true)` (registre des seize),
//     `{ actif: true }` (registres signature et entrée), à la clé `cleSetting…` ;
//   · un texte validé : `{ valide: true, empreinte }` à la clé `cleDuTexte(t)`,
//     l'empreinte étant `empreinteDuTexte(t)` — exactement ce qu'écrit « Valider
//     tous les textes formateurs » (`validerTousTextesFormateursAction`).
// Et l'ordre d'allumage est VÉRIFIÉ : chaque clé est contrôlée par
// `prealablesManquants…` contre l'état déjà posé, comme au clic. Un ordre que
// la console refuserait fait échouer le banc ICI, en le disant.
//
// ── Plusieurs specs en parallèle ────────────────────────────────────────────
// Le banc tourne sur quatre workers. Si chaque spec posait puis RESTAURAIT ses
// interrupteurs, le premier qui finit éteindrait le chantier sous les pieds des
// autres. Les porteurs sont donc COMPTÉS dans une ligne `settings` dédiée, sous
// verrou consultatif Postgres : le premier porteur photographie l'état d'avant
// et allume ; le dernier qui part remet la photographie. Jamais d'état laissé.

import type { Prisma } from "../../../../prisma/generated/client/index.js";
import {
  cleSetting,
  cleSettingEntree,
  cleSettingSignature,
  etatsDepuisLignes,
  prealablesManquants,
  prealablesManquantsEntree,
  valeurJson,
  type CleInterrupteur,
  type CleInterrupteurEntree,
  type CleInterrupteurSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  cleDuTexte,
  empreinteDuTexte,
  TEXTES_FORMATEURS_A_VALIDER,
} from "@/server/email/textes-formateurs-a-valider";

import { prisma } from "./base";

/** Les seize, dans un ordre que la console accepte (chaque préalable avant sa fille). */
export const ALLUMES_FORMATEURS: readonly CleInterrupteur[] = [
  "textes_valides",
  "echange_ouvert",
  "invitation_auto",
  "dossier_en_ligne",
  "relances_auto",
];

export const ALLUMES_ENTREE: readonly CleInterrupteurEntree[] = [
  "nature_offre",
  "formulaire_freelance",
  "menu_freelance",
  "modeles_composeur",
  "ajout_console",
  "suivi_echange",
  "dossiers_contrats",
  "reponses_formateurs",
];

export const ALLUMES_SIGNATURE: readonly CleInterrupteurSignature[] = [];

/** Textes validés en plus de ceux de l'écran formateur (clé complète → valeur). */
export const TEXTES_HORS_ECRAN: Readonly<Record<string, Prisma.InputJsonValue>> = {};

const CLE_PORTEURS = "banc.formateurs.allumage";
/** Verrou consultatif du banc (constante arbitraire, propre au banc). */
const VERROU = 7_340_021;

/** L'offre « Formateur IA freelance » du banc — le slug que le code reconnaît. */
export const SLUG_OFFRE_BANC = "formateur-ia-freelance";

const OFFRE_BANC = {
  slug: SLUG_OFFRE_BANC,
  status: "published",
  category: "ia",
  natureCollaboration: "freelance",
  employmentType: "CONTRACTOR",
  // Une fourchette AFFICHÉE : sans la règle « formateur indépendant », Google
  // recevrait un `baseSalary` — c'est ce que le scénario E01 vérifie.
  salaryMin: 300,
  salaryMax: 600,
  salaryPeriod: "DAY",
  salaryVisible: true,
  publishedAt: new Date("2026-10-01T08:00:00.000Z"),
  titleFr: "Formateur IA freelance (banc d'essai)",
  titleEn: "Freelance AI trainer (test bench)",
  summaryFr: "Offre fictive du banc @formateurs.",
  summaryEn: "Fictitious offer of the @formateurs bench.",
  bodyFr: "<p>Offre fictive du banc.</p>",
  bodyTextFr: "Offre fictive du banc.",
  bodyEn: "<p>Fictitious bench offer.</p>",
  bodyTextEn: "Fictitious bench offer.",
} as const;

interface EtatPorteurs {
  /** L'offre du banc a été créée par le premier porteur (sinon elle existait). */
  readonly offreCreee?: boolean;
  readonly porteurs: string[];
  /** Valeur d'avant de chaque clé posée ; `null` = la ligne n'existait pas. */
  readonly avant: Record<string, Prisma.JsonValue | null>;
}

/** Les lignes à poser, dans l'ordre, après contrôle des préalables comme au clic. */
function lignesAPoser(): Array<{ key: string; value: Prisma.InputJsonValue }> {
  const lignes: Array<{ key: string; value: Prisma.InputJsonValue }> = [];
  const poses: Array<{ key: string; value: unknown }> = [];
  const etats = () => etatsDepuisLignes(poses);

  for (const cle of ALLUMES_FORMATEURS) {
    const manque = prealablesManquants(cle, true, etats(), {});
    if (manque.length > 0) {
      throw new Error(
        `banc @formateurs : la console refuserait « ${cle} » — ${manque.join(" ; ")}`,
      );
    }
    const ligne = { key: cleSetting(cle), value: valeurJson(cle, true) as Prisma.InputJsonValue };
    lignes.push(ligne);
    poses.push(ligne);
  }
  for (const cle of ALLUMES_ENTREE) {
    const manque = prealablesManquantsEntree(cle, true, etats());
    if (manque.length > 0) {
      throw new Error(
        `banc @formateurs : la console refuserait « ${cle} » — ${manque.join(" ; ")}`,
      );
    }
    lignes.push({ key: cleSettingEntree(cle), value: { actif: true } });
  }
  for (const cle of ALLUMES_SIGNATURE) {
    lignes.push({ key: cleSettingSignature(cle), value: { actif: true } });
  }
  for (const t of TEXTES_FORMATEURS_A_VALIDER) {
    lignes.push({ key: cleDuTexte(t), value: { valide: true, empreinte: empreinteDuTexte(t) } });
  }
  for (const [key, value] of Object.entries(TEXTES_HORS_ECRAN)) lignes.push({ key, value });
  return lignes;
}

async function sousVerrou<T>(f: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERROU})`;
      return f(tx);
    },
    { timeout: 30_000, maxWait: 30_000 },
  );
}

/**
 * Allume le chantier pour ce porteur ; rend la fonction qui le libère. Le
 * dernier porteur à partir remet l'état d'avant le premier.
 */
export async function allumerLeBanc(porteur: string): Promise<() => Promise<void>> {
  const lignes = lignesAPoser();
  await sousVerrou(async (tx) => {
    const brut = await tx.setting.findUnique({ where: { key: CLE_PORTEURS } });
    const etat = (brut?.value as unknown as EtatPorteurs | undefined) ?? null;
    if (etat === null || etat.porteurs.length === 0) {
      const existantes = await tx.setting.findMany({
        where: { key: { in: lignes.map((l) => l.key) } },
        select: { key: true, value: true },
      });
      const avant = Object.fromEntries(
        lignes.map((l) => [l.key, existantes.find((e) => e.key === l.key)?.value ?? null]),
      );
      for (const l of lignes) {
        await tx.setting.upsert({
          where: { key: l.key },
          create: { key: l.key, value: l.value, description: "banc @formateurs — allumage" },
          update: { value: l.value },
        });
      }
      const offre = await tx.jobOffer.findUnique({ where: { slug: SLUG_OFFRE_BANC } });
      if (offre === null) await tx.jobOffer.create({ data: OFFRE_BANC as never });
      const nouvel: EtatPorteurs = { porteurs: [porteur], avant, offreCreee: offre === null };
      await tx.setting.upsert({
        where: { key: CLE_PORTEURS },
        create: { key: CLE_PORTEURS, value: nouvel as never, description: "banc @formateurs" },
        update: { value: nouvel as never },
      });
    } else {
      await tx.setting.update({
        where: { key: CLE_PORTEURS },
        data: { value: { ...etat, porteurs: [...etat.porteurs, porteur] } as never },
      });
    }
  });

  return () =>
    sousVerrou(async (tx) => {
      const brut = await tx.setting.findUnique({ where: { key: CLE_PORTEURS } });
      if (brut === null) return;
      const etat = brut.value as unknown as EtatPorteurs;
      const restants = etat.porteurs.filter((p) => p !== porteur);
      if (restants.length > 0) {
        await tx.setting.update({
          where: { key: CLE_PORTEURS },
          data: { value: { ...etat, porteurs: restants } as never },
        });
        return;
      }
      for (const [key, valeur] of Object.entries(etat.avant)) {
        if (valeur === null) await tx.setting.deleteMany({ where: { key } });
        else await tx.setting.update({ where: { key }, data: { value: valeur as never } });
      }
      if (etat.offreCreee) {
        // Chaque spec a effacé ses candidatures : l'offre n'est plus référencée.
        await tx.jobOffer.deleteMany({ where: { slug: SLUG_OFFRE_BANC } });
      }
      await tx.setting.delete({ where: { key: CLE_PORTEURS } });
    });
}

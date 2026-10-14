// Banc @formateurs (missions) — les interrupteurs ALLUMÉS PAR LES ACTIONS DE LA CONSOLE.
//
// Chaque clé est basculée par l'action même de l'écran « Interrupteurs » (ou, pour
// les textes, par « Valider ce texte » de l'écran des gabarits), appelée par
// l'administrateur fictif du monde : les préalables sont donc vérifiés par le
// serveur, dans l'ordre d'allumage, et le journal porte ses lignes. Une clé que la
// console REFUSE fait échouer le banc — sauf la date de passage au paiement (voir
// `ECART_PASSAGE_PAIEMENT`).
//
// ── Partage entre fichiers ──────────────────────────────────────────────────
// Les specs tournent en parallèle et les interrupteurs sont GLOBAUX. Un compteur
// de porteurs (une ligne `settings` du banc, sous verrou consultatif) fait que :
//   · le premier porteur photographie TOUTES les lignes `formateurs.*`,
//     `signature.*`, `textes_valides.*` puis allume ;
//   · le dernier qui rend restaure la photographie à l'identique.
// Aucun fichier n'éteint donc ce qu'un autre utilise encore.

import type { Prisma } from "../../../../prisma/generated/client/index.js";

import { prisma } from "./base";
import type { AdminBanc, Pilote } from "./missions-pilote";

const ACTIONS = "@/server/actions/qualiopi/formateurs-interrupteurs";
const TEXTES = "@/server/email/textes-valides-actions";
const REGISTRE_TEXTES = "@/server/email/textes-formateurs-a-valider";

const CLE_PORTEURS = "banc.formateurs.missions.porteurs";
const VERROU = 774_201_309;
/** Un porteur plus vieux que ceci est un processus mort : on repart de zéro. */
const PORTEUR_PERIME_MS = 30 * 60_000;

/**
 * ÉCART AU PLAN (noté au rapport) : `formateurs.passage_paiement` a un préalable
 * « non lisible » (le canal de changement de compte bancaire n'existe pas) — la
 * console REFUSE de poser la date, par construction. `choix_cartes` et donc
 * `rang_suivant` en dépendent. Le banc constate le refus de la console, puis pose
 * la date en base, comme le fera la direction le jour où le canal existera.
 */
export const ECART_PASSAGE_PAIEMENT =
  "La console refuse la date de passage au paiement (préalable « canal de changement de compte » non lisible) : le banc la pose en base.";

/** L'ordre d'allumage (`docs/formateurs/ordre-d-allumage.md`). */
const ORDRE: ReadonlyArray<readonly [string, string]> = [
  ["formateurs.textes_valides", "basculerFormateursTextesValidesAction"],
  ["formateurs.reponses_formateurs", "basculerFormateursReponsesFormateursAction"],
  ["formateurs.dossier_en_ligne", "basculerFormateursDossierEnLigneAction"],
  ["formateurs.relances_auto", "basculerFormateursRelancesAutoAction"],
  ["formateurs.controle_registre_periodique", "basculerFormateursControleRegistrePeriodiqueAction"],
  ["formateurs.contrat_auto", "basculerFormateursContratAutoAction"],
  ["formateurs.nouvelle_version_contrat", "basculerFormateursNouvelleVersionContratAction"],
  ["formateurs.garde_mission_portes", "basculerFormateursGardeMissionPortesAction"],
  ["formateurs.affectation_sure", "basculerFormateursAffectationSureAction"],
  ["formateurs.lettre_v2", "basculerFormateursLettreV2Action"],
  ["formateurs.lettre_auto", "basculerFormateursLettreAutoAction"],
  ["formateurs.missions_console", "basculerFormateursMissionsConsoleAction"],
  ["signature.copie_partielle", "basculerSignatureCopiePartielleAction"],
  ["signature.exemplaire_captation", "basculerSignatureExemplaireCaptationAction"],
  ["formateurs.communes_geo_cron", "basculerFormateursCommunesGeoCronAction"],
  ["formateurs.proches_bloc", "basculerFormateursProchesBlocAction"],
  // Après la date de passage (cf. `ECART_PASSAGE_PAIEMENT`) :
  ["formateurs.choix_cartes", "basculerFormateursChoixCartesAction"],
  ["formateurs.rang_suivant", "basculerFormateursRangSuivantAction"],
];

interface Photo {
  readonly n: number;
  readonly depuis: number;
  readonly lignes: ReadonlyArray<{
    key: string;
    value: Prisma.JsonValue;
    description: string | null;
  }>;
}

function estPhoto(x: unknown): x is Photo {
  return x !== null && typeof x === "object" && typeof (x as Photo).n === "number";
}

/** Le 1er du mois courant (`AAAA-MM-01`) : toute session à venir est payée par mission. */
export function datePassagePaiement(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

type EtatBascule = { ok: true; message: string } | { ok: false; error: string };

async function basculer(
  pilote: Pilote,
  admin: AdminBanc,
  action: string,
  champs: Record<string, string>,
): Promise<EtatBascule> {
  return pilote.appeler<EtatBascule>(ACTIONS, action, [{}, { $formData: champs }], { admin });
}

/** Ce que la console a répondu à la date de passage (pour le constat de l'écart). */
export interface ConstatAllumage {
  readonly refusPassagePaiement: string | null;
}

async function allumerTout(pilote: Pilote, admin: AdminBanc): Promise<ConstatAllumage> {
  // 1. Les textes, par l'écran des gabarits (super-administrateur), empreinte comprise.
  const textes = await pilote.appeler<Array<{ gabarit: string; variante?: string }>>(
    "./missions-aides-serveur.ts",
    "textesFormateursAValider",
  );
  let refusPassagePaiement: string | null = null;
  for (const [cle, action] of ORDRE) {
    if (cle === "formateurs.choix_cartes") {
      const r = await basculer(pilote, admin, "basculerFormateursPassagePaiementAction", {
        date: datePassagePaiement(),
      });
      if (r.ok) {
        refusPassagePaiement = null;
      } else {
        refusPassagePaiement = r.error;
        await prisma.setting.upsert({
          where: { key: "formateurs.passage_paiement" },
          create: {
            key: "formateurs.passage_paiement",
            value: { date: datePassagePaiement() },
            description: "banc @formateurs — date posée en base (console : préalable non lisible)",
          },
          update: { value: { date: datePassagePaiement() } },
        });
      }
    }
    const r = await basculer(pilote, admin, action, { actif: "1" });
    if (!r.ok) throw new Error(`la console refuse d'allumer ${cle} : ${r.error}`);
    if (cle === "formateurs.textes_valides") {
      for (const t of textes) {
        const empreinte = await pilote.appeler<string | null>(
          REGISTRE_TEXTES,
          "empreinteAttendue",
          [
            await pilote.appeler<string>("@/server/email/textes-valides", "cleTexteValide", [
              t.gabarit,
              ...(t.variante !== undefined ? [t.variante] : []),
            ]),
          ],
        );
        const v = await pilote.appeler<EtatBascule>(
          TEXTES,
          "validerTexteEmailAction",
          [
            {
              gabarit: t.gabarit,
              ...(t.variante !== undefined ? { variante: t.variante } : {}),
              valide: true,
              ...(empreinte !== null ? { empreinte } : {}),
            },
          ],
          { admin },
        );
        if (!v.ok) throw new Error(`la console refuse de valider ${t.gabarit} : ${v.error}`);
      }
    }
  }
  return { refusPassagePaiement };
}

async function photographier() {
  return prisma.setting.findMany({
    where: {
      OR: [
        { key: { startsWith: "formateurs." } },
        { key: { startsWith: "signature." } },
        { key: { startsWith: "textes_valides." } },
      ],
    },
    select: { key: true, value: true, description: true },
  });
}

/**
 * Prend les interrupteurs (allumés par la console si personne ne les tient).
 * Rend le constat d'allumage du premier porteur, ou `null` s'ils étaient déjà tenus.
 */
export async function prendreInterrupteurs(
  pilote: Pilote,
  admin: AdminBanc,
): Promise<ConstatAllumage | null> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERROU})`;
      const ligne = await tx.setting.findUnique({ where: { key: CLE_PORTEURS } });
      const brute: unknown = ligne?.value;
      const actuelle = estPhoto(brute) ? brute : null;
      if (actuelle !== null && actuelle.n > 0 && Date.now() - actuelle.depuis < PORTEUR_PERIME_MS) {
        await tx.setting.update({
          where: { key: CLE_PORTEURS },
          data: { value: { ...actuelle, n: actuelle.n + 1, depuis: Date.now() } as never },
        });
        return null;
      }
      const lignes = actuelle?.lignes ?? (await photographier());
      const constat = await allumerTout(pilote, admin);
      const photo: Photo = { n: 1, depuis: Date.now(), lignes };
      await tx.setting.upsert({
        where: { key: CLE_PORTEURS },
        create: { key: CLE_PORTEURS, value: photo as never, description: "banc @formateurs" },
        update: { value: photo as never },
      });
      return constat;
    },
    { maxWait: 300_000, timeout: 300_000 },
  );
}

/** Rend les interrupteurs ; le dernier porteur restaure l'état d'avant. */
export async function rendreInterrupteurs(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERROU})`;
      const ligne = await tx.setting.findUnique({ where: { key: CLE_PORTEURS } });
      const photo: unknown = ligne?.value;
      if (!estPhoto(photo)) return;
      if (photo.n > 1) {
        await tx.setting.update({
          where: { key: CLE_PORTEURS },
          data: { value: { ...photo, n: photo.n - 1 } as never },
        });
        return;
      }
      await tx.setting.deleteMany({
        where: {
          OR: [
            { key: { startsWith: "formateurs." } },
            { key: { startsWith: "signature." } },
            { key: { startsWith: "textes_valides." } },
          ],
        },
      });
      for (const l of photo.lignes) {
        await tx.setting.create({
          data: { key: l.key, value: l.value as never, description: l.description },
        });
      }
      await tx.setting.delete({ where: { key: CLE_PORTEURS } });
    },
    { maxWait: 60_000, timeout: 60_000 },
  );
}

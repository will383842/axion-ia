// E40 — L'éditeur de réglages GÉNÉRAL ne touche pas aux clés du chantier, et un
// interrupteur ne s'allume pas sans ses préalables.
//
// Un `admin` tente, par `upsertSettingAction` / `deleteSettingAction`, d'écrire
// ou d'effacer `formateurs.passage_paiement` et `formateurs.textes_valides`
// (casse d'origine et casse changée), puis d'allumer `relances_auto` alors que
// `dossier_en_ligne` est coupé. On rend les réponses et les lignes en base.

import { deleteSettingAction, upsertSettingAction } from "@/features/admin-settings/actions";

import {
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  basculerParLaConsole,
  creerAdmin,
  menage,
  noterReglage,
  prisma,
  seConnecter,
} from "../donnees";

const CLES = ["formateurs.passage_paiement", "formateurs.textes_valides"] as const;

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

async function lignes() {
  const l = await prisma.setting.findMany({
    where: { key: { in: [...CLES, "formateurs.relances_auto", "formateurs.dossier_en_ligne"] } },
    select: { key: true, value: true },
  });
  return Object.fromEntries(l.map((x) => [x.key, x.value]));
}

export default async function e40(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      // État de départ : textes validés allumés, dossier en ligne COUPÉ.
      await allumerParLaConsole(direction, ["textes_valides"]);
      seConnecter(direction);
      const coupe = await basculerParLaConsole("dossier_en_ligne", false);
      for (const k of CLES) await noterReglage(k);
      await noterReglage("formateurs.relances_auto");
      const avant = await lignes();

      seConnecter(admin);
      const ecritures: Record<string, unknown> = {};
      for (const key of [...CLES, "Formateurs.Passage_Paiement", "FORMATEURS.TEXTES_VALIDES"]) {
        const valeur = key.toLowerCase().includes("passage")
          ? JSON.stringify({ date: "2026-11-01" })
          : JSON.stringify({ actif: true });
        ecritures[`ecrire ${key}`] = await upsertSettingAction(
          { ok: true },
          formulaire({ key, valueJson: valeur, description: "banc" }),
        );
        ecritures[`effacer ${key}`] = await deleteSettingAction({ ok: true }, formulaire({ key }));
      }
      // La direction elle-même ne passe pas par l'éditeur général.
      seConnecter(direction);
      const effacerDirection: Record<string, unknown> = {};
      for (const key of CLES) {
        effacerDirection[key] = await deleteSettingAction({ ok: true }, formulaire({ key }));
      }

      // Allumer `relances_auto` sans `dossier_en_ligne`.
      seConnecter(admin);
      const relances = await basculerParLaConsole("relances_auto", true);
      const apres = await lignes();
      const journal = await prisma.activityLog.count({
        where: { adminUserId: admin.id },
      });
      // Les interrupteurs sont globaux : d'autres specs du job peuvent les
      // bouger pendant ce scénario. La preuve qui ne dépend que de lui : aucune
      // ligne de réglage portant la signature de cet administrateur.
      const ecritesParAdmin = await prisma.setting.count({ where: { updatedBy: admin.id } });
      return {
        coupe,
        avant,
        ecritures,
        effacerDirection,
        relances,
        apres,
        journalAdmin: journal,
        ecritesParAdmin,
      };
    });
  } finally {
    await menage();
  }
}

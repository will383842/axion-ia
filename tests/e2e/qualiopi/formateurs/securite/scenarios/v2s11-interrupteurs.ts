// V2-S11 — Écrire un interrupteur hors de ses règles.
//
//   · rôles : un `admin` sur la clé réservée au super-administrateur
//     (`textes_valides`), un `editor` et un `reader` sur une clé de direction ;
//   · l'éditeur de réglages GÉNÉRAL sur les clés `signature.*` et
//     `textes_valides.*` (E40 a couvert `formateurs.*`) ;
//   · allumer sans ses préalables, clé par clé, dans les trois registres ;
//   · COURSE : couper une mère pendant qu'on allume sa fille (deux clics
//     simultanés, deux administrateurs). Invariant attendu : jamais une fille
//     allumée sous une mère coupée.
// Tout passe par les actions réelles de la console ; l'état d'avant est remis.

import { deleteSettingAction, upsertSettingAction } from "@/features/admin-settings/actions";
import * as I from "@/server/actions/qualiopi/formateurs-interrupteurs";

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
import { estAllume, formulaire } from "../v2s-outils";

type Etat = { ok: true; message: string } | { ok: false; error: string };
type Bascule = (prev: Etat, fd: FormData) => Promise<Etat>;
const action = (nom: string) => (I as unknown as Record<string, Bascule>)[nom]!;
const allumer = (nom: string, champs: Record<string, string> = { actif: "1" }) =>
  action(nom)({ ok: true, message: "" }, formulaire(champs));

const PROTEGEES = [
  "formateurs.dossier_en_ligne",
  "formateurs.relances_auto",
  "formateurs.echange_ouvert",
  "formateurs.suivi_echange",
  "formateurs.controle_registre_periodique",
  "formateurs.garde_mission_portes",
  "formateurs.affectation_sure",
  "formateurs.rang_suivant",
  "formateurs.contrat_auto",
  "formateurs.activation_auto",
  "formateurs.garde_activation",
  "formateurs.mise_a_niveau",
  "formateurs.passage_paiement",
  "formateurs.choix_cartes",
  "signature.copie_partielle",
  "signature.alertes_hors_jeton",
];

async function lire(key: string): Promise<boolean> {
  const l = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return estAllume(l?.value);
}

export default async function v2s11(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      for (const k of PROTEGEES) await noterReglage(k);
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      const editeur = await creerAdmin("editor");
      const lecteur = await creerAdmin("reader");

      // État de départ : textes validés allumés, tout le reste coupé.
      await allumerParLaConsole(direction, ["textes_valides"]);
      seConnecter(direction);
      for (const cle of [
        "relances_auto",
        "dossier_en_ligne",
        "suivi_echange",
        "echange_ouvert",
        "garde_mission_portes",
        "controle_registre_periodique",
        "activation_auto",
      ]) {
        await basculerParLaConsole(cle, false);
      }
      await allumer("basculerFormateursRangSuivantAction", { actif: "0" });
      await allumer("basculerFormateursAffectationSureAction", { actif: "0" });
      await allumer("basculerFormateursMiseANiveauAction", { actif: "0" });
      await allumer("basculerSignatureCopiePartielleAction", { actif: "0" });

      // ── Rôles ──────────────────────────────────────────────────────────
      const roles: Record<string, Etat> = {};
      seConnecter(admin);
      roles["admin coupe textes_valides"] = await basculerParLaConsole("textes_valides", false);
      seConnecter(editeur);
      roles["editor allume echange_ouvert"] = await basculerParLaConsole("echange_ouvert", true);
      roles["editor allume copie_partielle"] = await allumer(
        "basculerSignatureCopiePartielleAction",
      );
      seConnecter(lecteur);
      roles["reader allume controle_registre"] = await basculerParLaConsole(
        "controle_registre_periodique",
        true,
      );
      seConnecter(null);
      roles["sans session allume echange_ouvert"] = await basculerParLaConsole(
        "echange_ouvert",
        true,
      );

      // ── Éditeur de réglages général ──────────────────────────────────────
      const general: Record<string, unknown> = {};
      for (const [qui, compte] of [
        ["admin", admin],
        ["direction", direction],
      ] as const) {
        seConnecter(compte);
        for (const key of [
          "signature.copie_partielle",
          "Signature.Alertes_Hors_Jeton",
          "textes_valides.formateur-dossier-lien",
        ]) {
          general[`${qui} écrit ${key}`] = await upsertSettingAction(
            { ok: true },
            formulaire({ key, valueJson: JSON.stringify({ actif: true }), description: "banc" }),
          );
          general[`${qui} efface ${key}`] = await deleteSettingAction(
            { ok: true },
            formulaire({ key }),
          );
        }
      }

      // ── Préalables (sous la direction : seul le préalable peut refuser) ──
      seConnecter(direction);
      const prealables: Record<string, Etat> = {
        "suivi_echange sans echange_ouvert": await allumer("basculerFormateursSuiviEchangeAction"),
        "relances_auto sans dossier_en_ligne": await basculerParLaConsole("relances_auto", true),
        "garde_mission_portes sans controle_registre": await allumer(
          "basculerFormateursGardeMissionPortesAction",
        ),
        "rang_suivant sans portes ni affectation_sure": await allumer(
          "basculerFormateursRangSuivantAction",
        ),
        "mise_a_niveau sans dossier_en_ligne": await allumer("basculerFormateursMiseANiveauAction"),
        "activation_auto sans contrat_auto": await basculerParLaConsole("activation_auto", true),
        "garde_activation levée": await allumer("basculerFormateursGardeActivationAction", {
          actif: "0",
        }),
        "passage_paiement daté": await allumer("basculerFormateursPassagePaiementAction", {
          date: "2026-11-01",
        }),
        "choix_cartes sans date de passage": await allumer("basculerFormateursChoixCartesAction"),
      };
      const allumees = {
        suivi_echange: await lire("formateurs.suivi_echange"),
        relances_auto: await lire("formateurs.relances_auto"),
        garde_mission_portes: await lire("formateurs.garde_mission_portes"),
        rang_suivant: await lire("formateurs.rang_suivant"),
        mise_a_niveau: await lire("formateurs.mise_a_niveau"),
        activation_auto: await lire("formateurs.activation_auto"),
      };

      // ── Course : couper la mère pendant qu'on allume la fille ─────────────
      const essais = 10;
      let violations = 0;
      for (let i = 0; i < essais; i++) {
        seConnecter(direction);
        await basculerParLaConsole("dossier_en_ligne", true);
        await basculerParLaConsole("relances_auto", false);
        // Deux clics simultanés : l'un allume la fille, l'autre coupe la mère.
        await Promise.all([
          basculerParLaConsole("relances_auto", true),
          basculerParLaConsole("dossier_en_ligne", false),
        ]);
        const fille = await lire("formateurs.relances_auto");
        const mere = await lire("formateurs.dossier_en_ligne");
        if (fille && !mere) violations += 1;
      }
      seConnecter(direction);
      await basculerParLaConsole("relances_auto", false);
      await basculerParLaConsole("dossier_en_ligne", false);

      const ecritesParAdmin = await prisma.setting.count({
        where: { updatedBy: { in: [admin.id, editeur.id, lecteur.id] } },
      });
      return { roles, general, prealables, allumees, essais, violations, ecritesParAdmin };
    });
  } finally {
    await menage();
  }
}

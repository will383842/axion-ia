// V2-S05 — Le lien du dossier en ligne, rejoué.
//
// Liens fabriqués par le code du dépôt (`jetonDossierFormateur`), lus par la
// lecture que la page appelle (`lireDossierParLien`) et éprouvés en écriture par
// l'action du formulaire : échu (horloge passée en paramètre), altéré, d'une
// version d'accès dépassée, d'un autre domaine signé (le lien de réservation),
// identifiant en majuscules. Témoin : le lien courant s'ouvre.

// eslint-disable-next-line no-restricted-imports
import { enregistrerVousAction } from "@/app/formateur/dossier/[id]/[jeton]/actions";
import { lireDossierParLien } from "@/server/qualiopi/formateurs-independants/dossier";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import { jetonReservationFormateur } from "@/server/qualiopi/formateurs-independants/jeton-reservation";

import {
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
} from "../donnees";
import { formulaire, issue } from "../v2s-outils";

export default async function v2s05(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne"]);
      const maintenant = new Date();
      const t = await creerIndependant({ dossierStatut: "a_completer", accesVersion: 1 } as never);
      const ouvre = async (id: string, jeton: string, quand: Date = new Date()) =>
        (await lireDossierParLien(id, jeton, quand)) !== null;
      const ecrit = async (id: string, jeton: string) =>
        issue(() =>
          enregistrerVousAction(
            formulaire({ id, jeton, telephone: "0612345678", codePostal: "69002" }),
          ),
        );

      const courant = jetonDossierFormateur(t.id, 1, maintenant) ?? "";
      const ancien = jetonDossierFormateur(t.id, 0, maintenant) ?? "";
      const [exp = "", sig = ""] = courant.split(".");
      const sigAlteree = `${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
      // Le lien de réservation de l'échange, signé pour le même identifiant.
      const reservation = (jetonReservationFormateur(t.id, maintenant) ?? "")
        .split(".")
        .slice(1)
        .join(".");

      const r = {
        temoin: await ouvre(t.id, courant),
        echu: await ouvre(t.id, courant, new Date(maintenant.getTime() + 31 * 86_400_000)),
        altere: await ouvre(t.id, `${exp}.${sigAlteree}`),
        prolonge: await ouvre(t.id, `${Number(exp) + 86_400_000}.${sig}`),
        versionDepassee: await ouvre(t.id, ancien),
        autreDomaine: await ouvre(t.id, reservation),
        majuscules: await ouvre(t.id.toUpperCase(), courant),
        ecritureVersionDepassee: await ecrit(t.id, ancien),
        ecritureEchue: await ecrit(t.id, jetonDossierFormateur(t.id, 1, new Date(0)) ?? ""),
      };
      const telephoneApres = (
        await prisma.trainer.findUniqueOrThrow({ where: { id: t.id }, select: { telephone: true } })
      ).telephone;
      return { r, telephoneAvant: t.telephone, telephoneApres };
    });
  } finally {
    await menage();
  }
}

// E-D3 — Le journal d'activité ne porte AUCUNE valeur personnelle (nom,
// prénom, e-mail, téléphone, adresse, IBAN) d'un formateur indépendant.
//
// Le scénario fait vivre une fiche par les vrais gestes, de la console ET de
// l'espace du formateur : interrupteurs, textes validés, dossier rempli par le
// lien (téléphone, code postal), demandes de changement d'adresse et d'IBAN et
// leur validation, pièce saisie, changement d'e-mail, activation, fin de
// collaboration, effacement RGPD. Puis il rend TOUTES les lignes du journal
// écrites pendant le scénario qui touchent ces fiches ou ces administrateurs,
// et les valeurs personnelles semées — le spec cherche les unes dans les autres.

import { signFormateurSession } from "@/lib/formateur-session";
// eslint-disable-next-line no-restricted-imports
import { enregistrerVousAction } from "@/app/formateur/dossier/[id]/[jeton]/actions";
// eslint-disable-next-line no-restricted-imports
import {
  demanderChangementAdresseAction,
  demanderChangementIbanAction,
} from "@/app/[locale]/espace-formateur/dossier/actions";
import { terminerCollaborationFormateurAction } from "@/server/actions/qualiopi/formateur-fin-collaboration";
import { validerChangementAction } from "@/server/actions/qualiopi/formateur-changements";
import { effacerFormateurIndependantAction } from "@/server/actions/qualiopi/rgpd-formateur-independant";
import { createTrainerDocumentAction } from "@/server/actions/qualiopi/trainer-documents";
import { setTrainerActifAction, updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import {
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";

import { poserCookie } from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";
import {
  adresse,
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  jourDeParis,
  menage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
} from "../donnees";

/** Rend l'issue d'un geste : sa valeur, ou l'adresse de sa redirection Next. */
async function issue(f: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await f());
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2] ?? digest;
    }
    return `leve: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

export default async function ed3(): Promise<unknown> {
  const t0 = new Date();
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      await allumerParLaConsole(direction, [
        "textes_valides",
        "dossier_en_ligne",
        "changement_coordonnees",
        "fin_collaboration",
      ]);
      await validerTextesParLaConsole(direction, [{ gabarit: "formateur-email-modifie" }]);

      const t = await creerIndependant({
        actif: false,
        dossierStatut: "a_completer",
        sousTraitantVerifieAt: new Date(Date.now() - 86_400_000),
        sousTraitantNda: "84691234569",
      } as never);
      const nouveauTelephone = "0611223344";
      const nouvelleAdresse = `42 avenue Banc-Sécu-${t.id.slice(0, 6)} 13001 Marseille`;
      const iban = "FR7630006000011234567890189";
      const gestes: Record<string, string> = {};

      // ── Le formateur, par son lien de dossier puis par son espace ───────
      const jeton = jetonDossierFormateur(t.id, 0, new Date()) ?? "";
      gestes["dossier_vous"] = await issue(() =>
        enregistrerVousAction(
          formulaire({ id: t.id, jeton, telephone: nouveauTelephone, codePostal: "13001" }),
        ),
      );
      await prisma.trainer.update({ where: { id: t.id }, data: { actif: true } });
      poserCookie(
        FORMATEUR_COOKIE_NAME,
        await signFormateurSession(
          t.id,
          "formateur",
          undefined,
          versionSessionFormateur({ finCollaborationAt: null }),
          empreinteSessionFormateur(t.email) ?? undefined,
        ),
      );
      gestes["demande_adresse"] = await issue(() =>
        demanderChangementAdresseAction(formulaire({ adresse: nouvelleAdresse })),
      );
      gestes["demande_iban"] = await issue(() =>
        demanderChangementIbanAction(formulaire({ iban })),
      );
      poserCookie(FORMATEUR_COOKIE_NAME, null);
      await prisma.trainer.update({ where: { id: t.id }, data: { actif: false } });

      // ── La console ───────────────────────────────────────────────────────
      seConnecter(direction);
      for (const d of await prisma.demandeChangementFormateur.findMany({
        where: { trainerId: t.id },
        select: { id: true },
      })) {
        gestes[`valider_${d.id.slice(0, 4)}`] = await issue(() =>
          validerChangementAction(formulaire({ demandeId: d.id })),
        );
      }
      gestes["piece"] = await issue(() =>
        createTrainerDocumentAction({
          trainerId: t.id,
          type: "kbis_avis_sirene",
          dateEmission: jourDeParis(new Date(Date.now() - 86_400_000)),
          notes: "Pièce reçue par courrier.",
        }),
      );
      const ancienneAdresseEmail = t.email;
      const nouvelEmail = adresse("nouvelle");
      gestes["changer_email"] = await issue(() =>
        updateTrainerAction({ id: t.id, email: nouvelEmail }),
      );
      await creerPieceASigner(t.id, "contrat_sous_traitance", "signee");
      seConnecter(admin);
      gestes["activer"] = await issue(() => setTrainerActifAction({ id: t.id, actif: true }));
      gestes["fin"] = await issue(() =>
        terminerCollaborationFormateurAction({
          trainerId: t.id,
          motif: "initiative_formateur",
          dateEffet: jourDeParis(new Date(Date.now() + 40 * 86_400_000)),
          note: "Départ à l'initiative du formateur.",
          envoyerEmail: false,
        } as never),
      );
      seConnecter(direction);
      gestes["rgpd"] = await issue(() =>
        effacerFormateurIndependantAction({ trainerId: t.id, confirmation: "EFFACER" }),
      );

      const lignes = await prisma.activityLog.findMany({
        where: {
          createdAt: { gte: t0 },
          OR: [
            { targetId: t.id },
            { adminUserId: { in: [direction.id, admin.id] } },
            { changes: { path: ["trainerId"], equals: t.id } },
          ],
        },
        select: { action: true, targetType: true, changes: true },
        orderBy: { createdAt: "asc" },
      });
      // Le ménage des demandes de changement (elles pendent à la fiche).
      await prisma.demandeChangementFormateur.deleteMany({ where: { trainerId: t.id } });
      await prisma.emailLog.deleteMany({
        where: { recipient: { in: [ancienneAdresseEmail, nouvelEmail] } },
      });
      return {
        gestes,
        lignes,
        personnelles: {
          nom: t.nom,
          prenom: t.prenom,
          email: ancienneAdresseEmail,
          nouvelEmail,
          telephone: t.telephone,
          nouveauTelephone,
          adresse: t.adresse,
          nouvelleAdresse,
          iban,
        },
      };
    });
  } finally {
    poserCookie(FORMATEUR_COOKIE_NAME, null);
    await menage();
  }
}

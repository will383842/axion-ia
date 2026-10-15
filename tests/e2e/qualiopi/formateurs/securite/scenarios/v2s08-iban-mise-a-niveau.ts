// V2-S08 — Un indépendant ACTIF (stock d'avant le contrôle) a déjà un IBAN, celui
// des virements. La console lui envoie son dossier de mise à niveau ; par ce lien,
// un nouvel IBAN est saisi. Attendu : le compte des virements ne change pas sans le
// circuit « changement de compte » (demande, avis F43, 48 h, accord) — ou, à défaut,
// le virement suivant est suspendu.
//
// Tout passe par les vraies actions : interrupteurs et texte par la console, envoi
// du dossier par l'action de mise à niveau, saisie par l'action du dossier en ligne.
// Seule la liste « figée » est posée sur la seule fiche du banc (la figer par
// l'action listerait toute la base du job).

import { encryptPii } from "@/lib/pii-crypto";
import { empreinteIban } from "@/lib/iban-empreinte";
// eslint-disable-next-line no-restricted-imports
import { enregistrerActiviteAction } from "@/app/formateur/dossier/[id]/[jeton]/actions";
import {
  basculerFormateursChangementCoordonneesAction,
  basculerFormateursMiseANiveauAction,
} from "@/server/actions/qualiopi/formateurs-interrupteurs";
import { envoyerDossierMiseANiveauAction } from "@/server/actions/qualiopi/formateur-contrat-cadre";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import {
  demanderChangementIban,
  validerDemandeChangement,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { contexteVirementMission } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission-base";

import {
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  noterReglage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
} from "../donnees";
import { formulaire } from "../v2s-outils";

/** IBAN fictifs, de clé valide (exemples publics). */
const ANCIEN = "FR7630006000011234567890189";
const NOUVEAU = "DE89370400440532013000";

async function motifsVirement(trainerId: string, maintenant: Date): Promise<unknown> {
  const t = await prisma.trainer.findUniqueOrThrow({
    where: { id: trainerId },
    select: { ibanEmpreinte: true },
  });
  // Le virement d'une mission échue, tel que « Virements à faire » le jugerait
  // avec l'IBAN affiché à l'instant.
  const ctx = await contexteVirementMission(
    prisma as never,
    {
      trainerId,
      echeanceAt: new Date(maintenant.getTime() - 86_400_000),
      totalTtcCents: 10_000,
      sessionId: null,
      periodeYear: maintenant.getUTCFullYear(),
      periodeMonth: maintenant.getUTCMonth() + 1,
      dateFacture: new Date(maintenant.getTime() - 31 * 86_400_000),
      objets: ["animation"],
    },
    t.ibanEmpreinte,
    maintenant,
  ).catch((e: unknown) => ({ erreur: e instanceof Error ? e.name : "erreur" }));
  return "verdict" in ctx ? ctx.verdict.motifs : ctx;
}

async function avecIban(t: { id: string }, iban: string): Promise<void> {
  await prisma.trainer.update({
    where: { id: t.id },
    data: {
      iban: encryptPii(iban, { aad: `trainer:${t.id}:iban`, cleExigee: true }),
      ibanEmpreinte: empreinteIban(iban),
    },
  });
}

export default async function v2s08(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const maintenant = new Date();
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne"]);
      await validerTextesParLaConsole(direction, [{ gabarit: "formateur-dossier-lien" }]);
      await noterReglage("formateurs.mise_a_niveau");
      seConnecter(direction);
      const allumage = await basculerFormateursMiseANiveauAction(
        { ok: true, message: "" },
        formulaire({ actif: "1" }),
      );

      const t = await creerIndependant({
        actif: true,
        estFormateur: true,
        siret: "73282932000074",
      });
      await avecIban(t, ANCIEN);
      await prisma.trainer.update({
        where: { id: t.id },
        data: { miseANiveauListeeAt: new Date(maintenant.getTime() - 86_400_000) },
      });

      seConnecter(direction);
      const envoi = await envoyerDossierMiseANiveauAction({ trainerId: t.id });
      const fiche = await prisma.trainer.findUniqueOrThrow({
        where: { id: t.id },
        select: { accesVersion: true, dossierStatut: true },
      });
      const jeton = jetonDossierFormateur(t.id, fiche.accesVersion, new Date()) ?? "";
      seConnecter(null);
      const saisie = await enregistrerActiviteAction(
        formulaire({
          id: t.id,
          jeton,
          siret: "73282932000074",
          nda: "84691234569",
          regimeTva: "franchise_293b",
          iban: NOUVEAU,
        }),
      );

      const apres = await prisma.trainer.findUniqueOrThrow({
        where: { id: t.id },
        select: { ibanEmpreinte: true },
      });
      const avisF43 = await prisma.emailLog.count({
        where: { recipient: t.email, template: "formateur-iban-changement" },
      });
      const demandes = await prisma.demandeChangementFormateur.count({
        where: { trainerId: t.id },
      });
      const motifsApres = await motifsVirement(t.id, new Date());

      // Le circuit prévu, sur une autre fiche active : demande depuis l'espace,
      // virement suspendu pendant l'attente, accord refusé avant 48 h.
      await validerTextesParLaConsole(direction, [
        { gabarit: "formateur-iban-changement" },
        { gabarit: "formateur-iban-valide" },
      ]);
      await noterReglage("formateurs.changement_coordonnees");
      seConnecter(direction);
      const circuit = await basculerFormateursChangementCoordonneesAction(
        { ok: true, message: "" },
        formulaire({ actif: "1" }),
      );
      const c = await creerIndependant({ actif: true });
      await avecIban(c, ANCIEN);
      const t0 = new Date();
      const demande = await demanderChangementIban(c.id, NOUVEAU, t0);
      const enAttente = await prisma.demandeChangementFormateur.findFirstOrThrow({
        where: { trainerId: c.id },
        select: { id: true },
      });
      const motifsPendantAttente = await motifsVirement(c.id, new Date(t0.getTime() + 3_600_000));
      const accordTropTot = await validerDemandeChangement({
        demandeId: enAttente.id,
        adminId: direction.id,
        maintenant: new Date(t0.getTime() + 47 * 3_600_000),
      });
      const ibanPendantAttente = (
        await prisma.trainer.findUniqueOrThrow({
          where: { id: c.id },
          select: { ibanEmpreinte: true },
        })
      ).ibanEmpreinte;
      await prisma.demandeChangementFormateur.deleteMany({ where: { trainerId: c.id } });

      return {
        allumage,
        envoi,
        dossierStatut: fiche.dossierStatut,
        saisie,
        ibanChange: apres.ibanEmpreinte !== empreinteIban(ANCIEN),
        ibanEstLeNouveau: apres.ibanEmpreinte === empreinteIban(NOUVEAU),
        demandes,
        avisF43,
        motifsApres,
        circuit,
        demande,
        motifsPendantAttente,
        accordTropTot,
        ibanInchangePendantAttente: ibanPendantAttente === empreinteIban(ANCIEN),
        adresses: [t.email, c.email],
      };
    });
  } finally {
    await menage();
  }
}

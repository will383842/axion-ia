/**
 * Espace formateur — UNE mission (lots L11b-ux et L11h, écrans F-8 et F-15).
 *
 * Proposition : six lignes (formation, journées, lieu, honoraires,
 * déplacement, réponse avant), la phrase de liberté, deux boutons de même
 * taille. Mission acceptée, avant le début : « Je ne peux plus assurer cette
 * mission » (sans pénalité). Sinon : pourquoi elle en est là, et quoi faire.
 *
 * 🔑 Interrupteur `formateurs.choix_cartes` coupé : la page n'existe pas
 * (404), l'espace reste exactement celui d'avant.
 *
 * 🔴 Un formateur ne voit que SES missions : la lecture filtre par
 * `trainerId` de la session ; la mission d'un autre répond comme une mission
 * inconnue (404).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireFormateur } from "@/server/formateur/guard";
import { prisma } from "@/lib/prisma";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { lirePropositionChiffree } from "@/server/qualiopi/formateurs-independants/proposition-chiffree";
import {
  MOTIF_REFUS_MIN,
  STATUTS_ACCORD_DONNE,
  refusLibrePour,
} from "@/server/qualiopi/trainers/mission-formateur";
import { MissionReponseForm } from "@/components/espace-formateur/MissionReponseForm";
import { PropositionSixLignes } from "@/components/espace-formateur/PropositionSixLignes";
import { DesistementForm } from "@/components/espace-formateur/DesistementForm";
import { TEXTE_STATUT_MISSION } from "@/components/espace-formateur/mission-copy";
import type { MissionFormateurStatut } from "../../../../../../prisma/generated/client";

import { CoquilleFormateur } from "../../_coquille";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ma mission — Axion-IA",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  if (!(await interrupteurAllume("choix_cartes"))) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const mission = await prisma.missionFormateur.findFirst({
    where: { id, trainerId },
    select: {
      id: true,
      statut: true,
      echeanceReponseAt: true,
      session: { select: { titreSession: true, dateDebut: true, statut: true } },
    },
  });
  if (mission === null) notFound();

  const maintenant = new Date();
  const avantLeDebut =
    mission.session.statut === "planifiee" &&
    mission.session.dateDebut.getTime() > maintenant.getTime();
  const delaiDepasse =
    mission.echeanceReponseAt !== null &&
    mission.echeanceReponseAt.getTime() <= maintenant.getTime();
  const enAttente = mission.statut === "en_attente" && avantLeDebut && !delaiDepasse;
  const accordDonne = (STATUTS_ACCORD_DONNE as ReadonlyArray<MissionFormateurStatut>).includes(
    mission.statut,
  );
  const [proposition, refusLibre, desistementOuvert] = await Promise.all([
    lirePropositionChiffree(mission.id),
    enAttente ? refusLibrePour(trainerId) : Promise.resolve(false),
    accordDonne && avantLeDebut ? interrupteurAllume("rang_suivant") : Promise.resolve(false),
  ]);
  const texte = TEXTE_STATUT_MISSION[mission.statut];

  return (
    <CoquilleFormateur section="accueil">
      <Link href={FORMATEUR_BASE_PATH} className="text-terracotta text-sm hover:underline">
        ← À faire
      </Link>
      <h1 className="text-mocha mt-3 font-serif text-2xl font-semibold">
        {enAttente ? "Proposition de mission" : mission.session.titreSession}
      </h1>

      <div className="mt-6 space-y-6">
        {proposition !== null ? (
          <PropositionSixLignes
            proposition={proposition}
            echeance={enAttente ? mission.echeanceReponseAt : null}
          />
        ) : null}

        {enAttente ? (
          // La phrase de liberté est dite par le formulaire (refus libre).
          <MissionReponseForm
            cible={{ missionId: mission.id }}
            resume="Acceptez-vous cette mission ?"
            motifMin={MOTIF_REFUS_MIN}
            refusLibre={refusLibre}
            grandsBoutons
          />
        ) : (
          <div role="status" className="border-border rounded-lg border p-4">
            <p className="text-mocha text-sm font-semibold">
              {mission.statut === "en_attente" && delaiDepasse
                ? TEXTE_STATUT_MISSION.sans_reponse.pourquoi
                : texte.pourquoi}
            </p>
            <p className="text-fg-soft mt-1 text-sm">
              {mission.statut === "en_attente" && delaiDepasse
                ? TEXTE_STATUT_MISSION.sans_reponse.quoiFaire
                : texte.quoiFaire}
            </p>
          </div>
        )}

        {desistementOuvert ? <DesistementForm missionId={mission.id} /> : null}
      </div>
    </CoquilleFormateur>
  );
}

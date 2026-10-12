/**
 * Espace formateur — UNE mission (lots L11b-ux et L11h, écrans F-8 et F-15),
 * rendue par l'accueil (`/espace-formateur?mission=<id>`) : aucune route de
 * plus, aucun JavaScript (formulaires serveur).
 *
 * Proposition : six lignes (formation, journées, lieu, honoraires,
 * déplacement, réponse avant), la phrase de liberté, deux boutons de même
 * taille. Mission acceptée, avant le début : « Je ne peux plus assurer cette
 * mission » (sans pénalité). Sinon : pourquoi elle en est là, et quoi faire.
 *
 * 🔴 Un formateur ne voit que SES missions : la lecture filtre par le
 * `trainerId` de la session connectée ; la mission d'un autre répond comme
 * une mission inconnue (404).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { lirePropositionChiffree } from "@/server/qualiopi/formateurs-independants/proposition-chiffree";
import {
  MOTIF_REFUS_MIN,
  STATUTS_ACCORD_DONNE,
  refusLibrePour,
} from "@/server/qualiopi/trainers/mission-formateur";
import { PropositionSixLignes } from "./PropositionSixLignes";
import {
  repondreDepuisFormulaireAction,
  seDesisterDepuisFormulaireAction,
} from "@/server/actions/qualiopi/choix-formateur";
import {
  CHOIX_MOTIF_REFUS_LIBRE,
  DESISTEMENT,
  PHRASE_LIBERTE,
  QUESTION_REFUS_LIBRE,
  REPONSE_ENREGISTREE,
  SUITE_APRES_REPONSE,
  TEXTE_STATUT_MISSION,
} from "./mission-copy";
import type { MissionFormateurStatut } from "../../../prisma/generated/client";

export interface ParametresVueMission {
  readonly fait?: string;
  readonly erreur?: string;
  readonly reponse?: string;
}

export async function VueMission({
  trainerId,
  id,
  sp,
}: {
  trainerId: string;
  id: string;
  sp: ParametresVueMission;
}): Promise<React.ReactElement> {
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
    <>
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
          // Formulaire HTML sans JavaScript (écran F-8) : deux boutons de même
          // taille, le motif d'un refus reste facultatif (refus libre) ou est
          // demandé comme avant (interrupteur `formateurs.affectation_sure`).
          // Deux formulaires : la touche Entrée dans le volet du motif ne peut
          // soumettre que le refus, jamais « J'accepte ». Le bouton du refus est
          // rattaché à son formulaire par l'attribut `form` (sans JavaScript).
          <div className="space-y-4">
            <p className="text-mocha text-sm">{PHRASE_LIBERTE}</p>
            <div className="grid grid-cols-2 gap-3">
              <form action={repondreDepuisFormulaireAction}>
                <input type="hidden" name="missionId" value={mission.id} />
                <input type="hidden" name="reponse" value="acceptee" />
                <button
                  type="submit"
                  className="bg-terracotta inline-flex min-h-[48px] w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white hover:opacity-90"
                >
                  J&apos;accepte
                </button>
              </form>
              <button
                type="submit"
                form={`mission-refus-${mission.id}`}
                className="border-border text-mocha hover:bg-sand inline-flex min-h-[48px] w-full items-center justify-center rounded-md border px-4 text-sm font-semibold"
              >
                Je ne suis pas disponible
              </button>
            </div>
            <form id={`mission-refus-${mission.id}`} action={repondreDepuisFormulaireAction}>
              <input type="hidden" name="missionId" value={mission.id} />
              <input type="hidden" name="reponse" value="refusee" />
              <details className="border-border rounded-lg border p-4">
                <summary className="text-mocha cursor-pointer text-sm">
                  {QUESTION_REFUS_LIBRE}{" "}
                  <span className="text-fg-muted">
                    {refusLibre
                      ? "(facultatif)"
                      : `(si vous refusez, ${MOTIF_REFUS_MIN} caractères au moins)`}
                  </span>
                </summary>
                <fieldset className="mt-3 flex flex-wrap gap-2">
                  <legend className="sr-only">{QUESTION_REFUS_LIBRE}</legend>
                  {CHOIX_MOTIF_REFUS_LIBRE.map((c) => (
                    <label
                      key={c}
                      className="border-border text-mocha inline-flex min-h-[48px] items-center gap-2 rounded-md border px-4 text-sm"
                    >
                      <input type="radio" name="choix" value={c} />
                      {c}
                    </label>
                  ))}
                </fieldset>
                <label
                  htmlFor="mission-motif"
                  className="text-mocha mt-3 block text-sm font-medium"
                >
                  Un mot si vous le souhaitez
                </label>
                <textarea
                  id="mission-motif"
                  name="motif"
                  rows={2}
                  maxLength={1960}
                  className="border-border w-full rounded-md border px-3 py-2 text-sm"
                />
              </details>
            </form>
          </div>
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

        {sp.reponse === "refusee" && mission.statut === "refusee" ? (
          <p role="status" className="text-mocha text-base font-semibold">
            {REPONSE_ENREGISTREE}
          </p>
        ) : null}
        {sp.reponse === "acceptee" && accordDonne ? (
          <p role="status" className="text-mocha text-base font-semibold">
            {SUITE_APRES_REPONSE.acceptee.titre}
          </p>
        ) : null}
        {sp.erreur === "reponse" ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {refusLibre
              ? "Votre réponse n'a pas pu être enregistrée : rechargez la page."
              : `Votre réponse n'a pas pu être enregistrée. Si vous refusez, indiquez le motif (${MOTIF_REFUS_MIN} caractères au moins).`}
          </p>
        ) : null}
        {sp.erreur === "1" ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            Votre réponse n&apos;a pas pu être enregistrée : appelez-nous ou écrivez-nous.
          </p>
        ) : null}
        {sp.fait === "1" && mission.statut === "desistee" ? (
          <p role="status" className="text-mocha text-base font-semibold">
            {DESISTEMENT.fait}
          </p>
        ) : null}
        {desistementOuvert ? (
          // Formulaire HTML sans JavaScript (écran F-15) : rien de plus à charger.
          <details className="border-border rounded-lg border p-4">
            <summary className="text-mocha flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">
              {DESISTEMENT.bouton}
            </summary>
            <form action={seDesisterDepuisFormulaireAction} className="mt-3 space-y-3">
              <input type="hidden" name="missionId" value={mission.id} />
              <label htmlFor="desistement-motif" className="text-mocha block text-sm font-medium">
                {DESISTEMENT.question} <span className="text-fg-muted">(facultatif)</span>
              </label>
              <textarea
                id="desistement-motif"
                name="motif"
                rows={2}
                maxLength={1400}
                className="border-border w-full rounded-md border px-3 py-2 text-sm"
              />
              <label
                htmlFor="desistement-remplacant"
                className="text-mocha block text-sm font-medium"
              >
                {DESISTEMENT.remplacant} <span className="text-fg-muted">(facultatif)</span>
              </label>
              <input
                id="desistement-remplacant"
                name="remplacant"
                type="text"
                maxLength={500}
                className="border-border w-full rounded-md border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="bg-terracotta inline-flex min-h-[48px] w-full items-center justify-center rounded-md px-5 text-sm font-semibold text-white hover:opacity-90"
              >
                {DESISTEMENT.envoyer}
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </>
  );
}

/**
 * Espace formateur — réponse à une proposition de mission par le LIEN de
 * l'e-mail (2026-09-03).
 *
 * Aucune connexion requise : le jeton `formateur_mission` désigne UNE
 * sollicitation et vaut identité pour ce seul geste — même doctrine que le
 * lien d'émargement du stagiaire. La page ne montre que ce que l'e-mail
 * disait déjà (titre, dates, modalité, lieu résumé, effectif) : aucune donnée
 * de stagiaire, aucune information d'accès — celles-ci viennent à J-7, une
 * fois la mission acceptée.
 *
 * Un jeton faux, expiré, ou une proposition déjà répondue ou retirée : la page
 * le DIT, elle ne renvoie pas un 404 muet qui ferait croire à une panne.
 */

import Link from "next/link";
import type { Metadata } from "next";

import {
  lireMissionParJeton,
  LIBELLE_STATUT_MISSION,
  MOTIF_REFUS_MIN,
} from "@/server/qualiopi/trainers/mission-formateur";
import { MissionReponseForm } from "@/components/espace-formateur/MissionReponseForm";
import { SUITE_APRES_REPONSE } from "@/components/espace-formateur/mission-copy";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { ROLE_FORMATEUR_LABELS, MODALITE_LABELS } from "@/server/formateur/collectif-labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposition de mission — Axion-IA",
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  const mission = await lireMissionParJeton(token);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-fg-muted text-xs tracking-wide uppercase">Espace formateur</p>
      <h1 className="text-mocha mt-1 font-serif text-2xl font-semibold">Proposition de mission</h1>

      {mission === null ? (
        <div className="border-border mt-6 rounded-lg border p-4">
          <p className="text-mocha text-sm font-semibold">Ce lien n&apos;est plus valide.</p>
          <p className="text-fg-soft mt-1 text-sm">
            Il a expiré, ou la proposition a été retirée. Si vous pensez que c&apos;est une erreur,
            connectez-vous à votre espace : vos propositions en attente y figurent.
          </p>
          <Link
            href={FORMATEUR_CONNEXION_PATH}
            className="text-terracotta mt-3 inline-block text-sm hover:underline"
          >
            Me connecter à mon espace
          </Link>
        </div>
      ) : (
        <>
          <p className="text-fg-soft mt-2 text-sm">
            Bonjour {mission.trainer.prenom} {mission.trainer.nom} — vous êtes sollicité comme{" "}
            {ROLE_FORMATEUR_LABELS[mission.role].toLowerCase()}.
          </p>

          <dl className="border-border mt-6 grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                Formation
              </dt>
              <dd className="text-mocha mt-1 text-sm font-semibold">
                {mission.session.titreSession}{" "}
                <span className="text-fg-muted font-normal">· {mission.session.numero}</span>
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Dates</dt>
              <dd className="text-mocha mt-1 text-sm">
                Du {dateFmt.format(mission.session.dateDebut)}
                <br />
                au {dateFmt.format(mission.session.dateFin)}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                Modalité
              </dt>
              <dd className="text-mocha mt-1 text-sm">
                {MODALITE_LABELS[mission.session.modalite] ?? mission.session.modalite}
              </dd>
            </div>
            {mission.session.lieu !== null ? (
              <div>
                <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Lieu</dt>
                <dd className="text-mocha mt-1 text-sm">{mission.session.lieu}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                Effectif
              </dt>
              <dd className="text-mocha mt-1 text-sm">{mission.session.effectif}</dd>
            </div>
          </dl>

          <div className="mt-6">
            {mission.statut === "en_attente" ? (
              <MissionReponseForm
                cible={{ token }}
                resume="Acceptez-vous d'animer cette session ? Un refus doit être motivé : il nous aide à réaffecter la session rapidement."
                motifMin={MOTIF_REFUS_MIN}
              />
            ) : (
              /*
                🔴 Recette du 2026-09-03 — ce bloc était écrit pour quelqu'un qui
                ROUVRE un vieux lien. Mais `router.refresh()` amène ici, en une
                seconde, celui qui vient de CLIQUER : le formulaire cesse d'être
                rendu, et sa confirmation avec. On répond donc aux deux, en
                réutilisant les phrases du formulaire plutôt qu'en les recopiant.
              */
              <div role="status" className="border-border rounded-lg border p-4">
                <p className="text-mocha text-sm font-semibold">
                  {mission.statut === "acceptee" || mission.statut === "refusee"
                    ? SUITE_APRES_REPONSE[mission.statut].titre
                    : `Cette proposition n'attend plus de réponse : ${LIBELLE_STATUT_MISSION[
                        mission.statut
                      ].toLowerCase()}.`}
                </p>
                <p className="text-fg-soft mt-1 text-sm">
                  {mission.statut === "acceptee" || mission.statut === "refusee"
                    ? SUITE_APRES_REPONSE[mission.statut].suite
                    : "Pour revoir vos missions, connectez-vous à votre espace."}
                </p>
                <Link
                  href={FORMATEUR_CONNEXION_PATH}
                  className="text-terracotta mt-3 inline-block text-sm hover:underline"
                >
                  Me connecter à mon espace
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

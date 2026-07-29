/**
 * Espace formateur collectif — détail d'une formation en LECTURE SEULE.
 *
 * Garde de propriété : `getTrainingSessionForFormateur` retourne `null` si la
 * session n'appartient pas au formateur (par FK principal ou ligne
 * `SessionFormateur`) → 404.
 *
 * ⚠️ POLITIQUE DE CHAMPS STAGIAIRE — non négociable : jamais d'email stagiaire
 * ni de détail chiffré de handicap. On n'affiche que le DRAPEAU
 * `situationHandicap` (mention sans détail), l'identité pédagogique minimale et
 * le taux de présence agrégé. C'est volontaire.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFormateur } from "@/server/formateur/guard";
import { lireFeuilleGroupe } from "@/server/qualiopi/emargement/feuille-groupe";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  signerPourStagiaireAction,
  contresignerDemiJourneeAction,
} from "@/server/actions/qualiopi/emargement-formateur";
import { EmargementGroupe } from "@/components/espace-formateur/EmargementGroupe";
import { SignatureReleve } from "@/components/espace-formateur/SignatureReleve";
import { signerReleveFormateurAction } from "@/server/actions/qualiopi/releve-signature";
import { lireEtatSignatureReleve } from "@/server/qualiopi/documents/signature/releve-queries";
import { getTrainingSessionForFormateur } from "@/server/formateur/collectif-queries";
import {
  FORMATEUR_SESSIONS_PATH,
  MODALITE_LABELS,
  STATUT_SESSION_LABELS,
  STATUT_INSCRIPTION_LABELS,
  ROLE_FORMATEUR_LABELS,
  libelle,
} from "@/server/formateur/collectif-labels";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const { id } = await params;

  const session = await getTrainingSessionForFormateur(id, trainerId);
  // La garde de propriété passe AVANT toute autre lecture : sinon n'importe quel
  // formateur authentifié fait exécuter une requête complète — noms de tous les
  // inscrits, tous les créneaux — sur n'importe quel identifiant de session.
  if (session === null) notFound();

  // L'instant est résolu UNE fois pour tout le rendu : deux appels séparés
  // pourraient tomber de part et d'autre d'une bascule de demi-journée et
  // afficher un état incohérent.
  const identite = await getOrganismeIdentite();
  const demiJournees = await lireFeuilleGroupe(id, new Date(), identite.raisonSociale, trainerId);
  // Lu APRÈS la garde de propriété, comme tout le reste de cette page.
  const etatReleve = await lireEtatSignatureReleve(id, trainerId);

  const lieu = [session.lieuVille, session.lieuCodePostal]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link href={FORMATEUR_SESSIONS_PATH} className="text-terracotta text-xs hover:underline">
          ← Mes formations
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-mocha font-serif text-2xl font-semibold">{session.titreSession}</h1>
          <span className="text-fg-muted text-sm">{session.numero}</span>
        </div>
        <p className="text-fg-muted mt-1 text-sm">
          {libelle(STATUT_SESSION_LABELS, session.statut)}
        </p>
      </div>

      {/* En-tête récapitulatif */}
      <dl className="border-border grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Dates</dt>
          <dd className="text-mocha mt-1 text-sm">
            Du {dateFmt.format(session.dateDebut)}
            <br />
            au {dateFmt.format(session.dateFin)}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Modalité</dt>
          <dd className="text-mocha mt-1 text-sm">{libelle(MODALITE_LABELS, session.modalite)}</dd>
        </div>
        {lieu ? (
          <div>
            <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Lieu</dt>
            <dd className="text-mocha mt-1 text-sm">{lieu}</dd>
          </div>
        ) : null}
        {session.dureeReelleHeures !== null ? (
          <div>
            <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">
              Durée réelle
            </dt>
            <dd className="text-mocha mt-1 text-sm">{session.dureeReelleHeures} h</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-fg-muted text-xs font-medium tracking-wide uppercase">Votre rôle</dt>
          <dd className="mt-1">
            <span className="bg-sand text-mocha inline-block rounded-full px-3 py-1 text-xs font-medium">
              {libelle(ROLE_FORMATEUR_LABELS, session.role)}
            </span>
          </dd>
        </div>
      </dl>

      {/* Bandeau de rôle / droit de clôture */}
      <div className="border-border bg-sand rounded-lg border p-4 text-sm">
        <p className="text-mocha">
          Vous consultez cette formation en tant que{" "}
          <strong>{libelle(ROLE_FORMATEUR_LABELS, session.role).toLowerCase()}</strong>.
        </p>
        {session.peutCloturerEmargement === false ? (
          <p className="text-fg-muted mt-2">
            {"Seul le formateur principal peut clôturer l'émargement de cette session."}
          </p>
        ) : null}
      </div>

      {/* Inscrits */}
      <section className="space-y-3">
        <h2 className="text-mocha font-serif text-lg font-semibold">
          Participants ({session.inscrits.length})
        </h2>

        {session.inscrits.length === 0 ? (
          <p className="border-border text-fg-muted rounded-lg border border-dashed p-6 text-center text-sm">
            Aucun participant inscrit à cette session pour le moment.
          </p>
        ) : (
          <>
            {/* Tableau desktop */}
            <div className="border-border hidden overflow-x-auto rounded-lg border sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border text-fg-muted border-b text-xs tracking-wide uppercase">
                    <th className="px-4 py-3 font-medium">Participant</th>
                    <th className="px-4 py-3 font-medium">Entreprise</th>
                    <th className="px-4 py-3 font-medium">Fonction</th>
                    <th className="px-4 py-3 font-medium">Présence</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {session.inscrits.map((p) => (
                    <tr key={p.id} className="border-border border-b last:border-b-0">
                      <td className="text-mocha px-4 py-3">
                        {p.prenom} {p.nom}
                        {p.situationHandicap ? (
                          <span className="text-fg-muted mt-0.5 block text-xs">
                            situation de handicap signalée
                          </span>
                        ) : null}
                      </td>
                      <td className="text-mocha px-4 py-3">{p.entreprise ?? "—"}</td>
                      <td className="text-mocha px-4 py-3">{p.fonction ?? "—"}</td>
                      <td className="text-mocha px-4 py-3">
                        {p.tauxPresencePct !== null ? `${p.tauxPresencePct} %` : "—"}
                      </td>
                      <td className="text-mocha px-4 py-3">
                        {libelle(STATUT_INSCRIPTION_LABELS, p.statut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes mobile */}
            <ul className="space-y-3 sm:hidden">
              {session.inscrits.map((p) => (
                <li key={p.id} className="border-border rounded-lg border p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-mocha font-medium">
                      {p.prenom} {p.nom}
                    </span>
                    <span className="text-fg-muted text-xs">
                      {libelle(STATUT_INSCRIPTION_LABELS, p.statut)}
                    </span>
                  </div>
                  {p.situationHandicap ? (
                    <p className="text-fg-muted mt-1 text-xs">situation de handicap signalée</p>
                  ) : null}
                  <dl className="text-fg-muted mt-2 space-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="min-w-20">Entreprise</dt>
                      <dd className="text-mocha">{p.entreprise ?? "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="min-w-20">Fonction</dt>
                      <dd className="text-mocha">{p.fonction ?? "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="min-w-20">Présence</dt>
                      <dd className="text-mocha">
                        {p.tauxPresencePct !== null ? `${p.tauxPresencePct} %` : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Émargement du groupe — pour un stagiaire sans téléphone, ou quand le
          réseau du site client ne permet pas d'ouvrir un lien. Le QR reste
          préférable quand il marche : les stagiaires signent alors en parallèle
          sur leur propre appareil, et l'identification ne repose pas sur le
          formateur. */}
      <section className="space-y-3">
        <h2 className="text-espresso font-serif text-xl">Émargement</h2>
        <p className="text-mocha text-sm">
          Faites signer un stagiaire qui n&apos;a pas pu utiliser son lien personnel. Vous attestez
          alors de son identité : votre nom sera enregistré avec la signature. Puis contresignez
          chaque demi-journée : c&apos;est la signature du formateur, exigée en plus de celle des
          stagiaires pour que la feuille soit probante.
        </p>
        {demiJournees === null ? (
          <p className="text-mocha text-sm">Feuille d&apos;émargement indisponible.</p>
        ) : (
          <EmargementGroupe
            sessionId={id}
            demiJournees={demiJournees}
            signerAction={signerPourStagiaireAction}
            contresignerAction={contresignerDemiJourneeAction}
          />
        )}
      </section>

      {/*
        Relevé de connexion FOAD — la pièce du distanciel.
        ⚠️ Rendu SEULEMENT si un relevé a été généré : une session présentielle
        n'en a pas, et afficher un bloc vide laisserait croire à une pièce
        manquante. `null` est le cas NORMAL, pas une erreur.
      */}
      {etatReleve !== null && (
        <section className="space-y-3">
          <h2 className="text-espresso font-serif text-xl">Relevé de connexion</h2>
          <p className="text-mocha text-sm">
            Le relevé atteste la réalité du distanciel. Il porte deux signatures internes : la vôtre
            et le visa du responsable pédagogique.
          </p>
          <SignatureReleve
            documentGenereId={etatReleve.documentGenereId}
            numero={etatReleve.numero}
            parties={etatReleve.parties}
            formateurPeutSigner={etatReleve.formateurPeutSigner}
            mentions={etatReleve.mentions}
            plafondProbant={etatReleve.plafondProbant}
            signerAction={signerReleveFormateurAction}
          />
        </section>
      )}
    </div>
  );
}

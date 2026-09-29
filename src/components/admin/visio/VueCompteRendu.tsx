// « Compte rendu » d'un rendez-vous enregistré (chantier visio, PR 6) — vue de
// l'onglet « Rendez-vous » (`/rendez-vous?compteRendu=<rencontreId>`).
//
// Pourquoi une VUE de l'onglet et pas une page à elle : chaque page de la
// console ajoute ~1 kB au cliquet des pages de la console, qui n'en avait plus
// que 0,97 (mesuré sur #1229 : 470,14 kB pour 470). Au rebase sur la PR 4, elle
// s'affiche sur la page de la rencontre, qui existe alors.
//
// Ce que Will fait ici : lire le compte rendu rédigé depuis l'enregistrement,
// vérifier les faits et leurs citations horodatées, dire qui est qui quand
// plusieurs personnes ont parlé côté client, valider (le son est alors
// supprimé), ou relancer (« Réécrire », « Réextraire », « Compléter »). Et, si
// le client le demande : « Le client retire son accord pour ce rendez-vous ».
//
// Régime REFUS (décision A2) : garde en PREMIÈRE instruction, avant toute
// lecture. Rendu en TEXTE BRUT : aucun HTML, aucun lien produit par l'IA.
// Formulaires sans JavaScript (le poids de la console ne bouge pas).

import { notFound } from "next/navigation";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  DocumentCompteRenduVue,
  FaitsEtCitations,
} from "@/components/admin/visio/CompteRenduVisio";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { lireCompteRendu } from "@/features/dossier-client/compte-rendu";
import { gesteCompteRenduAction } from "@/features/dossier-client/compte-rendu-actions";
import { prisma } from "@/lib/prisma";

interface Props {
  readonly locale: string;
  readonly adminPrefix: string;
  readonly rencontreId: string;
  readonly message: string | undefined;
  readonly erreur: string | undefined;
}

const LIBELLE_STATUT_CR: Readonly<Record<string, string>> = {
  brouillon: "en préparation",
  a_valider: "à valider",
  valide: "validé",
  remplace: "remplacé",
  rejete: "rejeté",
  a_regenerer: "à réécrire",
};

const LIBELLE_ETAPE: Readonly<Record<string, string>> = {
  transcrire: "Transcription",
  precontroler: "Contrôles avant rédaction",
  extraire: "Extraction des faits",
  verifier_faits: "Vérification des faits",
  rattacher: "Rattachement aux projets",
  consolider: "Comparaison avec l'historique",
  ebaucher: "Ébauche de devis",
  rediger: "Rédaction",
  verifier_compte_rendu: "Vérification du compte rendu",
  purger_audio: "Suppression du son",
};

const LIBELLE_STATUT_ETAPE: Readonly<Record<string, string>> = {
  a_faire: "à faire",
  en_cours: "en cours",
  reussie: "faite",
  echec_definitif: "en échec",
  annule: "annulée",
  suspendu: "suspendue",
};

const carte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const bouton =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]";

function dateFr(d: Date | null): string {
  return d
    ? d.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

export async function VueCompteRendu({ locale, adminPrefix, rencontreId, message, erreur }: Props) {
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const base = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={base} />;
  if (!/^[0-9a-f-]{36}$/.test(rencontreId)) notFound();

  const vue = await lireCompteRendu(prisma, rencontreId);
  if (!vue) notFound();
  const retour = `${base}?compteRendu=${rencontreId}`;
  const cr = vue.courant;
  const cache = (
    <>
      <input type="hidden" name="rencontreId" value={rencontreId} />
      <input type="hidden" name="retour" value={retour} />
    </>
  );
  const transcrireEnAttente = vue.etapes.some(
    (e) => e.etape === "transcrire" && e.statut === "suspendu" && e.classeErreur === null,
  );
  const suspendu = vue.etapes.some((e) => e.statut === "suspendu" && e.classeErreur !== null);
  const enEchec = vue.etapes.find((e) => e.statut === "echec_definitif");
  const attenteRattachement =
    vue.etat?.rattachement === "en_attente_client" && vue.rencontre.clientId !== null;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <a href={base} className={discret}>
          ← Rendez-vous
        </a>
      </div>
      <AdminPageHeader
        title={`Compte rendu — ${vue.rencontre.titre}`}
        description={`Rendez-vous du ${dateFr(vue.rencontre.debut)}. Outil de travail interne : rien n'est envoyé au client.`}
        meta={
          cr ? (
            <>
              <AdminBadge
                tone={
                  cr.statut === "valide"
                    ? "success"
                    : cr.statut === "a_valider"
                      ? "info"
                      : "neutral"
                }
              >
                {LIBELLE_STATUT_CR[cr.statut] ?? cr.statut}
              </AdminBadge>
              <AdminBadge tone="neutral">version {cr.version}</AdminBadge>
            </>
          ) : undefined
        }
      />

      {message ? (
        <p className={`${carte} text-[color:var(--color-admin-success-fg)]`}>{message}</p>
      ) : null}
      {erreur ? (
        <p className={`${carte} text-[color:var(--color-admin-danger-fg)]`}>{erreur}</p>
      ) : null}

      {transcrireEnAttente ? (
        <section className={carte}>
          <h2 className={titre}>Enregistrement de moins de 90 secondes</h2>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            Rien n&apos;a été transcrit. Le client a-t-il refusé l&apos;enregistrement ? Si oui,
            utilisez « Le client retire son accord » plus bas : tout sera supprimé.
          </p>
          <form action={gesteCompteRenduAction}>
            {cache}
            <input type="hidden" name="geste" value="court" />
            <button type="submit" className={bouton}>
              Non, traiter cet enregistrement court
            </button>
          </form>
        </section>
      ) : null}

      {!cr || !vue.document ? (
        <section className={carte}>
          <h2 className={titre}>Compte rendu non rédigé</h2>
          <p className={discret}>
            {enEchec
              ? `L'étape « ${LIBELLE_ETAPE[enEchec.etape] ?? enEchec.etape} » a échoué (${enEchec.derniereErreur ?? "erreur"}). Vous pouvez relancer, ou écrire une note manuelle depuis « Après l'appel ».`
              : "Le compte rendu est en préparation : il apparaît ici dès qu'il est prêt."}
          </p>
          {cr || enEchec ? (
            <form action={gesteCompteRenduAction} className="mt-[var(--space-admin-3)]">
              {cache}
              <input type="hidden" name="geste" value="reextraire" />
              <button type="submit" className={bouton}>
                Relancer
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <>
          {vue.voix.nonAttribuees.length > 0 ? (
            <section className={carte}>
              <h2 className={titre}>Qui a parlé côté client ?</h2>
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
                Plusieurs voix ont été entendues. Dites qui est qui avant de valider.
              </p>
              {vue.voix.voixClient.map((v, i) => (
                <form
                  key={v}
                  action={gesteCompteRenduAction}
                  className="mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-2)]"
                >
                  {cache}
                  <input type="hidden" name="geste" value="voix" />
                  <input type="hidden" name="voix" value={v} />
                  <label className="text-[length:var(--text-admin-sm)]" htmlFor={`voix-${v}`}>
                    CLIENT_{i + 1} =
                  </label>
                  <select id={`voix-${v}`} name="participantId" required className={bouton}>
                    {vue.voix.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                        {p.etiquetteVoix === v ? " (actuel)" : ""}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={bouton}>
                    Attribuer
                  </button>
                </form>
              ))}
              {vue.voix.participants.length === 0 ? (
                <p className={discret}>
                  Aucune personne n&apos;est encore liée à ce rendez-vous : ajoutez-la comme contact
                  depuis « Après l&apos;appel ».
                </p>
              ) : null}
            </section>
          ) : null}

          <section className={`${carte} flex flex-wrap gap-[var(--space-admin-2)]`}>
            {cr.statut === "a_valider" ? (
              <form action={gesteCompteRenduAction}>
                {cache}
                <input type="hidden" name="geste" value="valider" />
                <input type="hidden" name="compteRenduId" value={cr.id} />
                <button type="submit" className={`${bouton} font-semibold`}>
                  Valider le compte rendu
                </button>
              </form>
            ) : null}
            <form action={gesteCompteRenduAction}>
              {cache}
              <input type="hidden" name="geste" value="reecrire" />
              <button type="submit" className={bouton}>
                Réécrire
              </button>
            </form>
            <form action={gesteCompteRenduAction}>
              {cache}
              <input type="hidden" name="geste" value="reextraire" />
              <button type="submit" className={bouton}>
                Réextraire
              </button>
            </form>
            {attenteRattachement ? (
              <form action={gesteCompteRenduAction}>
                {cache}
                <input type="hidden" name="geste" value="completer" />
                <button type="submit" className={bouton}>
                  Compléter avec la fiche client
                </button>
              </form>
            ) : null}
          </section>

          <DocumentCompteRenduVue document={vue.document} />
          <FaitsEtCitations faits={vue.faits} />
        </>
      )}

      <section className={carte}>
        <h2 className={titre}>Où en est le traitement</h2>
        <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          {vue.etapes.map((e, i) => (
            <li key={`${e.etape}-${i}`}>
              {LIBELLE_ETAPE[e.etape] ?? e.etape} : {LIBELLE_STATUT_ETAPE[e.statut] ?? e.statut}
              {e.derniereErreur ? <span className={discret}> · {e.derniereErreur}</span> : null}
              {e.prochaineTentativeLe && e.statut === "a_faire" ? (
                <span className={discret}> · nouvel essai le {dateFr(e.prochaineTentativeLe)}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {vue.enregistrements.map((e, i) => (
          <p key={i} className={`mt-[var(--space-admin-2)] ${discret}`}>
            Son :{" "}
            {e.audioSupprimeLe
              ? `supprimé le ${dateFr(e.audioSupprimeLe)}`
              : `supprimé au plus tard le ${dateFr(e.audioAPurgerAvant)}`}
            {e.incomplet ? " · enregistrement incomplet" : ""}
          </p>
        ))}
        {suspendu ? (
          <form action={gesteCompteRenduAction} className="mt-[var(--space-admin-3)]">
            {cache}
            <input type="hidden" name="geste" value="reprendre" />
            <button type="submit" className={bouton}>
              Reprendre le traitement (crédit rechargé, configuration corrigée)
            </button>
          </form>
        ) : null}
      </section>

      {vue.versions.length > 1 ? (
        <section className={carte}>
          <h2 className={titre}>Versions</h2>
          <ul className="text-[length:var(--text-admin-sm)]">
            {vue.versions.map((v) => (
              <li key={v.version}>
                Version {v.version} · {LIBELLE_STATUT_CR[v.statut] ?? v.statut} · {dateFr(v.creeLe)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={carte}>
        <h2 className={titre}>Le client retire son accord pour ce rendez-vous</h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          La transcription, toutes les versions du compte rendu et les faits appris pendant ce
          rendez-vous seront effacés, et le son supprimé. La preuve de l&apos;accord donné au départ
          est gardée. Les devis et e-mails déjà envoyés ne changent pas.
        </p>
        <form
          action={gesteCompteRenduAction}
          className="flex items-center gap-[var(--space-admin-2)]"
        >
          {cache}
          <input type="hidden" name="geste" value="retrait" />
          <label className="text-[length:var(--text-admin-sm)]">
            <input type="checkbox" name="confirmation" value="oui" required /> Je confirme le
            retrait de l&apos;accord
          </label>
          <button type="submit" className={bouton}>
            Retirer l&apos;accord
          </button>
        </form>
      </section>
    </AdminPageShell>
  );
}

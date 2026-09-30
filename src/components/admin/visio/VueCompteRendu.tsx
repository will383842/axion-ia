// « Compte rendu de l'enregistrement » (chantier visio, PR 6) — rendu SUR la
// page du rendez-vous (`rendez-vous/rencontres/[rencontreId]`), qui porte déjà
// la garde (décision A2, première instruction) et lit la vue
// (`lireCompteRendu`). Un seul écran pour un rendez-vous : un composant serveur
// ajouté à une page existante n'ajoute aucune route à la console.
//
// Ce que Will fait ici : lire le compte rendu rédigé depuis l'enregistrement,
// vérifier les faits et leurs citations horodatées, dire qui est qui quand
// plusieurs personnes ont parlé côté client (y compris ajouter une personne
// imprévue, ou dire « c'est ma voix »), confirmer à la main l'accord d'une
// personne que le circuit n'a pas retrouvé (G16), valider (le son est alors
// supprimé), ou relancer (« Réécrire », « Réextraire », « Compléter »). Et, si
// le client le demande : « Le client retire son accord pour ce rendez-vous ».
//
// Rendu en TEXTE BRUT : aucun HTML, aucun lien produit par l'IA. Formulaires
// sans JavaScript (le poids de la console ne bouge pas).

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import {
  DocumentCompteRenduVue,
  FaitsEtCitations,
} from "@/components/admin/visio/CompteRenduVisio";
import {
  attendReponseDeWill,
  type VueCompteRendu as Vue,
} from "@/features/dossier-client/compte-rendu";
import {
  LIBELLE_ETAPE_VISIO,
  LIBELLE_STATUT_COMPTE_RENDU,
  LIBELLE_STATUT_ETAPE,
  LIBELLE_TYPE_CONSENTEMENT,
} from "@/features/dossier-client/libelles";
import { gesteCompteRenduAction } from "@/features/dossier-client/compte-rendu-actions";

interface Props {
  readonly vue: Vue;
  readonly rencontreId: string;
  /** L'adresse de la page du rendez-vous, où chaque geste revient. */
  readonly retour: string;
}

const carte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const alerte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold";
const texte = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const bouton =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]";
const ligne =
  "mb-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

function dateFr(d: Date | null): string {
  return d
    ? d.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

export function VueCompteRendu({ vue, rencontreId, retour }: Props) {
  const cr = vue.courant;
  const cache = (
    <>
      <input type="hidden" name="rencontreId" value={rencontreId} />
      <input type="hidden" name="retour" value={retour} />
    </>
  );
  const transcrireEnAttente = vue.etapes.some(attendReponseDeWill);
  const suspendu = vue.etapes.some((e) => e.statut === "suspendu" && e.classeErreur !== null);
  const enEchec = vue.etapes.find((e) => e.statut === "echec_definitif");
  const attenteRattachement =
    vue.etat?.rattachement === "en_attente_client" && vue.rencontre.clientId !== null;
  const nomDe = (id: string | null) => vue.voix.participants.find((p) => p.id === id)?.nom ?? null;

  return (
    <>
      <h2 className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-lg)] font-semibold">
        Compte rendu de l&apos;enregistrement
        {cr ? (
          <>
            <AdminBadge
              tone={
                cr.statut === "valide" ? "success" : cr.statut === "a_valider" ? "info" : "neutral"
              }
            >
              {LIBELLE_STATUT_COMPTE_RENDU[cr.statut]}
            </AdminBadge>
            <AdminBadge tone="neutral">version {cr.version}</AdminBadge>
          </>
        ) : null}
      </h2>
      <p className={`mb-[var(--space-admin-4)] ${discret}`}>
        Outil de travail interne : rien n&apos;est envoyé au client.
      </p>

      {transcrireEnAttente ? (
        <section className={carte}>
          <h3 className={titre}>Enregistrement de moins de 90 secondes</h3>
          <p className={texte}>
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

      {vue.accordAConfirmer ? (
        <section className={alerte} role="alert">
          <h3 className={titre}>
            <AdminBadge tone="warning">à confirmer</AdminBadge> Accord d&apos;une personne non
            retrouvé
          </h3>
          <p className={texte}>
            Plusieurs personnes ont parlé côté client, et la réponse d&apos;accord de l&apos;une
            d&apos;elles (ou de toutes) n&apos;a pas été retrouvée dans l&apos;enregistrement. Rien
            de ce rendez-vous ne peut être validé tant que vous n&apos;avez pas confirmé que chacune
            a bien donné son accord. Si ce n&apos;est pas le cas, utilisez « Le client retire son
            accord » plus bas : tout sera supprimé.
          </p>
          <form action={gesteCompteRenduAction} className={ligne}>
            {cache}
            <input type="hidden" name="geste" value="confirmer_accord" />
            <label>
              <input type="checkbox" name="confirmation" value="oui" required /> Je confirme que
              chaque personne qui a parlé côté client a donné son accord
            </label>
            <button type="submit" className={bouton}>
              Confirmer
            </button>
          </form>
        </section>
      ) : null}

      {!cr || !vue.document ? (
        <section className={carte}>
          <h3 className={titre}>Compte rendu non rédigé</h3>
          <p className={discret}>
            {enEchec
              ? `L'étape « ${LIBELLE_ETAPE_VISIO[enEchec.etape]} » a échoué (${enEchec.derniereErreur ?? "erreur"}). Vous pouvez relancer, ou écrire une note manuelle depuis « Après l'appel ».`
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
      ) : null}

      {vue.voix.voixClient.length > 1 ? (
        <section className={vue.voix.nonAttribuees.length > 0 ? alerte : carte}>
          <h3 className={titre}>Qui a parlé côté client ?</h3>
          <p className={texte}>
            Plusieurs voix ont été entendues sur la piste du client. Dites qui est qui avant de
            valider : une personne prévue, une personne à ajouter, ou votre propre voix (écho).
          </p>
          {vue.voix.voixClient.map((v, i) => {
            const actuel = nomDe(vue.voix.attribueeA[v] ?? null);
            return (
              <div key={v} className="mb-[var(--space-admin-3)]">
                <p className="font-medium">
                  CLIENT_{i + 1} : {actuel ?? <AdminBadge tone="warning">à attribuer</AdminBadge>}
                </p>
                {vue.voix.participants.length > 0 ? (
                  <form action={gesteCompteRenduAction} className={ligne}>
                    {cache}
                    <input type="hidden" name="geste" value="voix" />
                    <input type="hidden" name="voix" value={v} />
                    <label htmlFor={`voix-${v}`}>C&apos;est</label>
                    <select id={`voix-${v}`} name="participantId" required className={bouton}>
                      {vue.voix.participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.estWilliams ? `ma voix (écho) — ${p.nom}` : p.nom}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={bouton}>
                      Attribuer
                    </button>
                  </form>
                ) : null}
                <form action={gesteCompteRenduAction} className={ligne}>
                  {cache}
                  <input type="hidden" name="geste" value="voix_nouvelle_personne" />
                  <input type="hidden" name="voix" value={v} />
                  <label htmlFor={`nom-${v}`}>Ou une autre personne :</label>
                  <input
                    id={`nom-${v}`}
                    name="nom"
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder="Prénom et nom"
                    className={bouton}
                  />
                  <input
                    name="fonction"
                    maxLength={150}
                    placeholder="Fonction (facultatif)"
                    aria-label="Fonction"
                    className={bouton}
                  />
                  <button type="submit" className={bouton}>
                    Ajouter comme contact
                  </button>
                </form>
                {vue.voix.participants.some((p) => p.estWilliams) ? null : (
                  <form action={gesteCompteRenduAction} className={ligne}>
                    {cache}
                    <input type="hidden" name="geste" value="voix_williams" />
                    <input type="hidden" name="voix" value={v} />
                    <button type="submit" className={bouton}>
                      C&apos;est ma voix (écho)
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {cr && vue.document ? (
        <>
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
      ) : null}

      <section className={carte}>
        <h3 className={titre}>Où en est le traitement</h3>
        <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          {vue.etapes.map((e, i) => (
            <li key={`${e.etape}-${i}`}>
              {LIBELLE_ETAPE_VISIO[e.etape]} : {LIBELLE_STATUT_ETAPE[e.statut]}
              {e.derniereErreur ? <span className={discret}> · {e.derniereErreur}</span> : null}
              {e.prochaineTentativeLe && e.statut === "a_faire" ? (
                <span className={discret}> · nouvel essai le {dateFr(e.prochaineTentativeLe)}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {vue.accords.length > 0 ? (
          <ul className={`mt-[var(--space-admin-2)] ${discret}`}>
            {vue.accords.map((a, i) => (
              <li key={i}>
                {LIBELLE_TYPE_CONSENTEMENT[a.type]} — {dateFr(a.survenuLe)}
              </li>
            ))}
          </ul>
        ) : null}
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
          <h3 className={titre}>Versions</h3>
          <ul className="text-[length:var(--text-admin-sm)]">
            {vue.versions.map((v) => (
              <li key={v.version}>
                Version {v.version} · {LIBELLE_STATUT_COMPTE_RENDU[v.statut]} · {dateFr(v.creeLe)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={carte}>
        <h3 className={titre}>Le client retire son accord pour ce rendez-vous</h3>
        <p className={texte}>
          La transcription, toutes les versions du compte rendu et les faits appris pendant ce
          rendez-vous seront effacés, et le son supprimé. La preuve de l&apos;accord donné au départ
          est gardée. Les devis et e-mails déjà envoyés ne changent pas.
        </p>
        <form action={gesteCompteRenduAction} className={ligne}>
          {cache}
          <input type="hidden" name="geste" value="retrait" />
          <label>
            <input type="checkbox" name="confirmation" value="oui" required /> Je confirme le
            retrait de l&apos;accord
          </label>
          <button type="submit" className={bouton}>
            Retirer l&apos;accord
          </button>
        </form>
      </section>
    </>
  );
}

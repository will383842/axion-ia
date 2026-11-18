// Questionnaire de pré-audit sur la fiche d'une rencontre (console, 2026-10-24).
//
// Will y dépose son HTML adapté, l'essaie, voit l'aperçu EXACT de l'e-mail, puis clique
// « Envoyer » : rien ne part tout seul. Les réponses arrivent par personne, regroupées ici,
// avec « à traiter » tant qu'il ne les a pas marquées lues (pas d'e-mail interne).

import { AdminApercuEmail } from "@/components/admin/ui/AdminApercuEmail";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { ReponsePreaudit } from "@/components/admin/dossier-client/ReponsePreaudit";
import {
  arreterRelancesAction,
  cloreQuestionnaireAction,
  demanderEssaiAction,
  deposerQuestionnaireAction,
  enregistrerGabaritInvitationAction,
  envoyerQuestionnaireAction,
  marquerQuestionnaireLuAction,
} from "@/features/questionnaire-preaudit/actions";
import { planifierRelances } from "@/features/questionnaire-preaudit/calendrier";
import {
  conservationEchue,
  MESSAGE_REFUS,
  refusEnvoiReel,
  RETENTION_ANS,
} from "@/features/questionnaire-preaudit/config";
import { apercuEnvoi, apercusSuivi } from "@/features/questionnaire-preaudit/envoyer";
import { lireCopiesInvitation } from "@/features/questionnaire-preaudit/copies-envoyees";
import { lireGabaritBase } from "@/features/questionnaire-preaudit/gabarit-invitation";
import { adminPath } from "@/lib/admin-path";
import {
  CORPS_PAR_DEFAUT,
  MESSAGE_MAX,
  OBJET_PERSO_MAX,
  CORPS_MAX,
} from "@/lib/email/questionnaire-avant-audit-texte";
import {
  ETAT_RELANCES_LISIBLE,
  modeConfirmations,
  modeRelances,
} from "@/features/questionnaire-preaudit/drapeaux-suivi";
import { CODE_DIRIGEANT_MASQUE } from "@/features/questionnaire-preaudit/lecture";
import { lireSuivi } from "@/features/questionnaire-preaudit/suivi-console";
import {
  cheminEssaiPreaudit,
  essaiPermis,
  libellesDuQuestionnaire,
  lireDeLaRencontre,
  lireDuClientSansRendezVous,
  lireReponses,
} from "@/features/questionnaire-preaudit/serveur";
import {
  LIBELLE_NATURE,
  LIBELLE_STATUT,
} from "@/features/questionnaire-preaudit/libelles-courrier";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { fromParisLocalInput, timeInParis, toParisLocalInput } from "@/lib/calendar-grid";

const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const EXPEDITEUR = "Axion-IA <contact@axion-ia.com>";

const LIBELLE_ARRET: Readonly<Record<string, string>> = {
  reponse_dirigeant: "le dirigeant a répondu",
  desinscription: "le destinataire a demandé l'arrêt",
  will: "arrêtés par vous",
  clos: "questionnaire fermé",
  expire: "questionnaire expiré",
  supprime: "questionnaire supprimé",
  rebond: "adresse en erreur",
  opposition: "adresse retenue (opposition)",
};
const ESSAIS = [
  ["invitation", "Premier e-mail"],
  ["relance_1", "Rappel 1"],
  ["relance_2", "Rappel 2"],
  ["relance_3", "Rappel 3"],
  ["confirmation_dirigeant", "Confirmation au dirigeant"],
  ["confirmation_collaborateur", "Confirmation à un collaborateur"],
  ["telegram_reponse", "Message Telegram « réponse reçue »"],
] as const;

const LIBELLE_MODE = {
  main: "Dirigeant",
  emp: "Collaborateur",
  it: "Référent informatique",
} as const;

function quand(d: Date): string {
  return `${formatDateFrShort(d)} à ${timeInParis(d)}`;
}

export async function QuestionnairePreaudit(props: {
  /** Le rendez-vous du questionnaire. Absent : le questionnaire est celui d'une FICHE (`clientId`). */
  rencontreId?: string;
  /** La fiche, quand le questionnaire est envoyé SANS rendez-vous. */
  clientId?: string;
  /** Avec `clientId` : le questionnaire visé (plusieurs par fiche). Absent : le plus récent. */
  questionnaireId?: string;
  /** Seul Williams (super_admin) dépose le HTML. */
  peutDeposer: boolean;
  titulaire: { nom: string | null; email: string | null } | null;
  /** Début prévu du rendez-vous : préremplit la date de l'audit s'il est à venir. */
  debutPrevu?: Date | null;
  societe?: string | null;
  /** Saisies de l'aperçu (`?pa_email=&pa_prenom=&pa_date=&pa_lieu=`). */
  apercu: {
    email: string;
    prenom: string;
    date?: string;
    lieu?: string;
    /** Texte modifié par Will (objet, message personnel, corps) : repris tel quel par l'envoi. */
    objet?: string;
    message?: string;
    corps?: string;
  } | null;
}) {
  const { rencontreId, clientId, questionnaireId } = props;
  // Le champ caché qui dit aux actions quel questionnaire est visé (rendez-vous, sinon fiche).
  const cible =
    rencontreId !== undefined
      ? { name: "rencontreId", value: rencontreId }
      : { name: "clientId", value: clientId ?? "" };
  // Le questionnaire précis (fiche sans rendez-vous) voyage avec chaque geste : les rappels d'un
  // questionnaire déjà parti restent arrêtables même quand un autre a été déposé depuis.
  const champsCible = (
    <>
      <input type="hidden" name={cible.name} value={cible.value} />
      {rencontreId === undefined && questionnaireId !== undefined ? (
        <input type="hidden" name="questionnaireId" value={questionnaireId} />
      ) : null}
    </>
  );
  const q =
    rencontreId !== undefined
      ? await lireDeLaRencontre(rencontreId)
      : clientId === undefined
        ? null
        : await lireDuClientSansRendezVous(clientId, questionnaireId);
  const refus = refusEnvoiReel();
  const reponses = q === null ? [] : await lireReponses(q.id);
  const libelles =
    q !== null && reponses.length > 0
      ? await libellesDuQuestionnaire(q.id).catch(() => undefined)
      : undefined;
  const aTraiter =
    q !== null &&
    reponses.length > 0 &&
    (q.luLe === null || reponses.some((r) => r.recuLe > (q.luLe as Date)));
  const chemin = q === null ? null : cheminEssaiPreaudit(q.id);
  // Un lien fermé ou expiré ne se teste plus (la page répond 404) : on ne montre pas le lien.
  const essaiOuvert = q !== null && essaiPermis(q);

  const maintenant = new Date();
  const suivi = q === null ? null : await lireSuivi(q.id).catch(() => null);
  // Ces interrupteurs se posent TOUJOURS sur les deux applications (`coolify-drapeau.yml` le
  // refuse autrement) : la console lit donc la même valeur que le worker.
  const etatRelances = modeRelances();
  // Date de l'audit : celle de l'aperçu, sinon le rendez-vous s'il est à venir.
  const dateDuRendezVous =
    props.debutPrevu && props.debutPrevu.getTime() > maintenant.getTime()
      ? toParisLocalInput(props.debutPrevu)
      : "";
  // Sans saisie de Will (aperçu automatique), on part de la date du rendez-vous s'il est à venir.
  const dateSaisie = props.apercu === null ? dateDuRendezVous : (props.apercu.date ?? "");
  const dateAudit = dateSaisie !== "" ? fromParisLocalInput(dateSaisie) : null;
  const datePropose = dateSaisie !== "" ? dateSaisie : dateDuRendezVous;
  const lieuAudit = (props.apercu?.lieu ?? "").trim() || null;
  const relancesPrevues = planifierRelances(maintenant, dateAudit);
  // Vérification F, défaut C : en mode essai, ce qui SERAIT parti (dates comprises).
  const reponseDirigeant = reponses.find(
    (r) =>
      r.mode === "main" &&
      r.ecarteLe === null &&
      (r.lecture?.brut ?? "").includes(CODE_DIRIGEANT_MASQUE),
  );
  const modeConf = modeConfirmations();
  const simulation =
    suivi !== null &&
    suivi.premierEnvoiLe === null &&
    suivi.departConstate !== null &&
    (etatRelances !== "actif" || modeConf !== "actif")
      ? {
          relances: etatRelances === "actif" ? [] : suivi.relancesSimulees,
          confirmation:
            modeConf === "actif"
              ? "active : elle part à la réponse du dirigeant"
              : reponseDirigeant !== undefined
                ? `serait partie le ${quand(reponseDirigeant.recuLe)}, à sa réponse`
                : "partirait dès sa réponse",
        }
      : null;

  const emailPropose = props.apercu?.email || props.titulaire?.email || "";
  const prenomPropose = props.apercu?.prenom ?? (props.titulaire?.nom ?? "").split(" ")[0] ?? "";
  // L'aperçu s'affiche DÈS QUE l'adresse est connue (celle du rendez-vous) : le bouton « Envoyer »
  // n'est plus caché derrière un clic sur « Voir l'aperçu ». Rien ne part sans le clic sur « Envoyer ».
  const ap: NonNullable<typeof props.apercu> | null =
    props.apercu ?? (emailPropose !== "" ? { email: emailPropose, prenom: prenomPropose } : null);
  const gabaritBase = await lireGabaritBase();
  const corpsDeBase = gabaritBase.corps ?? CORPS_PAR_DEFAUT;
  const texteSaisi = { objet: ap?.objet, message: ap?.message, corps: ap?.corps };
  const copies = q === null ? [] : await lireCopiesInvitation(q.id);

  let apercuMail: { sujet: string; html: string } | null = null;
  let apercusDuSuivi: ReadonlyArray<{ libelle: string; sujet: string; html: string }> = [];
  let erreurApercu: string | null = null;
  if (q !== null && ap !== null && ap.email !== "") {
    try {
      const audit = { dateAudit, lieuAudit };
      const m = await apercuEnvoi(q.id, ap.email, ap.prenom, audit, texteSaisi);
      apercuMail = { sujet: m.subject, html: m.html };
      apercusDuSuivi = (
        await apercusSuivi(q.id, ap.email, ap.prenom, {
          ...audit,
          societe: props.societe ?? "",
        })
      ).map((a) => ({ libelle: a.libelle, sujet: a.email.subject, html: a.email.html }));
    } catch {
      erreurApercu = "L'aperçu n'a pas pu être préparé.";
    }
  }

  return (
    <AdminBloc
      teinte="terracotta"
      haut
      id="questionnaire-avant-audit"
      titre={
        <>
          Questionnaire avant audit{" "}
          {q === null ? null : q.envoyeLe === null ? (
            <AdminBadge tone="neutral">brouillon</AdminBadge>
          ) : (
            <AdminBadge tone="success">envoyé le {quand(q.envoyeLe)}</AdminBadge>
          )}{" "}
          {q?.closLe != null ? (
            <AdminBadge tone="outline">fermé</AdminBadge>
          ) : q?.expireLe != null ? (
            <AdminBadge tone="outline">expire le {quand(q.expireLe)}</AdminBadge>
          ) : null}{" "}
          {aTraiter ? <AdminBadge tone="warning">réponses à traiter</AdminBadge> : null}
        </>
      }
    >
      <h3 className="admin-carte-titre flex items-center gap-[var(--space-admin-3)]">
        <span className="admin-etape" aria-hidden="true">
          1
        </span>
        Préparer
      </h3>
      {props.peutDeposer ? (
        <form
          action={deposerQuestionnaireAction}
          className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
        >
          {champsCible}
          <input
            type="file"
            name="fichier"
            accept=".html,text/html"
            required
            className={inputCls}
            aria-label="Fichier HTML du questionnaire"
          />
          <AdminButton type="submit" variant="secondary" disabled={q?.envoyeLe != null}>
            {q === null ? "Ajouter un questionnaire" : "Remplacer le questionnaire"}
          </AdminButton>
          {q?.envoyeLe != null ? (
            <span className={mutedCls}>Déjà envoyé : il ne peut plus être remplacé.</span>
          ) : null}
        </form>
      ) : null}

      {q !== null && chemin !== null ? (
        <>
          {essaiOuvert ? (
            <p
              className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
              data-lien-essai
            >
              <a
                href={chemin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                Tester le questionnaire
              </a>{" "}
              <span className={mutedCls}>
                (mode test : rien n&apos;est enregistré, personne n&apos;est prévenu)
              </span>
            </p>
          ) : null}

          <form
            method="get"
            className="mb-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]"
          >
            <input
              name="pa_email"
              type="email"
              defaultValue={emailPropose}
              placeholder="Adresse du destinataire"
              required
              className={inputCls}
              aria-label="Adresse du destinataire"
            />
            <input
              name="pa_prenom"
              defaultValue={prenomPropose}
              placeholder="Prénom"
              className={inputCls}
              aria-label="Prénom du destinataire"
            />
            <input
              name="pa_date"
              type="datetime-local"
              defaultValue={datePropose}
              className={inputCls}
              aria-label="Date et heure de l'audit"
            />
            <input
              name="pa_lieu"
              defaultValue={props.apercu?.lieu ?? ""}
              maxLength={80}
              placeholder="Lieu (ex. dans vos locaux)"
              className={inputCls}
              aria-label="Lieu de l'audit"
            />
            <div
              className="flex w-full flex-col gap-[var(--space-admin-2)]"
              data-bloc="texte-email"
            >
              <label className={mutedCls} htmlFor="pa_objet">
                Objet (vide : objet de base, sinon objet automatique daté)
              </label>
              <input
                id="pa_objet"
                name="pa_objet"
                defaultValue={props.apercu?.objet ?? ""}
                maxLength={OBJET_PERSO_MAX}
                placeholder={apercuMail?.sujet ?? "Objet de l'e-mail"}
                className={inputCls}
              />
              <label className={mutedCls} htmlFor="pa_message">
                Mot personnel de Will, ajouté juste après « Bonjour » (facultatif)
              </label>
              <textarea
                id="pa_message"
                name="pa_message"
                rows={3}
                maxLength={MESSAGE_MAX}
                defaultValue={props.apercu?.message ?? ""}
                className={inputCls}
              />
              <label className={mutedCls} htmlFor="pa_corps">
                Texte de l&apos;e-mail (modifiable en entier ; une ligne vide sépare deux
                paragraphes ; {"{audit}"} devient la date et le lieu de l&apos;audit). Le bouton, le
                lien personnel, la formule de fin et les mentions légales ne changent pas.
              </label>
              <textarea
                id="pa_corps"
                name="pa_corps"
                rows={12}
                maxLength={CORPS_MAX}
                defaultValue={props.apercu?.corps ?? corpsDeBase}
                className={inputCls}
              />
            </div>
            <AdminButton type="submit" variant="secondary">
              Mettre à jour l&apos;aperçu
            </AdminButton>
          </form>

          {erreurApercu !== null ? (
            <p role="alert" className={mutedCls}>
              {erreurApercu}
            </p>
          ) : null}
          {apercuMail !== null && ap !== null ? (
            <div className="mb-[var(--space-admin-3)]">
              <h3 className="admin-carte-titre flex items-center gap-[var(--space-admin-3)]">
                <span className="admin-etape" aria-hidden="true">
                  2
                </span>
                Vérifier l&apos;aperçu
              </h3>
              <div className="mb-[var(--space-admin-4)]">
                <AdminApercuEmail
                  de={EXPEDITEUR}
                  a={ap.email}
                  objet={apercuMail.sujet}
                  html={apercuMail.html}
                  titre="Aperçu exact de l'e-mail"
                />
              </div>
              <h3 className="admin-carte-titre flex items-center gap-[var(--space-admin-3)]">
                <span className="admin-etape" aria-hidden="true">
                  3
                </span>
                Envoyer
              </h3>
              {refus !== null ? (
                <p role="status" className="text-[length:var(--text-admin-sm)]">
                  {MESSAGE_REFUS[refus]}
                </p>
              ) : (
                <form action={envoyerQuestionnaireAction} data-bloc="envoi-questionnaire">
                  {champsCible}
                  <input type="hidden" name="destinataire" value={ap.email} />
                  <input type="hidden" name="prenom" value={ap.prenom} />
                  <input
                    type="hidden"
                    name="texte_objet"
                    value={ap.objet || (gabaritBase.objet ?? "")}
                  />
                  <input type="hidden" name="texte_message" value={ap.message ?? ""} />
                  <input type="hidden" name="texte_corps" value={ap.corps || corpsDeBase} />
                  <input type="hidden" name="date_audit" value={dateSaisie} />
                  <input type="hidden" name="lieu_audit" value={lieuAudit ?? ""} />
                  <label className="mb-[var(--space-admin-2)] flex items-start gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                    <input type="checkbox" name="relances" value="1" defaultChecked />
                    <span>
                      Programmer les 3 rappels automatiques (
                      {relancesPrevues
                        .map((r) =>
                          r.prevuLe === null
                            ? `rappel ${r.rang} annulé : audit trop proche`
                            : quand(r.prevuLe),
                        )
                        .join(", ")}
                      ).{" "}
                      <span className={mutedCls}>
                        Dates recalculées depuis le départ réel de l&apos;e-mail ; ils
                        s&apos;arrêtent dès que le dirigeant répond.
                      </span>
                    </span>
                  </label>
                  <p role="status" className={mutedCls} data-etat-relances={etatRelances}>
                    {ETAT_RELANCES_LISIBLE[etatRelances]}
                  </p>
                  <AdminButton type="submit" size="lg">
                    Envoyer cet e-mail
                  </AdminButton>
                </form>
              )}
              {apercusDuSuivi.length > 0 ? (
                <div className="mt-[var(--space-admin-3)]" data-bloc="apercus-suivi">
                  <p className={mutedCls}>
                    Les e-mails de suivi, tels qu&apos;ils partiraient (rien n&apos;est envoyé
                    d&apos;ici) :
                  </p>
                  {apercusDuSuivi.map((a) => (
                    <details key={a.libelle} className="mt-[var(--space-admin-2)]">
                      <summary className="cursor-pointer text-[length:var(--text-admin-sm)]">
                        {a.libelle} — <b>Objet :</b> {a.sujet}
                      </summary>
                      <div className="mt-[var(--space-admin-2)]">
                        <AdminApercuEmail
                          de={EXPEDITEUR}
                          a={ap.email}
                          objet={a.sujet}
                          html={a.html}
                          titre={`Aperçu : ${a.libelle}`}
                        />
                      </div>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {copies.length > 0 ? (
        <AdminBloc teinte="vert" niveau={3} titre="Copie exacte de l'e-mail parti">
          <div data-bloc="copies-envoyees">
            <p className={mutedCls}>
              Objet et texte tels que le destinataire les a reçus. Seul son lien personnel est
              masqué.
            </p>
            {copies.map((c) => (
              <details
                key={c.emailLogId}
                className="mt-[var(--space-admin-2)]"
                open={copies.length === 1}
              >
                <summary className="cursor-pointer text-[length:var(--text-admin-sm)]">
                  {c.envoyeLe ? `Parti le ${quand(c.envoyeLe)}` : "Parti"} — <b>À :</b>{" "}
                  {c.destinataire}
                  {c.objet !== null ? (
                    <>
                      {" "}
                      — <b>Objet :</b> {c.objet}
                    </>
                  ) : null}
                </summary>
                {c.html !== null ? (
                  <div className="mt-[var(--space-admin-2)]">
                    <AdminApercuEmail
                      de={EXPEDITEUR}
                      a={c.destinataire}
                      objet={c.objet ?? "—"}
                      html={c.html}
                      titre={`Copie de l'e-mail envoyé à ${c.destinataire}`}
                    />
                  </div>
                ) : (
                  <p className={mutedCls}>La copie de cet e-mail n&apos;a pas été conservée.</p>
                )}
                <p className={mutedCls}>
                  <a
                    href={adminPath("fr", `/emails-envoyes/${c.emailLogId}`)}
                    className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                  >
                    Ouvrir dans les e-mails envoyés
                  </a>
                </p>
              </details>
            ))}
          </div>
        </AdminBloc>
      ) : null}

      <details className="mb-[var(--space-admin-3)]" data-bloc="texte-de-base">
        <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-semibold">
          Texte de base du premier e-mail (pour tous les clients)
        </summary>
        <p className={mutedCls}>
          C&apos;est le texte proposé à chaque nouvel envoi ; vous pouvez ensuite le modifier pour
          un client dans l&apos;aperçu.{" "}
          {gabaritBase.corps === null && gabaritBase.objet === null
            ? "Aucune modification : texte d'origine."
            : "Texte modifié par vous."}
        </p>
        {props.peutDeposer ? (
          <form
            action={enregistrerGabaritInvitationAction}
            className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
          >
            {champsCible}
            <label className={mutedCls} htmlFor="base_objet">
              Objet de base (vide = objet automatique daté)
            </label>
            <input
              id="base_objet"
              name="base_objet"
              defaultValue={gabaritBase.objet ?? ""}
              maxLength={OBJET_PERSO_MAX}
              className={inputCls}
            />
            <label className={mutedCls} htmlFor="base_corps">
              Texte de base ({"{audit}"} devient la date et le lieu de l&apos;audit)
            </label>
            <textarea
              id="base_corps"
              name="base_corps"
              rows={12}
              maxLength={CORPS_MAX}
              defaultValue={corpsDeBase}
              className={inputCls}
            />
            <div className="flex gap-[var(--space-admin-2)]">
              <AdminButton type="submit" variant="secondary">
                Enregistrer le texte de base
              </AdminButton>
              <AdminButton type="submit" variant="secondary" name="reinitialiser" value="1">
                Revenir au texte d&apos;origine
              </AdminButton>
            </div>
          </form>
        ) : (
          <pre className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
            {corpsDeBase}
          </pre>
        )}
      </details>

      {q !== null && refus === null ? (
        <form
          action={demanderEssaiAction}
          data-bloc="essai-suivi"
          className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
        >
          {champsCible}
          <select name="essai_de" className={inputCls} aria-label="E-mail à tester">
            {ESSAIS.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
          <AdminButton type="submit" variant="secondary">
            M&apos;envoyer un test
          </AdminButton>
          <span className={mutedCls}>
            (à l&apos;adresse de test d&apos;Axion IA, objet « [TEST] », jamais au prospect)
          </span>
        </form>
      ) : null}

      {suivi !== null ? (
        <div className="mb-[var(--space-admin-3)]" data-bloc="suivi-questionnaire">
          <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Suivi
          </h3>
          <p className="text-[length:var(--text-admin-sm)]">
            {suivi.premierEnvoiLe !== null
              ? `Envoyé le ${quand(suivi.premierEnvoiLe)}.`
              : suivi.departConstate !== null
                ? `E-mail envoyé le ${quand(suivi.departConstate)} (départ constaté).`
                : "Départ réel de l'e-mail pas encore constaté."}{" "}
            {suivi.relancesArreteesLe !== null
              ? `Rappels arrêtés le ${quand(suivi.relancesArreteesLe)} (${
                  LIBELLE_ARRET[suivi.relancesArretMotif ?? ""] ?? "arrêtés"
                }).`
              : !suivi.relancesDemandees
                ? "Aucun rappel demandé."
                : suivi.prochaine !== null
                  ? `Prochain rappel : ${quand(suivi.prochaine)}.`
                  : suivi.relancesSimulees.length > 0
                    ? ""
                    : "Rappels programmés au départ réel de l'e-mail."}
            {suivi.dateAudit !== null ? ` Audit : ${quand(suivi.dateAudit)}` : ""}
            {suivi.lieuAudit !== null ? `, ${suivi.lieuAudit}.` : suivi.dateAudit ? "." : ""}
          </p>
          {simulation !== null ? (
            <div
              role="status"
              data-bloc="simulation-essai"
              className="my-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
            >
              <p className="font-semibold">
                Mode test : voici ce qui serait parti. Rien ne part tant que ce n&apos;est pas
                activé.
              </p>
              <ul>
                {simulation.relances.map((r) => (
                  <li key={r.rang}>
                    Rappel {r.rang} :{" "}
                    {r.prevuLe !== null
                      ? `serait parti le ${quand(r.prevuLe)}`
                      : "annulé (audit à moins de 24 h)"}
                  </li>
                ))}
                <li>Confirmation au dirigeant : {simulation.confirmation}</li>
              </ul>
            </div>
          ) : null}
          <p className={mutedCls}>
            Un rendez-vous annulé n&apos;arrête pas les rappels : fermez le questionnaire ou
            arrêtez-les ici.
          </p>
          {suivi.journal.length > 0 ? (
            <ul className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
              {suivi.journal.map((c) => (
                <li key={c.id}>
                  {LIBELLE_NATURE[c.nature] ?? c.nature}
                  {c.essaiDe ? ` (${LIBELLE_NATURE[c.essaiDe] ?? c.essaiDe})` : ""} — prévu{" "}
                  {quand(c.prevuLe)}
                  {c.faitLe ? `, fait ${quand(c.faitLe)}` : ""} —{" "}
                  {LIBELLE_STATUT[c.statut] ?? c.statut}
                  {c.motif ? ` (${c.motif})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {suivi.relancesDemandees && suivi.relancesArreteesLe === null ? (
            <form action={arreterRelancesAction} className="mt-[var(--space-admin-2)]">
              {champsCible}
              <AdminButton type="submit" variant="ghost-danger">
                Arrêter les rappels
              </AdminButton>
            </form>
          ) : null}
        </div>
      ) : null}

      {q !== null && q.envoyeLe !== null && q.closLe === null ? (
        <form action={cloreQuestionnaireAction} className="mb-[var(--space-admin-3)]">
          {champsCible}
          <AdminButton type="submit" variant="secondary">
            Fermer le questionnaire
          </AdminButton>
        </form>
      ) : null}

      {reponses.length > 0 ? (
        <div>
          <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Réponses reçues ({reponses.length})
          </h3>
          {q !== null ? (
            <p className={mutedCls}>
              Référence du questionnaire : {q.ref} (avec le code d&apos;un collaborateur, elle
              l&apos;identifie pour une demande d&apos;accès ou d&apos;effacement).
            </p>
          ) : null}
          {reponses.some((r) => r.ecarteLe !== null) ? (
            <p
              role="alert"
              className="my-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-danger)]"
            >
              {reponses.filter((r) => r.ecarteLe !== null).length} réponse(s) mise(s) à l&apos;écart
              sur demande d&apos;effacement : l&apos;effacement définitif attend la décision de
              Williams.
            </p>
          ) : null}
          {reponses.some((r) => conservationEchue(r.recuLe)) ? (
            <p
              role="alert"
              className="my-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-danger)]"
            >
              Rappel : {reponses.filter((r) => conservationEchue(r.recuLe)).length} réponse(s) ont
              dépassé leur échéance de conservation ({RETENTION_ANS} ans). Rien n&apos;est supprimé
              automatiquement : à supprimer à la main si plus rien ne justifie de les garder.
            </p>
          ) : null}
          {reponses.some((r) => r.illisible) ? (
            <p
              role="alert"
              className="my-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-danger)]"
            >
              {reponses.filter((r) => r.illisible).length} réponse(s) illisible(s) : voir le détail
              ci-dessous.
            </p>
          ) : null}
          <ul className="space-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            {reponses.map((r) => (
              <li key={r.id}>
                <ReponsePreaudit
                  r={r}
                  rencontreId={rencontreId ?? null}
                  clientId={clientId ?? null}
                  questionnaireId={rencontreId === undefined ? (questionnaireId ?? null) : null}
                  reference={q?.ref ?? ""}
                  peutEffacer={props.peutDeposer}
                  libelleMode={LIBELLE_MODE[r.mode]}
                  quand={quand(r.recuLe)}
                  {...(libelles ? { libelles } : {})}
                />
              </li>
            ))}
          </ul>
          {aTraiter ? (
            <form action={marquerQuestionnaireLuAction} className="mt-[var(--space-admin-3)]">
              {champsCible}
              <AdminButton type="submit" variant="secondary">
                Marquer comme lues
              </AdminButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </AdminBloc>
  );
}

// Questionnaire de pré-audit sur la fiche d'une rencontre (console, 2026-10-24).
//
// Will y dépose son HTML adapté, l'essaie, voit l'aperçu EXACT de l'e-mail, puis clique
// « Envoyer » : rien ne part tout seul. Les réponses arrivent par personne, regroupées ici,
// avec « à traiter » tant qu'il ne les a pas marquées lues (pas d'e-mail interne).

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ReponsePreaudit } from "@/components/admin/dossier-client/ReponsePreaudit";
import {
  arreterRelancesAction,
  cloreQuestionnaireAction,
  demanderEssaiAction,
  deposerQuestionnaireAction,
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
  lireReponses,
} from "@/features/questionnaire-preaudit/serveur";
import {
  LIBELLE_NATURE,
  LIBELLE_STATUT,
} from "@/features/questionnaire-preaudit/libelles-courrier";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { fromParisLocalInput, timeInParis, toParisLocalInput } from "@/lib/calendar-grid";

const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const boutonCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium";

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
  rencontreId: string;
  /** Seul Williams (super_admin) dépose le HTML. */
  peutDeposer: boolean;
  titulaire: { nom: string | null; email: string | null } | null;
  /** Début prévu du rendez-vous : préremplit la date de l'audit s'il est à venir. */
  debutPrevu?: Date | null;
  societe?: string | null;
  /** Saisies de l'aperçu (`?pa_email=&pa_prenom=&pa_date=&pa_lieu=`). */
  apercu: { email: string; prenom: string; date?: string; lieu?: string } | null;
}) {
  const { rencontreId } = props;
  const q = await lireDeLaRencontre(rencontreId);
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
  const dateSaisie = props.apercu?.date ?? "";
  const dateAudit = dateSaisie !== "" ? fromParisLocalInput(dateSaisie) : null;
  const datePropose =
    dateSaisie !== ""
      ? dateSaisie
      : props.debutPrevu && props.debutPrevu.getTime() > maintenant.getTime()
        ? toParisLocalInput(props.debutPrevu)
        : "";
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

  let apercuMail: { sujet: string; html: string } | null = null;
  let apercusDuSuivi: ReadonlyArray<{ libelle: string; sujet: string; html: string }> = [];
  let erreurApercu: string | null = null;
  if (q !== null && props.apercu !== null && props.apercu.email !== "") {
    try {
      const audit = { dateAudit, lieuAudit };
      const m = await apercuEnvoi(q.id, props.apercu.email, props.apercu.prenom, audit);
      apercuMail = { sujet: m.subject, html: m.html };
      apercusDuSuivi = (
        await apercusSuivi(q.id, props.apercu.email, props.apercu.prenom, {
          ...audit,
          societe: props.societe ?? "",
        })
      ).map((a) => ({ libelle: a.libelle, sujet: a.email.subject, html: a.email.html }));
    } catch {
      erreurApercu = "L'aperçu n'a pas pu être préparé.";
    }
  }
  const emailPropose = props.apercu?.email || props.titulaire?.email || "";
  const prenomPropose = props.apercu?.prenom ?? (props.titulaire?.nom ?? "").split(" ")[0] ?? "";

  return (
    <section className={carteCls} id="questionnaire-avant-audit">
      <h2 className={titreCls}>
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
      </h2>

      {props.peutDeposer ? (
        <form
          action={deposerQuestionnaireAction}
          className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
        >
          <input type="hidden" name="rencontreId" value={rencontreId} />
          <input
            type="file"
            name="fichier"
            accept=".html,text/html"
            required
            className={inputCls}
            aria-label="Fichier HTML du questionnaire"
          />
          <button type="submit" className={boutonCls} disabled={q?.envoyeLe != null}>
            {q === null ? "Ajouter un questionnaire" : "Remplacer le questionnaire"}
          </button>
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
            <button type="submit" className={boutonCls}>
              Voir l&apos;aperçu de l&apos;e-mail
            </button>
          </form>

          {erreurApercu !== null ? (
            <p role="alert" className={mutedCls}>
              {erreurApercu}
            </p>
          ) : null}
          {apercuMail !== null && props.apercu !== null ? (
            <div className="mb-[var(--space-admin-3)]">
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                <b>À :</b> {props.apercu.email} — <b>Objet :</b> {apercuMail.sujet}
              </p>
              <iframe
                title="Aperçu exact de l'e-mail"
                sandbox=""
                srcDoc={apercuMail.html}
                className="mb-[var(--space-admin-3)] h-[420px] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)]"
              />
              {refus !== null ? (
                <p role="status" className="text-[length:var(--text-admin-sm)]">
                  {MESSAGE_REFUS[refus]}
                </p>
              ) : (
                <form action={envoyerQuestionnaireAction} data-bloc="envoi-questionnaire">
                  <input type="hidden" name="rencontreId" value={rencontreId} />
                  <input type="hidden" name="destinataire" value={props.apercu.email} />
                  <input type="hidden" name="prenom" value={props.apercu.prenom} />
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
                  <button type="submit" className={boutonCls}>
                    Envoyer cet e-mail
                  </button>
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
                      <iframe
                        title={`Aperçu : ${a.libelle}`}
                        sandbox=""
                        srcDoc={a.html}
                        className="mt-[var(--space-admin-2)] h-[380px] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)]"
                      />
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {q !== null && refus === null ? (
        <form
          action={demanderEssaiAction}
          data-bloc="essai-suivi"
          className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
        >
          <input type="hidden" name="rencontreId" value={rencontreId} />
          <select name="essai_de" className={inputCls} aria-label="E-mail à tester">
            {ESSAIS.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
          <button type="submit" className={boutonCls}>
            M&apos;envoyer un test
          </button>
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
              <input type="hidden" name="rencontreId" value={rencontreId} />
              <button type="submit" className={boutonCls}>
                Arrêter les rappels
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {q !== null && q.envoyeLe !== null && q.closLe === null ? (
        <form action={cloreQuestionnaireAction} className="mb-[var(--space-admin-3)]">
          <input type="hidden" name="rencontreId" value={rencontreId} />
          <button type="submit" className={boutonCls}>
            Fermer le questionnaire
          </button>
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
                  rencontreId={rencontreId}
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
              <input type="hidden" name="rencontreId" value={rencontreId} />
              <button type="submit" className={boutonCls}>
                Marquer comme lues
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Espace formateur — le bloc « Fin de formation » de la page d'une session (lot G2).
 *
 * Trois gestes, dans l'ordre, sur la page EXISTANTE de la session (aucune route
 * nouvelle) : évaluer chaque stagiaire présent, donner son avis, « Terminer ».
 *
 * Composant SERVEUR, formulaires HTML simples : aucun JavaScript client (la coquille
 * et ses pages n'en embarquent pas), gros boutons, utilisable au téléphone. Le bloc
 * n'est rendu que si la page lui passe une vue : interrupteur allumé, formateur
 * indépendant ayant animé la session, dernière journée passée.
 *
 * Aucune donnée d'accès au domaine ici : la vue est lue par la page, les gestes sont des
 * actions de l'espace qui revérifient tout côté serveur.
 */

import {
  donnerAvisFormAction,
  evaluerStagiaireFormAction,
  terminerBilanFormAction,
} from "@/server/actions/formateur/bilan-fin-formation.actions";

export interface VueBilanFinFormation {
  readonly objectifs: readonly string[];
  readonly stagiaires: ReadonlyArray<{
    readonly enrollmentId: string;
    readonly prenom: string;
    readonly nom: string;
    readonly finale: { readonly niveauGlobal: string; readonly scorePct: number } | null;
  }>;
  readonly avis: { readonly note: number | null; readonly commentaire: string | null } | null;
  readonly termineAt: Date | null;
  readonly etat: {
    readonly restants: number;
    readonly termine: boolean;
    readonly peutTerminer: boolean;
  };
  readonly attenduPourPaiement: boolean;
  readonly motifPaiement: string | null;
}

export interface BilanFinFormationProps {
  readonly sessionId: string;
  readonly vue: VueBilanFinFormation;
  /** Le retour du dernier geste (`?bilan=`), ou `null`. */
  readonly issue: string | null;
}

const NOTES = [
  { valeur: "1", libelle: "Non acquis" },
  { valeur: "2", libelle: "En cours" },
  { valeur: "3", libelle: "Acquis" },
] as const;

const NIVEAU: Record<string, string> = {
  non_acquis: "Non acquis",
  partiellement_acquis: "En cours",
  acquis: "Acquis",
};

/** Ce que dit l'écran après un geste. Court, sans jargon. */
const MESSAGES: Record<string, { texte: string; ok: boolean }> = {
  ok: { texte: "C'est enregistré.", ok: true },
  deja_evalue: { texte: "Ce stagiaire est déjà évalué.", ok: true },
  deja_donne: { texte: "Votre avis est déjà enregistré.", ok: true },
  notes_invalides: { texte: "Choisissez une réponse pour chaque objectif.", ok: false },
  avis_invalide: { texte: "Écrivez quelques lignes (10 caractères au moins).", ok: false },
  incomplet: { texte: "Il reste quelque chose à faire avant de terminer.", ok: false },
  dossier_clos: {
    texte: "Le dossier de cette session est clos : prévenez l'organisme pour cette évaluation.",
    ok: false,
  },
  stagiaire_inconnu: { texte: "Ce stagiaire n'est pas à évaluer ici.", ok: false },
  termine: { texte: "Votre bilan est déjà terminé.", ok: true },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const BOUTON =
  "bg-terracotta inline-flex min-h-12 w-full items-center justify-center rounded-lg px-5 text-base font-semibold text-white hover:opacity-90 sm:w-auto";
const CHOIX =
  "border-border text-mocha peer-checked:bg-terracotta peer-checked:border-terracotta peer-focus-visible:ring-terracotta flex min-h-12 items-center justify-center rounded-lg border px-3 text-center text-sm font-medium peer-checked:text-white peer-focus-visible:ring-2";

export function BilanFinFormation({
  sessionId,
  vue,
  issue,
}: BilanFinFormationProps): React.ReactElement {
  const message = issue !== null ? MESSAGES[issue] : undefined;
  const evalues = vue.stagiaires.filter((s) => s.finale !== null).length;

  return (
    <section
      id="fin-de-formation"
      aria-labelledby="fin-de-formation-titre"
      className="border-terracotta scroll-mt-24 space-y-5 rounded-lg border-2 p-4 sm:p-5"
    >
      <h2 id="fin-de-formation-titre" className="text-espresso font-serif text-xl">
        Fin de formation
      </h2>

      {issue === "termine_ok" || vue.etat.termine ? (
        <div className="bg-sand rounded-lg p-5 text-center">
          <p className="text-mocha text-2xl font-semibold">Merci, c&apos;est terminé.</p>
          <p className="text-mocha mt-2 text-sm">
            Votre bilan est enregistré
            {vue.termineAt !== null ? ` le ${dateFmt.format(vue.termineAt)}` : ""}.
          </p>
          <p className="text-fg-muted mt-1 text-sm">
            {vue.stagiaires.length > 0
              ? `${evalues} stagiaire${evalues > 1 ? "s" : ""} évalué${evalues > 1 ? "s" : ""}, votre avis donné.`
              : "Votre avis est donné."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-mocha text-sm">Trois étapes, quelques minutes.</p>
          {vue.attenduPourPaiement && vue.motifPaiement !== null ? (
            <p className="text-mocha bg-sand rounded-md px-3 py-2 text-sm">
              Paiement : {vue.motifPaiement}.
            </p>
          ) : null}
          {message !== undefined ? (
            <p
              role="status"
              className={`rounded-md px-3 py-2 text-sm font-medium ${message.ok ? "bg-sand text-mocha" : "border-terracotta text-mocha border"}`}
            >
              {message.texte}
            </p>
          ) : null}

          {/* ── 1. Les stagiaires ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-mocha text-base font-semibold">
              1. Vos stagiaires{" "}
              <span className="text-fg-muted font-normal">
                ({evalues} sur {vue.stagiaires.length})
              </span>
            </h3>
            {vue.stagiaires.length === 0 ? (
              <p className="text-fg-muted text-sm">Aucun stagiaire présent à évaluer.</p>
            ) : (
              <ul className="space-y-3">
                {vue.stagiaires.map((s) => (
                  <li key={s.enrollmentId} className="border-border rounded-lg border p-3">
                    <p className="text-mocha font-medium">
                      {s.prenom} {s.nom}
                    </p>
                    {s.finale !== null ? (
                      <p className="text-fg-muted mt-1 text-sm">
                        ✓ Évalué : {NIVEAU[s.finale.niveauGlobal] ?? s.finale.niveauGlobal}
                      </p>
                    ) : (
                      <form action={evaluerStagiaireFormAction} className="mt-2 space-y-3">
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="enrollmentId" value={s.enrollmentId} />
                        {vue.objectifs.map((objectif, k) => (
                          <fieldset key={objectif} className="space-y-1.5">
                            <legend className="text-mocha text-sm">{objectif}</legend>
                            <div className="grid grid-cols-3 gap-2">
                              {NOTES.map((n) => (
                                <label key={n.valeur} className="cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`note-${k}`}
                                    value={n.valeur}
                                    required
                                    className="peer sr-only"
                                  />
                                  <span className={CHOIX}>{n.libelle}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ))}
                        <button type="submit" className={BOUTON}>
                          Enregistrer
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── 2. L'avis ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-mocha text-base font-semibold">2. Votre avis sur la session</h3>
            {vue.avis !== null ? (
              <div className="border-border rounded-lg border p-3 text-sm">
                <p className="text-fg-muted">
                  ✓ Avis donné{vue.avis.note !== null ? ` · ${vue.avis.note}/5` : ""}
                </p>
                {vue.avis.commentaire !== null ? (
                  <p className="text-mocha mt-1 whitespace-pre-line">{vue.avis.commentaire}</p>
                ) : null}
              </div>
            ) : (
              <form action={donnerAvisFormAction} className="space-y-3">
                <input type="hidden" name="sessionId" value={sessionId} />
                <fieldset className="space-y-1.5">
                  <legend className="text-mocha text-sm">Votre note (facultative)</legend>
                  <div className="grid grid-cols-6 gap-2">
                    {["", "1", "2", "3", "4", "5"].map((v) => (
                      <label key={v || "aucune"} className="cursor-pointer">
                        <input
                          type="radio"
                          name="note"
                          value={v}
                          defaultChecked={v === ""}
                          className="peer sr-only"
                        />
                        <span className={CHOIX}>{v === "" ? "—" : v}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block space-y-1.5">
                  <span className="text-mocha text-sm">
                    Quelques lignes : déroulé, incidents, absences, suggestions.
                  </span>
                  <textarea
                    name="commentaire"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    className="border-border text-mocha w-full rounded-lg border p-3 text-base"
                  />
                </label>
                <button type="submit" className={BOUTON}>
                  Enregistrer mon avis
                </button>
              </form>
            )}
          </div>

          {/* ── 3. Terminer ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-mocha text-base font-semibold">3. Terminer</h3>
            {vue.etat.peutTerminer ? (
              <p className="text-mocha text-sm">
                Tout est prêt. Une fois terminé, plus rien ne change.
              </p>
            ) : (
              <ul className="text-fg-muted list-disc pl-5 text-sm">
                {vue.etat.restants > 0 ? (
                  <li>
                    {vue.etat.restants} stagiaire{vue.etat.restants > 1 ? "s" : ""} à évaluer
                  </li>
                ) : null}
                {vue.avis === null ? <li>votre avis à donner</li> : null}
              </ul>
            )}
            <form action={terminerBilanFormAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <button
                type="submit"
                disabled={!vue.etat.peutTerminer}
                className={`${BOUTON} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Terminer
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}

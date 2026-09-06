"use client";
// use-client: état local (formulaire inscription, sélecteur statut, inline portail), useTransition, router.refresh().
/**
 * EnrollmentsSection — Section « Stagiaires » du hub session Qualiopi.
 *
 * - Liste les inscriptions de la session (statut, taux de présence, accès portail).
 * - Formulaire d&apos;inscription : sélecteur parmi les stagiaires disponibles
 *   (signature enrollTraineeAction = { sessionId, traineeId }).
 * - Par inscription : changement de statut (setEnrollmentStatutAction).
 * - Par inscription : génération accès portail (GenererPortailAccesButton) +
 *   révocation (revoquerPortailAccesAction).
 * - router.refresh() après chaque mutation.
 *
 * Tokens admin var(--color-admin-*) — ZÉRO hex.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GenererPortailAccesButton } from "@/components/admin/qualiopi/GenererPortailAccesButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T } | { error: string };

export type EnrollmentStatut = "planifiee" | "presente" | "abandon" | "exclu";

/** Accès portail sérialisé (champs non-sensibles uniquement). */
export interface PortailAccesSerialized {
  id: string;
  expiresAt: string; // ISO string
  revoked: boolean;
}

/** Inscription sérialisée transmise par le Server Component parent. */
export interface EnrollmentSerialized {
  id: string;
  trainee: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
  statut: EnrollmentStatut;
  /** Null tant que non renseigné. */
  tauxPresencePct: number | null;
  /** Adaptations réellement réalisées pour ce bénéficiaire (ind. 10) — null si non renseigné. */
  adaptationsRealisees: string | null;
  /** Date de sortie du dispositif (abandon / exclusion), ISO — null si active. */
  sortieAt: string | null;
  /** Motif de la sortie — null si active. */
  sortieMotif: string | null;
  /** Accès portail actif (non révoqué, non expiré) le plus récent — null si aucun. */
  portailAcces: PortailAccesSerialized | null;
}

/** Stagiaire disponible pour inscription (fourni par le Server Component). */
export interface TraineeSerialized {
  id: string;
  nom: string;
  prenom: string;
  email: string;
}

export interface EnrollmentsSectionProps {
  sessionId: string;
  enrollments: EnrollmentSerialized[];
  /**
   * Les stagiaires proposés au sélecteur d&apos;inscription — une PAGE du
   * registre, plus le registre entier.
   *
   * 🔴 Le parent chargeait `prisma.trainee.findMany` SANS `take` : toute la
   * table était sérialisée vers le navigateur à chaque ouverture d&apos;une
   * fiche session. Tenable sur une base vierge, insoutenable en volume.
   *
   * ⚠️ Un plafond SEUL aurait été pire que le défaut : au-delà de la borne, un
   * stagiaire devient ININSCRIPTIBLE et rien ne le dit — on remplacerait une
   * lenteur par une impossibilité. D&apos;où les trois propriétés qui suivent :
   * elles ne sont pas décoratives, elles sont la contrepartie du plafond.
   */
  availableTrainees: TraineeSerialized[];
  /** Recherche serveur en cours (paramètre `qStagiaire`), « » si aucune. */
  rechercheStagiaire?: string;
  /** Combien de stagiaires au REGISTRE — jamais le compte de la page affichée. */
  totalStagiairesRegistre?: number;
  /** Borne appliquée par le parent, pour dire « N sur M » sans la deviner. */
  plafondStagiaires?: number;
  /** Server Actions injectées par le parent (Server Component). */
  enrollAction: (input: {
    sessionId: string;
    traineeId: string;
  }) => Promise<ActionResult<{ id: string }>>;
  setStatutAction: (input: {
    id: string;
    statut: EnrollmentStatut;
    /** Obligatoire pour une sortie (abandon / exclusion). */
    motif?: string;
  }) => Promise<ActionResult<{ id: string }>>;
  /** Renseigne les adaptations réellement réalisées (ind. 10). */
  setAdaptationsAction: (input: {
    id: string;
    adaptationsRealisees: string;
  }) => Promise<ActionResult<{ id: string }>>;
  genererPortailAction: (input: {
    traineeId: string;
    joursValidite?: number;
  }) => Promise<ActionResult<{ id: string; token: string; url: string; expiresAt: Date }>>;
  revoquerPortailAction: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<EnrollmentStatut, string> = {
  planifiee: "Planifiée",
  presente: "Présente",
  abandon: "Abandon",
  exclu: "Exclu(e)",
};

const STATUT_OPTIONS: Array<{ value: EnrollmentStatut; label: string }> = [
  { value: "planifiee", label: "Planifiée" },
  { value: "presente", label: "Présente" },
  { value: "abandon", label: "Abandon" },
  { value: "exclu", label: "Exclu(e)" },
];

/**
 * Ce statut fait-il SORTIR du dispositif ?
 *
 * 🔑 Dérivé du même couple que `STATUTS_SORTIS` côté serveur. Le client ne peut
 * pas importer le module serveur, mais la garde
 * `sortie-date-et-motif.spec.ts` vérifie que les deux listes restent égales —
 * une divergence ferait proposer un motif sans que le serveur l'exige, ou
 * l'inverse.
 */
export const STATUTS_DE_SORTIE: ReadonlyArray<EnrollmentStatut> = ["abandon", "exclu"];

function estSortie(s: EnrollmentStatut): boolean {
  return STATUTS_DE_SORTIE.includes(s);
}

function statutColor(s: EnrollmentStatut): string {
  if (s === "presente") return "text-[color:var(--color-admin-success)]";
  if (s === "abandon" || s === "exclu") return "text-[color:var(--color-admin-error)]";
  return "text-[color:var(--color-admin-fg-muted)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : ligne stagiaire
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentRowProps {
  enrollment: EnrollmentSerialized;
  setStatutAction: EnrollmentsSectionProps["setStatutAction"];
  setAdaptationsAction: EnrollmentsSectionProps["setAdaptationsAction"];
  genererPortailAction: EnrollmentsSectionProps["genererPortailAction"];
  revoquerPortailAction: EnrollmentsSectionProps["revoquerPortailAction"];
  onMutated: () => void;
}

function EnrollmentRow({
  enrollment,
  setStatutAction,
  setAdaptationsAction,
  genererPortailAction,
  revoquerPortailAction,
  onMutated,
}: EnrollmentRowProps): React.ReactElement {
  const [isPendingStatut, startStatut] = useTransition();
  const [isPendingRevoke, startRevoke] = useTransition();
  const [isPendingAdapt, startAdapt] = useTransition();
  const [statutError, setStatutError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [adaptSaved, setAdaptSaved] = useState(false);
  const [adaptText, setAdaptText] = useState<string>(enrollment.adaptationsRealisees ?? "");
  /**
   * Statut de sortie en attente de son motif.
   *
   * 🔑 On ne pose PAS le statut d'abord pour demander le motif ensuite : une
   * sortie non motivée serait alors enregistrable en fermant l'onglet, et le
   * défaut qu'on corrige reviendrait par la porte de derrière. Le statut et son
   * motif partent ensemble, ou ne partent pas.
   */
  const [sortieEnAttente, setSortieEnAttente] = useState<EnrollmentStatut | null>(null);
  const [motifText, setMotifText] = useState("");

  const inputCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  function handleStatutChange(newStatut: string) {
    const statut = newStatut as EnrollmentStatut;
    setStatutError(null);
    // Une SORTIE réclame son motif avant de partir.
    if (estSortie(statut)) {
      setSortieEnAttente(statut);
      setMotifText(enrollment.sortieMotif ?? "");
      return;
    }
    setSortieEnAttente(null);
    envoyerStatut(statut);
  }

  function envoyerStatut(statut: EnrollmentStatut, motif?: string) {
    startStatut(async () => {
      const res = await setStatutAction({ id: enrollment.id, statut, ...(motif ? { motif } : {}) });
      if ("error" in res) {
        setStatutError(res.error);
      } else {
        setSortieEnAttente(null);
        setMotifText("");
        onMutated();
      }
    });
  }

  function handleRevoquer(portailId: string) {
    setRevokeError(null);
    startRevoke(async () => {
      const res = await revoquerPortailAction({ id: portailId });
      if ("error" in res) {
        setRevokeError(res.error);
      } else {
        onMutated();
      }
    });
  }

  function handleSaveAdaptations() {
    setAdaptError(null);
    setAdaptSaved(false);
    startAdapt(async () => {
      const res = await setAdaptationsAction({
        id: enrollment.id,
        adaptationsRealisees: adaptText.trim(),
      });
      if ("error" in res) {
        setAdaptError(res.error);
      } else {
        setAdaptSaved(true);
        onMutated();
      }
    });
  }

  const adaptDirty = adaptText.trim() !== (enrollment.adaptationsRealisees ?? "");

  const tdCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <tr className="border-b border-[color:var(--color-admin-border)] last:border-b-0">
      {/* Identité */}
      <td className={tdCls}>
        <p className="font-medium">
          {enrollment.trainee.prenom} {enrollment.trainee.nom}
        </p>
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {enrollment.trainee.email}
        </p>
      </td>

      {/* Statut */}
      <td className={tdCls}>
        <select
          value={sortieEnAttente ?? enrollment.statut}
          onChange={(e) => handleStatutChange(e.target.value)}
          disabled={isPendingStatut}
          aria-label={`Statut de ${enrollment.trainee.prenom} ${enrollment.trainee.nom}`}
          className={inputCls}
        >
          {STATUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {statutError && (
          <p
            role="alert"
            className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {statutError}
          </p>
        )}

        {/* Saisie du motif — le statut ne part qu'avec lui. */}
        {sortieEnAttente !== null && (
          <div className="mt-[var(--space-admin-2)]">
            <label
              htmlFor={`motif-${enrollment.id}`}
              className="block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg)]"
            >
              Motif de la sortie
              <span className="text-[color:var(--color-admin-error-fg)]" aria-hidden="true">
                {" *"}
              </span>
            </label>
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Ce que l&apos;auditeur lira à côté du taux d&apos;abandon : santé, emploi retrouvé,
              contenu inadapté, absence prolongée…
            </p>
            <textarea
              id={`motif-${enrollment.id}`}
              value={motifText}
              onChange={(e) => setMotifText(e.target.value)}
              rows={2}
              maxLength={500}
              required
              className={`mt-1 w-full ${inputCls}`}
            />
            <div className="mt-1 flex gap-[var(--space-admin-2)]">
              <button
                type="button"
                disabled={isPendingStatut || motifText.trim() === ""}
                onClick={() => envoyerStatut(sortieEnAttente, motifText.trim())}
                className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent-fg)] disabled:opacity-50"
              >
                Enregistrer la sortie
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortieEnAttente(null);
                  setMotifText("");
                }}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Sortie déjà enregistrée : la date et le motif, lisibles sans clic. */}
        {sortieEnAttente === null && enrollment.sortieAt !== null && (
          <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Sortie le{" "}
            {new Date(enrollment.sortieAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
            {enrollment.sortieMotif !== null && ` — ${enrollment.sortieMotif}`}
          </p>
        )}
        {/* Affichage statut coloré en complément */}
        <p
          className={`mt-1 text-[length:var(--text-admin-xs)] font-semibold ${statutColor(enrollment.statut)}`}
        >
          {STATUT_LABELS[enrollment.statut]}
        </p>
      </td>

      {/* Taux de présence */}
      <td className={tdCls}>
        {enrollment.tauxPresencePct !== null ? (
          <span className="font-medium">{enrollment.tauxPresencePct}&nbsp;%</span>
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
        )}
      </td>

      {/* Adaptations réalisées (ind. 10) */}
      <td className={tdCls}>
        <textarea
          value={adaptText}
          onChange={(e) => {
            setAdaptText(e.target.value);
            setAdaptSaved(false);
          }}
          disabled={isPendingAdapt}
          rows={2}
          maxLength={5000}
          placeholder="Adaptations réalisées (rythme, supports, handicap…)"
          aria-label={`Adaptations réalisées pour ${enrollment.trainee.prenom} ${enrollment.trainee.nom}`}
          className={`${inputCls} min-w-[14rem] resize-y`}
        />
        <div className="mt-1 flex items-center gap-[var(--space-admin-2)]">
          <button
            type="button"
            onClick={handleSaveAdaptations}
            disabled={isPendingAdapt || !adaptDirty}
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {isPendingAdapt ? "Enregistrement…" : "Enregistrer"}
          </button>
          {adaptSaved && !adaptDirty && (
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
              Enregistré
            </span>
          )}
        </div>
        {adaptError && (
          <p
            role="alert"
            className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {adaptError}
          </p>
        )}
      </td>

      {/* Accès portail */}
      <td className={tdCls}>
        <div className="space-y-[var(--space-admin-2)]">
          {/* Générer un nouvel accès */}
          <GenererPortailAccesButton
            traineeId={enrollment.trainee.id}
            genererAction={genererPortailAction}
          />

          {/* Accès portail actif : affichage + révocation */}
          {enrollment.portailAcces !== null && !enrollment.portailAcces.revoked && (
            <div className="mt-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-2)]">
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Accès actif — expire le{" "}
                {new Date(enrollment.portailAcces.expiresAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (enrollment.portailAcces !== null) {
                    handleRevoquer(enrollment.portailAcces.id);
                  }
                }}
                disabled={isPendingRevoke}
                className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                {isPendingRevoke ? "Révocation…" : "Révoquer l’accès"}
              </button>
              {revokeError && (
                <p
                  role="alert"
                  className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
                >
                  {revokeError}
                </p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire d&apos;inscription
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollFormProps {
  sessionId: string;
  availableTrainees: TraineeSerialized[];
  alreadyEnrolledIds: Set<string>;
  enrollAction: EnrollmentsSectionProps["enrollAction"];
  onEnrolled: () => void;
  /** Recherche serveur en cours — voir `EnrollmentsSectionProps`. */
  rechercheStagiaire: string;
  /** Le sélecteur ne montre-t-il qu'une partie du registre ? */
  listeTronquee: boolean;
  totalStagiairesRegistre: number;
}

function EnrollForm({
  sessionId,
  availableTrainees,
  alreadyEnrolledIds,
  enrollAction,
  onEnrolled,
  rechercheStagiaire,
  listeTronquee,
  totalStagiairesRegistre,
}: EnrollFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtrer les stagiaires déjà inscrits
  const candidates = availableTrainees.filter((t) => !alreadyEnrolledIds.has(t.id));

  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedTraineeId) {
      setError("Veuillez sélectionner un stagiaire.");
      return;
    }

    startTransition(async () => {
      const res = await enrollAction({ sessionId, traineeId: selectedTraineeId });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccessMsg("Stagiaire inscrit avec succès.");
        setSelectedTraineeId("");
        onEnrolled();
      }
    });
  }

  /*
   * 🔴 La contrepartie du plafond : la RECHERCHE.
   *
   * Le sélecteur ne montre qu'une page du registre. Sans ce champ, le stagiaire
   * au-delà de la borne serait inatteignable et rien ne le dirait — on aurait
   * remplacé une lenteur par une impossibilité. Formulaire GET pur, sans une
   * ligne de JS : c'est le même recours que celui de `/qualiopi/stagiaires`, et
   * il ne peut pas être imbriqué dans le formulaire d'inscription (deux
   * `<form>` emboîtés sont invalides). D'où le fragment.
   */
  const recherche = (
    <div className="mb-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
      <form method="get" className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <label
          htmlFor="recherche-stagiaire-inscription"
          className="text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
        >
          Chercher dans le registre
        </label>
        <input
          id="recherche-stagiaire-inscription"
          type="search"
          name="qStagiaire"
          defaultValue={rechercheStagiaire}
          placeholder="Nom, prénom, e-mail, entreprise…"
          className="admin-input min-w-[260px]"
        />
        <button type="submit" className="admin-button-secondary">
          Rechercher
        </button>
      </form>
      {listeTronquee && (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
          {`Le sélecteur n'affiche que ${availableTrainees.length} stagiaires sur ${totalStagiairesRegistre} au registre. Celui que vous cherchez n'y est peut-être pas : passez par la recherche ci-dessus.`}
        </p>
      )}
    </div>
  );

  if (candidates.length === 0) {
    return (
      <>
        {recherche}
        {/* Ce message affirmait « tous déjà inscrits ». Depuis la recherche,
            une liste vide veut aussi dire « aucun résultat » — et ces deux
            situations demandent des gestes opposés. */}
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {rechercheStagiaire !== ""
            ? `Aucun stagiaire du registre ne correspond à « ${rechercheStagiaire} », ou ceux qui correspondent sont déjà inscrits à cette session.`
            : "Tous les stagiaires disponibles sont déjà inscrits à cette session."}
        </p>
      </>
    );
  }

  return (
    <>
      {recherche}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="enroll-trainee-select" className={labelCls}>
            Stagiaire
          </label>
          <select
            id="enroll-trainee-select"
            value={selectedTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="">— Choisir un stagiaire</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.prenom} {t.nom} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isPending || !selectedTraineeId} className="admin-button">
          {isPending ? "Inscription…" : "Inscrire"}
        </button>

        {error && (
          <p
            role="alert"
            className="w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            Erreur : {error}
          </p>
        )}
        {successMsg && (
          <p
            role="status"
            className="w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          >
            {successMsg}
          </p>
        )}
      </form>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EnrollmentsSection({
  sessionId,
  enrollments,
  availableTrainees,
  rechercheStagiaire = "",
  totalStagiairesRegistre,
  plafondStagiaires,
  enrollAction,
  setStatutAction,
  setAdaptationsAction,
  genererPortailAction,
  revoquerPortailAction,
}: EnrollmentsSectionProps): React.ReactElement {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  const alreadyEnrolledIds = new Set(enrollments.map((e) => e.trainee.id));

  const thCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <div className="space-y-[var(--space-admin-6)]">
      {/* ── Liste des inscriptions ───────────────────────────────────────── */}
      {enrollments.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun stagiaire inscrit pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Statut</th>
                <th className={thCls}>Présence</th>
                <th className={thCls}>Adaptations (ind. 10)</th>
                <th className={thCls}>Accès portail</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <EnrollmentRow
                  key={enrollment.id}
                  enrollment={enrollment}
                  setStatutAction={setStatutAction}
                  setAdaptationsAction={setAdaptationsAction}
                  genererPortailAction={genererPortailAction}
                  revoquerPortailAction={revoquerPortailAction}
                  onMutated={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Formulaire d&apos;inscription ────────────────────────────────── */}
      <div>
        <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
          Inscrire un stagiaire
        </h3>
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
          <EnrollForm
            sessionId={sessionId}
            availableTrainees={availableTrainees}
            alreadyEnrolledIds={alreadyEnrolledIds}
            enrollAction={enrollAction}
            onEnrolled={refresh}
            rechercheStagiaire={rechercheStagiaire}
            totalStagiairesRegistre={totalStagiairesRegistre ?? availableTrainees.length}
            // La liste est tronquée quand elle touche le plafond du parent, ou
            // quand elle est plus courte que le registre. Deux signaux plutôt
            // qu'un : le second reste juste si le plafond n'est pas transmis.
            listeTronquee={
              (plafondStagiaires !== undefined && availableTrainees.length >= plafondStagiaires) ||
              (totalStagiairesRegistre !== undefined &&
                availableTrainees.length < totalStagiairesRegistre)
            }
          />
        </div>
      </div>
    </div>
  );
}

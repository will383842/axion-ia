// Tableau d'une offre vidéo freelance et filtres de la vue « Monteurs &
// vidéastes ». Composants SERVEUR, sortis de `page.tsx` pour être testés seuls
// (un fichier `page` ne peut exporter que sa page).

import Link from "next/link";
import { AdminCard, AdminBadge, AdminEmptyState } from "@/components/admin/ui";
import {
  PLAFOND_LECTURE_VIDEO,
  PLAFOND_VIDEO_FREELANCE,
  type CandidatVideo,
  type OffreVideo,
} from "@/features/admin-job-applications/video-freelance";
import { LIBELLE_STATUT, STATUTS_CANDIDATURE, TON_STATUT } from "@/content/recrutement/statuts";
import {
  montantEnCentimes,
  valeurAffichee,
  type ScreeningQuestion,
} from "@/lib/careers/screening-answers";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { BoutonVideos } from "./BoutonVideos";

const MASQUE = "—";
const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

/** Les paramètres d'adresse de la vue, lus une fois. */
export interface Etat {
  tri: string;
  sens: "asc" | "desc";
  prixMax: string;
  ville: string;
  etape: string;
}

export function hrefAvec(chemin: string, etat: Etat, change: Partial<Etat>): string {
  const e = { ...etat, ...change };
  const p = new URLSearchParams();
  if (e.tri) p.set("tri", e.tri);
  if (e.sens === "desc") p.set("sens", "desc");
  if (e.prixMax) p.set("prixMax", e.prixMax);
  if (e.ville) p.set("ville", e.ville);
  if (e.etape) p.set("etape", e.etape);
  const qs = p.toString();
  return qs ? `${chemin}?${qs}` : chemin;
}

/** « 1 200 € », « 49,90 € » — jamais « HT » (règle de Will). */
function euros(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centimes / 100);
}

/** Une réponse libre, avec ses liens cliquables (exemples de montages, rushes). */
function Reponse({ texte }: { texte: string | undefined }) {
  if (!texte) return <span className="admin-meta-small">{MASQUE}</span>;
  const morceaux = texte.split(URL_RE);
  return (
    <span className="block max-w-[22rem] text-sm whitespace-pre-wrap">
      {morceaux.map((m, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={m}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline"
          >
            {m}
          </a>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </span>
  );
}

/** Un prix : le montant, ou « à préciser » avec la saisie d'origine dessous. */
function Prix({ brut }: { brut: string | undefined }) {
  const c = montantEnCentimes(brut);
  if (c !== null) return <span className="font-semibold whitespace-nowrap">{euros(c)}</span>;
  return (
    <span className="block max-w-[14rem]">
      <span className="admin-meta-small">à préciser</span>
      {brut ? <span className="admin-meta-small block truncate">« {brut} »</span> : null}
    </span>
  );
}

/** Libellé court de colonne : le début de la question, jusqu'à sa première ponctuation. */
function entete(label: string): string {
  const court = label.split(/[:?(]/)[0]?.trim() ?? label;
  return court.length > 40 ? `${court.slice(0, 39)}…` : court;
}

function titreQuestion(q: ScreeningQuestion, prix: boolean): string {
  if (prix && q.court) return `Prix ${q.court}`;
  return entete(q.labelFr ?? q.id);
}

// Sur téléphone, le tableau DÉFILE horizontalement comme les autres tableaux de
// la console (décision de Will du 07/10 : pas de lignes en cartes).
const TD =
  "border-b border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-4)] align-top";
const TH =
  "border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold whitespace-nowrap text-[color:var(--color-admin-fg-muted)] uppercase";

interface Colonne {
  key: string;
  titre: React.ReactNode;
  tri?: "asc" | "desc" | "none";
  cell: (c: CandidatVideo) => React.ReactNode;
}

export function TableauOffre({
  offre,
  base,
  chemin,
  etat,
}: {
  offre: OffreVideo;
  base: string;
  chemin: string;
  etat: Etat;
}) {
  const prixIds = new Set(offre.questionsPrix);
  const prix = offre.questions.filter((q) => prixIds.has(q.id));
  const autres = offre.questions.filter((q) => !prixIds.has(q.id));
  const questionTri = offre.questions.find((q) => q.id === offre.questionTri);

  const colonnes: Colonne[] = [
    {
      key: "candidat",
      titre: "Candidat",
      cell: (c) => (
        <Link
          href={`${base}/${c.id}`}
          className="inline-flex min-h-11 items-center font-medium underline"
        >
          {c.nom ?? "masqué"}
        </Link>
      ),
    },
    { key: "ville", titre: "Ville", cell: (c) => c.ville ?? MASQUE },
    ...prix.map((q): Colonne => {
      const actif = offre.questionTri === q.id;
      const prochain = actif && offre.sens === "asc" ? "desc" : "asc";
      const titre = `${titreQuestion(q, true)}${q.required ? " *" : ""}`;
      return {
        key: `q_${q.id}`,
        tri: actif ? offre.sens : "none",
        titre: (
          <Link
            href={hrefAvec(chemin, etat, { tri: q.id, sens: prochain })}
            className="inline-flex min-h-11 items-center gap-1 underline-offset-2 hover:underline"
            title={prochain === "asc" ? "Du moins cher au plus cher" : "Du plus cher au moins cher"}
          >
            {titre}
            <span aria-hidden="true">{actif ? (offre.sens === "asc" ? "↑" : "↓") : "↕"}</span>
          </Link>
        ),
        cell: (c) => <Prix brut={c.reponses[q.id]} />,
      };
    }),
    {
      key: "videos",
      titre: "Vidéos",
      cell: (c) =>
        c.nom !== null && (c.videos.length > 0 || c.liens.length > 0) ? (
          <BoutonVideos
            nom={c.nom}
            ficheHref={`${base}/${c.id}`}
            videos={c.videos}
            liens={c.liens}
          />
        ) : (
          <span className="admin-meta-small">{c.nom === null ? MASQUE : "Aucune vidéo"}</span>
        ),
    },
    {
      key: "statut",
      titre: "Statut",
      cell: (c) => <AdminBadge tone={TON_STATUT[c.status]}>{LIBELLE_STATUT[c.status]}</AdminBadge>,
    },
    {
      key: "depot",
      titre: "Reçue le",
      cell: (c) => formatDateFrShort(c.submittedAt),
    },
    ...autres.map((q): Colonne => {
      const titre = `${titreQuestion(q, false)}${q.required ? " *" : ""}`;
      return {
        key: `q_${q.id}`,
        titre,
        cell: (c) => {
          const brut = c.reponses[q.id];
          return <Reponse texte={brut ? valeurAffichee(q, brut) : undefined} />;
        },
      };
    }),
  ];

  const filtre = Boolean(etat.prixMax || etat.ville || etat.etape);
  return (
    <AdminCard className="mb-[var(--space-admin-5)]">
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="admin-section-title">{offre.titre}</h2>
        <span className="admin-meta-small">
          {filtre ? `${offre.retenus} sur ${offre.total}` : offre.total} candidature
          {offre.total > 1 ? "s" : ""}
          {offre.retenus > offre.candidats.length
            ? ` · ${PLAFOND_VIDEO_FREELANCE} premières affichées`
            : ""}
          {offre.lectureTronquee
            ? ` · classement sur les ${PLAFOND_LECTURE_VIDEO} plus récentes`
            : ""}
          {offre.offerId ? (
            <>
              {" · "}
              <Link href={`${base}?offerId=${offre.offerId}`} className="underline">
                gérer dans la liste
              </Link>
            </>
          ) : null}
        </span>
      </div>
      {questionTri ? (
        <p className="admin-meta-small mb-[var(--space-admin-3)]">
          Classé par {titreQuestion(questionTri, true).toLowerCase()},{" "}
          {offre.sens === "asc" ? "du moins cher au plus cher" : "du plus cher au moins cher"} · « à
          préciser » en bas.
        </p>
      ) : null}
      {offre.candidats.length === 0 ? (
        <AdminEmptyState
          title={
            filtre ? "Personne ne correspond à ces filtres." : "Aucune candidature pour l'instant."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-admin-sm)] [font-variant-numeric:tabular-nums]">
            <caption className="sr-only">Candidatures — {offre.titre}</caption>
            <thead>
              <tr>
                {colonnes.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={TH}
                    aria-sort={
                      col.tri === "asc"
                        ? "ascending"
                        : col.tri === "desc"
                          ? "descending"
                          : col.tri === "none"
                            ? "none"
                            : undefined
                    }
                  >
                    {col.titre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offre.candidats.map((c) => (
                <tr key={c.id} className="hover:bg-[color:var(--color-admin-surface-hover)]">
                  {colonnes.map((col) => (
                    <td key={col.key} className={TD}>
                      {col.cell(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}

export function Filtres({ etat, chemin, ouvert }: { etat: Etat; chemin: string; ouvert: boolean }) {
  const actif = Boolean(etat.prixMax || etat.ville || etat.etape);
  return (
    <form
      method="get"
      action={chemin}
      className="mb-[var(--space-admin-5)] flex flex-wrap items-end gap-3"
      aria-label="Filtrer les candidatures"
    >
      {etat.tri ? <input type="hidden" name="tri" value={etat.tri} /> : null}
      {etat.sens === "desc" ? <input type="hidden" name="sens" value="desc" /> : null}
      {ouvert ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Prix max (€)
            <input
              name="prixMax"
              defaultValue={etat.prixMax}
              inputMode="decimal"
              placeholder="ex. 100"
              className="admin-input min-h-11 w-28 text-base sm:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ville
            <input
              name="ville"
              defaultValue={etat.ville}
              placeholder="ex. Lyon"
              className="admin-input min-h-11 w-40 text-base sm:text-sm"
            />
          </label>
        </>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Statut
        <select
          name="etape"
          defaultValue={etat.etape}
          className="admin-input min-h-11 text-base sm:text-sm"
        >
          <option value="">Tous les statuts</option>
          {STATUTS_CANDIDATURE.map((s) => (
            <option key={s} value={s}>
              {LIBELLE_STATUT[s]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="admin-button min-h-11">
        Filtrer
      </button>
      {actif ? (
        <Link
          href={hrefAvec(chemin, etat, { prixMax: "", ville: "", etape: "" })}
          className="admin-button-ghost inline-flex min-h-11 items-center"
        >
          Tout afficher
        </Link>
      ) : null}
    </form>
  );
}

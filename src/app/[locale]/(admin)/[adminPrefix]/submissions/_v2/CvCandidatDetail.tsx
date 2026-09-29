// CV + analyse d'un candidat apporteur (2026-09-28).
//
// Trois morceaux, lus dans `details` par `lib/commercial-application/cv-candidat` :
//   · le cadre « a postulé pour un poste SALARIÉ » — à lever pendant l'échange ;
//   · l'analyse du CV (l'essentiel et l'avis) — EN PREMIER, c'est ce qu'on lit
//     avant de décrocher ;
//   · ce que dit le CV, et le fichier à télécharger.
// Server Component pur : les parties longues sont des <details> natifs.

import { AdminBadge } from "@/components/admin/ui";
import { formatDateFr } from "@/lib/format-date-fr";
import {
  PROFILS_APPORTEUR,
  type CandidatureSalariee,
  type CvCandidat,
} from "@/lib/commercial-application/cv-candidat";

const CANAUX: Record<string, string> = { indeed: "Indeed" };

export function CadreCandidatureSalariee({ info }: { info: CandidatureSalariee }) {
  return (
    <div className="admin-card admin-card-wide">
      <p className="admin-alert admin-alert-warning" role="note">
        <strong>A postulé pour un poste de commercial SALARIÉ</strong> — via{" "}
        {CANAUX[info.canal] ?? info.canal}
        {info.annonce ? <>, annonce « {info.annonce} »</> : null}. La personne est suivie dans le
        tunnel des apporteurs d&apos;affaires : pendant l&apos;échange, vérifier qu&apos;elle
        accepte un statut d&apos;indépendant rémunéré à la commission, sans salaire.
      </p>
    </div>
  );
}

function Liste({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-[var(--space-admin-2)] list-disc space-y-[var(--space-admin-1)] pl-[var(--space-admin-5)] text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)]">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="admin-dt">{label}</dt>
      <dd className="admin-dd">{value}</dd>
    </>
  );
}

function Paragraphe({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)] text-[color:var(--color-admin-fg)]"
      style={{ whiteSpace: "pre-wrap" }}
    >
      {children}
    </p>
  );
}

function tailleLisible(octets: number | null): string {
  if (octets === null) return "";
  return octets >= 1024 * 1024
    ? ` · ${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`
    : ` · ${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export function CvCandidatDetail({ cv, cvHref }: { cv: CvCandidat; cvHref: string }) {
  const { fichier, extrait: x, analyse: a } = cv;
  const profil = a?.profilApporteur ? PROFILS_APPORTEUR[a.profilApporteur] : null;

  return (
    <>
      {a ? (
        <div className="admin-card admin-card-wide">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
            <h2 className="admin-h2">Analyse du CV</h2>
            {profil ? <AdminBadge tone={profil.tone}>{profil.label}</AdminBadge> : null}
          </div>
          {a.resume ? <Paragraphe>{a.resume}</Paragraphe> : null}
          {a.pointsForts.length > 0 ? (
            <>
              <h3 className="admin-h3 mt-[var(--space-admin-4)]">Ce qui est important</h3>
              <Liste items={a.pointsForts} />
            </>
          ) : null}
          {a.pointsVigilance.length > 0 ? (
            <>
              <h3 className="admin-h3 mt-[var(--space-admin-4)]">Points de vigilance</h3>
              <Liste items={a.pointsVigilance} />
            </>
          ) : null}
          {a.avis ? (
            <>
              <h3 className="admin-h3 mt-[var(--space-admin-4)]">Mon avis</h3>
              <Paragraphe>{a.avis}</Paragraphe>
            </>
          ) : null}
          <p className="admin-meta-small mt-[var(--space-admin-4)]">
            Analyse rédigée par Claude à la lecture du CV
            {cv.analyseLe ? `, le ${formatDateFr(cv.analyseLe)}` : ""}. Elle ne reprend ni âge, ni
            situation familiale, ni santé, ni nationalité.
          </p>
        </div>
      ) : null}

      <div className="admin-card">
        <h2 className="admin-h2">CV</h2>
        {fichier ? (
          <p className="text-[length:var(--text-admin-base)]">
            <a href={cvHref} className="admin-link">
              Télécharger le CV ({fichier.nomOriginal}
              {tailleLisible(fichier.tailleOctets)})
            </a>
          </p>
        ) : (
          <p className="admin-meta-small">Aucun fichier attaché.</p>
        )}
        {x ? (
          <dl className="admin-dl mt-[var(--space-admin-4)]">
            {x.titre ? <Row label="Titre du CV" value={x.titre} /> : null}
            {x.ville || x.pays ? (
              <Row
                label="Lieu"
                value={[x.ville, x.pays && x.pays !== "France" ? x.pays : null]
                  .filter(Boolean)
                  .join(" — ")}
              />
            ) : null}
            {x.email ? <Row label="E-mail lu sur le CV" value={x.email} /> : null}
            {x.telephone ? <Row label="Téléphone lu sur le CV" value={x.telephone} /> : null}
            {x.linkedin ? <Row label="LinkedIn" value={x.linkedin} /> : null}
            {x.experienceCommercialeAnnees !== null ? (
              <Row
                label="Expérience commerciale (estimée)"
                value={`${x.experienceCommercialeAnnees} an${x.experienceCommercialeAnnees > 1 ? "s" : ""}${
                  x.experienceB2B === true
                    ? " — dont B2B"
                    : x.experienceB2B === false
                      ? " — pas de B2B"
                      : ""
                }`}
              />
            ) : null}
            {x.permis || x.vehicule !== null ? (
              <Row
                label="Permis / véhicule"
                value={[
                  x.permis ? `Permis ${x.permis}` : null,
                  x.vehicule === true ? "véhiculé" : x.vehicule === false ? "non véhiculé" : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}
            {x.langues.length > 0 ? <Row label="Langues" value={x.langues.join(", ")} /> : null}
          </dl>
        ) : null}
        {x && x.competences.length > 0 ? (
          <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
            {x.competences.map((c) => (
              <AdminBadge key={c} tone="neutral">
                {c}
              </AdminBadge>
            ))}
          </div>
        ) : null}
      </div>

      {x && (x.experiences.length > 0 || x.formations.length > 0) ? (
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Parcours lu sur le CV</h2>
          <div className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]">
            {x.experiences.map((e, i) => (
              <details key={i} className="admin-card" open={i === 0}>
                <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-semibold select-none">
                  {e.poste} — {e.entreprise}
                  {e.periode ? ` · ${e.periode}` : ""}
                </summary>
                <dl className="admin-dl mt-[var(--space-admin-3)]">
                  {e.lieu ? <Row label="Lieu" value={e.lieu} /> : null}
                  {e.resume ? <Row label="En bref" value={e.resume} /> : null}
                </dl>
              </details>
            ))}
          </div>
          {x.formations.length > 0 ? (
            <>
              <h3 className="admin-h3 mt-[var(--space-admin-4)]">Formation</h3>
              <Liste
                items={x.formations.map(
                  (f) =>
                    `${f.diplome}${f.etablissement ? ` — ${f.etablissement}` : ""}${f.annee ? ` (${f.annee})` : ""}`,
                )}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

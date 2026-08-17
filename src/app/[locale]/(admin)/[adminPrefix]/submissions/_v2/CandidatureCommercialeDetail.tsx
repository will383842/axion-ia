// Détail structuré d’une candidature commerciale (tunnel sans CV 2026-08-12).
//
// Rend le bloc `details.candidature` d’une Submission recrutement : profil en
// lignes lisibles, chips IA / informatique / zone, expériences en accordéons
// anti-chronologiques. Server Component pur — les accordéons sont des
// <details> natifs, zéro JS client. Lecture DÉFENSIVE : le JSON vient de la
// base, un enregistrement partiel ne doit jamais casser la fiche.

import { AdminBadge } from "@/components/admin/ui";
import {
  B2B_ANNEES_OPTIONS,
  DEPLACEMENT_OPTIONS,
  IA_OUTILS_OPTIONS,
  INFORMATIQUE_USAGES_OPTIONS,
  SOURCE_OPTIONS,
  STATUT_OPTIONS,
  TYPES_CLIENTS_OPTIONS,
  formatMoisAnnee,
  optionLabel,
} from "@/lib/commercial-application/model";

// ── Lecture défensive du JSON ───────────────────────────────────────────────

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

interface ExperienceRow {
  entreprise: string;
  ville: string;
  poste: string;
  periode: string;
  clients: string;
}

function readExperiences(v: unknown): ExperienceRow[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((raw) => {
    const e = asObject(raw);
    if (!e) return [];
    const posteActuel = asBool(e.posteActuel) === true;
    const debut = formatMoisAnnee(asString(e.debut) ?? undefined);
    const fin = posteActuel ? "aujourd’hui" : formatMoisAnnee(asString(e.fin) ?? undefined);
    return [
      {
        entreprise: asString(e.entreprise) ?? "—",
        ville: asString(e.ville) ?? "—",
        poste: asString(e.poste) ?? "—",
        periode: `${debut} → ${fin}`,
        clients: asStringArray(e.typesClients)
          .map((t) => optionLabel(TYPES_CLIENTS_OPTIONS, t))
          .join(", "),
      },
    ];
  });
}

// ── UI ──────────────────────────────────────────────────────────────────────

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-2)]">
      {items.map((label) => (
        <AdminBadge key={label} tone="neutral">
          {label}
        </AdminBadge>
      ))}
    </div>
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

export function CandidatureCommercialeDetail({
  candidature,
}: {
  candidature: Record<string, unknown>;
}) {
  const c = candidature;
  const b2b = asObject(c.b2b);
  const ia = asObject(c.ia);
  const informatique = asObject(c.informatique);
  const zone = asObject(c.zone);
  const experiences = readExperiences(c.experiences);
  const pitch = asString(c.pitch);
  const messageLibre = asString(c.messageLibre);

  const iaOutils = ia
    ? asStringArray(ia.outils).map((id) =>
        id === "autre" && asString(ia.outilAutre)
          ? `Autre (${asString(ia.outilAutre)})`
          : optionLabel(IA_OUTILS_OPTIONS, id),
      )
    : [];
  const infoUsages = informatique
    ? asStringArray(informatique.usages).map((id) =>
        id === "autre" && asString(informatique.usageAutre)
          ? `Autre (${asString(informatique.usageAutre)})`
          : optionLabel(INFORMATIQUE_USAGES_OPTIONS, id),
      )
    : [];
  const zones = zone ? asStringArray(zone.zones) : [];
  const zoneMobile = zone ? asBool(zone.mobile) === true : false;

  return (
    <>
      <div className="admin-card">
        <h2 className="admin-h2">Profil candidat</h2>
        <dl className="admin-dl">
          {asString(c.ville) ? (
            <Row
              label="Ville"
              value={`${asString(c.ville)}${asString(c.codePostal) ? ` (${asString(c.codePostal)})` : ""}`}
            />
          ) : null}
          {asString(c.dateNaissance) ? (
            <Row label="Date de naissance" value={asString(c.dateNaissance) as string} />
          ) : null}
          {asString(c.nationalite) ? (
            <Row label="Nationalité" value={asString(c.nationalite) as string} />
          ) : null}
          {b2b ? (
            <Row
              label="Expérience B2B"
              value={
                asBool(b2b.dejaVendu) === true
                  ? `Oui — ${optionLabel(B2B_ANNEES_OPTIONS, asString(b2b.annees) ?? undefined)}`
                  : "Non (prérequis non rempli)"
              }
            />
          ) : null}
          {asString(c.disponibilite) ? (
            <Row
              label="Disponibilité"
              value={formatMoisAnnee(asString(c.disponibilite) as string)}
            />
          ) : null}
          {asBool(c.permisVehicule) !== null ? (
            <Row label="Permis + véhicule" value={asBool(c.permisVehicule) ? "Oui" : "Non"} />
          ) : null}
          {asString(c.statut) ? (
            <Row label="Statut" value={optionLabel(STATUT_OPTIONS, asString(c.statut) as string)} />
          ) : null}
          {asString(c.deplacement) ? (
            <Row
              label="Déplacement clients"
              value={optionLabel(DEPLACEMENT_OPTIONS, asString(c.deplacement) as string)}
            />
          ) : null}
          {asString(c.linkedin) ? (
            <Row label="LinkedIn" value={asString(c.linkedin) as string} />
          ) : null}
          {asString(c.sourceConnaissance) ? (
            <Row
              label="A connu l’offre via"
              value={optionLabel(SOURCE_OPTIONS, asString(c.sourceConnaissance) as string)}
            />
          ) : null}
        </dl>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Zone et outils</h2>
        <dl className="admin-dl">
          <Row
            label="Zone souhaitée"
            value={zoneMobile ? "Peu importe — mobile" : zones.length > 0 ? "" : "—"}
          />
        </dl>
        {!zoneMobile ? <ChipList items={zones} /> : null}
        <dl className="admin-dl mt-[var(--space-admin-4)]">
          <Row label="IA au quotidien" value={ia && asBool(ia.utilise) === true ? "Oui" : "Non"} />
        </dl>
        <ChipList items={iaOutils} />
        {ia && asString(ia.usage) ? (
          <p
            className="admin-meta-small mt-[var(--space-admin-2)]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {asString(ia.usage)}
          </p>
        ) : null}
        <dl className="admin-dl mt-[var(--space-admin-4)]">
          <Row
            label="Informatique au travail"
            value={informatique && asBool(informatique.utilise) === true ? "Oui" : "Non"}
          />
        </dl>
        <ChipList items={infoUsages} />
      </div>

      {experiences.length > 0 ? (
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Parcours — 10 dernières années ({experiences.length})</h2>
          <div className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]">
            {experiences.map((e, i) => (
              <details key={i} className="admin-card" open={i === 0}>
                <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-semibold select-none">
                  {e.poste} — {e.entreprise} · {e.periode}
                </summary>
                <dl className="admin-dl mt-[var(--space-admin-3)]">
                  <Row label="Entreprise" value={e.entreprise} />
                  <Row label="Ville / département" value={e.ville} />
                  <Row label="Poste" value={e.poste} />
                  <Row label="Période" value={e.periode} />
                  {e.clients ? <Row label="Types de clients" value={e.clients} /> : null}
                </dl>
              </details>
            ))}
          </div>
        </div>
      ) : null}

      {pitch ? (
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Le candidat en quelques lignes</h2>
          <p
            className="text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)] text-[color:var(--color-admin-fg)]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {pitch}
          </p>
        </div>
      ) : null}

      {messageLibre ? (
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Message libre</h2>
          <p
            className="text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)] text-[color:var(--color-admin-fg)]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {messageLibre}
          </p>
        </div>
      ) : null}
    </>
  );
}

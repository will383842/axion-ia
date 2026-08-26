// Vue d'une rubrique du dossier société (server component) : les pièces
// déposées, leur état d'échéance, et le formulaire d'import.
//
// L'état d'échéance est calculé ICI, au rendu, à partir de la date stockée —
// jamais lu depuis une colonne de statut, qui serait fausse dès le lendemain.

import {
  listSocieteDocsByRubrique,
  typesPresentsDansRubrique,
} from "@/server/societe-documents/queries";
import {
  getRubriqueBySegment,
  labelSocieteDocType,
  typesAttendusDeRubrique,
  typesManquants,
  type SocieteRubriqueKey,
} from "@/server/societe-documents/rubriques";
import {
  calculerEcheance,
  libelleEcheance,
  type EtatEcheance,
} from "@/server/societe-documents/echeance";
import { SocieteDocForm } from "./SocieteDocForm";
import { SocieteDocActions } from "./SocieteDocActions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `null` → chaîne vide plutôt que « Invalid Date ». */
function formatDate(d: Date | null): string {
  return d ? DATE_FR.format(d) : "";
}

/** Sérialise une date en `AAAA-MM-JJ` pour un `<input type="date">`. */
function pourChampDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * Habillage d'un état d'échéance.
 *
 * Le libellé porte toujours l'information : la couleur ne fait que la répéter,
 * pour rester lisible en niveaux de gris comme pour un daltonien.
 */
const ETAT_CLASSES: Record<EtatEcheance, string> = {
  sans_echeance: "border-border text-fg-muted",
  a_jour:
    "border-[color:var(--color-admin-success-fg)] text-[color:var(--color-admin-success-fg)] bg-[color:var(--color-admin-success-soft)]",
  bientot:
    "border-[color:var(--color-admin-warning-fg)] text-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)]",
  perimee:
    "border-[color:var(--color-admin-destructive-fg)] text-[color:var(--color-admin-destructive-fg)] bg-[color:var(--color-admin-destructive-soft)]",
};

interface Props {
  segment: string;
  adminPrefix: string;
  /** Injecté par les tests ; en production, l'instant du rendu. */
  maintenant?: Date;
}

export async function SocieteDocRubriqueView({
  segment,
  adminPrefix,
  maintenant = new Date(),
}: Props): Promise<React.ReactElement> {
  const rubrique = getRubriqueBySegment(segment);
  if (!rubrique) {
    return <p className="text-fg-muted text-sm">Rubrique inconnue&nbsp;: {segment}</p>;
  }

  const cle = rubrique.key as SocieteRubriqueKey;
  const [docs, presents] = await Promise.all([
    listSocieteDocsByRubrique(cle),
    typesPresentsDansRubrique(cle),
  ]);
  const manquants = typesManquants(cle, presents);
  const attendus = typesAttendusDeRubrique(cle);
  const couverts = attendus.length - manquants.length;
  const fichiersBase = `/fr/${adminPrefix}/societe/fichiers`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-mocha mb-1 text-xl font-semibold">{rubrique.label}</h1>
          <p className="text-fg-muted max-w-prose text-sm">{rubrique.description}</p>
          {/*
            ⚠️ La phrase est construite en UNE expression, pas en alternant
            texte JSX et accolades. Écrit ainsi — `attendue{n > 1 ? "s" : ""}`
            — Prettier passe à la ligne avant l'accolade, et JSX transforme ce
            retour en ESPACE : l'écran affichait « sur 10 attendue s ». Ni le
            typecheck ni les tests ne voient ce défaut ; seule la page rendue.
          */}
          <p className="text-fg-muted mt-2 text-sm font-medium tabular-nums">
            {`${couverts} pièce${couverts > 1 ? "s" : ""} sur ${attendus.length} attendue${
              attendus.length > 1 ? "s" : ""
            }`}
          </p>
        </div>
        <SocieteDocForm types={rubrique.types} />
      </div>

      {docs.length === 0 ? (
        <div className="border-border text-fg-muted rounded-lg border border-dashed bg-[color:var(--color-admin-paper)] p-8 text-center text-sm">
          Aucune pièce dans cette rubrique. Cliquez sur «&nbsp;Importer une pièce&nbsp;» pour en
          déposer une.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const echeance = calculerEcheance(doc.dateExpiration, maintenant);
            const peutOuvrir = !doc.sensitive && doc.mimeType === "application/pdf";
            return (
              <li
                key={doc.id}
                className="border-border rounded-lg border bg-[color:var(--color-admin-paper)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-mocha text-sm font-semibold">{doc.titre}</span>
                      <span className="border-border text-fg-muted rounded border px-1.5 py-0.5 text-[11px]">
                        {labelSocieteDocType(doc.type)}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${ETAT_CLASSES[echeance.etat]}`}
                      >
                        {libelleEcheance(echeance)}
                      </span>
                      {doc.sensitive ? (
                        <span className="rounded bg-[color:var(--color-admin-destructive-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--color-admin-destructive-fg)]">
                          confidentielle
                        </span>
                      ) : null}
                    </div>

                    {doc.description ? (
                      <p className="text-fg-muted mt-1 text-xs">{doc.description}</p>
                    ) : null}

                    <p className="text-fg-muted mt-1 text-[11px]">
                      {doc.dateEmission ? <>Émise le {formatDate(doc.dateEmission)}</> : null}
                      {doc.dateEmission && doc.dateExpiration ? " · " : null}
                      {doc.dateExpiration ? (
                        <>valable jusqu&apos;au {formatDate(doc.dateExpiration)}</>
                      ) : null}
                      {doc.numeroPiece ? <> · n° {doc.numeroPiece}</> : null}
                    </p>

                    <p className="text-fg-muted mt-1 font-mono text-[11px]">
                      {doc.fileName} · {formatBytes(doc.sizeBytes)} · déposé le{" "}
                      {formatDate(doc.createdAt)}
                    </p>

                    <div className="mt-2 flex items-center gap-4">
                      <a
                        href={`${fichiersBase}/${doc.id}?dl=1`}
                        className="text-terracotta text-xs font-medium underline"
                      >
                        Télécharger
                      </a>
                      {peutOuvrir ? (
                        <a
                          href={`${fichiersBase}/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-terracotta text-xs font-medium underline"
                        >
                          Ouvrir
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <SocieteDocActions
                    types={rubrique.types}
                    piece={{
                      id: doc.id,
                      type: doc.type,
                      titre: doc.titre,
                      description: doc.description,
                      numeroPiece: doc.numeroPiece,
                      dateEmission: pourChampDate(doc.dateEmission),
                      dateExpiration: pourChampDate(doc.dateExpiration),
                      sensitive: doc.sensitive,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        🔴 CE QUI MANQUE, ET POURQUOI C'EST EN BAS MAIS PAS EN PETIT.
        Un dossier fournisseur ne se lit pas par ce qu'il contient : il se lit
        par ses TROUS. La première version de cet écran n'affichait que les
        pièces déposées — une armoire qui montre son contenu et tait ce qui
        lui manque. Un onglet vide disait « Aucune pièce », sans nommer les
        onze qu'un acheteur va réclamer.
      */}
      {manquants.length > 0 ? (
        <section className="mt-6 rounded-lg border border-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)] p-5">
          <h2 className="mb-2 text-sm font-semibold text-[color:var(--color-admin-warning-fg)]">
            {manquants.length === 1
              ? "Une pièce attendue n'est pas encore déposée"
              : `${manquants.length} pièces attendues ne sont pas encore déposées`}
          </h2>
          {/*
            🔑 CHAQUE LIGNE PORTE SON PROPRE BOUTON D'IMPORT.
            Nommer le manque sans offrir le geste obligeait à remonter en
            haut de page, rouvrir le formulaire général, puis retrouver la
            pièce dans un menu de dix entrées — trois gestes pour une
            intention déjà exprimée par le clic. Le bouton pré-remplit la
            nature ET le titre : il reste à choisir le fichier.
          */}
          <ul className="space-y-2">
            {manquants.map((t) => (
              <li key={t.key} className="text-sm">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <p className="min-w-0 flex-1">
                    <span className="text-mocha font-medium">{t.label}</span>
                    {t.motif ? <span className="text-fg-muted"> — {t.motif}</span> : null}
                  </p>
                  <SocieteDocForm
                    types={rubrique.types}
                    typeInitial={t.key}
                    titreInitial={t.label}
                    labelBouton="Importer"
                    variante="ligne"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 rounded-lg border border-[color:var(--color-admin-success-fg)] bg-[color:var(--color-admin-success-soft)] p-4 text-sm font-medium text-[color:var(--color-admin-success-fg)]">
          Toutes les pièces attendues de cette rubrique sont déposées.
        </p>
      )}
    </div>
  );
}

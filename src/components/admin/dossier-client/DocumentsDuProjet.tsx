/**
 * La rubrique « Documents » de la page d'un projet (ADR 0063 ; écrans et
 * libellés de 2-ux.md et 2-maquette.html).
 *
 *   · `DocumentsDuProjet` (serveur, asynchrone) lit la rubrique — métadonnées
 *     seulement, jamais les octets — puis rend…
 *   · `CarteDocuments` (sans base, testée telle quelle) : deux groupes
 *     « Envoyé au client » / « Interne », le plus récent en haut, les archivés
 *     à part, l'état vide utile, le formulaire d'ajout.
 *
 * 🔴 Appelée par la page du projet APRÈS `gardeLectureEchanges` (décision A2).
 * Tout en texte brut : aucun HTML venant d'une donnée n'est interprété.
 * Pas de « Supprimer » ni de « Modifier » : on archive, on réaffiche ; une
 * nouvelle version est un nouveau document.
 */

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AjouterDocument } from "@/components/admin/dossier-client/AjouterDocument";
import { CopierLienClient } from "@/components/admin/dossier-client/DocumentsInteractifs";
import {
  archiverDocumentFormAction,
  reafficherDocumentFormAction,
} from "@/features/dossier-client/documents/actions";
import { FORMATS, tailleLisible } from "@/features/dossier-client/documents/formats";
import { aujourdhuiAParis } from "@/features/dossier-client/documents/ajouter";
import { cheminDocument } from "@/features/dossier-client/documents/jeton";
import { domaineDuLien } from "@/features/dossier-client/documents/lien";
import { estPartageable } from "@/features/dossier-client/documents/partage";
import {
  lireDocumentsDuProjet,
  lireOuvertures,
  type DocumentDeLaListe,
  type OuverturesDuDocument,
} from "@/features/dossier-client/documents/queries";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { formatDateFrShort } from "@/lib/format-date-fr";
import type { NatureDocumentProjet } from "../../../../prisma/generated/client";

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const actionCls = "admin-button-secondary min-h-[44px] whitespace-nowrap";
const fantomeCls = "admin-button-ghost min-h-[44px] whitespace-nowrap";

// ─── Natures : libellé, pictogramme, couleur (Record EXHAUSTIF, RM-04) ──────

const TRACES: Readonly<Record<string, React.ReactElement>> = {
  enveloppe: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  feuille: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  blocNotes: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  euro: <path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9" />,
  crayon: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  trombone: (
    <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />
  ),
};

export const NATURES_AFFICHEES: Readonly<
  Record<NatureDocumentProjet, { libelle: string; trace: keyof typeof TRACES; tuile: string }>
> = {
  email: {
    libelle: "E-mail",
    trace: "enveloppe",
    tuile: "text-[color:var(--color-admin-id-bleu)] bg-[color:var(--color-admin-id-bleu-soft)]",
  },
  pdf: {
    libelle: "PDF",
    trace: "feuille",
    tuile:
      "text-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)]",
  },
  page_en_ligne: {
    libelle: "Page en ligne",
    trace: "globe",
    tuile: "text-[color:var(--color-admin-id-teal)] bg-[color:var(--color-admin-id-teal-soft)]",
  },
  compte_rendu: {
    libelle: "Compte rendu",
    trace: "blocNotes",
    tuile: "text-[color:var(--color-admin-id-violet)] bg-[color:var(--color-admin-id-violet-soft)]",
  },
  devis: {
    libelle: "Devis",
    trace: "euro",
    tuile: "text-[color:var(--color-admin-id-or)] bg-[color:var(--color-admin-id-or-soft)]",
  },
  note: {
    libelle: "Note",
    trace: "crayon",
    tuile: "text-[color:var(--color-admin-neutral)] bg-[color:var(--color-admin-neutral-soft)]",
  },
  autre: {
    libelle: "Autre",
    trace: "trombone",
    tuile: "text-[color:var(--color-admin-neutral)] bg-[color:var(--color-admin-neutral-soft)]",
  },
};

function Icone({ nature, archive }: { nature: NatureDocumentProjet; archive: boolean }) {
  const n = NATURES_AFFICHEES[nature];
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-admin-sm)] ${
        archive ? `${mutedCls} bg-[color:var(--color-admin-neutral-soft)]` : n.tuile
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TRACES[n.trace]}
      </svg>
    </span>
  );
}

// ─── Rangement (pur) ────────────────────────────────────────────────────────

export interface Rangement {
  readonly envoyes: DocumentDeLaListe[];
  readonly internes: DocumentDeLaListe[];
  readonly archives: DocumentDeLaListe[];
}

const temps = (d: Date | null): number => (d === null ? 0 : d.getTime());

/** Envoyés par date d'envoi, internes par date d'ajout, archivés par date d'archivage — plus récent en haut. */
export function rangerDocuments(documents: ReadonlyArray<DocumentDeLaListe>): Rangement {
  const actifs = documents.filter((d) => d.archiveLe === null);
  return {
    envoyes: actifs
      .filter((d) => d.cote === "envoye_au_client")
      .sort(
        (a, b) =>
          temps(b.envoyeLe) - temps(a.envoyeLe) || b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    internes: actifs
      .filter((d) => d.cote === "interne")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    archives: documents
      .filter((d) => d.archiveLe !== null)
      .sort((a, b) => temps(b.archiveLe) - temps(a.archiveLe)),
  };
}

// ─── Une ligne ──────────────────────────────────────────────────────────────

function suffixe(d: DocumentDeLaListe): string {
  if (d.fichierTailleOctets !== null) return ` · ${tailleLisible(d.fichierTailleOctets)}`;
  if (d.lienUrl !== null) {
    const domaine = domaineDuLien(d.lienUrl);
    return domaine ? ` · ${domaine}` : "";
  }
  return "";
}

function ligneSecondaire(d: DocumentDeLaListe): string {
  const nature = NATURES_AFFICHEES[d.nature].libelle;
  if (d.archiveLe !== null) {
    const groupe = d.cote === "envoye_au_client" ? "Envoyé au client" : "Interne";
    const date =
      d.cote === "envoye_au_client"
        ? `envoyé le ${formatDateFrShort(d.envoyeLe)}`
        : `ajouté le ${formatDateFrShort(d.createdAt)}`;
    return `${groupe} · ${nature} · ${date}${suffixe(d)}`;
  }
  if (d.cote === "envoye_au_client") {
    const auteur = d.auteur ? ` · ajouté par ${d.auteur}` : "";
    return `${nature} · envoyé le ${formatDateFrShort(d.envoyeLe)}${auteur}${suffixe(d)}`;
  }
  const auteur = d.auteur ? ` par ${d.auteur}` : "";
  return `${nature} · ajouté le ${formatDateFrShort(d.createdAt)}${auteur}${suffixe(d)}`;
}

function texteOuvertures(o: OuverturesDuDocument | undefined): string | null {
  if (!o || (o.navigateur === 0 && o.apercus === 0)) return null;
  const morceaux: string[] = [];
  if (o.navigateur > 0) {
    morceaux.push(
      `Ouvert ${o.navigateur} fois${o.derniere ? `, dernière ouverture le ${formatDateFrShort(o.derniere)}` : ""}`,
    );
  }
  if (o.apercus > 0) {
    morceaux.push(
      `${o.apercus} aperçu${o.apercus > 1 ? "s" : ""} automatique${o.apercus > 1 ? "s" : ""}`,
    );
  }
  return morceaux.join(" · ");
}

interface PropsLigne {
  readonly d: DocumentDeLaListe;
  readonly clientId: string;
  readonly projetId: string;
  readonly projetHref: string;
  readonly lienPublic: string | null;
  readonly ouvertures: OuverturesDuDocument | undefined;
}

function LigneDocument({ d, clientId, projetId, projetHref, lienPublic, ouvertures }: PropsLigne) {
  const archive = d.archiveLe !== null;
  const estLien = d.lienUrl !== null;
  const href = estLien ? d.lienUrl! : `${projetHref}/documents/${d.id}`;
  const exterieur = estLien ? ({ target: "_blank", rel: "noopener noreferrer" } as const) : {};
  const partage = !archive && lienPublic !== null && estPartageable(d);
  const vues = partage ? texteOuvertures(ouvertures) : null;
  const libelleFormat = d.fichierFormat ? FORMATS[d.fichierFormat].libelle : "";
  const taille = d.fichierTailleOctets !== null ? tailleLisible(d.fichierTailleOctets) : "";

  return (
    <li className="grid grid-cols-[36px_1fr] items-center gap-[var(--space-admin-3)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-3)] last:border-b-0 sm:grid-cols-[36px_1fr_auto]">
      <Icone nature={d.nature} archive={archive} />
      <div className="min-w-0">
        <a
          href={href}
          {...exterieur}
          title={d.titre}
          className={`line-clamp-2 text-[length:var(--text-admin-md)] font-semibold [overflow-wrap:anywhere] hover:text-[color:var(--color-admin-accent)] ${
            archive ? mutedCls : "text-[color:var(--color-admin-fg)]"
          }`}
        >
          {d.titre}
        </a>
        <div className={`mt-[2px] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
          {archive ? (
            <>
              <AdminBadge tone="neutral">{`archivé le ${formatDateFrShort(d.archiveLe)}`}</AdminBadge>{" "}
            </>
          ) : null}
          {ligneSecondaire(d)}
        </div>
        {vues !== null ? (
          <div className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>{vues}</div>
        ) : null}
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-[var(--space-admin-2)] sm:col-span-1 sm:justify-end">
        {estLien ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={actionCls}>
            Ouvrir ↗<span className="sr-only">{` « ${d.titre} » (nouvel onglet)`}</span>
          </a>
        ) : (
          <a href={href} className={actionCls}>
            Télécharger
            <span className="sr-only">{` « ${d.titre} » (${libelleFormat}, ${taille})`}</span>
          </a>
        )}
        {partage ? <CopierLienClient lien={lienPublic!} titre={d.titre} /> : null}
        <form action={archive ? reafficherDocumentFormAction : archiverDocumentFormAction}>
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="projetId" value={projetId} />
          <button type="submit" className={fantomeCls}>
            {archive ? "Réafficher" : "Archiver"}
            <span className="sr-only">{` « ${d.titre} »`}</span>
          </button>
        </form>
      </div>
    </li>
  );
}

// ─── Le message de retour ───────────────────────────────────────────────────

/**
 * Les actions ne mettent dans l'URL que `geste:identifiant` (aucun titre) ;
 * le texte se compose ici avec le titre lu en base.
 */
function MessageDeRetour({
  message,
  documents,
  clientId,
  projetId,
}: {
  message: string;
  documents: ReadonlyArray<DocumentDeLaListe>;
  clientId: string;
  projetId: string;
}) {
  const m = /^(ajoute|archive|reaffiche):(.+)$/.exec(message);
  const d = m ? documents.find((x) => x.id === m[2]) : undefined;
  let texte = message;
  if (m) {
    const nom = d ? `« ${d.titre} »` : "Le document";
    const groupe = d?.cote === "interne" ? "« Interne »" : "« Envoyé au client »";
    texte =
      m[1] === "ajoute"
        ? `${nom} est ajouté dans ${groupe}.`
        : m[1] === "archive"
          ? `${nom} est archivé.`
          : `${nom} est de nouveau visible.`;
  }
  return (
    <div
      role="status"
      className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-success-soft)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success-fg)]"
    >
      <span>{texte}</span>
      {m?.[1] === "archive" && d && d.archiveLe !== null ? (
        <form action={reafficherDocumentFormAction}>
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="projetId" value={projetId} />
          <button type="submit" className="admin-button-secondary">
            Annuler
          </button>
        </form>
      ) : null}
    </div>
  );
}

// ─── La carte ───────────────────────────────────────────────────────────────

export interface PropsCarteDocuments {
  readonly clientId: string;
  readonly projetId: string;
  /** `/fr/<préfixe>/qualiopi/clients/<id>/projets/<projetId>` */
  readonly projetHref: string;
  readonly documents: ReadonlyArray<DocumentDeLaListe>;
  readonly ouvertures: Readonly<Record<string, OuverturesDuDocument>>;
  /** URL publique des seules pages partageables. */
  readonly liensPublics: Readonly<Record<string, string>>;
  readonly nbQuestionnaires: number;
  readonly message: string | null;
  readonly erreur: string | null;
  /** `AAAA-MM-JJ`, date par défaut de l'envoi. */
  readonly aujourdhui: string;
}

function Groupe({
  id,
  titre,
  vide,
  docs,
  interne,
  enPied,
  ligne,
}: {
  id: string;
  titre: string;
  vide: string;
  docs: ReadonlyArray<DocumentDeLaListe>;
  interne: boolean;
  enPied?: React.ReactNode;
  ligne: (d: DocumentDeLaListe) => React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3
        id={id}
        className={`mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-2)] border-b-2 border-[color:var(--color-admin-border)] pb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-[0.06em] uppercase ${mutedCls}`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${
            interne
              ? "bg-[color:var(--color-admin-neutral)]"
              : "bg-[color:var(--color-admin-accent)]"
          }`}
        />
        {`${titre} · ${docs.length}`}
      </h3>
      {docs.length === 0 ? (
        <p className={`py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          {vide}
        </p>
      ) : (
        <ul className="m-0 list-none p-0">{docs.map((d) => ligne(d))}</ul>
      )}
      {enPied}
    </section>
  );
}

export function CarteDocuments(p: PropsCarteDocuments): React.ReactElement {
  const r = rangerDocuments(p.documents);
  const actifs = r.envoyes.length + r.internes.length;
  const aucun = p.documents.length === 0;
  const ligne = (d: DocumentDeLaListe) => (
    <LigneDocument
      key={d.id}
      d={d}
      clientId={p.clientId}
      projetId={p.projetId}
      projetHref={p.projetHref}
      lienPublic={p.liensPublics[d.id] ?? null}
      ouvertures={p.ouvertures[d.id]}
    />
  );

  return (
    <section id="documents" aria-labelledby="documents-titre" className={carteCls}>
      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <h2
          id="documents-titre"
          className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
        >
          Documents
          {actifs > 0 ? (
            <span
              aria-label={`${actifs} document${actifs > 1 ? "s" : ""}`}
              className="rounded-full bg-[color:var(--color-admin-neutral-soft)] px-2 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-neutral)]"
            >
              {actifs}
            </span>
          ) : null}
        </h2>
      </div>

      {p.message !== null ? (
        <MessageDeRetour
          message={p.message}
          documents={p.documents}
          clientId={p.clientId}
          projetId={p.projetId}
        />
      ) : null}
      {p.erreur !== null ? (
        <div
          role="alert"
          id="documents-erreur"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border-l-4 border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-error-soft)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error-fg)]"
        >
          {p.erreur}
        </div>
      ) : null}

      {aucun ? (
        <p className={`mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${mutedCls}`}>
          Rangez ici tout ce qui concerne ce projet : ce que vous avez envoyé au client (e-mail,
          PDF, liens) et vos documents internes.
        </p>
      ) : null}

      <AjouterDocument
        clientId={p.clientId}
        projetId={p.projetId}
        ouvert={aucun || p.erreur !== null}
        aujourdhui={p.aujourdhui}
        {...(p.erreur !== null ? { erreurId: "documents-erreur" } : {})}
      />

      {aucun ? null : (
        <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[3fr_2fr]">
          <Groupe
            id="documents-envoyes"
            titre="Envoyé au client"
            vide="Rien d'envoyé au client pour l'instant."
            docs={r.envoyes}
            interne={false}
            ligne={ligne}
            enPied={
              p.nbQuestionnaires > 0 ? (
                <p className="pt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
                  <a href={`${p.projetHref}?vue=questionnaire`} className={lienCls}>
                    Questionnaire de cadrage et réponses du client →
                  </a>
                </p>
              ) : null
            }
          />
          <Groupe
            id="documents-internes"
            titre="Interne"
            vide="Aucun document interne pour l'instant."
            docs={r.internes}
            interne
            ligne={ligne}
          />
        </div>
      )}

      {r.archives.length > 0 ? (
        <details className="mt-[var(--space-admin-4)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-[length:var(--text-admin-sm)] font-semibold">
            {`Documents archivés (${r.archives.length})`}
          </summary>
          <ul className="m-0 list-none p-0">{r.archives.map((d) => ligne(d))}</ul>
        </details>
      ) : null}
    </section>
  );
}

// ─── La rubrique (lecture + carte) ──────────────────────────────────────────

export async function DocumentsDuProjet({
  clientId,
  projetId,
  projetHref,
  nbQuestionnaires,
  recherche,
}: {
  clientId: string;
  projetId: string;
  projetHref: string;
  nbQuestionnaires: number;
  /** Les paramètres de la page : le message n'est lu que s'il vient de la rubrique (`carte=documents`). */
  recherche: Readonly<Record<string, unknown>>;
}): Promise<React.ReactElement> {
  const documents = await lireDocumentsDuProjet(clientId, projetId);
  const partageables = documents.filter((d) => estPartageable(d));
  const ouvertures = await lireOuvertures(partageables.map((d) => d.id));
  const { SITE_URL } = await import("@/lib/site-url");
  const origine = SITE_URL.replace(/\/+$/, "");
  const liensPublics: Record<string, string> = {};
  for (const d of partageables) {
    const chemin = cheminDocument(d.id);
    if (chemin !== null) liensPublics[d.id] = `${origine}${chemin}`;
  }
  const pourLaRubrique = recherche["carte"] === "documents";
  return (
    <CarteDocuments
      clientId={clientId}
      projetId={projetId}
      projetHref={projetHref}
      documents={documents}
      ouvertures={ouvertures}
      liensPublics={liensPublics}
      nbQuestionnaires={nbQuestionnaires}
      message={pourLaRubrique ? lireMessageDeRetour(recherche, "message") : null}
      erreur={pourLaRubrique ? lireMessageDeRetour(recherche, "erreur") : null}
      aujourdhui={aujourdhuiAParis()}
    />
  );
}

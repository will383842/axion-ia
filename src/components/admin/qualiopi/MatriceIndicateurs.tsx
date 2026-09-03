/**
 * Qualiopi — Matrice des 32 indicateurs RNQ V9, composant partagé (phase 2
 * de l'audit UX console, 2026-08-01).
 *
 * Avant : « Conformité » (tableaux denses) et « Mode auditeur » (cartes +
 * documents) recopiaient chacun libelleCritere / badge de statut / le
 * regroupement par critère — jusqu'au même commentaire de constat F15
 * dupliqué. Les deux pages fusionnent sur /qualiopi/mode-auditeur avec un
 * commutateur de vue (?vue=tableau|manifeste) ; ce composant rend l'une ou
 * l'autre depuis la même donnée `IndicateurManifeste[]` (sur-ensemble :
 * conformité + comptes de documents).
 *
 * Server Component pur — aucun state, 0 JS client.
 */

import Link from "next/link";

import type { IndicateurManifeste } from "@/server/qualiopi/conformite/audit-dossier";
import { libelleTypeDocument } from "@/server/qualiopi/documents/libelles-type-document";
import { registresDeIndicateur } from "@/server/qualiopi/conformite/registres-par-indicateur";
import { Star } from "lucide-react";

export type MatriceVue = "tableau" | "manifeste";

/** Libellé long du critère Qualiopi RNQ V9. */
function libelleCritere(c: number): string {
  const labels: Record<number, string> = {
    1: "C1 — Conditions d'information du public",
    2: "C2 — Identification et analyse des besoins des bénéficiaires",
    3: "C3 — Adaptation aux bénéficiaires",
    4: "C4 — Adéquation des moyens pédagogiques, techniques et d'encadrement",
    5: "C5 — Qualification et développement des compétences du personnel",
    6: "C6 — Inscription et veille des sous-traitants et formateurs occasionnels",
    7: "C7 — Recueil des appréciations et mise en œuvre de l'amélioration continue",
  };
  return labels[c] ?? `Critère ${c}`;
}

/** Badge de statut coloré selon l'état de couverture de l'indicateur. */
function StatutBadge({ statut }: { statut: IndicateurManifeste["statut"] }): React.ReactElement {
  if (statut === "couvert") {
    return (
      <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-success-subtle,color-mix(in_srgb,var(--color-admin-success)_15%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-success-fg)]">
        Couvert
      </span>
    );
  }
  if (statut === "a_completer") {
    return (
      <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-warning-subtle,color-mix(in_srgb,var(--color-admin-warning)_15%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-warning-fg)]">
        À compléter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[color:var(--color-admin-surface-subtle,color-mix(in_srgb,var(--color-admin-fg)_8%,transparent))] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]">
      Non applicable
    </span>
  );
}

/*
 * 🔴 LA VUE MANIFESTE — celle que consulte l'auditrice — listait ses pièces
 * en monospace et en valeurs brutes : `livret_accueil`, `reglement_interieur`,
 * `certificat_realisation`.
 *
 * 🔴 2026-09-02 — LE CORRECTIF DE 2026-08 N'AVAIT CORRIGÉ QU'UN TIERS DU MAL.
 * Il avait posé ICI une table `Record<string, string>` de treize entrées, écrite
 * à la main. `Record<string, …>` n'oblige à rien : six de ses entrées ne
 * correspondaient à AUCUNE valeur de l'énumération `DocumentType`
 * (`convention_formation`, `programme_formation`, `feuille_emargement`…) et,
 * sur les huit types réellement présentés à l'auditrice le 2026-09-02, SEPT
 * n'avaient pas de libellé. L'écran affichait donc « programme » : 578 pièces,
 * « emargement » : 501 pièces — la valeur d'énumération, en guillemets, au
 * certificateur.
 *
 * Le vocabulaire est désormais unique et EXHAUSTIF PAR TYPE
 * (`Record<DocumentType, string>`, importé en tête de fichier) : oublier un
 * type ne compile plus.
 */

/**
 * Compte du registre, et — quand la liste des pièces est plafonnée — combien
 * en sont réellement montrées.
 *
 * ⚠️ Le compte reste celui du registre : il n'est JAMAIS remplacé par le
 * nombre de pièces affichées. Écrire « 5 pièces » là où il y en a douze
 * mentirait sur le registre lui-même, pas seulement sur l'affichage.
 */
function compteEtAffichage(doc: IndicateurManifeste["documents"][number]): string {
  const compte = `${doc.count} pièce${doc.count > 1 ? "s" : ""}`;
  if (doc.pieces.length >= doc.count) return compte;
  return `${compte}, ${doc.pieces.length} affichée${doc.pieces.length > 1 ? "s" : ""}`;
}

/** Étoile « NC majeure » commune aux deux vues. */
function SuperStar(): React.ReactElement {
  return (
    // 🔴 `role="img"` AJOUTÉ le 2026-08-27. `aria-label` sur un `<span>` SANS
    // rôle est INTERDIT par la spécification ARIA : un `<span>` nu n'expose
    // aucun rôle, donc rien à nommer — et un lecteur d'écran ignore le nom, ou
    // pire, annonce le contenu brut. `axe` le relevait 17 fois sur le MODE
    // AUDITEUR, c'est-à-dire l'écran que le certificateur lit le jour de sa
    // venue : l'étoile « NC majeure » n'était annoncée à personne.
    //
    // `role="img"` est le rôle juste ici : le contenu est une icône décorative
    // (`aria-hidden`), et le nom accessible porte à lui seul l'information.
    <span
      title="NC majeure en audit"
      role="img"
      className="ml-1 text-[color:var(--color-admin-destructive)]"
      aria-label="Indicateur critique (NC majeure)"
    >
      <Star
        size={12}
        aria-hidden="true"
        fill="currentColor"
        className="inline-block align-[-0.1em]"
      />
    </span>
  );
}

function groupParCritere(
  indicateurs: ReadonlyArray<IndicateurManifeste>,
): Map<number, IndicateurManifeste[]> {
  const map = new Map<number, IndicateurManifeste[]>();
  for (const ind of indicateurs) {
    const groupe = map.get(ind.critere) ?? [];
    groupe.push(ind);
    map.set(ind.critere, groupe);
  }
  return map;
}

const CRITERE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

interface Props {
  indicateurs: ReadonlyArray<IndicateurManifeste>;
  vue: MatriceVue;
  /**
   * Racine de la console (`/{locale}/{adminPrefix}`), pour renvoyer vers les
   * registres. Le préfixe admin est secret et variable : il ne peut pas être
   * écrit dans le module de correspondance, il descend d'ici.
   */
  baseHref: string;
}

/**
 * « Où vérifier » — les registres de la console qui portent la preuve d'un
 * indicateur.
 *
 * 🔴 2026-09-02 (audit certificateur). Dix des vingt-trois indicateurs
 * applicables n'ont AUCUNE pièce à lister : leur preuve est un registre, pas un
 * PDF. Sur ces dix-là, l'écran de l'auditrice affichait un verdict et ne
 * proposait rien à cliquer — elle devait le croire sur parole, ou refermer
 * l'écran et chercher dans cent cinquante entrées de navigation.
 *
 * ⚠️ Ces liens ne disent RIEN de la couverture : un renvoi vers un registre
 * vide reste juste — il mène là où la preuve devrait être, ce qui est
 * exactement l'information utile quand elle n'y est pas.
 */
function OuVerifier({
  numero,
  baseHref,
}: {
  numero: number;
  baseHref: string;
}): React.ReactElement | null {
  const registres = registresDeIndicateur(numero);
  if (registres.length === 0) return null;
  return (
    <div className="mt-[var(--space-admin-3)]">
      <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Où vérifier dans la console
      </p>
      {/*
        🔴 2026-09-03 — `target-size` (WCAG 2.2 AA, impact « serious »). Ces liens
        étaient rendus en `text-admin-xs` nu : mesurés par axe en CI, **228 px
        par 15 px**, avec 21,2 px d'espace libre autour — sous le minimum de
        24 × 24 px. La gate a rougi sur l'écran de l'auditrice, et elle avait
        raison : un lien de 15 px de haut se rate au doigt.

        🔑 ET MON INSTRUMENT ÉTAIT PLUS FAIBLE QUE LA GATE. J'avais passé axe en
        local sur `wcag2a, wcag2aa, wcag21a, wcag21aa` et conclu « aucune
        violation » — `target-size` est une règle **WCAG 2.2**, que je n'avais pas
        demandée. Le test CI, lui, s'appelle « WCAG 2.2 AA ». Une mesure qui
        n'interroge pas la même norme que la garde ne dit rien de la garde.

        `min-h` + `inline-flex` donnent la hauteur de cible ; l'espacement
        vertical passe à `space-admin-2` pour que deux liens qui se suivent ne
        se touchent pas.
      */}
      <ul className="flex flex-wrap gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-2)]">
        {registres.map((r) => (
          <li key={r.chemin + r.libelle}>
            <Link
              href={`${baseHref}${r.chemin}`}
              className="inline-flex min-h-[24px] items-center text-[length:var(--text-admin-xs)] underline"
            >
              {r.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vue tableau — balayage rapide, 4 colonnes, zébrage. */
function VueTableau({
  lignes,
  baseHref,
}: {
  lignes: IndicateurManifeste[];
  baseHref: string;
}): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
      <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
        <thead>
          <tr className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
            <th className="w-16 px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              N°
            </th>
            <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              Libellé officiel
            </th>
            <th className="w-28 px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-center font-semibold text-[color:var(--color-admin-fg-muted)]">
              Statut
            </th>
            <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left font-semibold text-[color:var(--color-admin-fg-muted)]">
              Éléments constatés
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ind, idx) => (
            <tr
              key={ind.numero}
              className={
                idx % 2 === 0
                  ? "bg-[color:var(--color-admin-paper)]"
                  : "bg-[color:var(--color-admin-surface)]"
              }
            >
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] font-medium whitespace-nowrap text-[color:var(--color-admin-fg-muted)]">
                <span>{ind.numero}</span>
                {ind.super && <SuperStar />}
              </td>
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] leading-snug text-[color:var(--color-admin-fg)]">
                {ind.libelle}
              </td>
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-center">
                <StatutBadge statut={ind.statut} />
              </td>
              {/* Constat F15 (2026-07-26) : `preuves` mélange preuves réelles
                  et constats d'absence, sans polarité — titre et puces neutres,
                  jamais de ✓ décoratif. Le statut est dit par sa colonne. */}
              <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
                {ind.preuves.length > 0 ? (
                  <ul className="list-none space-y-0.5">
                    {ind.preuves.map((preuve) => (
                      <li key={preuve} className="flex items-center gap-[var(--space-admin-1)]">
                        <span
                          aria-hidden="true"
                          className="text-xs text-[color:var(--color-admin-fg-muted)]"
                        >
                          •
                        </span>
                        <span className="text-[length:var(--text-admin-xs)]">{preuve}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
                    Aucun élément enregistré
                  </span>
                )}
                <OuVerifier numero={ind.numero} baseHref={baseHref} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vue manifeste — cartes verbeuses avec comptes de documents (l'auditrice). */
function VueManifeste({
  lignes,
  baseHref,
}: {
  lignes: IndicateurManifeste[];
  baseHref: string;
}): React.ReactElement {
  return (
    <div className="space-y-[var(--space-admin-3)]">
      {lignes.map((ind) => (
        <div
          key={ind.numero}
          className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
        >
          <div className="mb-[var(--space-admin-3)] flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
            <div className="flex items-start gap-[var(--space-admin-3)]">
              <span className="shrink-0 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]">
                Ind. {ind.numero}
                {ind.super && <SuperStar />}
              </span>
              <p className="text-[length:var(--text-admin-sm)] leading-snug text-[color:var(--color-admin-fg)]">
                {ind.libelle}
              </p>
            </div>
            <div className="shrink-0">
              <StatutBadge statut={ind.statut} />
            </div>
          </div>

          {/* Constat F15 (2026-07-26) : titre neutre, puce neutre — voir
              VueTableau ci-dessus, même règle. */}
          {ind.preuves.length > 0 && (
            <div className="mb-[var(--space-admin-3)]">
              <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Éléments constatés
              </p>
              <ul className="space-y-[var(--space-admin-1)]">
                {ind.preuves.map((preuve) => (
                  <li key={preuve} className="flex items-center gap-[var(--space-admin-2)]">
                    <span
                      className="shrink-0 text-xs text-[color:var(--color-admin-fg-muted)]"
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]">
                      {preuve}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ind.documents.length > 0 && (
            <div>
              <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Documents
              </p>
              <ul className="space-y-[var(--space-admin-2)]">
                {ind.documents.map((doc, i) => (
                  <li
                    key={`${doc.type}-${i}`}
                    className="rounded bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]"
                  >
                    <div className="flex items-center gap-[var(--space-admin-3)]">
                      <span
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
                        title={doc.type}
                      >
                        {libelleTypeDocument(doc.type)}
                      </span>
                      <span className="ml-auto shrink-0 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {compteEtAffichage(doc)}
                      </span>
                    </div>

                    {/* 🔴 Les pièces étaient un COMPTE, et rien d'autre. « 3
                        pièces » sur l'écran que l'auditrice consulte, sans un
                        numéro, sans un lien : il fallait quitter le manifeste,
                        deviner la session et rouvrir le registre pour savoir
                        DE QUOI on parlait. Le modèle ne portait aucun
                        identifiant — la cause était en amont, dans
                        `PreuveDocument`. */}
                    {doc.pieces.length > 0 && (
                      <ul className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-2)]">
                        {doc.pieces.map((piece) => (
                          <li key={piece.id}>
                            <a
                              href={`/api/qualiopi/documents/${piece.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="admin-button-ghost"
                              aria-label={`Ouvrir ${libelleTypeDocument(doc.type)} n° ${piece.numero}`}
                            >
                              {piece.numero}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Une troncature muette se lit comme une liste complète —
                        règle du dépôt, déjà écrite en toutes lettres sur le
                        registre des signatures. On dit le plafond LÀ où il
                        mord, et où retrouver le reste. */}
                    {doc.pieces.length < doc.count && (
                      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {`Liste plafonnée : ${doc.count} pièce${doc.count > 1 ? "s" : ""} au registre, ${doc.pieces.length} accessible${doc.pieces.length > 1 ? "s" : ""} ici. Le dossier d'audit ZIP les porte toutes.`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ind.preuves.length === 0 && ind.documents.length === 0 && (
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
              {ind.statut === "non_applicable"
                ? "Non applicable au périmètre de l'OF."
                : "Aucune preuve enregistrée pour cet indicateur."}
            </p>
          )}

          {ind.statut !== "non_applicable" && (
            <OuVerifier numero={ind.numero} baseHref={baseHref} />
          )}
        </div>
      ))}
    </div>
  );
}

export function MatriceIndicateurs({ indicateurs, vue, baseHref }: Props): React.ReactElement {
  const parCritere = groupParCritere(indicateurs);

  if (indicateurs.length === 0) {
    return (
      <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-8)] text-center">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune donnée disponible. Les indicateurs seront affichés une fois les services de
          conformité déployés.
        </p>
      </div>
    );
  }

  return (
    <>
      {CRITERE_IDS.map((critereId) => {
        const lignes = parCritere.get(critereId);
        if (!lignes || lignes.length === 0) return null;
        return (
          <section
            key={critereId}
            className="mb-[var(--space-admin-8)]"
            aria-labelledby={`critere-${critereId}-titre`}
          >
            <h2
              id={`critere-${critereId}-titre`}
              className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
            >
              {libelleCritere(critereId)}
            </h2>
            {vue === "tableau" ? (
              <VueTableau lignes={lignes} baseHref={baseHref} />
            ) : (
              <VueManifeste lignes={lignes} baseHref={baseHref} />
            )}
          </section>
        );
      })}

      <footer className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-5)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <span>
          <Star
            size={12}
            aria-hidden="true"
            fill="currentColor"
            className="inline-block align-[-0.1em] text-[color:var(--color-admin-destructive)]"
          />{" "}
          = Indicateur super (NC majeure si non couvert en audit)
        </span>
        <span>
          Score = indicateurs couverts / indicateurs applicables (hors « Non applicable »)
        </span>
      </footer>
    </>
  );
}

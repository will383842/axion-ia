"use client";
// use-client: saisie interactive du contrat de travail (inputs conditionnels
// CDI/CDD, useTransition) + émission de la pièce.

/**
 * Contrat de travail d'un formateur SALARIÉ — saisie, relecture, émission.
 *
 * 🔴 CE PANNEAU EXISTE PARCE QUE LES ONZE COLONNES DE LA MIGRATION DU 12/09
 * N'AVAIENT AUCUNE PORTE D'ENTRÉE. C'est le défaut que ce dépôt répète le plus
 * souvent — du code complet sans appelant : `regimeTvaHonoraires` réglable par
 * aucun écran depuis juillet, les six colonnes de sous-traitance de l'été,
 * `echeanceAt` indexée sans personne pour l'écrire. Une colonne que personne ne
 * remplit n'est pas une fonctionnalité à moitié faite : c'est une promesse
 * fausse, parce que tout ce qui la lit rend un résultat d'apparence normale.
 *
 * ## Les trois gestes, et pourquoi ils sont trois
 *
 *   1. ENREGISTRER — ne produit rien, se rejoue autant de fois qu'on veut ;
 *   2. ÉTABLIR LE CONTRAT — produit la pièce, numérotée et hashée ;
 *   3. RELIRE puis envoyer en signature — le PDF s'ouvre, et l'envoi est un
 *      geste distinct, depuis le bloc « Documents » de la fiche.
 *
 * Will a demandé la relecture avant l'envoi. Un bouton unique « établir et
 * envoyer » ne l'aurait pas permise : la pièce serait partie dans le même geste
 * que la saisie.
 *
 * ## Ce que l'écran REFUSE de faire
 *
 * Il ne valide pas la classification, et il le dit. Vérifier qu'un coefficient
 * correspond au poste suppose de lire la grille de la convention collective, que
 * l'outil ne connaît pas. Laisser croire le contraire ferait passer pour vérifié
 * ce qui ne l'est pas — et une classification fausse se paie en rappel de
 * salaire sur toute la durée du contrat.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  genererContratTravailAction,
  updateTrainerContratAction,
} from "@/server/actions/qualiopi/trainer-contrat";
import { plafondLegalEssaiMois } from "@/server/qualiopi/trainers/contrat-travail";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

/** `Date` → `yyyy-mm-dd` pour un `<input type="date">`, chaîne vide si absente. */
function versChampDate(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

export interface TrainerContratTravailPanelProps {
  trainerId: string;
  initial: {
    contratType: "cdi" | "cdd" | null;
    dateNaissance: Date | null;
    lieuNaissance: string | null;
    adressePersonnelle: string | null;
    dateEmbauche: Date | null;
    contratPoste: string | null;
    contratClassification: string | null;
    contratDureeHebdoHeures: number | null;
    contratPeriodeEssaiMois: number | null;
    contratLieuTravail: string | null;
    contratDateFin: Date | null;
    contratMotifCdd: string | null;
  };
  /**
   * La convention collective est-elle renseignée ? Décidé côté serveur, jamais
   * ici : c'est la MÊME question que se pose `motifSpecimenContrat` au moment
   * d'émettre, et deux réponses différentes au même instant seraient pires que
   * pas de réponse du tout.
   */
  conventionRenseignee: boolean;
  /** Lien vers la console de configuration Qualiopi, pour aller la renseigner. */
  hrefConfig: string;
  /**
   * Le contrat déjà produit, s'il existe. Sert à la RELECTURE : sans ce lien, la
   * pièce serait atteignable par URL et liée depuis aucun écran — un lecteur qui
   * n'existe pas est le symétrique exact d'un écrivain qui n'existe pas.
   */
  contratExistant: { documentId: string; numero: string; emisLe: string } | null;
}

export function TrainerContratTravailPanel({
  trainerId,
  initial,
  conventionRenseignee,
  hrefConfig,
  contratExistant,
}: TrainerContratTravailPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [type, setType] = useState<"" | "cdi" | "cdd">(initial.contratType ?? "");
  const [dateNaissance, setDateNaissance] = useState(versChampDate(initial.dateNaissance));
  const [lieuNaissance, setLieuNaissance] = useState(initial.lieuNaissance ?? "");
  const [adresse, setAdresse] = useState(initial.adressePersonnelle ?? "");
  const [dateEmbauche, setDateEmbauche] = useState(versChampDate(initial.dateEmbauche));
  const [poste, setPoste] = useState(initial.contratPoste ?? "");
  const [classification, setClassification] = useState(initial.contratClassification ?? "");
  const [dureeHebdo, setDureeHebdo] = useState(
    initial.contratDureeHebdoHeures === null ? "" : String(initial.contratDureeHebdoHeures),
  );
  const [essai, setEssai] = useState(
    initial.contratPeriodeEssaiMois === null ? "" : String(initial.contratPeriodeEssaiMois),
  );
  const [lieuTravail, setLieuTravail] = useState(initial.contratLieuTravail ?? "");
  const [dateFin, setDateFin] = useState(versChampDate(initial.contratDateFin));
  const [motifCdd, setMotifCdd] = useState(initial.contratMotifCdd ?? "");

  // Plafond LÉGAL de la période d'essai, dérivé de la classification saisie.
  // ⚠️ La convention peut en fixer un plus COURT, auquel cas c'est le sien qui
  // s'applique — le message le dit, parce qu'un plafond affiché sans cette
  // réserve se lirait comme une autorisation.
  const plafondEssai = plafondLegalEssaiMois(classification);
  const essaiNombre = essai.trim() === "" ? null : Number(essai);
  const essaiDepasse =
    plafondEssai !== null &&
    essaiNombre !== null &&
    Number.isFinite(essaiNombre) &&
    essaiNombre > plafondEssai;

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await updateTrainerContratAction({
        id: trainerId,
        // Vide = EFFACER partout. Un CDD transformé en CDI doit pouvoir perdre
        // son terme et son motif ; sans cette conversion, ils survivraient au
        // changement de nature et s'imprimeraient sur un contrat qui ne les
        // porte pas.
        contratType: type === "" ? null : type,
        dateNaissance: dateNaissance === "" ? null : dateNaissance,
        lieuNaissance: lieuNaissance.trim() === "" ? null : lieuNaissance.trim(),
        adressePersonnelle: adresse.trim() === "" ? null : adresse.trim(),
        dateEmbauche: dateEmbauche === "" ? null : dateEmbauche,
        contratPoste: poste.trim() === "" ? null : poste.trim(),
        contratClassification: classification.trim() === "" ? null : classification.trim(),
        contratDureeHebdoHeures:
          dureeHebdo.trim() === "" ? null : Number(dureeHebdo.replace(",", ".")),
        contratPeriodeEssaiMois: essai.trim() === "" ? null : Number(essai),
        contratLieuTravail: lieuTravail.trim() === "" ? null : lieuTravail.trim(),
        contratDateFin: dateFin === "" ? null : dateFin,
        contratMotifCdd: motifCdd.trim() === "" ? null : motifCdd.trim(),
      });
      if ("error" in res) setError(res.error);
      else {
        setOk("Mentions enregistrées. Vous pouvez établir le contrat.");
        router.refresh();
      }
    });
  }

  function etablir() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await genererContratTravailAction({ trainerId });
      if ("error" in res) setError(res.error);
      else {
        setOk(
          res.data.specimen
            ? `Contrat ${res.data.numero} établi — marqué SPÉCIMEN faute de convention collective. Relisez-le, il n'est pas opposable en l'état.`
            : `Contrat ${res.data.numero} établi. Relisez-le avant de l'envoyer en signature.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <section
      className="admin-card mb-[var(--space-admin-5)]"
      aria-labelledby="contrat-travail-titre"
    >
      <h2
        id="contrat-travail-titre"
        className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Contrat de travail
      </h2>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Remplissez les mentions, enregistrez, puis établissez le contrat. Il est produit en PDF pour
        que vous le <strong>relisiez</strong> ; l&apos;envoi en signature est un geste distinct,
        depuis le bloc « Documents » plus bas.
      </p>

      {/*
        ⛔ La convention collective manque : on le dit AVANT la saisie, pas après
        l'émission. Découvrir un filigrane SPÉCIMEN sur une pièce qu'on s'apprête
        à envoyer à quelqu'un qu'on embauche est le pire moment pour l'apprendre.
      */}
      {!conventionRenseignee && (
        <div className="admin-alert admin-alert-warning mb-[var(--space-admin-4)]" role="status">
          <strong>Convention collective non renseignée.</strong> Le contrat sera produit, mais
          marqué <strong>SPÉCIMEN</strong> : sans elle, ni la classification, ni la période
          d&apos;essai, ni les minima applicables ne peuvent être énoncés.{" "}
          <a href={hrefConfig} className="underline">
            La renseigner dans les paramètres Qualiopi
          </a>
          .
        </div>
      )}

      <form onSubmit={enregistrer} className="flex flex-col gap-[var(--space-admin-4)]">
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label htmlFor="ct-type" className={labelCls}>
              Nature du contrat
            </label>
            <select
              id="ct-type"
              className={inputCls}
              value={type}
              disabled={isPending}
              onChange={(e) => setType(e.target.value as "" | "cdi" | "cdd")}
            >
              <option value="">— à choisir —</option>
              <option value="cdi">CDI</option>
              <option value="cdd">CDD</option>
            </select>
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-embauche" className={labelCls}>
              Entrée en fonction
            </label>
            <input
              id="ct-embauche"
              type="date"
              className={inputCls}
              value={dateEmbauche}
              disabled={isPending}
              onChange={(e) => setDateEmbauche(e.target.value)}
            />
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-naissance" className={labelCls}>
              Date de naissance
            </label>
            <input
              id="ct-naissance"
              type="date"
              className={inputCls}
              value={dateNaissance}
              disabled={isPending}
              onChange={(e) => setDateNaissance(e.target.value)}
            />
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-lieu-naissance" className={labelCls}>
              Lieu de naissance
            </label>
            <input
              id="ct-lieu-naissance"
              className={inputCls}
              value={lieuNaissance}
              disabled={isPending}
              onChange={(e) => setLieuNaissance(e.target.value)}
              placeholder="ex. Lyon (69)"
            />
          </div>

          <div className={`${fieldCls} sm:col-span-2`}>
            <label htmlFor="ct-adresse" className={labelCls}>
              Adresse personnelle
            </label>
            <input
              id="ct-adresse"
              className={inputCls}
              value={adresse}
              disabled={isPending}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Domicile du salarié — pas l'adresse d'exercice"
            />
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-poste" className={labelCls}>
              Intitulé du poste
            </label>
            <input
              id="ct-poste"
              className={inputCls}
              value={poste}
              disabled={isPending}
              onChange={(e) => setPoste(e.target.value)}
              placeholder="ex. Formateur en intelligence artificielle"
            />
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-classification" className={labelCls}>
              Classification conventionnelle
            </label>
            <input
              id="ct-classification"
              className={inputCls}
              value={classification}
              disabled={isPending}
              onChange={(e) => setClassification(e.target.value)}
              placeholder="ex. Cadre, position 2.1, coefficient 115"
            />
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Recopiée de la grille de votre convention. L&apos;outil ne la vérifie pas : il ne
              connaît pas la grille.
            </span>
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-duree" className={labelCls}>
              Durée hebdomadaire (heures)
            </label>
            <input
              id="ct-duree"
              className={inputCls}
              value={dureeHebdo}
              disabled={isPending}
              inputMode="decimal"
              onChange={(e) => setDureeHebdo(e.target.value)}
              placeholder="ex. 35"
            />
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Obligatoire : un temps partiel qui ne la porte pas est présumé à temps plein.
            </span>
          </div>

          <div className={fieldCls}>
            <label htmlFor="ct-essai" className={labelCls}>
              Période d&apos;essai (mois)
            </label>
            <input
              id="ct-essai"
              className={inputCls}
              value={essai}
              disabled={isPending}
              inputMode="numeric"
              onChange={(e) => setEssai(e.target.value)}
              placeholder="laisser vide si aucune"
            />
            {plafondEssai !== null && (
              <span
                className={
                  essaiDepasse
                    ? "text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-danger)]"
                    : "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                }
                role={essaiDepasse ? "alert" : undefined}
              >
                {essaiDepasse
                  ? `Au-delà du plafond légal de ${plafondEssai} mois pour cette classification (art. L.1221-19).`
                  : `Plafond légal : ${plafondEssai} mois. Votre convention peut en fixer un plus court — le sien prime alors.`}
              </span>
            )}
          </div>

          <div className={`${fieldCls} sm:col-span-2`}>
            <label htmlFor="ct-lieu-travail" className={labelCls}>
              Lieu habituel de travail
            </label>
            <input
              id="ct-lieu-travail"
              className={inputCls}
              value={lieuTravail}
              disabled={isPending}
              onChange={(e) => setLieuTravail(e.target.value)}
            />
          </div>

          {/*
            ⛔ LES DEUX MENTIONS QUI REQUALIFIENT UN CDD EN CDI, et elles
            n'apparaissent que pour un CDD. Les montrer sur un CDI inviterait à
            les remplir : un terme sur un contrat à durée indéterminée est une
            contradiction dans les termes, et il s'imprimerait.
          */}
          {type === "cdd" && (
            <>
              <div className={fieldCls}>
                <label htmlFor="ct-fin" className={labelCls}>
                  Terme du contrat
                </label>
                <input
                  id="ct-fin"
                  type="date"
                  className={inputCls}
                  value={dateFin}
                  disabled={isPending}
                  onChange={(e) => setDateFin(e.target.value)}
                />
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  Sans terme, le contrat est réputé à durée indéterminée (art. L.1242-12).
                </span>
              </div>
              <div className={`${fieldCls} sm:col-span-2`}>
                <label htmlFor="ct-motif" className={labelCls}>
                  Motif de recours au CDD
                </label>
                <textarea
                  id="ct-motif"
                  className={inputCls}
                  rows={3}
                  value={motifCdd}
                  disabled={isPending}
                  onChange={(e) => setMotifCdd(e.target.value)}
                  placeholder="ex. Remplacement de Mme X, formatrice, absente pour congé maternité du … au …"
                />
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  Mention obligatoire et PRÉCISE (art. L.1242-2). Son absence entraîne la
                  requalification en CDI.
                </span>
              </div>
            </>
          )}
        </div>

        {error !== null && (
          <div className="admin-alert admin-alert-error whitespace-pre-line" role="alert">
            {error}
          </div>
        )}
        {ok !== null && (
          <div className="admin-alert admin-alert-success" role="status">
            {ok}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <button type="submit" className="admin-button" disabled={isPending}>
            {isPending ? "Enregistrement…" : "Enregistrer les mentions"}
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={isPending}
            onClick={etablir}
          >
            Établir le contrat (PDF)
          </button>
          {contratExistant !== null && (
            <a
              className="admin-button-secondary"
              href={`/api/qualiopi/documents/${contratExistant.documentId}`}
              target="_blank"
              rel="noreferrer"
            >
              Relire {contratExistant.numero} ({contratExistant.emisLe})
            </a>
          )}
        </div>
      </form>
    </section>
  );
}

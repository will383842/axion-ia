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
 *   3. RELIRE — le PDF s'ouvre ; c'est ici qu'on attrape une mention fausse ;
 *   4. PRÉVENIR LE SALARIÉ — le message qui l'envoie lire et signer.
 *
 * Will a demandé la relecture avant l'envoi. Un bouton unique « établir et
 * envoyer » ne l'aurait pas permise : la pièce serait partie dans le même geste
 * que la saisie.
 *
 * 🔴 LE QUATRIÈME GESTE MANQUAIT, ET C'ÉTAIT LE PLUS INVISIBLE DES DÉFAUTS. La
 * pièce était produite, signable, lisible depuis l'espace du salarié — et rien
 * ne l'y envoyait. Quelqu'un qu'on vient d'embaucher n'ouvre pas un « espace
 * formateur » de sa propre initiative : il attend qu'on lui dise. Le lecteur
 * existait, personne ne lui indiquait le chemin.
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
  consignerRemiseContratAction,
  genererContratTravailAction,
  notifierContratTravailAction,
  updateTrainerContratAction,
} from "@/server/actions/qualiopi/trainer-contrat";
import { plafondLegalEssai } from "@/server/qualiopi/trainers/contrat-travail";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

/** `Date` → `yyyy-mm-dd` pour un `<input type="date">`, chaîne vide si absente. */
function versChampDate(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

/**
 * L'inverse de `versChampDate` — pour dériver le plafond d'essai d'un CDD de la
 * durée EN COURS DE SAISIE, pas de celle enregistrée.
 *
 * ⚠️ `null` sur une date incomplète (« 2026-1 » pendant la frappe) : sans ce
 * refus, `new Date` rendrait une date valide mais absurde, et l'avertissement
 * clignoterait entre deux plafonds à chaque caractère tapé.
 */
function depuisChampDate(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
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
  /**
   * La pièce déjà produite ne porte PLUS les mentions de la fiche.
   *
   * 🔴 Décidé côté serveur, sur une EMPREINTE des mentions scellée à l'émission —
   * jamais sur `updatedAt`, qui bouge aussi quand on consigne la remise de
   * l'exemplaire, c'est-à-dire au geste qui SUIT normalement l'envoi.
   */
  contratDesynchronise: boolean;
  /**
   * L'annonce faite au salarié, si elle a eu lieu. `null` = jamais prévenu.
   *
   * 🔑 Lu dans le journal des e-mails, pas déduit : sans cette trace,
   * l'opérateur réenverrait par prudence ou n'enverrait rien en croyant que
   * c'est fait — deux erreurs symétriques que la même absence produit.
   */
  notification: { leLisible: string; rebond: boolean } | null;
  /**
   * Date à laquelle le salarié a REÇU son exemplaire. `null` = non consignée.
   *
   * ⛔ Distincte de `notification` : « on lui a dit » et « il l'a » sont deux
   * faits, et c'est leur confusion qui rendrait la trace fausse au moment exact
   * où elle compte — devant quelqu'un qui demande la preuve de la remise.
   */
  remisLe: string | null;
}

export function TrainerContratTravailPanel({
  trainerId,
  initial,
  conventionRenseignee,
  hrefConfig,
  contratExistant,
  contratDesynchronise,
  notification,
  remisLe,
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
  const [remise, setRemise] = useState(remisLe ?? "");

  /*
    Plafond LÉGAL de la période d'essai.

    🔴 IL DÉPEND DE LA NATURE DU CONTRAT, et cette fonction ne le savait pas
    (recette du 13/09). Elle ne recevait que la classification, donc elle rendait
    toujours le plafond du CDI (art. L.1221-19). Sur un CDD de six mois classé
    « Cadre », l'écran affichait « Plafond légal : 4 mois » — rassurant, et faux :
    l'art. L.1242-10 le limite à DEUX SEMAINES. Quatre mois d'essai y sont nuls,
    et le salarié est réputé confirmé depuis son premier jour.

    ⚠️ La convention peut en fixer un plus COURT, auquel cas c'est le sien qui
    s'applique — le libellé le dit, parce qu'un plafond affiché sans cette
    réserve se lirait comme une autorisation.
  */
  const plafondEssai = plafondLegalEssai({
    contratType: type === "" ? null : type,
    contratClassification: classification,
    dateEmbauche: depuisChampDate(dateEmbauche),
    contratDateFin: depuisChampDate(dateFin),
  });
  const essaiNombre = essai.trim() === "" ? null : Number(essai);
  const essaiDepasse =
    plafondEssai !== null &&
    essaiNombre !== null &&
    Number.isFinite(essaiNombre) &&
    essaiNombre > plafondEssai.plafondMois;

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

  function consignerRemise(efface: boolean) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await consignerRemiseContratAction({
        trainerId,
        remisLe: efface || remise.trim() === "" ? null : remise,
      });
      if ("error" in res) setError(res.error);
      else {
        setOk(
          res.data.efface
            ? "Date de remise effacée."
            : "Remise consignée. L'alerte s'éteindra au prochain balayage.",
        );
        if (res.data.efface) setRemise("");
        router.refresh();
      }
    });
  }

  function prevenir() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await notifierContratTravailAction({ trainerId });
      if ("error" in res) setError(res.error);
      else {
        setOk(`Message envoyé à ${res.data.destinataire}.`);
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
              // Le plafond légal et son dépassement sont RATTACHÉS au champ : un
              // lecteur d'écran les énonce en y entrant, sans avoir à explorer
              // ce qui suit l'input pour les découvrir.
              aria-describedby="ct-essai-aide"
              aria-invalid={essaiDepasse || undefined}
              onChange={(e) => setEssai(e.target.value)}
              placeholder="laisser vide si aucune"
            />
            {/*
              🔴 RÉGION LIVE STABLE, MONTÉE EN PERMANENCE (recette a11y du 13/09).

              Le dépassement basculait `role` sur un élément DÉJÀ monté : un
              lecteur d'écran n'annonce pas un rôle live posé après coup, il
              annonce les changements d'une région live qu'il surveillait DÉJÀ.
              L'avertissement le plus important du formulaire — celui qui dit
              qu'une période d'essai est nulle — n'était donc jamais lu à voix
              haute. Le conteneur existe désormais toujours, avec son rôle posé
              une fois pour toutes ; seul son TEXTE change.

              ⚠️ Et le texte porte le mot « Dépassement » : l'information ne
              tient pas qu'à la couleur rouge.
            */}
            <span
              id="ct-essai-aide"
              role="status"
              aria-live="polite"
              className={
                essaiDepasse
                  ? "text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-danger)]"
                  : "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
              }
            >
              {plafondEssai === null
                ? ""
                : essaiDepasse
                  ? `Dépassement — ${plafondEssai.libelle}`
                  : plafondEssai.libelle}
            </span>
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
              {/*
                ⚠️ LE DÉLAI DE TRANSMISSION, DIT SANS ÊTRE CALCULÉ.

                L'art. L.1242-13 fait courir DEUX JOURS OUVRABLES depuis
                l'embauche. On énonce la règle et on ne fabrique pas de date :
                « jours ouvrables » suppose les fériés et les samedis, et une
                date fausse sur un délai de requalification serait pire que pas
                de date du tout — elle ferait croire qu'on a jusque-là.
              */}
              <div className="sm:col-span-2">
                <p className="admin-alert admin-alert-warning" role="status">
                  <strong>Délai de transmission.</strong> Un CDD doit être remis au salarié dans les{" "}
                  <strong>deux jours ouvrables</strong> suivant son embauche (art. L.1242-13).
                  Au-delà, il est requalifiable en CDI. Établissez-le, relisez-le, puis prévenez le
                  salarié sans attendre.
                </p>
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
          {/*
            ⛔ Le bouton n'apparaît QU'APRÈS l'établissement. Proposer « prévenir »
            sur un salarié sans contrat enverrait quelqu'un ouvrir un espace vide —
            pire que le silence qu'on corrige : le silence n'engage rien, l'annonce
            fausse fait perdre confiance dans tout ce qui suivra.
          */}
          {contratExistant !== null && (
            <button
              type="button"
              className="admin-button-secondary"
              /*
                🔴 NEUTRALISÉ TANT QUE LA PIÈCE NE PORTE PAS LES CORRECTIONS.

                L'annonce décrit la fiche VIVANTE et renvoie vers la PIÈCE. Les
                laisser diverger faisait partir « votre CDD pour le poste de
                Secrétaire administrative… Référence : AXI-DOC-2026-050 » pendant
                que ce PDF portait « Formatrice IA ». L'action refuse aussi de son
                côté — ici on évite d'abord le clic, là-bas on garantit le refus
                même si cet écran se trompe.
              */
              disabled={isPending || contratDesynchronise}
              aria-describedby={contratDesynchronise ? "ct-perime" : undefined}
              onClick={prevenir}
            >
              {notification === null ? "Prévenir le salarié" : "Prévenir à nouveau"}
            </button>
          )}
        </div>

        {contratExistant !== null && contratDesynchronise && (
          <div id="ct-perime" className="admin-alert admin-alert-error" role="alert">
            <strong>
              {contratExistant.numero} a été établi avant vos dernières corrections : il ne les
              porte pas.
            </strong>{" "}
            Le relire montrerait l&apos;ancienne version, et prévenir le salarié lui enverrait
            signer celle-là. Cliquez <strong>« Établir le contrat (PDF) »</strong> pour produire un
            tirage à jour, relisez-le, puis prévenez-le.
          </div>
        )}

        {/*
          ── LA REMISE, LE SEUL FAIT QUE LE LOGICIEL NE VOYAIT PAS ──────────────

          🔴 Le contrat était produit, le salarié prévenu, la pièce dans son
          espace. Restait « est-ce qu'il a son exemplaire ? », et la réponse ne
          reposait sur rien d'observable. Si la remise a lieu, tout va bien ; si
          elle n'a pas lieu, rien ne le dit et personne ne l'apprend avant un
          conseil de prud'hommes.

          ⛔ CE N'EST PAS « prévenu le … » JUSTE AU-DESSUS. Annoncer qu'une pièce
          est disponible n'est pas la remettre, et consigner l'un pour l'autre
          donnerait une trace FAUSSE — pire qu'une trace absente, parce qu'elle
          se défend.

          ⚠️ La date est SAISIE : une remise a pu avoir lieu la veille, ou le jour
          de l'embauche pendant que personne n'était devant l'écran. Un bouton
          « aujourd'hui » ferait dire à la trace autre chose que ce qui s'est
          passé, sur la pièce même qu'on produirait pour le prouver.
        */}
        {contratExistant !== null && (
          <div className="flex flex-col gap-[var(--space-admin-2)]">
            <label className={labelCls} htmlFor="ct-remise">
              Exemplaire remis au salarié le
            </label>
            <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
              <input
                id="ct-remise"
                type="date"
                className={`${inputCls} max-w-[14rem]`}
                value={remise}
                disabled={isPending}
                onChange={(e) => setRemise(e.target.value)}
              />
              <button
                type="button"
                className="admin-button-secondary"
                disabled={isPending || remise.trim() === ""}
                onClick={() => consignerRemise(false)}
              >
                Consigner la remise
              </button>
              {remisLe !== null && (
                <button
                  type="button"
                  className="admin-button-ghost"
                  disabled={isPending}
                  onClick={() => consignerRemise(true)}
                >
                  Effacer
                </button>
              )}
            </div>
            {remisLe === null && type === "cdd" ? (
              <span
                className="text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-danger)]"
                role="status"
              >
                Remise non consignée. Sur un CDD, c&apos;est elle qui éteint l&apos;alerte — et le
                délai de l&apos;article L.1242-13 court depuis l&apos;embauche.
              </span>
            ) : (
              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {remisLe === null
                  ? "Consignez la date à laquelle il a reçu son exemplaire — ce n'est pas la date du message ci-dessous."
                  : "C'est cette date qui prouve la remise, pas l'envoi du message."}
              </span>
            )}
          </div>
        )}

        {/*
          🔑 L'ÉTAT DE L'ANNONCE, DIT DANS LES DEUX SENS. « Jamais prévenu » est
          une information au même titre que « prévenu le 12/09 » : sans elle,
          l'absence de ligne se lirait comme « rien à signaler ».
        */}
        {contratExistant !== null &&
          (notification === null ? (
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Le salarié n&apos;a <strong>pas encore été prévenu</strong> : rien ne l&apos;a envoyé
              vers son espace.
            </p>
          ) : notification.rebond ? (
            <p
              className="text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-danger)]"
              role="alert"
            >
              Message envoyé le {notification.leLisible}, mais <strong>refusé</strong> par la
              messagerie du destinataire. Vérifiez son adresse e-mail : il ne l&apos;a pas reçu.
            </p>
          ) : (
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Salarié prévenu le {notification.leLisible}.
            </p>
          ))}
      </form>
    </section>
  );
}

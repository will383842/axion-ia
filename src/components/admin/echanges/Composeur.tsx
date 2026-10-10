"use client";
// use-client: états locaux (modèle, objet, corps), aperçu vif et machine d'états de l'envoi.

/**
 * LE COMPOSEUR UNIQUE — répondre à une personne, dans les deux mondes
 * (Candidatures unifiées L6).
 *
 * Avant, la fiche d'un candidat et celle d'un futur apporteur avaient chacune
 * leur « Répondre » : le second sans modèle adapté ni fichier à joindre. Ce
 * panneau est désormais le même partout ; ce qui change d'un monde à l'autre
 * arrive par les ADAPTATEURS, jamais par une condition ici :
 *
 *   - `contacts/candidatures/[id]/ComposerReponse.tsx` (emploi) : modèles de
 *     recrutement, bibliothèque complète, « Depuis mon ordinateur », dépôt L5b ;
 *   - `components/admin/contacts/ComposerReponseApporteur.tsx` (réseau) :
 *     modèles du réseau, kit et présentation SEULS, rien d'autre.
 *
 * 🔴 Ce composant ne porte AUCUN mot propre à un monde : les libellés lui sont
 * donnés. C'est ce qui permet de garantir qu'aucun mot de recrutement n'arrive
 * côté apporteur (garde : `vocabulaire-apporteur.spec.ts`).
 *
 * ## Ce qu'il montre, et pourquoi ça compte
 *
 * L'aperçu rend le texte avec la MÊME grammaire que l'e-mail qui partira — la
 * partie pure de `markdown-leger`, importée par les deux.
 *
 * ## La machine d'états, et pourquoi elle n'a pas d'état « envoyé »
 *
 * Cliquer « Envoyer » met en file : à ce moment, le message n'est pas parti. On
 * affiche donc « en file », puis on sonde l'état réel, puis on dit « remise »
 * ou « échec, réessayer » (défaut `D5-1-C1` de ce dépôt).
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { remplirModele } from "@/content/modeles/remplir";
import { fragmenter, paragraphes } from "@/lib/email/markdown-leger";
import { OBJET_MAX } from "@/lib/email/objet-email";

/** Un texte de départ, dans le vocabulaire du monde de la personne. */
export interface ModeleComposeur {
  readonly id: string;
  readonly libelle: string;
  readonly quand: string;
  readonly objet: string;
  readonly corps: string;
}

/** Un lien à insérer d'un clic — imprimé, ou rendez-vous Calendly. */
export interface LienInsertionComposeur {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

/** Un fichier proposé dans « Depuis ma bibliothèque », calculé côté SERVEUR. */
export interface FichierBibliothequeComposeur {
  readonly id: string;
  readonly titre: string;
  readonly categorie: string;
  readonly libelleCategorie: string;
  readonly taille: number | null;
  readonly tailleLisible: string | null;
  readonly enAnalyse: boolean;
}

/** Un fichier choisi pour partir avec le message. */
export interface FichierJoint {
  readonly id: string;
  readonly titre: string;
  readonly categorie: string;
  readonly taille: number | null;
}

/** Ce que l'adaptateur reçoit pour envoyer. */
export interface EnvoiComposeur {
  readonly objet: string;
  readonly corps: string;
  readonly modele: string;
  readonly note?: string;
  readonly fichierIds?: ReadonlyArray<string>;
  readonly depotAutorise?: boolean;
}

export type ResultatComposeur =
  | { readonly ok: true; readonly replyId: string }
  | { readonly ok: false; readonly message: string; readonly replyId?: string };

export type EtatLivraisonComposeur = {
  readonly statut: string;
  readonly erreur?: string | null;
} | null;

type Phase =
  | { readonly nom: "repos" }
  | { readonly nom: "envoi" }
  | { readonly nom: "en_file"; readonly replyId: string }
  | { readonly nom: "remise" }
  | { readonly nom: "echec"; readonly message: string; readonly replyId?: string };

const JoindreFichiers = dynamic(() => import("./JoindreFichiers"), {
  ssr: false,
  loading: () => <p className="admin-meta-small">Chargement…</p>,
});

export interface ComposeurProps {
  /** Le bouton qui ouvre le panneau (« Répondre au candidat », « Répondre »). */
  readonly libelleOuvrir: string;
  readonly modeles: ReadonlyArray<ModeleComposeur>;
  /** Variables substituées dans les modèles (`{prenom}`, `{poste}`…). */
  readonly valeurs: Record<string, string | null>;
  readonly envoyer: (e: EnvoiComposeur) => Promise<ResultatComposeur>;
  readonly rejouer: (replyId: string) => Promise<ResultatComposeur>;
  readonly etat: (replyId: string) => Promise<EtatLivraisonComposeur>;
  readonly liensInsertion?: ReadonlyArray<LienInsertionComposeur>;
  /** Fichiers à joindre ; `null` : la bibliothèque est éteinte, aucun bouton. */
  readonly partages?: {
    readonly bibliotheque: ReadonlyArray<FichierBibliothequeComposeur>;
    /** « Depuis mon ordinateur » (emploi seulement). */
    readonly ordinateur: boolean;
    /** Case « déposer sa version » (L5b, emploi seulement) ; `null` : absente. */
    readonly libelleDepot: string | null;
    readonly videTexte?: string;
  } | null;
  /** Ouvert d'emblée (fiche dont le seul geste attendu est la réponse). */
  readonly ouvertAuDepart?: boolean;
}

/** Rendu de l'aperçu — mêmes fragments que l'e-mail, apparence de la console. */
function Apercu({ texte }: { texte: string }): React.ReactElement {
  const blocs = useMemo(() => paragraphes(texte), [texte]);
  if (blocs.length === 0) {
    return <p className="admin-meta-small">L’aperçu s’affichera ici pendant que vous écrivez.</p>;
  }
  return (
    <>
      {blocs.map((bloc, i) => (
        <p key={i} className="mb-[var(--space-admin-3)] text-sm leading-relaxed">
          {fragmenter(bloc).map((f, j) => {
            if (f.type === "gras") return <strong key={j}>{f.valeur}</strong>;
            if (f.type === "italique") return <em key={j}>{f.valeur}</em>;
            if (f.type === "lien")
              return (
                <a key={j} href={f.href} className="admin-link" rel="noopener">
                  {f.valeur}
                </a>
              );
            return <span key={j}>{f.valeur}</span>;
          })}
        </p>
      ))}
    </>
  );
}

export function Composeur({
  libelleOuvrir,
  modeles,
  valeurs,
  envoyer: envoyerAction,
  rejouer: rejouerAction,
  etat,
  liensInsertion = [],
  partages = null,
  ouvertAuDepart = false,
}: ComposeurProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  const [modele, setModele] = useState<string>(modeles[0]?.id ?? "libre");
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>({ nom: "repos" });
  const [fichiers, setFichiers] = useState<FichierJoint[]>([]);
  const [panneauFichiers, setPanneauFichiers] = useState(false);
  const [depotAutorise, setDepotAutorise] = useState(false);
  const [, demarrer] = useTransition();
  const corpsRef = useRef<HTMLTextAreaElement>(null);

  /** Insère `[libellé](url)` AU CURSEUR ; sans curseur connu, en fin de message. */
  function insererLien(lien: LienInsertionComposeur): void {
    const fragment = `[${lien.label}](${lien.url})`;
    const el = corpsRef.current;
    if (!el) {
      setCorps((c) => (c.length > 0 ? `${c}\n\n${fragment}` : fragment));
      return;
    }
    const debut = el.selectionStart ?? corps.length;
    const fin = el.selectionEnd ?? corps.length;
    setCorps(corps.slice(0, debut) + fragment + corps.slice(fin));
    const position = debut + fragment.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(position, position);
    });
  }

  function choisirModele(id: string): void {
    setModele(id);
    const m = modeles.find((x) => x.id === id);
    if (!m) return;
    // 🔑 On ÉCRASE, y compris avec du vide pour « Message libre » : fusionner
    // l'ancien texte et le nouveau produirait un message que personne n'a écrit.
    setObjet(remplirModele(m.objet, valeurs));
    setCorps(remplirModele(m.corps, valeurs));
  }

  // Sondage de l'état réel après mise en file. S'arrête dès qu'il est tranché.
  useEffect(() => {
    if (phase.nom !== "en_file") return;
    const replyId = phase.replyId;
    let vivant = true;
    const minuteur = setInterval(() => {
      void etat(replyId).then((e) => {
        if (!vivant || !e) return;
        if (e.statut === "sent") {
          setPhase({ nom: "remise" });
          router.refresh();
        } else if (e.statut === "failed" || e.statut === "bounced") {
          setPhase({ nom: "echec", message: e.erreur ?? "L'envoi a échoué.", replyId });
        }
      });
    }, 3_000);
    // Au bout de 30 s on cesse de sonder : la fiche porte l'état.
    const arret = setTimeout(() => {
      vivant = false;
      clearInterval(minuteur);
      router.refresh();
    }, 30_000);
    return () => {
      vivant = false;
      clearInterval(minuteur);
      clearTimeout(arret);
    };
  }, [phase, router, etat]);

  function envoyer(): void {
    setPhase({ nom: "envoi" });
    demarrer(() => {
      void envoyerAction({
        objet,
        corps,
        modele,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(fichiers.length > 0
          ? {
              fichierIds: fichiers.map((f) => f.id),
              depotAutorise: partages?.libelleDepot ? depotAutorise : false,
            }
          : {}),
      }).then((r) => {
        if (r.ok) {
          setPhase({ nom: "en_file", replyId: r.replyId });
          setFichiers([]);
          setPanneauFichiers(false);
          setDepotAutorise(false);
          router.refresh();
          return;
        }
        setPhase({
          nom: "echec",
          message: r.message,
          ...(r.replyId ? { replyId: r.replyId } : {}),
        });
      });
    });
  }

  function rejouer(replyId: string): void {
    setPhase({ nom: "envoi" });
    demarrer(() => {
      void rejouerAction(replyId).then((r) => {
        setPhase(
          r.ok
            ? { nom: "en_file", replyId: r.replyId }
            : { nom: "echec", message: r.message, replyId },
        );
      });
    });
  }

  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        {libelleOuvrir}
      </button>
    );
  }

  const objetTropLong = objet.length > OBJET_MAX;
  const envoiPossible =
    objet.trim().length >= 2 && corps.trim().length > 0 && phase.nom !== "envoi";

  return (
    <div className="admin-form">
      <div className="admin-field">
        <label htmlFor="modele" className="admin-label">
          Modèle de départ
        </label>
        <select
          id="modele"
          className="admin-input"
          value={modele}
          onChange={(e) => choisirModele(e.target.value)}
        >
          {modeles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.libelle}
            </option>
          ))}
        </select>
        <p className="admin-meta-small">{modeles.find((m) => m.id === modele)?.quand}</p>
      </div>

      <div className="admin-field">
        <label htmlFor="objet" className="admin-label">
          Objet
        </label>
        <input
          id="objet"
          className="admin-input"
          value={objet}
          maxLength={120}
          onChange={(e) => setObjet(e.target.value)}
        />
        {/* 🔑 On AVERTIT, on ne bloque pas : au-delà de 45 caractères les
            messageries coupent l'objet. */}
        <p className={objetTropLong ? "admin-alert admin-alert-warning" : "admin-meta-small"}>
          {objet.length} / {OBJET_MAX} caractères
          {objetTropLong ? " — au-delà, les messageries coupent l’objet." : null}
        </p>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="corps" className="admin-label">
            Message
          </label>
          {liensInsertion.length > 0 ? (
            <div
              role="group"
              aria-label="Insérer un lien"
              className="mb-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-2)]"
            >
              <span className="admin-meta-small self-center">Insérer un lien :</span>
              {liensInsertion.map((lien) => (
                <button
                  key={lien.id}
                  type="button"
                  className="admin-button-ghost"
                  onClick={() => insererLien(lien)}
                >
                  {lien.label}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            id="corps"
            ref={corpsRef}
            className="admin-input admin-textarea"
            rows={14}
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
          />
          <p className="admin-meta-small">
            Mise en forme : **gras**, *italique*, [libellé](adresse). Une ligne vide sépare deux
            paragraphes.
          </p>
        </div>
        <div className="admin-field">
          <span className="admin-label">Aperçu</span>
          <div className="admin-card-inset">
            <Apercu texte={corps} />
          </div>
        </div>
      </div>

      {partages ? (
        <div className="admin-field">
          <span className="admin-label">Fichiers joints</span>
          {fichiers.length > 0 ? (
            <ul className="grid gap-[var(--space-admin-1)]">
              {fichiers.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                  <span>{f.titre}</span>
                  <button
                    type="button"
                    className="admin-button-ghost admin-button-xs"
                    onClick={() => setFichiers((l) => l.filter((x) => x.id !== f.id))}
                    aria-label={`Retirer ${f.titre}`}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {fichiers.length > 0 && partages.libelleDepot ? (
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={depotAutorise}
                onChange={(e) => setDepotAutorise(e.target.checked)}
              />
              <span>{partages.libelleDepot}</span>
            </label>
          ) : null}
          {panneauFichiers ? (
            <JoindreFichiers
              bibliotheque={partages.bibliotheque}
              choisis={fichiers}
              onChanger={setFichiers}
              onFermer={() => setPanneauFichiers(false)}
              ordinateur={partages.ordinateur}
              {...(partages.videTexte ? { videTexte: partages.videTexte } : {})}
            />
          ) : (
            <div>
              <button
                type="button"
                className="admin-button-secondary admin-button-tactile"
                onClick={() => setPanneauFichiers(true)}
              >
                Joindre des fichiers
              </button>
            </div>
          )}
          <p className="admin-meta-small">
            Les fichiers partent comme un lien personnel ajouté à la fin du message, jamais en pièce
            jointe. Lien valable 30 jours (7 jours avec des rushs), à prolonger ou retirer depuis «
            Fichiers envoyés ».
          </p>
        </div>
      ) : null}

      <div className="admin-field">
        <label htmlFor="note" className="admin-label">
          Note interne (jamais envoyée)
        </label>
        <input
          id="note"
          className="admin-input"
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div>
        <button type="button" className="admin-button" disabled={!envoiPossible} onClick={envoyer}>
          {phase.nom === "envoi" ? "Envoi…" : "Envoyer"}
        </button>
        <button type="button" className="admin-button-ghost" onClick={() => setOuvert(false)}>
          Fermer
        </button>

        {phase.nom === "en_file" ? (
          <span role="status" className="admin-alert admin-alert-warning">
            {" "}
            Mise en file — le message n’est pas encore remis.
          </span>
        ) : null}
        {phase.nom === "remise" ? (
          <span role="status" className="admin-alert admin-alert-success">
            {" "}
            Remise confirmée.
          </span>
        ) : null}
        {phase.nom === "echec" ? (
          <span role="alert" className="admin-alert admin-alert-error">
            {" "}
            {phase.message}
            {phase.replyId ? (
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => rejouer(phase.replyId!)}
              >
                Réessayer
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

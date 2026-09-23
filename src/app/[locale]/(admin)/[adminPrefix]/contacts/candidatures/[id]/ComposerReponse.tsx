"use client";
// use-client: états locaux (modèle, objet, corps), aperçu vif et machine d'états de l'envoi.

/**
 * COMPOSER UNE RÉPONSE À UN CANDIDAT.
 *
 * ## Ce qu'il montre, et pourquoi ça compte
 *
 * L'aperçu à droite rend le texte avec la MÊME grammaire que l'e-mail qui
 * partira — la partie pure de `markdown-leger`, importée par les deux. Une
 * seconde implémentation « pour l'aperçu » finirait par montrer autre chose que
 * ce qui part, et c'est précisément ce dont un composeur doit protéger.
 *
 * ## La machine d'états, et pourquoi elle n'a pas d'état « envoyé »
 *
 * Cliquer « Envoyer » met en file : à ce moment, le message n'est pas parti. Un
 * écran qui afficherait « Envoyé » mentirait pendant les secondes — ou les
 * heures, si la chaîne d'envoi est en panne — qui séparent la mise en file de la
 * remise. On affiche donc « en file », puis on sonde l'état réel, puis on dit
 * « remise » ou « échec, réessayer ». C'est le défaut `D5-1-C1` de ce dépôt,
 * pris à l'endroit où il se produit.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  repondreAuCandidatAction,
  rejouerReponseEchoueeAction,
  etatLivraisonReponseAction,
} from "@/features/admin-job-applications/reply-actions";
// 🔴 Les libellés d'erreur vivent HORS du fichier d'actions : un module
// `"use server"` ne peut exporter que des fonctions asynchrones, et un objet
// y fait planter la page entière au chargement.
import { LIBELLES_ERREUR_REPONSE } from "@/features/admin-job-applications/libelles-erreurs";
import {
  MODELES_REPONSE,
  remplirModele,
  type ModeleReponseId,
} from "@/content/recrutement/modeles-reponse";
import { fragmenter, paragraphes } from "@/lib/email/markdown-leger";
import { OBJET_MAX } from "@/lib/email/objet-email";

type Phase =
  | { readonly nom: "repos" }
  | { readonly nom: "envoi" }
  | { readonly nom: "en_file"; readonly replyId: string }
  | { readonly nom: "remise" }
  | { readonly nom: "echec"; readonly message: string; readonly replyId?: string };

/**
 * Un lien à insérer d'un clic — imprimé, ou rendez-vous Calendly.
 * Calculé côté SERVEUR par `liensInsertionComposeur` (voir la page) : le
 * référentiel des imprimés et `env` ne doivent pas traverser vers ce composant
 * client, qui n'a besoin que de trois `{ id, label, url }` réduits.
 */
export interface LienInsertionComposeur {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

interface Props {
  readonly applicationId: string;
  readonly prenom: string;
  readonly poste: string;
  /** Boutons « Insérer un lien » proposés à côté du corps du message. */
  readonly liensInsertion?: readonly LienInsertionComposeur[];
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

export function ComposerReponse({
  applicationId,
  prenom,
  poste,
  liensInsertion = [],
}: Props): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [modele, setModele] = useState<ModeleReponseId>("libre");
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>({ nom: "repos" });
  const [, demarrer] = useTransition();
  const corpsRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insère `[libellé](url)` AU CURSEUR — pas en fin de texte. Le composeur
   * n'accepte aucune pièce jointe (doctrine du dépôt : un lien suit la
   * dernière version du document, une pièce jointe de 10 Mo pousse vers les
   * indésirables) ; Will ne retient pas les adresses de tête, donc en
   * pratique il n'en collait jamais. Sans position de curseur connue (aucune
   * sélection faite), on ajoute en fin de message plutôt que d'échouer.
   */
  function insererLien(lien: LienInsertionComposeur): void {
    const fragment = `[${lien.label}](${lien.url})`;
    const el = corpsRef.current;
    if (!el) {
      setCorps((c) => (c.length > 0 ? `${c}\n\n${fragment}` : fragment));
      return;
    }
    const debut = el.selectionStart ?? corps.length;
    const fin = el.selectionEnd ?? corps.length;
    const nouveau = corps.slice(0, debut) + fragment + corps.slice(fin);
    setCorps(nouveau);
    const position = debut + fragment.length;
    // Après le prochain rendu : `el.value` doit déjà porter le texte inséré
    // pour que `setSelectionRange` positionne le curseur au bon endroit.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(position, position);
    });
  }

  function choisirModele(id: ModeleReponseId): void {
    setModele(id);
    const m = MODELES_REPONSE.find((x) => x.id === id);
    if (!m) return;
    const valeurs = { prenom, poste };
    // 🔑 On ÉCRASE, y compris avec du vide pour « Message libre ». Fusionner
    // l'ancien texte avec le nouveau produirait un message hybride que personne
    // n'a écrit — et qu'on relirait mal, parce qu'il ressemble à un brouillon.
    setObjet(remplirModele(m.objet, valeurs));
    setCorps(remplirModele(m.corps, valeurs));
  }

  // Sondage de l'état réel après mise en file. S'arrête dès qu'il est tranché.
  useEffect(() => {
    if (phase.nom !== "en_file") return;
    const replyId = phase.replyId;
    let vivant = true;
    const minuteur = setInterval(() => {
      void etatLivraisonReponseAction(replyId).then((etat) => {
        if (!vivant || !etat) return;
        if (etat.statut === "sent") {
          setPhase({ nom: "remise" });
          router.refresh();
        } else if (etat.statut === "failed" || etat.statut === "bounced") {
          setPhase({
            nom: "echec",
            message: etat.erreur ?? "L'envoi a échoué.",
            replyId,
          });
        }
      });
    }, 3_000);
    // Au bout de 30 s on cesse de sonder : la frise porte l'état, et un écran
    // qui interroge indéfiniment le serveur pour un message déjà en file coûte
    // plus qu'il n'apprend.
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
  }, [phase, router]);

  function envoyer(): void {
    setPhase({ nom: "envoi" });
    demarrer(() => {
      void repondreAuCandidatAction({
        applicationId,
        subject: objet,
        bodyMarkdown: corps,
        modele,
        ...(note.trim() ? { internalNote: note.trim() } : {}),
      }).then((r) => {
        if (r.ok) {
          setPhase({ nom: "en_file", replyId: r.replyId });
          router.refresh();
          return;
        }
        setPhase({
          nom: "echec",
          message: LIBELLES_ERREUR_REPONSE[r.error] ?? `Échec (${r.error}).`,
          ...(r.replyId ? { replyId: r.replyId } : {}),
        });
      });
    });
  }

  function rejouer(replyId: string): void {
    setPhase({ nom: "envoi" });
    demarrer(() => {
      void rejouerReponseEchoueeAction(replyId).then((r) => {
        setPhase(
          r.ok
            ? { nom: "en_file", replyId: r.replyId }
            : { nom: "echec", message: LIBELLES_ERREUR_REPONSE[r.error] ?? r.error, replyId },
        );
      });
    });
  }

  if (!ouvert) {
    return (
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        Répondre au candidat
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
          onChange={(e) => choisirModele(e.target.value as ModeleReponseId)}
        >
          {MODELES_REPONSE.map((m) => (
            <option key={m.id} value={m.id}>
              {m.libelle}
            </option>
          ))}
        </select>
        <p className="admin-meta-small">{MODELES_REPONSE.find((m) => m.id === modele)?.quand}</p>
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
        {/* 🔑 On AVERTIT, on ne bloque pas. Au-delà de 45 caractères les
            messageries coupent l'objet — c'est une information utile, pas une
            règle : refuser une soumission à 47 caractères serait une contrainte
            de forme imposée à quelqu'un qui écrit à une personne. */}
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
          {/* 🔑 Le composeur n'accepte aucune pièce jointe (doctrine du dépôt :
              un lien suit la dernière version du document, une pièce jointe de
              10 Mo pousse vers les indésirables). Sans ces boutons, Will devait
              retenir les adresses de tête pour coller un lien markdown — en
              pratique il n'en mettait jamais. Un clic insère `[libellé](url)`
              au curseur, prêt à partir. */}
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

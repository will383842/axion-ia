"use client";
// use-client: état local du brouillon (objet, message), appel de l'aperçu serveur, lecteur chargé à la demande.

/**
 * L'e-mail du devis tel que le client le recevra (étape 4). Le contenu vient du SERVEUR
 * (`apercuEmail`) : rien n'est rendu ici. Le fondateur peut modifier l'objet et ajouter un message
 * personnel ; le corps du gabarit ne se modifie pas. Chaque modification passe par « Actualiser
 * l'aperçu » : ce qui est montré est exactement ce qui part. Aucune écriture, aucun envoi ici.
 *
 * Cadre de hauteur fixe avec squelette (CLS = 0) ; le lecteur est chargé à la demande.
 */
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";

const OBJET_MAX = 300;
const MESSAGE_MAX = 4000;

type Resultat<T> = { data: T } | { error: string };

export interface DonneesApercuEmail {
  a: string;
  de: string;
  objet: string;
  objetOrigine: string;
  html: string;
  piecesJointes: string[];
  lienSignature: string;
  salutation: string;
  adresseManquante: boolean;
}

export interface ModificationsEmail {
  sujet?: string | undefined;
  message?: string | undefined;
}

/** Ce que l'écran d'envoi retient de l'aperçu : l'adresse lue sur la fiche, et ce qui sera envoyé. */
export interface EtatApercuEmail {
  a: string;
  sujet?: string | undefined;
  message?: string | undefined;
  /** Le brouillon diffère de l'aperçu affiché : l'envoi attend « Actualiser l'aperçu ». */
  nonActualise: boolean;
}

export interface PropsApercuEmailDevis {
  apercuEmail: (m: ModificationsEmail) => Promise<Resultat<DonneesApercuEmail>>;
  /** Fiche du client (modification de l'adresse), ouverte dans un nouvel onglet. */
  lienFiche?: string | undefined;
  /**
   * Faux par défaut : l'aperçu est en LECTURE SEULE (aucun champ). Vrai UNIQUEMENT quand l'appelant
   * relaie l'objet et le message jusqu'à `sendDevisAction` — sinon le fondateur croirait modifier
   * un e-mail dont les modifications ne partiraient pas.
   */
  modifiable?: boolean | undefined;
  onEtat: (e: EtatApercuEmail) => void;
}

const LecteurEmail = dynamic(
  () => import("@/components/admin/ui/LecteurEmail").then((m) => m.LecteurEmail),
  { ssr: false, loading: () => <Squelette /> },
);

function Squelette() {
  return (
    <div className="p-[var(--space-admin-5)]" aria-hidden="true">
      <div className="mb-2 h-5 w-1/2 rounded bg-[color:var(--color-admin-border)]" />
      <div className="mb-2 h-4 w-full rounded bg-[color:var(--color-admin-border)]" />
      <div className="h-4 w-3/4 rounded bg-[color:var(--color-admin-border)]" />
    </div>
  );
}

export function ApercuEmailDevis({
  apercuEmail,
  lienFiche,
  modifiable = false,
  onEtat,
}: PropsApercuEmailDevis) {
  const uid = useId();
  const [donnees, setDonnees] = useState<DonneesApercuEmail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Ce que l'aperçu affiché reflète.
  const [applique, setApplique] = useState<{ sujet: string | null; message: string }>({
    sujet: null,
    message: "",
  });
  // Ce que le fondateur est en train de taper.
  const [objet, setObjet] = useState("");
  const [message, setMessage] = useState("");
  const enVol = useRef(false);
  const lance = useRef(false);

  async function charger(sujet: string | null, msg: string) {
    if (enVol.current) return;
    enVol.current = true;
    setOccupe(true);
    setErreur(null);
    try {
      const r = await apercuEmail({
        ...(sujet !== null ? { sujet } : {}),
        ...(msg.trim() !== "" ? { message: msg.trim() } : {}),
      });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setDonnees(r.data);
      setApplique({ sujet, message: msg.trim() });
      // Sans objet choisi, le champ montre l'objet d'origine rendu par le serveur.
      if (sujet === null) setObjet(r.data.objetOrigine);
    } finally {
      enVol.current = false;
      setOccupe(false);
    }
  }

  useEffect(() => {
    // Un seul appel à l'entrée, même si l'effet est rejoué par le mode strict.
    if (lance.current) return;
    lance.current = true;
    void charger(null, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const objetOrigine = donnees?.objetOrigine ?? "";
  const objetAffiche = applique.sujet ?? objetOrigine;
  const nonActualise =
    donnees !== null && (objet.trim() !== objetAffiche || message.trim() !== applique.message);

  useEffect(() => {
    if (donnees === null) return;
    onEtat({
      a: donnees.a,
      ...(applique.sujet !== null ? { sujet: applique.sujet } : {}),
      ...(applique.message !== "" ? { message: applique.message } : {}),
      nonActualise,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, applique, nonActualise]);

  function actualiser() {
    const sujet = objet.trim() !== "" && objet.trim() !== objetOrigine ? objet.trim() : null;
    void charger(sujet, message);
  }

  function revenirALOrigine() {
    setObjet(objetOrigine);
    setMessage("");
    void charger(null, "");
  }

  return (
    <div className="grid gap-[var(--space-admin-4)]" data-testid="apercu-email">
      <div
        data-testid="cadre-apercu-email"
        aria-busy={donnees === null && erreur === null}
        className="h-[520px] overflow-auto rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)]"
      >
        {donnees === null && erreur === null ? <Squelette /> : null}
        {erreur !== null && donnees === null ? (
          <div role="alert" className="p-[var(--space-admin-5)]">
            <p className="mb-[var(--space-admin-3)]">{erreur}</p>
            <AdminButton variant="secondary" size="lg" onClick={() => void charger(null, "")}>
              Réessayer
            </AdminButton>
          </div>
        ) : null}
        {donnees !== null ? (
          <LecteurEmail
            apercu={{
              html: donnees.html,
              objet: donnees.objet,
              de: donnees.de,
              a: donnees.a === "" ? "(aucune adresse sur la fiche)" : donnees.a,
              piecesJointes: donnees.piecesJointes,
            }}
            titre={`Aperçu : ${donnees.objet}`}
            liensOuvrables
          />
        ) : null}
      </div>
      {donnees !== null ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Bouton « Signer le devis en ligne » : lien {donnees.lienSignature}.
        </p>
      ) : null}
      {erreur !== null && donnees !== null ? (
        <p role="alert" className="text-[color:var(--color-admin-destructive-fg)]">
          {erreur}
        </p>
      ) : null}
      {donnees?.adresseManquante === true ? (
        <p role="alert" className="text-[color:var(--color-admin-destructive-fg)]">
          La fiche du client n&apos;a pas d&apos;adresse e-mail : l&apos;envoi est impossible.{" "}
          {lienFiche ? (
            <a href={lienFiche} target="_blank" rel="noopener noreferrer" className="underline">
              Ajouter l&apos;adresse sur la fiche
            </a>
          ) : null}
        </p>
      ) : null}
      {donnees !== null && !modifiable && lienFiche ? (
        <div>
          <AdminButton
            variant="secondary"
            size="lg"
            disabled={occupe}
            onClick={() => void charger(null, "")}
          >
            Relire la fiche
          </AdminButton>
        </div>
      ) : null}
      {donnees !== null && modifiable ? (
        <div className="grid gap-[var(--space-admin-3)]">
          <label htmlFor={`${uid}-objet`} className="grid gap-1">
            Objet
            <input
              id={`${uid}-objet`}
              type="text"
              className="min-h-[44px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-control-border)] px-[var(--space-admin-4)]"
              value={objet}
              maxLength={OBJET_MAX}
              disabled={occupe}
              onChange={(e) => setObjet(e.target.value.replace(/[\r\n]+/g, " "))}
            />
          </label>
          <label htmlFor={`${uid}-message`} className="grid gap-1">
            Message personnel
            <textarea
              id={`${uid}-message`}
              className="min-h-[120px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-control-border)] px-[var(--space-admin-4)] py-[var(--space-admin-3)]"
              value={message}
              maxLength={MESSAGE_MAX}
              disabled={occupe}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {message.length} / {MESSAGE_MAX} caractères. Le message s&apos;ajoute au texte du devis
            ; le reste de l&apos;e-mail n&apos;est pas modifiable.
          </p>
          {nonActualise ? (
            <p
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
              data-testid="non-actualise"
            >
              Modifications pas encore montrées : actualisez l&apos;aperçu avant d&apos;envoyer.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <AdminButton variant="secondary" size="lg" disabled={occupe} onClick={actualiser}>
              Actualiser l&apos;aperçu
            </AdminButton>
            <AdminButton variant="secondary" size="lg" disabled={occupe} onClick={revenirALOrigine}>
              Revenir au texte d&apos;origine
            </AdminButton>
            {lienFiche ? (
              <AdminButton
                variant="secondary"
                size="lg"
                disabled={occupe}
                onClick={() => void charger(applique.sujet, applique.message)}
              >
                Relire la fiche
              </AdminButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";
// use-client: formulaire à état (saisie, panneau de doublon, confirmation, soumission async) — intrinsèquement client.
//
// SAISIE MANUELLE D'UN CONTACT APPORTEUR.
//
// Pour l'apporteur qui écrit par e-mail, celui rencontré sur un salon, celui
// repéré sur un site d'annonces. Aucun de ces gens ne pouvait entrer dans le
// système : les six chemins de création étaient tous des formulaires publics.
//
// ⛔ AUCUN ENVOI. Cette personne n'a rien demandé : ni confirmation, ni rappels.
// L'écran le DIT, plutôt que de laisser le doute — un administrateur qui ignore
// ce que son geste déclenche finit par ne plus oser l'utiliser.

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { creerContactManuelAction } from "@/features/commercial-application/saisie-manuelle-actions";
// 🔴 Le vocabulaire et les types viennent d'un module SANS `"use server"`.
// Importés de l'action, ils arriveraient ici sous forme de références
// distantes, et `ORIGINES_SAISIE.map(...)` lèverait « map is not a function »
// au rendu — ce qui s'est produit, et que seule la recette par l'interface a vu.
import { ORIGINES_SAISIE, type TraceExistante } from "@/lib/commercial-application/saisie-manuelle";

// Classes du SYSTEME de la console, pas des couleurs choisies a la main : la
// garde `admin-design-tokens` refuse la palette Tailwind par defaut. Deux
// ecrans qui choisissent chacun leur gris cessent de se ressembler, et le
// theme sombre ne tient plus.
const CHAMP = "admin-input";
const LABEL = "admin-label";

interface Champs {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  origine: string;
  note: string;
}

const VIDE: Champs = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  ville: "",
  origine: "email-direct",
  note: "",
};

export function FormulaireContactManuel({ lienFiche }: { lienFiche: string }) {
  const [c, setC] = useState<Champs>(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [doublons, setDoublons] = useState<TraceExistante[] | null>(null);
  const [cree, setCree] = useState<string | null>(null);

  const set = (patch: Partial<Champs>) => {
    setC((p) => ({ ...p, ...patch }));
    setErreur(null);
  };

  async function envoyer(confirmeMalgreDoublon: boolean) {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await creerContactManuelAction({
        prenom: c.prenom.trim(),
        ...(c.nom.trim() ? { nom: c.nom.trim() } : {}),
        email: c.email.trim(),
        ...(c.telephone.trim() ? { telephone: c.telephone.trim() } : {}),
        ...(c.ville.trim() ? { ville: c.ville.trim() } : {}),
        origine: c.origine,
        ...(c.note.trim() ? { note: c.note.trim() } : {}),
        ...(confirmeMalgreDoublon ? { confirmeMalgreDoublon: true } : {}),
      });

      if (r.ok) {
        setCree(r.submissionId);
        setDoublons(null);
        setC(VIDE);
        return;
      }
      if (r.erreur === "doublon") {
        setDoublons(r.traces);
        return;
      }
      setErreur(r.message);
    } catch {
      setErreur("L'enregistrement a échoué. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  if (cree) {
    return (
      <div className="admin-alert admin-alert-success flex flex-col gap-3">
        <p className="flex items-center gap-2 font-medium">
          <Check className="size-4" aria-hidden /> Contact enregistré.
        </p>
        <p className="text-sm">
          <strong>Aucun e-mail ne lui a été envoyé</strong> — ni confirmation, ni rappel. Il
          n&apos;a rien demandé.
        </p>
        <div className="flex flex-wrap gap-3">
          <AdminButton type="button" variant="secondary" onClick={() => setCree(null)}>
            Saisir un autre contact
          </AdminButton>
          <a className="admin-button-secondary" href={`${lienFiche}/${cree}`}>
            Ouvrir la fiche
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-prenom">
            Prénom *
          </label>
          <input
            id="cm-prenom"
            name="prenom"
            className={CHAMP}
            value={c.prenom}
            onChange={(e) => set({ prenom: e.target.value })}
            autoComplete="given-name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-nom">
            Nom
          </label>
          <input
            id="cm-nom"
            name="nom"
            className={CHAMP}
            value={c.nom}
            onChange={(e) => set({ nom: e.target.value })}
            autoComplete="family-name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-email">
            E-mail *
          </label>
          <input
            id="cm-email"
            name="email"
            type="email"
            inputMode="email"
            className={CHAMP}
            value={c.email}
            onChange={(e) => set({ email: e.target.value })}
            autoComplete="email"
          />
          <p className="admin-help">
            C&apos;est elle qui relie cette personne à ses autres traces sur le site.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-telephone">
            Téléphone
          </label>
          <input
            id="cm-telephone"
            name="telephone"
            type="tel"
            inputMode="tel"
            className={CHAMP}
            value={c.telephone}
            onChange={(e) => set({ telephone: e.target.value })}
            autoComplete="tel"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-ville">
            Ville
          </label>
          <input
            id="cm-ville"
            name="ville"
            className={CHAMP}
            value={c.ville}
            onChange={(e) => set({ ville: e.target.value })}
            autoComplete="address-level2"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="cm-origine">
            D&apos;où vient ce contact *
          </label>
          <select
            id="cm-origine"
            name="origine"
            className={CHAMP}
            value={c.origine}
            onChange={(e) => set({ origine: e.target.value })}
          >
            {ORIGINES_SAISIE.map((o) => (
              <option key={o.id} value={o.id}>
                {o.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL} htmlFor="cm-note">
          Note
        </label>
        <textarea
          id="cm-note"
          name="note"
          rows={3}
          className={CHAMP}
          value={c.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="Ce qu'il a dit, ce qu'il cherche, ce qu'on lui a promis."
        />
      </div>

      {doublons ? (
        <div className="admin-alert admin-alert-warning flex flex-col gap-3">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden /> Cette adresse est déjà connue
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {doublons.map((t) => (
              <li key={t.id}>
                {t.nom ?? "sans nom"} — {t.etape ?? t.type} · reçu le{" "}
                {new Date(t.recuLe).toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            Créer une seconde ligne n&apos;est pas réversible : la fusion n&apos;existe pas encore.
            Si c&apos;est bien la même personne, mieux vaut ouvrir la fiche existante.
          </p>
          <div className="flex flex-wrap gap-3">
            <AdminButton type="button" variant="secondary" onClick={() => setDoublons(null)}>
              Annuler
            </AdminButton>
            <AdminButton
              type="button"
              variant="danger"
              disabled={envoi}
              onClick={() => void envoyer(true)}
            >
              Créer quand même une seconde ligne
            </AdminButton>
          </div>
        </div>
      ) : null}

      {erreur ? (
        <p role="alert" className="admin-alert admin-alert-error text-sm font-medium">
          {erreur}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton
          type="button"
          disabled={envoi || !c.prenom.trim() || !c.email.trim()}
          onClick={() => void envoyer(false)}
        >
          {envoi ? "Enregistrement…" : "Enregistrer le contact"}
        </AdminButton>
        <p className="admin-help">Aucun e-mail ne sera envoyé à cette personne.</p>
      </div>
    </div>
  );
}

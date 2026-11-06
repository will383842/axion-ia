"use client";
// use-client: liste éditable de la bibliothèque (ajout, nouvelle version, archivage) avec useTransition et rafraîchissement du serveur.

/** Bibliothèque des textes du devis à formules. Tout texte est un PROJET « à valider ». */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterTexteAction,
  archiverTexteAction,
  modifierTexteAction,
} from "@/server/actions/qualiopi/devis-bibliotheque";
import {
  FORMULES_BIBLIOTHEQUE,
  NATURES_BIBLIOTHEQUE,
  type TexteBibliotheque,
} from "@/server/qualiopi/devis/bibliotheque-constantes";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

export function BibliothequeTextesDevis({
  textes,
}: {
  textes: TexteBibliotheque[];
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Record<string, string>>({});
  const [formule, setFormule] = useState<(typeof FORMULES_BIBLIOTHEQUE)[number]>("commun");
  const [nature, setNature] = useState<(typeof NATURES_BIBLIOTHEQUE)[number]>("avantage");
  const [nouveau, setNouveau] = useState("");

  function lancer(f: () => Promise<{ error: string } | { data: unknown }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await f();
      if ("error" in r) setErreur(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Textes proposés à la saisie d&apos;un devis à formules. Modifier un texte crée une nouvelle
        version (l&apos;ancienne est archivée) ; rien ne se supprime. Tous sont des projets « à
        valider » (Will et juriste).
      </p>
      {erreur !== null ? (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      ) : null}

      <ul className="flex flex-col gap-[var(--space-admin-3)]">
        {textes.map((t) => {
          const valeur = edition[t.id] ?? t.texte;
          return (
            <li
              key={t.id}
              className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
            >
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                {t.formule} · {t.nature} · v{t.version} {t.aValider ? "· à valider" : ""}
              </p>
              <label className="sr-only" htmlFor={`txt-${t.id}`}>
                Texte
              </label>
              <textarea
                id={`txt-${t.id}`}
                className={inputCls}
                rows={3}
                value={valeur}
                disabled={pending}
                onChange={(e) => setEdition({ ...edition, [t.id]: e.target.value })}
              />
              <div className="mt-[var(--space-admin-2)] flex gap-[var(--space-admin-4)]">
                <button
                  type="button"
                  disabled={pending || valeur === t.texte}
                  onClick={() => lancer(() => modifierTexteAction(t.id, valeur))}
                  className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline"
                >
                  Enregistrer une nouvelle version
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => lancer(() => archiverTexteAction(t.id))}
                  className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)] underline"
                >
                  Archiver
                </button>
              </div>
            </li>
          );
        })}
        {textes.length === 0 ? (
          <li className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun texte pour l&apos;instant.
          </li>
        ) : null}
      </ul>

      <form
        className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
        onSubmit={(e) => {
          e.preventDefault();
          lancer(async () => {
            const r = await ajouterTexteAction({ formule, nature, texte: nouveau });
            if ("data" in r) setNouveau("");
            return r;
          });
        }}
      >
        <h2 className="text-[length:var(--text-admin-base)] font-semibold">Ajouter un texte</h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
          <select
            aria-label="Formule"
            className={inputCls}
            value={formule}
            onChange={(e) => setFormule(e.target.value as typeof formule)}
          >
            {FORMULES_BIBLIOTHEQUE.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            aria-label="Nature"
            className={inputCls}
            value={nature}
            onChange={(e) => setNature(e.target.value as typeof nature)}
          >
            {NATURES_BIBLIOTHEQUE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <textarea
          aria-label="Nouveau texte"
          className={inputCls}
          rows={3}
          value={nouveau}
          disabled={pending}
          onChange={(e) => setNouveau(e.target.value)}
        />
        <button
          type="submit"
          disabled={pending || nouveau.trim() === ""}
          className="self-start rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-paper)]"
        >
          Ajouter
        </button>
      </form>
    </div>
  );
}

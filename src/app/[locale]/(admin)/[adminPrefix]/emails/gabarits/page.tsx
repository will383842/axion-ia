// Gabarits d'e-mail — les 44, groupés, avec leur déclencheur.
//
// ## Le défaut que cette page ferme
//
// Les 44 gabarits vivaient déjà au même endroit dans le code. Ce qui manquait
// n'était pas la centralisation, c'était la VISIBILITÉ : pour savoir à quoi
// ressemblait un e-mail il fallait se l'envoyer, et pour savoir quand il
// partait il fallait chercher son appelant. Personne ne le faisait — d'où cinq
// gabarits qui ont cessé d'être envoyés sans que ça se voie, et une refonte de
// charte qui a mis des semaines à être constatée.
//
// ## 🔑 CETTE PAGE NE PORTE AUCUNE LISTE
//
// Elle dérive de `CATALOGUE`, dont l'exhaustivité est garantie par le type
// (`Record<EmailJobName, …>`). Un gabarit ajouté à l'union sans fiche ne
// compile pas ; un gabarit ajouté avec sa fiche apparaît ici sans qu'on touche
// à ce fichier. Une page qui porterait sa propre liste serait fausse au premier
// ajout, et personne ne le verrait.
//
// ## Zéro JavaScript
//
// La barre de catégories est faite d'ancres, pas d'état : elle fonctionne sans
// hydratation, et ne coûte rien au budget de la console. Même doctrine que le
// sélecteur de créneaux (ADR 0038).
//
// ## Textes des formateurs indépendants (M1, lot A)
//
// Un encart dit combien de textes formateurs (gabarits et variantes) sont validés,
// les liste, et donne au super-admin « valider tous les textes formateurs d'un
// coup », avec case de confirmation. C'est le seul composant client de la page.
//
// FR uniquement (admin FR).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminBadge } from "@/components/admin/ui";
import {
  CATALOGUE,
  DORMANTS,
  LIBELLE_CATEGORIE,
  type CategorieEmail,
} from "@/server/email/apercu/catalogue";
import type { EmailJobName } from "@/server/queue/types";
import { estSuperAdmin } from "@/server/auth/habilitations";
import {
  cleDuTexte,
  listeDesTextesAffichee,
  TEXTES_FORMATEURS_A_VALIDER,
} from "@/server/email/textes-formateurs-a-valider";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";

import { ValiderTousTextesFormateurs } from "./ValiderTousTextesFormateurs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gabarits d'e-mail",
  robots: { index: false, follow: false },
};

/** L'ordre d'affichage des catégories — du plus fréquent au plus rare. */
const ORDRE: ReadonlyArray<CategorieEmail> = [
  "rendez-vous",
  "formation",
  "commerce",
  "recrutement",
  "rgpd",
  "divers",
];

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function GabaritsEmailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const registre = await lireTextesValides();
  const textesFormateurs = TEXTES_FORMATEURS_A_VALIDER.map((t) => ({
    ...t,
    valide: registre.has(cleDuTexte(t)),
  }));
  const nbValides = textesFormateurs.filter((t) => t.valide).length;
  const peutValider = estSuperAdmin((session.user as { role?: string }).role);

  const noms = Object.keys(CATALOGUE) as EmailJobName[];
  const groupes = ORDRE.map((cat) => ({
    cat,
    items: noms.filter((n) => CATALOGUE[n].categorie === cat).sort(),
  })).filter((g) => g.items.length > 0);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Gabarits d'e-mail"
        description={`Les ${noms.length} e-mails que le site peut envoyer, leur rendu réel, et ce qui déclenche chacun.`}
        meta={
          <>
            <AdminBadge tone="neutral">{noms.length} gabarits</AdminBadge>
            <AdminBadge tone="success" dot>
              {noms.length - DORMANTS.length} actifs
            </AdminBadge>
            {DORMANTS.length > 0 ? (
              <AdminBadge tone="warning" dot>
                {DORMANTS.length} dormants
              </AdminBadge>
            ) : null}
          </>
        }
      />

      {/* Barre de catégories — ancres pures, aucune hydratation. */}
      <nav
        aria-label="Catégories"
        className="border-border bg-bg/90 sticky top-0 z-10 -mx-1 mb-8 flex flex-wrap gap-1.5 border-b px-1 py-3 backdrop-blur"
      >
        {groupes.map(({ cat, items }) => (
          <a
            key={cat}
            href={`#cat-${cat}`}
            className="border-border text-fg-soft hover:border-border-strong hover:text-fg rounded-lg border px-3 py-1.5 text-xs font-medium transition"
          >
            {LIBELLE_CATEGORIE[cat]}
            <span className="text-fg-muted ml-1.5">{items.length}</span>
          </a>
        ))}
      </nav>

      {DORMANTS.length > 0 ? (
        <div className="border-border bg-sand/40 mb-8 rounded-lg border p-4">
          <p className="text-fg-soft text-sm leading-relaxed">
            <strong className="text-fg font-semibold">
              {DORMANTS.length} gabarits ne partent jamais.
            </strong>{" "}
            Ils existent et se maintiennent, mais aucun code ne les envoie. Ce n&apos;est pas une
            anomalie en soi — trois d&apos;entre eux attendent que Stripe soit rallumé — mais
            c&apos;est une information que rien n&apos;affichait jusqu&apos;ici.
          </p>
        </div>
      ) : null}

      <section
        aria-labelledby="textes-formateurs"
        className="border-border bg-paper mb-8 rounded-lg border p-4"
      >
        <h2 id="textes-formateurs" className="text-fg text-base font-semibold tracking-tight">
          Textes des e-mails aux formateurs indépendants
        </h2>
        <p className="text-fg-soft mt-1 text-sm">
          {nbValides} validé{nbValides > 1 ? "s" : ""} sur {textesFormateurs.length}. Un texte non
          validé ne part jamais. Ouvrez un texte pour le lire, puis le valider (ou retirer sa
          validation) sous son aperçu.
        </p>
        <details className="mt-3">
          <summary className="text-primary cursor-pointer text-sm">Voir la liste</summary>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {textesFormateurs.map((t) => (
              <li key={cleDuTexte(t)} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={[
                    "size-1.5 shrink-0 rounded-lg",
                    t.valide ? "bg-sage" : "bg-terracotta",
                  ].join(" ")}
                />
                <Link
                  href={`/fr/${adminPrefix}/emails/gabarits/${t.gabarit}${
                    t.variante !== undefined ? `?variante=${t.variante}` : ""
                  }`}
                  className="text-primary hover:underline"
                >
                  <code className="text-[13px]">
                    {t.gabarit}
                    {t.variante !== undefined ? ` · ${t.variante}` : ""}
                  </code>
                </Link>
                <span className="text-fg-muted text-xs">{t.valide ? "validé" : "non validé"}</span>
              </li>
            ))}
          </ul>
        </details>
        {peutValider && nbValides < textesFormateurs.length ? (
          <div className="border-border mt-4 border-t pt-4">
            <ValiderTousTextesFormateurs
              nombre={textesFormateurs.length}
              liste={listeDesTextesAffichee()}
            />
          </div>
        ) : null}
      </section>

      <div className="space-y-12">
        {groupes.map(({ cat, items }) => (
          <section key={cat} id={`cat-${cat}`} className="scroll-mt-20">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-fg text-base font-semibold tracking-tight">
                {LIBELLE_CATEGORIE[cat]}
              </h2>
              <span className="text-fg-muted text-xs">{items.length}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((nom) => {
                const fiche = CATALOGUE[nom];
                const dormant = fiche.source === null;
                return (
                  <Link
                    key={nom}
                    href={`/fr/${adminPrefix}/emails/gabarits/${nom}`}
                    className={[
                      "group bg-paper relative flex flex-col rounded-lg border p-4",
                      "hover:border-border-strong transition hover:shadow-sm",
                      dormant ? "border-border bg-sand/30" : "border-border",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <code className="text-fg text-[13px] leading-tight font-medium">{nom}</code>
                      <span
                        aria-hidden="true"
                        className={[
                          "mt-1 size-1.5 shrink-0 rounded-lg",
                          dormant ? "bg-terracotta" : "bg-sage",
                        ].join(" ")}
                      />
                    </div>

                    <p className="text-fg-soft mt-2.5 flex-1 text-[13px] leading-relaxed">
                      {fiche.quand}
                    </p>

                    <p className="border-border text-fg-muted mt-3 border-t pt-2.5 text-xs">
                      {dormant ? (
                        <span className="text-terracotta-deep font-medium">
                          Rien ne l&apos;envoie
                        </span>
                      ) : (
                        <>Pour {fiche.destinataire}</>
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminPageShell>
  );
}

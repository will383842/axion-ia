"use client";
// use-client: sélection des formateurs, aperçu et messages de retour + appels Server Actions.

/**
 * Listes de l'écran « Contrats à mettre à niveau » (lots L9b, L7d).
 *
 * Chaque geste est refusé côté serveur si le rôle ou l'interrupteur manque : l'écran ne
 * fait qu'appeler. Les messages affichés viennent de l'action, jamais de l'URL.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  apercuNouvelleVersionAction,
  envoyerDossierMiseANiveauAction,
  envoyerNouvelleVersionAction,
  figerListeMiseANiveauAction,
} from "@/server/actions/qualiopi/formateur-contrat-cadre";

interface LigneMiseANiveauVue {
  readonly trainerId: string;
  readonly nom: string;
  readonly manquants: readonly string[];
  readonly listeeLe: string | null;
  readonly premierEnvoi: string | null;
  readonly finGrace: string | null;
  readonly dossierStatut: string | null;
}

interface LigneAResignerVue {
  readonly trainerId: string;
  readonly nom: string;
  readonly versionEnVigueur: number;
}

const LIBELLE_ENVOI: Record<string, string> = {
  envoye: "Dossier envoyé.",
  "en-validation": "E-mail placé dans la corbeille de validation.",
  "texte-non-valide": "Le texte de cet e-mail n'est pas encore validé : rien n'est parti.",
  "fin-de-collaboration": "Collaboration terminée : rien n'est parti.",
};

export function MiseANiveauListe({
  base,
  versionArretee,
  elements,
  miseANiveau,
  nouvelleVersion,
}: {
  base: string;
  versionArretee: number | null;
  elements: readonly { cle: string; libelle: string }[];
  miseANiveau: { peutAgir: boolean; lignes: readonly LigneMiseANiveauVue[] } | null;
  nouvelleVersion: { peutAgir: boolean; lignes: readonly LigneAResignerVue[] } | null;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set());
  const [apercu, setApercu] = useState<{ sujet: string; html: string; note: string } | null>(null);
  const libelle = (cle: string) => elements.find((e) => e.cle === cle)?.libelle ?? cle;
  const nonFigees = miseANiveau?.lignes.filter((l) => l.listeeLe === null).length ?? 0;

  const figer = () =>
    demarrer(async () => {
      const r = await figerListeMiseANiveauAction();
      setMessage(
        "error" in r
          ? { ok: false, texte: r.error }
          : { ok: true, texte: `${r.data.listees} formateur(s) ajouté(s) à la liste figée.` },
      );
      router.refresh();
    });

  const envoyerDossier = (trainerId: string) =>
    demarrer(async () => {
      const r = await envoyerDossierMiseANiveauAction({ trainerId });
      setMessage(
        "error" in r
          ? { ok: false, texte: r.error }
          : {
              ok: r.data.envoi === "envoye" || r.data.envoi === "en-validation",
              texte: LIBELLE_ENVOI[r.data.envoi] ?? "L'e-mail n'est pas parti : réessayez.",
            },
      );
      router.refresh();
    });

  const voirApercu = (trainerId: string) =>
    demarrer(async () => {
      const r = await apercuNouvelleVersionAction({ trainerId });
      if ("error" in r) {
        setMessage({ ok: false, texte: r.error });
        return;
      }
      const notes = [
        r.data.texteValide ? null : "Le texte de cet e-mail n'est pas encore validé.",
        r.data.resumeEcrit ? null : "Le résumé des changements n'est pas écrit au registre.",
      ].filter((n): n is string => n !== null);
      setApercu({ sujet: r.data.sujet, html: r.data.html, note: notes.join(" ") });
    });

  const envoyerVersion = () =>
    demarrer(async () => {
      const r = await envoyerNouvelleVersionAction({ trainerIds: [...choisis] });
      if ("error" in r) {
        setMessage({ ok: false, texte: r.error });
        return;
      }
      const ok = r.data.resultats.filter((x) => x.ok).length;
      setMessage({
        ok: ok === r.data.resultats.length,
        texte:
          `${ok} sur ${r.data.resultats.length} envoyé(s). ` +
          r.data.resultats
            .filter((x) => !x.ok)
            .map((x) => x.message)
            .join(" "),
      });
      setChoisis(new Set());
      router.refresh();
    });

  const basculer = (id: string) =>
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 30) n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ok ? "admin-alert-success" : "admin-alert-warning"}`}
        >
          {message.texte}
        </p>
      ) : null}

      {miseANiveau ? (
        <section className="admin-card" aria-labelledby="mise-a-niveau-titre">
          <h2 id="mise-a-niveau-titre" className="admin-meta">
            Indépendants actifs à mettre à niveau ({miseANiveau.lignes.length})
          </h2>
          <p className="text-[length:var(--text-admin-sm)]">
            Aucun n&apos;est désactivé. Figez la liste, puis envoyez à chacun son dossier prérempli
            ; le délai de grâce de 30 jours court à partir de l&apos;envoi.
          </p>
          {miseANiveau.peutAgir && nonFigees > 0 ? (
            <div className="mt-[var(--space-admin-2)]">
              <AdminButton type="button" disabled={enCours} onClick={figer}>
                Figer la liste ({nonFigees} à ajouter)
              </AdminButton>
            </div>
          ) : null}
          <ul className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            {miseANiveau.lignes.map((l) => (
              <li key={l.trainerId} className="mt-[var(--space-admin-3)]">
                <a href={`${base}/${l.trainerId}`} className="underline">
                  <strong>{l.nom}</strong>
                </a>{" "}
                — {l.manquants.length} élément(s) à reprendre
                {l.listeeLe
                  ? ` — liste figée le ${l.listeeLe}`
                  : " — pas encore dans la liste figée"}
                {l.premierEnvoi
                  ? ` — dossier envoyé le ${l.premierEnvoi}, délai de grâce jusqu'au ${l.finGrace ?? "—"}`
                  : " — dossier pas encore envoyé"}
                {l.manquants.length > 0 ? (
                  <span className="block">
                    À reprendre : {l.manquants.map(libelle).join(" · ")}
                  </span>
                ) : null}
                {miseANiveau.peutAgir && l.listeeLe && l.dossierStatut !== "a_verifier" ? (
                  <span className="mt-[var(--space-admin-1)] block">
                    <AdminButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={enCours}
                      onClick={() => envoyerDossier(l.trainerId)}
                    >
                      {l.premierEnvoi
                        ? "Renvoyer le dossier de mise à niveau"
                        : "Envoyer le dossier de mise à niveau"}
                    </AdminButton>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nouvelleVersion ? (
        <section className="admin-card" aria-labelledby="a-resigner-titre">
          <h2 id="a-resigner-titre" className="admin-meta">
            À faire re-signer{versionArretee !== null ? ` (version ${versionArretee})` : ""} (
            {nouvelleVersion.lignes.length})
          </h2>
          {nouvelleVersion.lignes.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)]">
              Aucun formateur n&apos;a de contrat antérieur à la dernière version arrêtée.
            </p>
          ) : (
            <ul className="text-[length:var(--text-admin-sm)]">
              {nouvelleVersion.lignes.map((l) => (
                <li key={l.trainerId} className="mt-[var(--space-admin-2)]">
                  {nouvelleVersion.peutAgir ? (
                    <input
                      type="checkbox"
                      aria-label={`Choisir ${l.nom}`}
                      checked={choisis.has(l.trainerId)}
                      onChange={() => basculer(l.trainerId)}
                    />
                  ) : null}{" "}
                  <a href={`${base}/${l.trainerId}`} className="underline">
                    {l.nom}
                  </a>{" "}
                  — version en vigueur {l.versionEnVigueur}
                  {nouvelleVersion.peutAgir ? (
                    <span className="ml-[var(--space-admin-2)] inline-block">
                      <AdminButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={enCours}
                        onClick={() => voirApercu(l.trainerId)}
                      >
                        Aperçu de l&apos;e-mail
                      </AdminButton>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {apercu ? (
            <div className="mt-[var(--space-admin-3)]">
              <p className="admin-meta">Objet : {apercu.sujet}</p>
              {apercu.note ? (
                <p className="admin-alert admin-alert-warning">{apercu.note}</p>
              ) : null}
              <iframe
                title="Aperçu de l'e-mail"
                sandbox=""
                srcDoc={apercu.html}
                className="h-96 w-full border"
              />
            </div>
          ) : null}
          {nouvelleVersion.peutAgir && choisis.size > 0 ? (
            <div className="mt-[var(--space-admin-3)]">
              <AdminButton type="button" disabled={enCours} onClick={envoyerVersion}>
                Préparer et envoyer la nouvelle version ({choisis.size})
              </AdminButton>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

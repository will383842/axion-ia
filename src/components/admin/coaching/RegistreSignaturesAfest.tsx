/**
 * Admin — Registre des signatures d'émargement AFEST d'un parcours 1-to-1.
 *
 * ## Server Component PUR — aucun JS client
 *
 * Le registre est de la lecture, plus une correction rare. Le rendre interactif
 * tirerait un bundle sur un écran consulté à l'audit, pour un gain nul : un
 * `<form action>` suffit à révoquer, et le reste est du rendu serveur.
 *
 * C'est le même arbitrage que le registre des documents, tenu ici pour la même
 * raison — et le panneau AFEST voisin, lui, reste client parce qu'il enchaîne
 * des mutations optimistes.
 *
 * ## Ce que cet écran refuse de faire
 *
 * 🔴 Il ne RÉPARE rien. Une chaîne rompue est présentée telle quelle : c'est un
 * résultat que quelqu'un doit constater, pas une panne à masquer.
 *
 * 🔴 Il ne dit jamais « signé » tout court. Qui, à quel titre, quand, par quelle
 * modalité, et sur quel matériel — une signature recueillie sur le poste du
 * formateur n'a pas la portée d'une signature apposée par la partie depuis son
 * propre appareil, et taire la nuance reviendrait à les présenter comme égales.
 */

import { revoquerSignatureSeanceAfestAction } from "@/server/actions/qualiopi/signature-revocation";
import type { RegistreSeancesAfest } from "@/server/qualiopi/coaching-afest/signature/registre-seances";
import { libelleAnomalieChaine } from "@/server/qualiopi/emargement/chaine-labels";

const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Refus du service, traduits.
 *
 * ⚠️ L'URL ne porte qu'un CODE, jamais le message : un texte libre repris d'une
 * URL et réaffiché est une injection en puissance. La traduction se fait ici.
 */
const MESSAGE_REFUS: Readonly<Record<string, string>> = {
  signature_introuvable: "Signature introuvable.",
  deja_revoquee: "Cette signature est déjà révoquée.",
  revocation_maillon_interne_interdite:
    "Cette signature n'est pas la dernière de sa chaîne : la révoquer romprait le chaînage. Révoquez d'abord les signatures postérieures du même rôle.",
};

const MESSAGE_REVOCATION: Readonly<Record<string, string>> = {
  ok: "Signature révoquée. La ligne reste au dossier, retirée du décompte.",
  role_insuffisant: "Vous n'êtes pas habilité à révoquer une signature.",
  demande_invalide: "Demande invalide : le motif est obligatoire.",
};

export function RegistreSignaturesAfest({
  registre,
  cheminRetour,
  revocation,
  raison,
}: {
  /** `null` quand la base n'est pas joignable — distinct d'un registre vide. */
  registre: RegistreSeancesAfest | null;
  cheminRetour: string;
  revocation?: string | undefined;
  raison?: string | undefined;
}): React.ReactElement | null {
  // Aucune signature réelle : ne rien afficher plutôt qu'un bloc vide qui
  // laisserait croire à une anomalie. Un parcours en régime déclaratif n'a
  // légitimement aucune ligne, et le panneau voisin dit déjà la présence actée.
  if (registre === null || registre.lignes.length === 0) return null;

  const messageRevocation =
    revocation === "refus_service"
      ? (MESSAGE_REFUS[raison ?? ""] ?? "Révocation refusée.")
      : revocation !== undefined
        ? MESSAGE_REVOCATION[revocation]
        : undefined;

  return (
    <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <h2 className="text-mocha mb-2 text-sm font-semibold">
        Signatures d&apos;émargement AFEST (preuves réelles)
      </h2>

      {messageRevocation !== undefined ? (
        <p
          className={`mb-2 text-xs ${revocation === "ok" ? "text-success" : "text-terracotta"}`}
          role="status"
        >
          {messageRevocation}
        </p>
      ) : null}

      {/* Verdict d'intégrité, chaîne par chaîne. Affiché AVANT les lignes : si
          une chaîne est rompue, c'est la première chose à savoir en les lisant. */}
      <ul className="mb-3 space-y-1">
        {registre.chaines.map((c) => (
          <li key={c.role} className="text-xs">
            <span className="text-fg-muted">{c.roleLibelle} — </span>
            {c.resultat.valide ? (
              <span className="text-success">
                {`chaîne intacte (${c.resultat.nbVerifies} signature${c.resultat.nbVerifies > 1 ? "s" : ""} vérifiée${c.resultat.nbVerifies > 1 ? "s" : ""})`}
              </span>
            ) : (
              <span className="text-terracotta">
                {`chaîne altérée : ${c.resultat.anomalies
                  .map((a) => libelleAnomalieChaine(a.type))
                  .join(", ")}`}
              </span>
            )}
          </li>
        ))}
      </ul>

      <ul className="space-y-3">
        {registre.lignes.map((l) => (
          <li key={l.signatureId} className="border-border border-t pt-2 first:border-t-0">
            <p className="text-sm">
              <span className="font-medium">{l.signataireNom}</span>{" "}
              <span className="text-fg-muted text-xs">{l.roleLibelle}</span>
            </p>
            <p className="text-fg-muted text-xs">
              {`${horodatageParis.format(l.signeAt)} · ${l.methodeLibelle}`}
            </p>
            <p className="text-fg-muted font-mono text-xs">{l.empreinte.slice(0, 16)}…</p>

            {l.recueilliSurPosteFormateur ? (
              <p className="text-fg-muted text-xs">
                Recueillie sur le poste du formateur — portée probante plafonnée.
              </p>
            ) : null}
            {l.imagePurgee ? (
              <p className="text-fg-muted text-xs">
                Image purgée à la demande du signataire (RGPD art. 17) : l&apos;empreinte et la
                signature restent opposables.
              </p>
            ) : null}
            {l.insertionTardive ? (
              <p className="text-terracotta text-xs">
                {`Enregistrée le ${horodatageParis.format(l.createdAt)} — écart avec la date de signature déclarée.`}
              </p>
            ) : null}

            {l.revocation !== null ? (
              <p className="text-terracotta text-xs">
                {`Révoquée le ${horodatageParis.format(l.revocation.at)}${
                  l.revocation.motif !== null ? ` — ${l.revocation.motif}` : ""
                }`}
              </p>
            ) : l.dernierMaillon ? (
              /* La révocation est la SEULE correction possible sur un registre
                 append-only : sans cette surface, une signature posée par erreur
                 était définitive et l'index unique partiel qui autorise à
                 re-signer ne pouvait jamais servir. */
              <form action={revoquerSignatureSeanceAfestAction} className="mt-1 flex gap-1">
                <input type="hidden" name="signatureId" value={l.signatureId} />
                <input type="hidden" name="retour" value={cheminRetour} />
                <input
                  type="text"
                  name="motif"
                  required
                  maxLength={500}
                  placeholder="Motif de révocation (obligatoire)"
                  aria-label={`Motif de révocation de la signature de ${l.signataireNom}`}
                  className="border-border flex-1 rounded border px-1 py-0.5 text-xs"
                />
                <button
                  type="submit"
                  className="text-terracotta border-terracotta rounded border px-2 py-0.5 text-xs"
                >
                  Révoquer
                </button>
              </form>
            ) : (
              /* Dit AVANT le clic ce que le service refuserait APRÈS. */
              <p className="text-fg-muted text-xs">
                Non révocable : une signature postérieure du même rôle s&apos;y enchaîne. Révoquez
                d&apos;abord la plus récente.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

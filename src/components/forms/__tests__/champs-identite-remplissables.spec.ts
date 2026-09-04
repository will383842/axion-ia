// Tout champ d'identité d'un formulaire public doit être REMPLISSABLE par le
// téléphone.
//
// ── Pourquoi cette garde ──────────────────────────────────────────────────
// Le 2026-09-04, un audit a compté les attributs `autoComplete` des deux grands
// formulaires publics :
//
//   · tunnel apporteurs (`LeadApporteurForm`)  →  un sur CHAQUE champ ;
//   · candidature emploi (`JobApplicationForm`) →  **ZÉRO**, sur dix-huit champs.
//
// Un candidat sur téléphone tapait donc son prénom, son nom, son adresse et son
// numéro à la main — avec le clavier alphabétique par défaut, y compris pour le
// numéro de téléphone.
//
// 🔑 C'est une perte SILENCIEUSE, et c'est ce qui la rend coûteuse : rien ne
// casse, aucune erreur ne s'affiche, et l'abandon ne laisse aucune trace à
// compter. Elle n'aurait été trouvée par aucun test fonctionnel — seulement par
// quelqu'un qui remplit le formulaire sur un vrai téléphone, ou par ceci.
//
// ── Deux attributs, deux rôles distincts ──────────────────────────────────
//   · `autoComplete` laisse le navigateur REMPLIR depuis le carnet d'adresses ;
//   · `inputMode` change le CLAVIER (pavé numérique, arobase visible).
// Le second sert même quand le premier n'a rien à proposer. Les deux sont donc
// exigés là où ils s'appliquent, et pas l'un à la place de l'autre.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

/** Formulaires publics qui demandent une identité. */
const FORMULAIRES = [
  "src/components/forms/JobApplicationForm.tsx",
  "src/components/recrutement/LeadApporteurForm.tsx",
];

/**
 * Champ d'identité → valeur `autocomplete` attendue.
 *
 * Liste volontairement restreinte aux champs que le navigateur SAIT remplir.
 * Exiger un `autoComplete` sur « prétentions salariales » n'apporterait rien et
 * ferait rougir la garde pour un motif sans valeur — une garde qui crie pour
 * rien finit ignorée.
 */
const ATTENDUS: ReadonlyArray<{ champ: RegExp; valeur: string }> = [
  { champ: /name="(firstName|prenom)"/, valeur: "given-name" },
  { champ: /name="(lastName|nom)"/, valeur: "family-name" },
  { champ: /name="email"/, valeur: "email" },
  { champ: /name="(phone|telephone)"/, valeur: "tel" },
  { champ: /name="(city|ville)"/, valeur: "address-level2" },
];

/** Le bloc d'attributs qui suit un `name="…"`, jusqu'à la fermeture de la balise. */
function blocDuChamp(source: string, motif: RegExp): string | null {
  const m = motif.exec(source);
  if (!m || m.index === undefined) return null;
  // On regarde en arrière (la balise ouvrante peut précéder) ET en avant.
  const debut = Math.max(0, source.lastIndexOf("<", m.index));
  const fin = source.indexOf("/>", m.index);
  return fin === -1 ? source.slice(debut, m.index + 400) : source.slice(debut, fin + 2);
}

describe("les champs d'identité sont remplissables par le téléphone", () => {
  it("les formulaires audités existent — sinon la garde ne regarde rien", () => {
    for (const f of FORMULAIRES) {
      expect(() => lire(f), `${f} introuvable`).not.toThrow();
    }
  });

  it("chaque champ d'identité porte le bon `autoComplete`", () => {
    const fautes: string[] = [];
    for (const f of FORMULAIRES) {
      const src = lire(f);
      for (const { champ, valeur } of ATTENDUS) {
        const bloc = blocDuChamp(src, champ);
        if (!bloc) continue; // le formulaire ne demande pas ce champ : rien à exiger
        if (!bloc.includes(`autoComplete="${valeur}"`)) {
          fautes.push(`${f} — ${champ.source} devrait porter autoComplete="${valeur}"`);
        }
      }
    }
    expect(
      fautes,
      "champ d'identité non remplissable : le candidat le tape à la main sur son téléphone, " +
        "et l'abandon qui s'ensuit ne laisse aucune trace",
    ).toEqual([]);
  });

  it("le téléphone et l'e-mail ouvrent le BON clavier", () => {
    // `autoComplete` ne suffit pas : quand le carnet d'adresses est vide, c'est
    // `inputMode` qui décide si l'on tape un numéro sur un pavé numérique ou sur
    // un clavier de texte.
    const fautes: string[] = [];
    for (const f of FORMULAIRES) {
      const src = lire(f);
      for (const [motif, mode] of [
        [/name="(phone|telephone)"/, "tel"],
        [/name="email"/, "email"],
      ] as const) {
        const bloc = blocDuChamp(src, motif);
        if (!bloc) continue;
        if (!bloc.includes(`inputMode="${mode}"`)) {
          fautes.push(`${f} — ${motif.source} devrait porter inputMode="${mode}"`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });

  it("TÉMOIN — le détecteur voit un champ nu et accepte un champ équipé", () => {
    // Sans ce témoin, un extracteur cassé qui ne trouverait jamais de bloc
    // rendrait la garde verte à perpétuité.
    const nu = '<input name="firstName" type="text" className="x" />';
    const equipe = '<input name="firstName" type="text" autoComplete="given-name" />';
    const motif = /name="(firstName|prenom)"/;

    expect(blocDuChamp(nu, motif)?.includes('autoComplete="given-name"')).toBe(false);
    expect(blocDuChamp(equipe, motif)?.includes('autoComplete="given-name"')).toBe(true);
    // Et un formulaire qui ne demande PAS le champ ne doit pas être compté en faute.
    expect(blocDuChamp('<input name="autre" />', motif)).toBeNull();
  });
});

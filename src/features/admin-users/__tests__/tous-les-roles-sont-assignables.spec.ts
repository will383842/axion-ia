/**
 * 🔴 `D6-2-M1` — un rôle qu'on ne peut pas attribuer est un rôle qui n'existe pas.
 *
 * ## Le défaut
 *
 * `responsable_qualite` et `secretaire` ont été créés le 2026-08-15 : l'enum
 * Prisma les porte, la matrice d'habilitation leur donne des droits, leurs tests
 * passent. Mais **six endroits** du produit portaient chacun leur recopie de la
 * liste des rôles — les deux schémas `zod` de gestion de comptes, le filtre de
 * la liste, les deux `<select>` de la console, les deux tables de libellés et la
 * table de tonalité des badges — et **les six étaient restées à quatre**.
 *
 * Aucun chemin du produit ne permettait donc de les attribuer : le seul moyen de
 * créer un tel compte était une commande SQL à la main. Et un tel compte se
 * serait affiché sous l'étiquette brute `secretaire`, badge gris, absent du
 * filtre.
 *
 * 🔑 C'est la seconde moitié, jamais traitée, du défaut du 15-17/08 — et la
 * septième occurrence du motif *un prédicat recopié diverge*.
 *
 * ## Ce que ce fichier garde, et ce qu'il NE garde PAS
 *
 * ⚠️ La correspondance rôle → libellé / description / tonalité n'est PAS gardée
 * ici : elle est tenue par `tsc`. Les tables sont des `Record<RoleAdmin, …>`
 * dérivés du tuple `ROLES_ADMIN` — ajouter un septième rôle casse la
 * compilation tant qu'il n'a pas reçu ses trois entrées. Une garde qui doublerait
 * le compilateur n'apporterait rien.
 *
 * Reste un risque que `tsc` ne voit pas : **re-recopier** une liste en dur, dans
 * un `z.enum([…])` ou un `<option value="…">`. C'est exactement ce qui s'est
 * produit. C'est CE risque, et lui seul, que ce fichier surveille.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES_ADMIN, ROLES_ECRITURE } from "@/server/auth/habilitations";
import { LIBELLES_ROLE, DESCRIPTIONS_ROLE, libelleRole, tonaliteRole } from "../roles";

const RACINE = process.cwd();

/** Le fichier, commentaires ôtés — un commentaire qui cite un rôle n'est pas du code. */
function lire(...segments: string[]): string {
  return readFileSync(join(RACINE, ...segments), "utf-8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ACTIONS = lire("src", "features", "admin-users", "actions.ts");
const USERS = "src/app/[locale]/(admin)/[adminPrefix]/users";
const FORM_CREATION = lire(...USERS.split("/"), "new", "CreateUserForm.tsx");
const FORM_MODIF = lire(...USERS.split("/"), "[id]", "UserActions.tsx");
const LISTE = lire(...USERS.split("/"), "_v2", "UsersV2.tsx");
const DETAIL = lire(...USERS.split("/"), "[id]", "page.tsx");

describe("`D6-2-M1` — tout rôle qui existe peut être attribué", () => {
  it("le SSOT porte les six rôles, et rien ne s'en écarte", () => {
    // 🔑 Sans ceci, retirer un rôle du tuple rendrait tous les tests ci-dessous
    // vrais en ne vérifiant plus rien : ils raisonnent sur `ROLES_ADMIN`.
    expect(ROLES_ADMIN).toHaveLength(6);
    // La cohérence des deux moitiés de la frontière : `reader` est le SEUL rôle
    // qui n'écrit pas. Un rôle ajouté à l'un sans l'autre rougit ici.
    expect([...ROLES_ADMIN].filter((r) => !ROLES_ECRITURE.includes(r))).toEqual(["reader"]);
    for (const role of ROLES_ADMIN) {
      expect(LIBELLES_ROLE[role], `« ${role} » sans libellé`).toBeTruthy();
      expect(DESCRIPTIONS_ROLE[role], `« ${role} » sans description`).toBeTruthy();
    }
  });

  it("🔴 aucune liste de rôles n'est recopiée en dur — nulle part", () => {
    // Le défaut, à la lettre : une liste écrite à la main quelque part vieillit
    // en silence pendant que l'enum avance. On interdit la recopie plutôt que de
    // vérifier qu'elle est à jour — vérifier suppose de repasser, interdire non.
    const surfaces: Array<[string, string]> = [
      ["actions.ts", ACTIONS],
      ["CreateUserForm.tsx", FORM_CREATION],
      ["UserActions.tsx", FORM_MODIF],
      ["UsersV2.tsx", LISTE],
      ["page.tsx (détail)", DETAIL],
    ];
    for (const [nom, source] of surfaces) {
      expect(source, `${nom} recopie une liste de rôles dans un z.enum`).not.toMatch(
        /enum\(\s*\[\s*"(super_admin|admin|editor|reader|secretaire|responsable_qualite)"/,
      );
      expect(source, `${nom} écrit un rôle en dur dans un value=`).not.toMatch(
        /value="(super_admin|admin|editor|reader|secretaire|responsable_qualite)"/,
      );
      expect(source, `${nom} recopie une table de rôles`).not.toMatch(
        /^\s*(super_admin|responsable_qualite):\s*"/m,
      );
    }
  });

  it("🔴 les cinq surfaces se dérivent bien du SSOT", () => {
    // ⚠️ Le test ci-dessus est une INTERDICTION : un fichier qui n'offrirait
    // plus aucun rôle le passerait au vert. Celui-ci exige la contrepartie —
    // chaque surface doit citer le tuple.
    expect(ACTIONS, "les schémas zod n'utilisent pas ROLES_ADMIN").toContain("ROLES_ADMIN");
    expect(FORM_CREATION, "le menu de création n'utilise pas ROLES_ADMIN").toContain("ROLES_ADMIN");
    expect(FORM_MODIF, "le menu de modification n'utilise pas ROLES_ADMIN").toContain(
      "ROLES_ADMIN",
    );
    expect(LISTE, "le filtre de la liste n'utilise pas ROLES_ADMIN").toContain("ROLES_ADMIN");
    expect(DETAIL, "le détail n'affiche pas le libellé du SSOT").toContain("libelleRole");
  });

  it("🔴 le filtre de la liste accepte tout rôle attribuable", () => {
    // Le filtre est lu par `listSchema.parse` — `parse`, pas `safeParse`. Un
    // rôle attribuable mais absent du filtre ferait LEVER la page de liste dès
    // qu'on le sélectionne. Les deux listes doivent donc rester la même.
    expect(ACTIONS).toMatch(/enum\(\[\.\.\.ROLES_ADMIN, "all"\]\)/);
  });

  it("un rôle inconnu en base s'affiche sans casser, et sans se déguiser", () => {
    // 🔑 Le témoin de non-vacuité des lectures. `libelleRole` doit rendre la
    // valeur brute — pas un libellé par défaut, qui ferait passer un rôle
    // inattendu pour un rôle connu.
    expect(libelleRole("role_inexistant")).toBe("role_inexistant");
    expect(tonaliteRole("role_inexistant")).toBe("neutral");
    expect(libelleRole("secretaire")).toBe("Secrétaire");
  });
});

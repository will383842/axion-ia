# Diagnostic push challenges

Étape : `git push origin feat/apporteurs-challenges-v2` (non fast-forward).
Erreur : `! [rejected] ... Updates were rejected because the tip of your current branch is behind its remote counterpart.`

`origin/feat/apporteurs-challenges-v2` existe déjà (20f51f193, tentative antérieure : 370507384 + 20f51f193 « ci: drapeaux des challenges… », qui modifie `.github/workflows/coolify-drapeau.yml`, interdit par la consigne). Son code est identique à celui de ma reprise (diff = ce workflow + le corps de PR seulement). Je n'ai pas forcé le push (écraserait des commits distants sans accord). Ma reprise est le commit local e4335e9db (typecheck, eslint, 1732 tests verts). Aussi : `.git/config.lock` verrouillé, pas de `push -u`.
Décision humaine : forcer (`--force-with-lease`) ou reprendre la branche distante en retirant le changement `.github`.

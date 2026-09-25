# /fixsvg

Tu corriges des SVG d’icônes pour qu’ils soient **tintables** dans l’app (React Native SVG).

## Cibles
- Fichiers `*.svg` (souvent `src/assets/icons/*.svg`)
- Si une sélection est fournie, ne modifier que le SVG sélectionné.

## Règles de correction (obligatoires)
- Sur le tag racine `<svg ...>` :
  - ajouter `color="#000000"` (fallback)
  - garder `fill="none"` si c’est un outline (sinon ne pas forcer)
- Remplacer les couleurs “hardcodées” :
  - `stroke="white"` / `stroke="#..."` → `stroke="currentColor"`
  - `fill="white"` / `fill="#..."` → `fill="currentColor"`
- Ne pas introduire de variantes “white / black” si `currentColor` suffit.
- Ne pas changer le `viewBox`, ni les `d=...` des paths (sauf si nécessaire).
- Garder le SVG valide.

## Sortie attendue
- Le SVG est tintable via la prop `color`.
- Le rendu par défaut (sans tint) est **noir**.

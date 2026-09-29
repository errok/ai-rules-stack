/**
 * What the audit tells the user about each check, in French: the subject (`title`), the rule in plain words
 * (`expected`), why it matters (`why`) and how to fix a failure (`fix`). Kept apart from the checks so the
 * wording is easy to edit; every check id must have an entry.
 */
export const TEXTS = {
  // Services and stores
  'F-SVC-01': {
    title: "Gestion d'erreur dans les services HTTP",
    expected:
      'les fonctions de `services/api` ne contiennent pas de `try/catch` : elles laissent remonter l’erreur de `r()`.',
    why: 'c’est l’écran ou le hook qui sait quoi afficher à l’utilisateur ; un `catch` dans le service cache l’erreur.',
    fix: 'retirer le `try/catch` du service et gérer l’erreur dans le hook ou l’écran qui l’appelle (`services/auth` n’est pas concerné).',
  },
  'F-SVC-02': {
    title: 'Appels réseau',
    expected:
      'tous les appels au back passent par `r` (utilisateur connecté) ou `rPublic` (public), dans `utils/fetch.ts`.',
    why: 'ces fonctions ajoutent le jeton, le timeout et la reconnexion automatique après une 401 ; un `fetch()` direct les oublie.',
    fix: 'remplacer `fetch()` par `r` ou `rPublic`.',
  },
  'F-SVC-03': {
    title: 'Accès au fournisseur d’authentification',
    expected:
      'le code de l’app utilise `authService` (`services/auth`) et n’importe jamais un fichier de `services/auth/providers/` (le code propre à Supabase).',
    why: 'changer de fournisseur d’authentification ne doit toucher qu’un seul dossier.',
    fix: 'remplacer l’import par `authService` ; s’il manque une fonction, l’ajouter à `authService`.',
  },
  'F-STORE-01': {
    title: 'Appels réseau depuis les stores',
    expected: 'les stores Zustand ne font que garder l’état et le modifier ; ils n’appellent jamais un service.',
    why: 'les appels réseau et leurs erreurs se gèrent dans les hooks, qui mettent ensuite le store à jour.',
    fix: 'déplacer l’appel dans un hook qui appelle le service, puis le setter du store.',
  },
  'F-STORE-02': {
    title: 'Vidage des stores à la déconnexion',
    expected:
      'chaque store qui contient des données de l’utilisateur est vidé par `clearAllStores()` (`stores/utils/clearStores.ts`).',
    why: 'sinon, après une déconnexion, l’utilisateur suivant sur le même téléphone peut voir les données du précédent.',
    fix: 'ajouter le vidage du store dans `clearAllStores()` ; si le store ne contient rien de personnel (thème, catalogues), le signaler avec `audit-ignore` et la raison.',
  },
  'F-STORE-03': {
    title: 'Nom des stores',
    expected: 'un store s’appelle `use{Nom}Store` et son type `T{Nom}Store`.',
    why: 'on reconnaît un store au premier coup d’œil.',
    fix: 'renommer le hook et son type.',
  },

  // TypeScript and naming
  'F-TS-01': {
    title: '`interface` au lieu de `type`',
    expected: 'les types de données s’écrivent avec `type`, jamais `interface`.',
    why: 'une seule façon d’écrire les types dans tout le projet.',
    fix: 'réécrire l’interface en `type X = { … }`.',
  },
  'F-TS-02': {
    title: 'React.FC',
    expected: 'un composant type ses props directement, sans `React.FC`.',
    why: 'convention du projet : les props sont typées sur la fonction elle-même.',
    fix: 'écrire `function MonComposant({ … }: MonComposantProps)`.',
  },
  'F-NAME-01': {
    title: 'Nom du fichier et nom exporté',
    expected:
      'un fichier de composant, d’écran ou de hook porte le nom de ce qu’il exporte (`HomeScreen.tsx` exporte `HomeScreen`).',
    why: 'on trouve le fichier en cherchant le composant, et inversement.',
    fix: 'renommer le fichier ou l’export pour qu’ils soient identiques.',
  },
  'F-NAME-02': {
    title: 'Suffixe Screen',
    expected: 'seuls les écrans déclarés dans la navigation finissent par `Screen`.',
    why: 'le suffixe signale qu’on peut naviguer vers ce composant.',
    fix: 'déclarer l’écran dans sa stack, ou retirer `Screen` du nom d’un sous-composant.',
  },
  'F-NAME-03': {
    title: 'Nom des types',
    expected:
      'un type commence par `T` (`TCard`), ou finit par `Props`, `Dto`, `Params` ou `Request` ; une enum commence par `E`.',
    why: 'on distingue d’un coup d’œil un type, un composant et une valeur.',
    fix: 'renommer le type (par exemple `ThemeMode` → `TThemeMode`).',
  },
  'F-NAME-04': {
    title: 'Nom des indicateurs de chargement',
    expected: 'un booléen de chargement dit ce qui charge : `isSessionsLoading`, pas `loading`.',
    why: 'quand un écran charge plusieurs choses, on sait laquelle est en cours.',
    fix: 'renommer (`loading` → `isLoginLoading`, `sessionsLoading` → `isSessionsLoading`) avec son setter.',
  },

  // Component structure
  'F-BARREL-01': {
    title: 'Fichiers index qui ne font que réexporter',
    expected: 'pas de fichier `index.ts` qui se contente de réexporter les fichiers voisins.',
    why: 'ces fichiers cachent d’où vient un import et favorisent les dépendances circulaires.',
    fix: 'supprimer le fichier `index` et importer directement les fichiers concernés.',
  },
  'F-SECT-01': {
    title: 'Sections des composants',
    expected:
      'chaque composant et écran contient les commentaires de section `// -------- Nom --------`, même vides, dans cet ordre : Params, Store, Hooks, States & Refs, Init, Helpers, Callbacks, Effects, Renderers, Loading, Error, (No data), Main renderer.',
    why: 'tous les fichiers ont la même structure : on sait où chercher.',
    fix: 'ajouter les sections manquantes à leur place (une section vide garde son commentaire).',
  },
  'F-SECT-02': {
    title: 'Espacement des commentaires de section',
    expected: 'une ligne vide avant et après chaque commentaire de section.',
    why: 'les sections se repèrent mieux à la lecture.',
    fix: 'ajouter les lignes vides autour du commentaire.',
  },
  'F-ASYNC-01': {
    title: 'Chaînes .then / .catch',
    expected: 'le code asynchrone s’écrit avec `async/await` et `try/catch/finally`.',
    why: 'plus lisible, et le `finally` remet l’état de chargement à coup sûr.',
    fix: 'réécrire la chaîne avec `await` dans une fonction `async`.',
  },
  'F-EFFECT-01': {
    title: 'Fonctions déclarées dans un useEffect',
    expected: 'un `useEffect` appelle une fonction déclarée plus haut (avec `useCallback`), il n’en déclare pas.',
    why: 'évite les boucles de rendu et garde l’effet lisible.',
    fix: 'sortir la fonction dans la section Init (ou Callbacks) avec `useCallback`, et l’appeler depuis l’effet.',
  },
  'F-CB-01': {
    title: 'Nom des fonctions passées aux événements',
    expected: 'une fonction du composant passée à `onPress`, `onClose`… commence par `handle` (`handlePress`).',
    why: 'on repère tout de suite ce qui réagit à une action de l’utilisateur.',
    fix: 'renommer la fonction (`toggle` → `handleToggle`).',
  },
  'F-STYLE-01': {
    title: 'Styles fixes écrits en ligne',
    expected: 'un style fixe passe par des classes NativeWind ; `style={{…}}` est réservé aux valeurs calculées.',
    why: 'un seul système de style, cohérent avec les tokens du design.',
    fix: 'remplacer l’objet par les classes équivalentes (`w-12`, `absolute left-0`…).',
  },

  // Housekeeping
  'F-COMMENT-01': {
    title: 'Code commenté',
    expected: 'pas de code laissé en commentaire.',
    why: 'git garde l’historique ; le code commenté vieillit et induit en erreur.',
    fix: 'proposer sa suppression à l’utilisateur, ou le remplacer par un `TODO` qui explique la bascule prévue.',
  },
  'F-DEAD-01': {
    title: 'Code inutilisé',
    expected: 'chaque fonction, composant ou constante déclaré est utilisé quelque part.',
    why: 'le code mort alourdit la lecture et la maintenance.',
    fix: 'vérifier qu’il n’est pas gardé exprès (travail en cours), puis proposer sa suppression à l’utilisateur.',
  },

  // Spacing (Tailwind)
  'F-TW-01': {
    title: 'Classes space-* et gap-x / gap-y',
    expected:
      'l’espace entre éléments se fait avec `gap-N` sur le parent, jamais `space-x` / `space-y` ni `gap-x` / `gap-y`.',
    why: '`space-*` ne fait rien sur mobile, et `gap-x` / `gap-y` ne s’appliquent pas toujours.',
    fix: 'remplacer par `flex flex-col gap-N` (ou `flex-row`) sur le parent.',
  },
  'F-TW-02': {
    title: 'gap sans flex',
    expected: 'un élément qui a `gap-N` déclare aussi `flex` (`flex flex-col` ou `flex flex-row`).',
    why: 'sans `flex`, le gap peut ne pas s’appliquer.',
    fix: 'ajouter `flex flex-col` (ou `flex flex-row`) dans les classes.',
  },

  // Design system
  'F-DS-01': {
    title: 'Modifications du design system',
    expected: 'l’app ne modifie pas `components/ds` ni ses tokens : ils viennent de la stack commune.',
    why: 'sinon la prochaine mise à jour de la stack écrase la modification, ou bute dessus.',
    fix: 'annuler la modification dans l’app et la proposer à la stack avec `/promote-ds`.',
  },
  'F-DS-02': {
    title: 'Couleurs en dur dans le design system',
    expected: 'les composants `Ds*` et leurs tokens n’ont aucune couleur écrite en dur (`#fff`, `rgb(…)`).',
    why: 'un changement de thème doit passer uniquement par les tokens.',
    fix: 'remplacer la couleur par un token sémantique (`sl.*`).',
  },
  'F-DS-03': {
    title: 'Style des composants Ds*',
    expected:
      'un `Ds*` se style avec son propre fichier de tokens, pas avec les classes du thème ni les couleurs primitives.',
    why: 'le design system reste indépendant du thème de l’app.',
    fix: 'passer par `design-tokens/components/ds/{nom}.js`.',
  },
  'F-DS-04': {
    title: 'DsCard cliquable',
    expected: '`DsCard` sert à afficher : elle ne reçoit pas de `onPress`.',
    why: 'une carte cliquable a besoin d’un retour visuel au toucher que `DsCard` n’a pas.',
    fix: 'envelopper la carte dans un `Pressable`.',
  },
  'F-DS-05': {
    title: 'Double marge horizontale',
    expected:
      'un seul des deux gère la marge horizontale : `DsContainer` (par défaut) ou `DsScrollView` (`enablePadding`), pas les deux.',
    why: 'sinon le contenu est décalé deux fois (marge doublée sur les côtés).',
    fix: 'retirer `enablePadding` du `DsScrollView`, ou mettre `disablePadding` sur le `DsContainer`.',
  },
  'F-DS-06': {
    title: 'Icônes importées en SVG',
    expected: 'une icône qui existe dans `DsIcon` s’affiche avec `<DsIcon name="…" />`.',
    why: 'la taille et la couleur des icônes restent cohérentes partout.',
    fix: 'remplacer l’import du SVG par `DsIcon`.',
  },
  'F-DS-07': {
    title: 'Composants React Native bruts',
    expected:
      'on utilise les composants du design system (`DsText`, `DsScrollView`, `DsFlatList`…) plutôt que ceux de React Native.',
    why: 'ils appliquent déjà le thème et les réglages du projet.',
    fix: 'remplacer par l’équivalent `Ds*`.',
  },
  'F-PICTO-01': {
    title: 'Emplacement des pictogrammes',
    expected: 'les pictogrammes sont rangés dans `components/Picto/`.',
    why: 'un seul endroit pour les trouver et les réutiliser.',
    fix: 'déplacer le fichier dans `components/Picto/`.',
  },
  'F-SVG-01': {
    title: 'Couleur des icônes SVG',
    expected: 'les SVG d’icônes utilisent `currentColor`, avec `color="#000000"` sur la balise `<svg>`.',
    why: 'la couleur de l’icône se règle alors depuis le code.',
    fix: 'corriger le SVG (la commande `/fixsvg` le fait).',
  },

  // Navigation
  'F-NAV-01': {
    title: 'Nom des navigateurs',
    expected:
      'seuls `BottomTabNavigator` et `RootNavigator` finissent par `Navigator` ; une stack s’appelle `{Nom}Stack`.',
    why: 'convention de la navigation du projet.',
    fix: 'renommer en `{Nom}Stack`.',
  },
  'F-NAV-02': {
    title: 'Noms de routes écrits en dur',
    expected: 'on navigue avec les enums de routes (`EHomeRoutes.HomeMain`), jamais avec un texte en dur.',
    why: 'renommer une route ne casse pas une navigation oubliée.',
    fix: 'remplacer le texte par la valeur de l’enum.',
  },

  // Contract with the Go back
  'F-API-01': {
    title: 'Types d’API alignés avec le back',
    expected: 'chaque type de `services/api` correspond à la struct Go que le back envoie ou attend.',
    why: 'un champ attendu mais jamais envoyé vaut `undefined` et peut faire planter un écran.',
    fix: 'aligner le type front sur le back (le back fait foi), ou corriger le back ; comparaison complète : `npm run api:dto`.',
  },
  'F-API-02': {
    title: 'Champs null et optionnels',
    expected: 'un champ que le back peut envoyer à `null` est typé `| null` côté front (et pas seulement `?:`).',
    why: 'sinon le code teste `undefined` et laisse passer `null`.',
    fix: 'ajouter `| null` au type du champ.',
  },
  'F-API-03': {
    title: 'Appels vers des routes inexistantes',
    expected: 'chaque appel du front vise une route qui existe dans le back.',
    why: 'sinon l’appel échoue en 404.',
    fix: 'corriger l’URL ou la méthode dans `services/api`, ou créer la route côté back.',
  },
  'F-API-04': {
    title: 'Champs envoyés mais jamais utilisés',
    expected: 'le back n’envoie que des champs dont l’app se sert.',
    why: 'moins de données transférées, un contrat plus simple à faire évoluer.',
    fix: 'vérifier que le champ est vraiment inutilisé, puis proposer de le retirer du DTO — ou commencer à s’en servir.',
  },
  'F-API-05': {
    title: 'Routes jamais appelées',
    expected: 'chaque route `/api` du back est appelée par l’app.',
    why: 'une route que personne n’appelle est du code mort, ou une fonctionnalité pas encore branchée.',
    fix: 'proposer de la retirer, ou la brancher.',
  },

  // Tooling
  'F-TOOL-01': {
    title: 'Compilation TypeScript',
    expected: '`npx tsc --noEmit` ne remonte aucune erreur.',
    why: 'une erreur de type est souvent un vrai bug (une comparaison toujours fausse, un argument manquant).',
    fix: 'corriger l’erreur à la ligne indiquée, sans `any` ni `@ts-ignore`.',
  },
  'F-TOOL-02': {
    title: 'Lint et formatage (Biome)',
    expected: '`biome ci` passe sans erreur.',
    why: 'un code homogène, et les erreurs courantes repérées automatiquement.',
    fix: 'lancer `npm run fix`, puis corriger le reste à la main (jamais `--unsafe` sans relire).',
  },
};

package main

// checkText is what the audit tells the user about a check, in French: the subject, the rule in plain
// words, why it matters, and how to fix a failure. Kept apart from the checks so the wording is easy to edit.
type checkText struct {
	title    string
	expected string
	why      string
	fix      string
}

var checkTexts = map[string]checkText{
	// Architecture
	"B-ARCH-01": {
		"Dépendances entre services",
		"un service de niveau 1 (`services/<nom>`) n'importe jamais un autre service de niveau 1 ; les sous-dossiers d'un même service peuvent s'importer entre eux.",
		"chaque service reste indépendant ; un traitement qui en combine plusieurs a sa place dans `application/`.",
		"déplacer la combinaison des services dans `application/<objet>/` et appeler cet orchestrateur depuis le contrôleur.",
	},
	"B-ARCH-02": {
		"Dépendances entre contrôleurs",
		"un dossier de `controllers/v1/` n'importe jamais un autre dossier de `controllers/v1/` (seul `controllers/common` est partagé).",
		"chaque ressource d'API peut évoluer sans casser les autres.",
		"copier le DTO ou le mapper nécessaire dans ce contrôleur (mêmes noms et tags json) au lieu de l'importer.",
	},
	"B-ARCH-03": {
		"application/ indépendant du HTTP et de la base",
		"le code de `application/` n'utilise ni gin, ni GORM, ni les modèles de base ; la seule fonction de `database` permise est `RunInTx`.",
		"l'orchestration passe par les services, qui sont les seuls à parler à la base.",
		"remplacer l'accès direct par un appel au service concerné.",
	},
	"B-ARCH-04": {
		"Sous-packages de calcul purs",
		"un sous-package de calcul (sans `*_mapper.go`) n'accède ni à la base, ni au réseau, ni à un autre service.",
		"ces calculs restent simples à tester et à réutiliser.",
		"déplacer l'accès aux données dans le service parent ou dans `application/`, et passer les données au calcul en paramètre.",
	},
	"B-ARCH-05": {
		"Contrôleurs et base de données",
		"un contrôleur v1 n'importe ni GORM ni `database` : il passe par un service ou un orchestrateur.",
		"la base ne se manipule qu'à un seul niveau, celui des services.",
		"appeler le service et tester ses erreurs avec `errors.Is` sur les erreurs qu'il exporte.",
	},

	// Types and files
	"B-TYPE-01": {
		"Tags des modèles de base",
		"les structs de `database/model` n'ont que des tags `gorm` (pas de `json`).",
		"un modèle reflète une table ; le JSON renvoyé à l'app est défini par les DTO des contrôleurs.",
		"retirer les tags `json` du modèle.",
	},
	"B-TYPE-02": {
		"Tags des types domain",
		"les structs des fichiers `*_domain.go` n'ont aucun tag (ni `json` ni `gorm`).",
		"le domain est le modèle métier, indépendant de la base et de l'API.",
		"retirer les tags ; la conversion vers la base se fait dans `*_mapper.go`.",
	},
	"B-TYPE-03": {
		"Tags GORM dans les DTO",
		"les DTO et les requêtes des contrôleurs n'ont pas de tag `gorm`.",
		"un DTO décrit le JSON échangé avec l'app, pas une table.",
		"retirer les tags `gorm`.",
	},
	"B-TYPE-04": {
		"Méthodes sur les structs de données",
		"les structs domain, DTO et requête ne portent aucune méthode.",
		"ce sont de simples données ; la logique va dans les mappers ou les services.",
		"transformer la méthode en fonction dans le mapper ou le service.",
	},
	"B-TYPE-05": {
		"Nom des structs de réponse",
		"les structs des fichiers `*_dto.go` finissent par `Dto`.",
		"le nom fait partie du contrat que l'app reprend à l'identique.",
		"renommer la struct en `…Dto` sans toucher à ses tags json.",
	},
	"B-FILE-01": {
		"Fichiers d'un service",
		"chaque service a trois fichiers : `<nom>_domain.go` (données et erreurs), `<nom>_mapper.go` (conversions) et `<nom>.go` (requêtes).",
		"même structure partout : on sait où chercher.",
		"créer le fichier manquant et y déplacer le code concerné.",
	},
	"B-FILE-02": {
		"Fichiers d'un contrôleur",
		"chaque contrôleur v1 a un `<nom>_dto.go`, un `<nom>_mapper.go` et un `<nom>.go` (plus `<nom>_request.go` s'il lit une entrée).",
		"même structure partout : on sait où chercher.",
		"créer le fichier manquant et y déplacer le code concerné.",
	},
	"B-FILE-03": {
		"Nom des fichiers Go",
		"les fichiers Go sont en snake_case (`target_card.go`).",
		"convention Go du projet.",
		"renommer le fichier.",
	},

	// Database
	"B-DB-01": {
		"Relations des clés étrangères",
		"chaque colonne clé étrangère (`XxxID`) a aussi son champ de relation (`Xxx *Xxx` avec `foreignKey:XxxID`).",
		"c'est ce champ qui permet de charger la relation avec `Preload`.",
		"ajouter le champ de relation à côté de la colonne.",
	},
	"B-DB-02": {
		"Relations en pointeur",
		"une relation vers un autre modèle est un pointeur (`*OrderType`).",
		"une relation non chargée vaut alors `nil`, au lieu d'un objet vide trompeur.",
		"passer le type du champ en pointeur.",
	},
	"B-DB-03": {
		"Tables au singulier",
		"les noms de tables sont au singulier (`user`, `order_line`).",
		"convention de nommage de la base.",
		"renommer la table dans `database/tables/*.sql` et dans `TableName()`.",
	},
	"B-DB-04": {
		"Commentaires dans les modèles",
		"les fichiers de `database/model` ne contiennent pas de commentaire explicatif.",
		"l'explication vit dans le fichier SQL de la table, qui fait foi.",
		"déplacer le commentaire dans `database/tables/<table>.sql`.",
	},
	"B-DB-05": {
		"AutoMigrate",
		"le backend ne modifie jamais le schéma de la base (pas d'`AutoMigrate`).",
		"le schéma est géré à la main dans `database/tables/*.sql`.",
		"retirer l'appel et modifier le fichier SQL de la table.",
	},
	"B-DB-06": {
		"Point de départ des requêtes",
		"chaque requête commence par `database.FromContext(ctx, s.db)`.",
		"c'est ce qui la fait participer à la transaction en cours ; sinon une partie des écritures échappe à la transaction.",
		"remplacer `s.db.…` par `database.FromContext(ctx, s.db).…`.",
	},
	"B-DB-07": {
		".Debug() sur les requêtes",
		"pas de `.Debug()` dans le code.",
		"il affiche tout le SQL même en production ; la trace s'active avec `LOG_DB_LEVEL=DEBUG`.",
		"retirer `.Debug()`.",
	},

	// API
	"B-API-01": {
		"Détails d'erreur renvoyés sur une 500",
		"une erreur 500 renvoie un message générique à l'app, jamais `err.Error()`.",
		"`err.Error()` peut montrer du SQL ou des détails internes à l'utilisateur.",
		"logger l'erreur avec `helpers.CTRLogger` et renvoyer un message générique.",
	},
	"B-API-02": {
		"DTO construits dans les handlers",
		"un handler ne construit pas de DTO lui-même : il appelle une fonction `To…Dto` du mapper.",
		"la conversion vers le JSON reste au même endroit.",
		"déplacer la construction dans une fonction de `*_mapper.go`.",
	},
	"B-API-03": {
		"Handlers qui enchaînent plusieurs services",
		"un handler appelle un seul orchestrateur ou service.",
		"un enchaînement de services est un cas d'usage : il a sa place dans `application/`.",
		"créer ou compléter un orchestrateur dans `application/<objet>/` et l'appeler depuis le handler.",
	},
	"B-API-04": {
		"Création des dépendances des contrôleurs",
		"les services d'un contrôleur sont créés une seule fois, dans `NewController()`, appelé au démarrage par le router.",
		"une variable globale est créée avant la connexion à la base ; une création dans le handler est refaite à chaque requête.",
		"déclarer le service en champ du contrôleur et le créer dans `NewController()`.",
	},
	"B-API-05": {
		"Alias d'import des services",
		"un service est importé avec l'alias `srv{Ressource}` (`srvUser`).",
		"on reconnaît tout de suite un appel de service dans un contrôleur.",
		"renommer l'alias de l'import.",
	},
	"B-API-06": {
		"Ordre des groupes de routes",
		"`router.go` déclare un groupe de routes par ressource, dans l'ordre alphabétique.",
		"on retrouve une route rapidement et on évite les doublons.",
		"réordonner ou fusionner les groupes.",
	},
	"B-API-07": {
		"Nom des méthodes",
		"les méthodes des handlers, orchestrateurs et services commencent par `GetList`, `GetOne`, `Create`, `Update` ou `Delete`.",
		"le même vocabulaire du contrôleur jusqu'au service.",
		"renommer (`GetByID` → `GetOneByID`, `ListActive` → `GetListActive`).",
	},

	// Security
	"B-SEC-01": {
		"Timeout des appels HTTP sortants",
		"tout client HTTP qui appelle un service externe a un `Timeout` (par exemple 15 s).",
		"sans timeout, un service externe lent bloque le serveur indéfiniment.",
		"créer `&http.Client{Timeout: 15 * time.Second}` au lieu d'utiliser `http.DefaultClient` ou `http.Get`.",
	},
	"B-SEC-02": {
		"Timeouts du serveur",
		"le serveur démarre avec un `http.Server` qui fixe `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout` et `IdleTimeout`.",
		"protège le serveur contre les connexions volontairement lentes.",
		"remplacer `router.Run()` par un `http.Server` configuré.",
	},
	"B-SEC-03": {
		"Création du router gin",
		"le router est créé avec `gin.New()` et les middlewares sont ajoutés à la main.",
		"`gin.Default()` ajoute ses propres middlewares, qui doublonnent ceux du projet.",
		"remplacer `gin.Default()` par `gin.New()`.",
	},

	// Go conventions
	"B-GO-01": {
		"Type uint",
		"pas de `uint` : `int` pour les ids integer, `int64` pour les bigint, `uuid.UUID` pour les ids d'entité.",
		"le type Go doit correspondre au type de la colonne Postgres.",
		"changer le type.",
	},
	"B-GO-02": {
		"Position du contexte",
		"`ctx context.Context` est toujours le premier paramètre d'une fonction.",
		"convention Go.",
		"déplacer `ctx` en premier paramètre.",
	},
	"B-GO-03": {
		"Documentation des fonctions exportées",
		"une fonction exportée a un commentaire qui commence par son nom (`// GetOne renvoie …`).",
		"la documentation s'affiche dans l'éditeur au survol.",
		"ajouter le commentaire au-dessus de la fonction.",
	},
	"B-GO-04": {
		"Code commenté",
		"pas de code laissé en commentaire.",
		"git garde l'historique ; le code commenté vieillit et induit en erreur.",
		"proposer sa suppression à l'utilisateur, ou le remplacer par un `TODO` qui explique la bascule prévue.",
	},

	// Logging
	"B-LOG-01": {
		"Logs hors des loggers du projet",
		"les logs passent par les loggers de `commons/helpers`, jamais directement par `log` ou `logrus`.",
		"le niveau de log se règle par couche avec `LOG_*_LEVEL`.",
		"remplacer par `helpers.CTRLogger` (contrôleurs) ou `helpers.SRCLogger` (services).",
	},
	"B-LOG-02": {
		"Logger de la bonne couche",
		"les contrôleurs utilisent `CTRLogger`, les services `SRCLogger`.",
		"le réglage `LOG_*_LEVEL` s'applique alors au bon périmètre.",
		"changer de logger.",
	},

	// Configuration
	"B-CFG-01": {
		"Lecture des variables d'environnement",
		"les variables d'environnement ne sont lues que dans `config/`.",
		"toute la configuration est visible et typée au même endroit.",
		"ajouter la variable à la config typée de `config/` et la lire via `config.AppCfg()` (ou équivalent).",
	},
	"B-CFG-02": {
		"Fichier .example.env à jour",
		"`config/.example.env` liste toutes les variables que le code lit.",
		"c'est la référence pour configurer un nouvel environnement.",
		"ajouter la variable manquante avec une valeur d'exemple ; une variable listée mais jamais lue est à vérifier avant de la retirer.",
	},

	// Tooling
	"B-TOOL-01": {
		"Formatage gofmt",
		"tout le code est formaté avec `gofmt`.",
		"format standard de Go, des diffs propres.",
		"lancer `gofmt -w <fichier>`.",
	},
	"B-TOOL-02": {
		"Compilation (go build / go vet)",
		"`go build ./...` et `go vet ./...` passent sans erreur.",
		"le code doit compiler ; `vet` repère des bugs courants.",
		"corriger le message à la ligne indiquée.",
	},
}

// textOf returns the wording of a check; a check without wording is a bug of the audit itself.
func textOf(c check) checkText {
	t, ok := checkTexts[c.id]
	if !ok {
		fail(errorf("no wording for check %s in texts.go", c.id))
	}
	return t
}

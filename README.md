# BULLPRINT 3D — Site + Admin

Site web pour Bullprint 3D, avec admin éditeur de contenu.
Signé Edmaster & Claudius · Bleu Canard Édition 2026.

## Structure

```
bullprint/
├── index.html              # site public — coquille avec data-bind
├── render.js               # remplit la coquille depuis content.json
├── script.js               # animations, curseur, carousels
├── styles.css              # design system complet
├── content.json            # TOUT le contenu éditable (texte + cartes)
├── netlify.toml            # config Netlify
├── package.json            # déclaration des fonctions
├── secret-admin/
│   ├── index.html          # interface admin (mode admin orange)
│   └── admin.js            # logique édition + commit
├── netlify/
│   └── functions/
│       └── commit-content.js   # backend GitHub commit
└── assets/
    ├── logo.png
    ├── products/           # 19 photos produits
    └── atelier/            # 4 schémas postes
```

## Comment ça marche

### Site public
1. Le navigateur charge `index.html`
2. `render.js` récupère `content.json` et remplit tous les éléments `data-bind`
3. `script.js` lance l'intro, les animations, les carousels

### Admin (`/secret-admin`)
1. Page protégée par mot de passe (env var `ADMIN_SECRET`)
2. Charge `content.json` exactement comme le site public
3. Ajoute une barre orange "MODE ADMIN" en haut
4. Chaque texte/carte/catégorie devient cliquable pour édition en place
5. Bouton "Valider" → modal avec résumé des changements → "Publier"
6. Le bouton Publier envoie le nouveau `content.json` à la fonction Netlify
7. La fonction commit sur GitHub
8. Netlify détecte le push et redéploie automatiquement (~1 min)

## Mise en ligne — première fois

### 1. Pousser sur GitHub
Créer un repo (ex: `eddie-boop14/Bull.print3d`), pousser tout le contenu de `bullprint/` dessus.

### 2. Connecter à Netlify
- New site from Git → choisir le repo
- Build settings : laisser par défaut (Netlify lit `netlify.toml`)
- Deploy

### 3. Créer un fine-grained GitHub PAT
- github.com/settings/personal-access-tokens → Generate new
- Nom : `bullprint-admin`
- Expiration : 1 an
- Repository access : **Only select** → choisir `Bull.print3d` (UN SEUL repo)
- Permissions → Contents : **Read and write**
- Copier le token (commence par `github_pat_...`)

### 4. Choisir un mot de passe admin
30+ caractères aléatoires :
```
openssl rand -base64 32
```

### 5. Ajouter les variables d'environnement Netlify
Dans Netlify → Site settings → Environment variables :
- `GITHUB_TOKEN` = le PAT
- `ADMIN_SECRET` = le mot de passe
- (optionnel) `REPO_OWNER`, `REPO_NAME`, `REPO_BRANCH` si pas `eddie-boop14/Bull.print3d/main`

Redéployer (Deploys → Trigger deploy → Clear cache and deploy).

### 6. Vérifier
- Visiter `https://bullprint3d.fr/secret-admin/` (ou le domaine Netlify provisoire)
- Entrer le mot de passe
- Faire une petite édition de test
- Valider, publier
- Vérifier sur `github.com/eddie-boop14/Bull.print3d/commits/main` que le commit apparaît
- Attendre ~1 min, recharger le site, voir le changement

## Pour le client (Bull)

URL : `bullprint3d.fr/secret-admin`
Mot de passe : (à lui transmettre séparément, à ne pas mettre dans un email avec l'URL)

Workflow :
1. Va sur l'URL secrète
2. Entre le mot de passe (le navigateur s'en souvient)
3. La barre orange "MODE ADMIN" indique qu'il est en mode édition
4. Cliquer sur n'importe quel texte pour le modifier
5. Cliquer sur une carte produit pour modifier ses détails
6. Boutons "+ Carte", "+ Catégorie" pour ajouter
7. Quand prêt → bouton "Valider →"
8. Vérifier le résumé → "Publier maintenant"
9. Attendre 1 minute, le site est à jour

## Sécurité

- Le mot de passe est validé côté serveur (fonction Netlify), pas dans le navigateur
- Le GitHub PAT n'est **jamais** envoyé au navigateur — il reste dans les env vars Netlify
- Le PAT est scopé à UN SEUL repo (Bullprint), donc même s'il fuit, dégâts limités
- L'URL `/secret-admin` n'est pas indexée (X-Robots-Tag dans `netlify.toml`)
- Le mot de passe est stocké en sessionStorage côté client (perdu en fermant l'onglet — il devra le re-entrer chaque session si Netlify Identity n'est pas utilisé)

## Photos (pour plus tard)

Le système de photos n'est PAS dans cet admin. Eddie a un outil séparé
(`picture-system-v1`) qu'il branchera quand il sera prêt.

En attendant : pour changer une photo, remplacer le fichier dans
`assets/products/` (même nom) et push sur GitHub. Le `content.json` n'a
pas besoin d'être modifié si le nom de fichier reste le même.

## Modifier le contenu sans admin (urgence / direct)

Éditer `content.json` directement, commit, push. Le site se met à jour
automatiquement.

---
Signé Edmaster & Claudius · Bleu Canard Édition 2026

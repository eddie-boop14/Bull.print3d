# BULLPRINT 3D — Site

Site web pour Bullprint 3D. Build 2026.

## Structure
```
bullprint/
├── index.html          # page unique, tout est dedans
├── styles.css          # tout le style
├── script.js           # intro, scroll, filtres, curseur
└── assets/
    ├── logo.png        # logo bulldog (fond transparent)
    └── products/       # 19 photos produits
```

## Tester en local
Ouvrir un terminal dans ce dossier puis :
```bash
python3 -m http.server 8080
```
Puis aller sur `http://localhost:8080` dans le navigateur.

(Ouvrir `index.html` directement en double-cliquant marche aussi mais certains effets peuvent ne pas charger correctement à cause des restrictions CORS du protocole `file://`.)

## Mettre en ligne
N'importe quel hébergeur de fichiers statiques fonctionne :

- **Netlify** : glisser-déposer le dossier sur netlify.com → URL en 30 secondes, gratuit
- **Vercel** : `vercel deploy` depuis ce dossier
- **OVH / hébergement classique** : uploader le dossier via FTP dans `www/`
- **GitHub Pages** : push le dossier sur un repo public, activer Pages dans Settings

Le site est 100% statique — pas de serveur, pas de base de données, pas de build.

## À faire avant mise en ligne réelle

1. **Domaine** : acheter `bullprint3d.fr` (ou autre). Sans ça, le bouton "Écrire à l'atelier" pointe vers une adresse qui n'existe pas (`contact@bullprint3d.fr`).
2. **Prix** : valider tous les prix dans `index.html` — ils sont basés sur le marché cosplay/3D français mais à toi de confirmer.
3. **Noms de produits** : certains sont inventés ("Bar-Bot Mascotte", "Waitress Bot") — à changer si besoin.
4. **Compresser les images** : les .jpg actuels font ~80-130KB chacun. Pour aller plus vite, les passer en .webp via squoosh.app (gain ~60%).
5. **Vrai handle Insta** : le lien pointe vers `instagram.com/bull.print3d` — vérifier que c'est correct.

## Sections de la page
1. **Intro** : animation "impression 3D" qui imprime les mots BULLPRINT FAIT-LE EN 3D (clic pour passer)
2. **Hero** : grand titre + pièce en vedette (Deadpool)
3. **Ticker vert** : bandeau qui défile
4. **Galerie** : 19 produits filtrables par catégorie (bento grid)
5. **Les Signatures** : 3 pièces emblématiques en scroll sticky
6. **Sur Mesure** : process en 4 étapes pour les commandes custom
7. **Stats** : 19+, 24H, 5-21j, 1 atelier
8. **Commander** : CTA email + Insta
9. **Footer** : liens, contact, mentions

## Modifier le contenu

**Changer une photo** :
Remplacer le fichier dans `assets/products/` en gardant le même nom.

**Changer un prix** :
Ouvrir `index.html`, chercher le nom du produit, modifier la valeur dans `<span class="price">`.

**Ajouter un produit** :
Copier le bloc `<article class="piece ...">` complet d'un produit existant et modifier. Attention à la classe de taille (`feat`, `big`, `mid`, `tall`, `wide`, `std`) — voir grid plan ci-dessous.

**Grid plan** (12 colonnes) :
- `feat` = 6 col × 3 row (gros)
- `big` = 3 col × 3 row (haut)
- `tall` = 4 col × 3 row (haut moyen)
- `mid` = 4 col × 2 row (moyen)
- `wide` = 6 col × 2 row (large)
- `std` = 3 col × 2 row (petit)

Chaque rangée doit totaliser 12 colonnes.

## Ce qui manque (volontairement)
- Pas de checkout / panier — tout passe par devis/DM. À ajouter plus tard si besoin (Stripe, Snipcart, etc.)
- Pas d'admin — pour ajouter un produit il faut modifier le HTML. Plus tard on peut passer sur un CMS headless (Sanity, Strapi).
- Pas de blog/news — à ajouter si pertinent pour le SEO.
- Pas de vidéo intro de la reel Instagram — peut être ajoutée en remplaçant l'intro CSS par un `<video autoplay muted>` avec un fichier dans `assets/intro.mp4`.

## Performance
- 0 framework, 0 dépendance externe sauf fonts Google
- Total page : ~2.3 MB (1.6 MB d'images, le reste 70 KB)
- Compresser les images en webp ramène à ~1 MB

— Build par Claude pour J.M.

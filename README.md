# BULLPRINT 3D — Site

Site web pour Bullprint 3D. Build 2026.
Signé Edmaster & Claudius · Bleu Canard Édition 2026.

## Structure
```
bullprint/
├── index.html          # page unique, tout est dedans
├── styles.css          # tout le style
├── script.js           # intro, scroll, carousels, curseur
└── assets/
    ├── logo.png        # logo bulldog (fond transparent)
    └── products/       # 19 photos produits
```

## Sections de la page
1. **Intro animée** — "BULLPRINT 3D" qui s'imprime lettre par lettre (clic pour passer)
2. **Hero** — Titre + Pièce en vedette (Deadpool)
3. **Reel Instagram** — embed du reel atelier
4. **Galerie** — 7 catégories en carousels horizontaux (flèches gauche/droite)
5. **L'Atelier** — texte + 4 postes (FDM, Résine, Ponçage, Peinture)
6. **Sur Mesure** — Process 4 étapes : Tu envoies / On décide / On imprime / On livre
7. **Commander** — CTA email + Insta
8. **Footer** — liens + signature

## Tester en local
```bash
cd bullprint/
python3 -m http.server 8080
```
Puis aller sur `http://localhost:8080`.

## Mettre en ligne
- **Netlify** : glisser-déposer le dossier sur netlify.com → URL en 30s, gratuit
- **Vercel** : `vercel deploy`
- **OVH / hébergement classique** : uploader le dossier via FTP dans `www/`
- **GitHub Pages** : push sur un repo, activer Pages

100% statique. Pas de serveur, pas de base de données.

## À faire avant mise en ligne réelle

1. **Domaine** : `bullprint3d.fr` (ou autre). Les CTA pointent vers `contact@bullprint3d.fr`.
2. **Reel Instagram** : l'embed officiel d'Insta s'affichera automatiquement sur un vrai navigateur. Si tu préfères héberger la vidéo toi-même (chargement plus rapide, pas de tracking IG), déposer le fichier dans `assets/intro-reel.mp4` et remplacer le `<blockquote>` par un `<video autoplay muted loop playsinline>`.
3. **Photos atelier** : ajouter quand prêtes — slot prévu dans la section "L'Atelier".
4. **Compresser les images** : passer les `.jpg` en `.webp` via squoosh.app (gain ~60%).
5. **Vérifier le handle Insta** : `instagram.com/bull.print3d`.

## Modifier le contenu

**Changer une photo** : remplacer le fichier dans `assets/products/` en gardant le même nom.

**Ajouter un produit à une catégorie** :
1. Ouvrir `index.html`, chercher la `<section class="cat-row">` de la catégorie
2. Copier un bloc `<a href="#order" class="card">...</a>` complet
3. Modifier l'image, le nom, le sous-titre
4. Mettre à jour `<span class="cat-count">X pièces</span>`

**Ajouter une nouvelle catégorie** : copier un bloc `<section class="cat-row reveal">` complet et personnaliser.

## Carousel
Les flèches gauche/droite scrollent horizontalement par largeur de carte. Sur mobile, tu peux aussi swipe au doigt directement.

## Performance
- 0 framework, 0 dépendance sauf fonts Google et embed Instagram
- ~2 MB total (1.6 MB d'images, le reste 70 KB)
- Compresser en webp ramène à ~1 MB

## Ce qui manque (volontairement)
- Pas de checkout : tout passe par devis/DM
- Pas d'admin : modifier le HTML
- Pas de prix : choix volontaire, le devis se fait au cas par cas
- Pas de blog/news

---
Signé Edmaster & Claudius · Bleu Canard Édition 2026

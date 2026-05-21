# BULLPRINT 3D — Site

Site web pour Bullprint 3D. Build 2026.
Signé Edmaster & Claudius · Bleu Canard Édition 2026.

## Structure
```
bullprint/
├── index.html          # page unique
├── styles.css          # tout le style
├── script.js           # intro, scroll, carousels, curseur
└── assets/
    ├── logo.png        # logo bulldog
    └── products/       # 19 photos produits
```

## Sections de la page
1. **Intro animée** — "BULLPRINT 3D" s'imprime lettre par lettre (clic = skip)
2. **Hero** — Titre + Pièce en vedette (Deadpool) + 3 boutons (Galerie / Sur mesure / Instagram)
3. **Galerie** — 7 catégories en carousels (Casques, Star Wars, Bustes, Lampes, Gaming, Déco, Pièces uniques)
4. **L'Atelier** — Texte + 4 postes avec photos d'illustration (FDM, Résine, Ponçage, Peinture)
5. **Sur Mesure** — Process 4 étapes : Tu envoies / On décide / On imprime / On livre
6. **Commander** — CTA email + Insta
7. **Footer** — liens + signature

## Tester en local
```bash
cd bullprint/
python3 -m http.server 8080
```
Aller sur `http://localhost:8080`.

## Mettre en ligne
- **Netlify** : drag-and-drop le dossier → URL en 30s, gratuit
- **Vercel** : `vercel deploy`
- **OVH / hébergement classique** : FTP dans `www/`
- **GitHub Pages** : push + activer Pages

100% statique, pas de serveur ni de base de données.

## À faire avant mise en ligne

1. **Domaine** : `bullprint3d.fr` (les CTA pointent vers `contact@bullprint3d.fr`)
2. **Photos atelier** : les images dans la section "L'Atelier" sont des photos d'illustration Unsplash (libres de droits, gratuites, usage commercial OK). À remplacer par les vraies photos quand prêtes — voir ci-dessous.
3. **Compresser les images produits** : passer en `.webp` via squoosh.app (gain ~60%)
4. **Vérifier handle Insta** : `instagram.com/bull.print3d`

## Photos atelier — comment remplacer

Les images dans la section L'Atelier viennent directement d'Unsplash via leur CDN. Pour mettre les vraies photos :

1. Ouvrir `index.html`
2. Chercher `<img src="https://images.unsplash.com/...`
3. Remplacer par `<img src="assets/atelier/poste-01.jpg"` (etc.)
4. Mettre les photos dans `assets/atelier/`

## Carousel galerie
Flèches gauche/droite scrollent par largeur de carte. Sur mobile, swipe au doigt.

## Performance
- 0 framework, 0 dépendance externe sauf fonts Google et photos Unsplash
- ~2 MB total (sans les photos Unsplash hébergées chez eux)

## Ce qui manque volontairement
- Pas de checkout : devis/DM uniquement
- Pas de prix : volonté de faire le devis cas par cas
- Pas de délais affichés : volonté de ne pas s'engager
- Pas d'admin : modifier le HTML directement

---
Signé Edmaster & Claudius · Bleu Canard Édition 2026

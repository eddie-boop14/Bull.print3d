# Journal de commandes — installation (compte Google de Cedric)

Le site envoie chaque commande **payée** à un petit script Google qui :
1. ajoute une ligne dans un Google Sheet « Commandes »,
2. envoie un email à l'atelier + un email de confirmation au client.

Aucun serveur à gérer, ça tourne sur le compte Google de Cedric.

## Installation (10 minutes, une seule fois)

1. Créer un Google Sheet vierge, le nommer par ex. `BULLPRINT — Commandes`.
2. Menu **Extensions → Apps Script**.
3. Effacer le contenu, coller le fichier `Code.gs` de ce dossier.
4. En haut du script, remplacer :
   - `SHARED_SECRET` → une longue phrase secrète inventée (garde-la, il la faut à l'étape 7),
   - `NOTIFY_EMAIL` → la boîte qui reçoit les commandes (déjà pré-remplie).
5. **Déployer → Nouveau déploiement → Application Web** :
   - Exécuter en tant que : **Moi**
   - Accès : **Tout le monde** (le secret partagé fait office d'authentification)
   - → copier l'**URL de l'application Web** (`https://script.google.com/macros/s/…/exec`).
6. Autoriser le script quand Google le demande (envoi d'emails + accès au Sheet).
7. Donner à Eddie pour Netlify (Site settings → Environment variables) :
   - `APPS_SCRIPT_URL` = l'URL copiée à l'étape 5
   - `APPS_SCRIPT_SHARED_SECRET` = la phrase secrète de l'étape 4

## Vérifier que ça marche

Dans un terminal (ou demander à Eddie) :

```bash
curl -X POST "$APPS_SCRIPT_URL" -H "Content-Type: application/json" -d '{
  "secret": "LA-PHRASE-SECRETE",
  "type": "order",
  "reference": "BP-TEST-0001",
  "checkoutId": "test-123",
  "paidAmount": 1,
  "currency": "EUR",
  "items": [{"name":"Test","variant":"","qty":1,"price":1}],
  "shippingMethod": "retrait atelier",
  "customer": {"name":"Test","email":"ADRESSE-DE-TEST"}
}'
```

→ une ligne apparaît dans le Sheet, deux emails partent. Rejouer la même
commande ne crée **pas** de doublon (déduplication par Checkout ID).

## Notes

- Quota Gmail d'un compte standard : ~100 emails/jour envoyés par script —
  très au-dessus du volume attendu.
- Si le script est injoignable, la commande reste payée et visible dans le
  dashboard SumUp ; seul le journal/les emails manquent. Le paiement ne
  dépend jamais de Google.

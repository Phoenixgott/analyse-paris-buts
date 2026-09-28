# Analyse Paris Buts

Matchs de football du jour, probabilités de buts estimées (Over/Under, 1re mi-temps, buteurs) et
prompt d'analyse IA. **Probabilités estimées, pas des certitudes. Réservé aux 18 ans et plus.**

Site : https://phoenixgott.github.io/analyse-paris-buts/ (installable sur Android : Chrome → menu ⋮ →
« Installer l'application »).

## Développement

Prérequis : Node.js 20.19 ou plus.

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests Vitest
npm run build      # construit dist/ (site + service worker)
npm run preview    # sert dist/ sur http://localhost:4173/analyse-paris-buts/
npm run icones     # régénère les icônes PWA
npm run demo       # régénère les 6 matchs de démonstration (data/demo/)
```

Schéma des données d'un match : [docs/SCHEMA.md](docs/SCHEMA.md).

Le déploiement sur GitHub Pages se fait automatiquement à chaque push sur `main`
(`.github/workflows/deploy.yml`). Dans les réglages du repo : **Settings → Pages → Source :
GitHub Actions**.

Plan complet, règles et risques : [docs/PLAN.md](docs/PLAN.md).

## Jeu responsable

Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelle le
09 74 75 13 13 (appel non surtaxé) ou va sur [joueurs-info-service.fr](https://www.joueurs-info-service.fr/).

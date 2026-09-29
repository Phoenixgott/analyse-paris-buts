# Plan — Analyse Paris Buts

Site statique (GitHub Pages, repo `Phoenixgott/analyse-paris-buts`), PWA installable sur Android,
interface en français, fuseau Europe/Paris. Chaque jour : matchs du jour, probabilités de buts
estimées (Over/Under 0.5 → 5.5, 1re mi-temps, buteurs) et prompt d'analyse IA.

## Règles non négociables

1. Aucune donnée inventée : donnée absente = `null`, affichée « N/D ».
2. **Aucune clé API**, nulle part. Les données de match sont collectées par prompt (voir plus bas).
3. Données de démonstration toujours marquées « DÉMO » à l'écran.
4. Chaque pourcentage affiché a une info-bulle expliquant son calcul.
5. Jamais de promesse de gain ; pied de page 18+ et lien joueurs-info-service.fr.
6. Qualité des données < 40/100 : match « non fiable », aucun pari suggéré.
7. « PASSER » est un verdict valable et fréquent.

## Choix techniques

Vite + JavaScript vanilla + Chart.js + vite-plugin-pwa ; pas de framework ni de backend. Tests : Vitest.
Déploiement : Actions → Pages à chaque push sur `main`.

**Collecte des matchs : par prompt, sans clé API** (décision du 28/09/2026, remplace les API et les
crons 05:30 / 16:00 du cahier des charges). Page « Récupérer les matchs » :
1. liste du jour → 2. fiches complètes (1 à 3 matchs par demande) → 3. mise à jour avant le match
(cotes, compos, absents). À chaque étape, le site génère la demande, l'utilisateur la colle dans une
conversation Claude avec la recherche web, puis recolle la réponse. Le site la vérifie (schéma,
vraisemblance, source obligatoire par bloc), la range **sur l'appareil** (IndexedDB, avec sauvegarde
en fichier) et calcule le modèle **dans le navigateur**.

**Historique des ligues : football-data.co.uk** (fichiers CSV publics, sans clé ni compte), téléchargé
chaque nuit par `.github/workflows/historiques.yml` dans `data/ligues/` (saison en cours + précédente,
16 championnats). Sans historique (coupes d'Europe, féminines, sélections, palier 2) : repli sur la
forme des deux équipes.

## Arborescence

```
index.html · vite.config.js · package.json
docs/        PLAN.md · SCHEMA.md · MODELE.md
public/      favicon.svg · icons/
src/         main.js · router.js · format.js · explications.js
  styles/    tokens, base, layout, composants
  pages/     accueil · collecte · match (+ section-modele, section-prompt, blocs-graphiques) · a-venir
  composants/ carte-kpi · tableau-triable · badge · info-bulle · navigation · presse-papier
  collecte/  competitions · prompts · import · noms
  donnees/   chargement · local (IndexedDB)
  graphiques/ donnees · fiche (Chart.js) · registre
  prompt/    modele-prompt (texte exact) · generateur
modele/      JS pur : dixon-coles · grille · mi-temps · buteurs · ajustements · value-kelly · confiance · analyser
schema/      match.schema.json · modele.schema.json · valider.js · qualite.js
scripts/     historiques/ (telecharger, csv) · lib/ (index-jour, modeles-jour) · demo/ · calculer-modeles · generer-icones
data/        index.json · demo/ · ligues/
tests/       Vitest
.github/workflows/ deploy.yml · historiques.yml
```

## Risques connus

| Risque | Conséquence / parade |
|---|---|
| L'IA peut inventer ou mal recopier des chiffres | Source (URL) exigée par bloc, sinon bloc ignoré ; contrôles de vraisemblance (dates, scores, ordre et marge des cotes, cohérence des stats) ; rapport d'import ; la qualité baisse quand des blocs manquent |
| Noms d'équipes différents entre l'IA et football-data.co.uk | Noms imposés dans les prompts + rapprochement automatique (sigles, abréviations), signalé dans le rapport ; nom inconnu → forme seule |
| Données stockées sur un seul appareil | Sauvegarde / restauration en fichier ; demande de stockage persistant au navigateur |
| Réponse de l'IA coupée si trop longue | 1 à 3 fiches par demande ; protocole « SUITE DISPONIBLE » / « continue » |
| football-data.co.uk indisponible | Fichier existant conservé, échec visible dans l'Action ; le modèle garde le dernier historique |
| Modèle moins juste que le marché, values non rentables au backtest | Réglages passés à 240 j / prior 20 (les plus justes testés) ; rappel du backtest sous chaque « PARIER » et sur Top picks ; page Fiabilité |
| Pages gratuit exige un repo public | Seuls la démo et les historiques publics y sont ; les matchs collectés restent sur l'appareil |

## Écarts assumés au cahier des charges

- Champ `demo` ajouté au schéma du match (règle 3 jusque dans le prompt IA et l'export).
- Validateur de schéma maison (`schema/valider.js`) plutôt qu'Ajv.
- Historique des ligues dans `data/ligues/<competition_id>.json` (hors schéma du match).
- Calculs du modèle dans un objet à part (schéma `modele.schema.json`).
- Schéma du match v1.1.0 : `stats.buts_par_tranche` (graphique des tranches de 15 min).
- Calculs du modèle v1.1.0 : champ `unites`.
- Prompt IA : texte exact ; pour une démo, `{{COMPETITION}}` reçoit « (DÉMO : données fictives, ne pas parier) ».
- Couleurs des graphiques : jaune #FFD500 / bleu ciel #5AB0FF (ΔE daltonisme 30).
- **Phase 4 : collecte par prompt, stockage local, modèle dans le navigateur ; plus de quotas, de
  crons de collecte, de `/data/AAAA-MM-JJ/` ni de purge à 30 jours.** Les phases 5 (alertes) et 6
  (archivage) seront locales elles aussi (ntfy.sh accepte des envois depuis le navigateur, sans clé).
- **Réglages du modèle : demi-vie 240 jours et prior de 20 matchs** au lieu de 60 jours / prior 1
  (décision du 29/09/2026, d'après le backtest sur 7 029 matchs réels : probabilités moins tranchées,
  plus proches de ce qui arrive vraiment). Les réglages du cahier des charges restent mesurés chaque
  nuit dans le backtest, pour comparaison.

## Suivi des phases

- Phase 0 : validée le 28/09/2026 (site en ligne, installé sur Android).
- Phase 1 : validée le 28/09/2026.
- Phase 2 : validée le 28/09/2026. Demi-vie gardée à 60 jours jusqu'au backtest (phase 6).
- Phase 3 : validée le 28/09/2026.
- Phase 4 (revue, collecte par prompt) : validée le 29/09/2026, sur une vraie journée de Ligue des
  nations (liste de 10 matchs puis 3 fiches importées, 0 bloc écarté). La vérification sur une
  journée de Ligue 1 (historique football-data.co.uk utilisé en conditions réelles) reste à faire au
  prochain week-end de championnat.
- Phase 5 : livrée le 29/09/2026, en attente de validation (pari test résolu automatiquement, alerte
  reçue sur le téléphone). Écarts : journal, résultats et réglages stockés sur l'appareil ; résultats
  collectés par une 4e demande (« résultats ») ; alertes ntfy.sh envoyées depuis le navigateur ; un pari
  buteur non trouvé dans la liste des buteurs reste à trancher à la main (le joueur a-t-il joué ?) ; les
  limites avertissent et demandent confirmation, sans bloquer. Alertes validées (reçues sur le
  téléphone) ; pari test à résoudre avec les résultats du 29/09.
- Phase 6 : livrée le 29/09/2026, en attente de validation (Brier sur une journée réelle : les matchs du
  29/09, prédits avant le coup d'envoi puis leurs résultats importés). Archive des prédictions sur
  l'appareil (jamais après le coup d'envoi) ; backtest walk-forward sur 7 029 matchs réels, relancé
  chaque nuit. Décidé le 29/09/2026 : réglages 240 j / prior 20, et rappel du résultat du backtest sous
  chaque « PARIER » (fiche match et Top picks).
- Phase 7 (tout simplifier) : ajoutée au cahier des charges le 29/09/2026, à concevoir (maquette à
  valider avant de coder).

## Phases

| Phase | Contenu | Validation |
|---|---|---|
| 0 | Plan, repo, Vite, PWA, workflow Pages | Accueil en ligne sur Pages, installable |
| 1 | Design, schéma JSON, 6 matchs DÉMO, Accueil + Fiche match sans calcul | Aucun défilement horizontal à 360 px, ouverture hors ligne |
| 2 | Modèle + tests | Grille = 100 %, Over décroissants, Over + Under = 100 %, tests verts |
| 3 | Graphiques + générateur de prompt (Copier, Exporter .json) | Aucun `{{…}}` restant, JSON valide |
| 4 | Collecte par prompt (Ligue 1 d'abord, puis palier 1, puis palier 2) + historiques football-data.co.uk | Chaque fiche importée respecte le schéma, manquants à null, rapport d'import clair |
| 5 | Top picks, Journal, alertes ntfy.sh (depuis le navigateur) | Résolution d'un pari test, alerte reçue |
| 6 | Archivage local des prédictions, backtest, page Fiabilité | Brier sur une journée réelle ; < 100 prédictions : « échantillon insuffisant » |
| 7 | Tout simplifier : beaucoup moins de cases, un site plus dynamique (le match, les infos) | Tu trouves le site simple à l'usage ; à 360 px, l'essentiel d'un match se lit sans faire défiler ; toutes les règles ci-dessus tiennent toujours |

## Phase 7 — Tout simplifier (demande du 29/09/2026)

> « Tout simplifier, vraiment simplifier. Il y a vraiment trop de cases. Ça doit être plus dynamique :
> le match, les infos. »

Objectifs :
- **Moins de cases** : une information n'apparaît qu'une fois, à l'endroit où elle sert. Le détail
  (tableaux complets, méthode, sources) reste accessible, mais replié.
- **Plus dynamique** : on explore un match en touchant (choisir une ligne de buts, changer d'onglet),
  les chiffres se mettent à jour sur place au lieu d'être tous empilés.
- **L'essentiel d'abord** : pour chaque match, le verdict et deux ou trois chiffres clés, lisibles d'un
  coup d'œil sur téléphone.
- Les règles 1 à 7 restent intactes (N/D, DÉMO, info-bulle sur chaque %, 18+, non fiable, PASSER).

La maquette est présentée et validée avant tout changement de code.

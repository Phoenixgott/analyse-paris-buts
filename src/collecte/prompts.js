// Prompts de collecte : le site les génère, tu les colles dans une conversation Claude AVEC la
// recherche web, puis tu recolles la réponse (un bloc JSON) dans le site, qui la vérifie.
import { PAR_ID } from './competitions.js';
import { dateLongue, heure } from '../format.js';

const ENTETE = `Tu es un assistant de collecte de données football. Utilise la recherche web. N'invente rien : une donnée que tu n'as pas trouvée vaut null. Ne donne aucun avis ni pronostic, uniquement des données.`;

const SUITE = `Si ta réponse risque d'être coupée, termine l'élément en cours, ferme correctement le bloc JSON, puis écris SUITE DISPONIBLE sur la dernière ligne ; je répondrai « continue » et tu enverras la suite dans un nouveau bloc JSON du même type.`;

function listeNoms(noms) {
  return noms?.length ? noms.join(', ') : null;
}

/**
 * Étape 1 — liste des matchs d'une journée.
 * competitions : [{ id, noms_equipes? }] ; options : { autres, maxAutres }.
 */
export function promptListe(date, competitions, { autres = false, maxAutres = 10 } = {}) {
  const lignes = competitions.map(({ id, noms_equipes: noms }) => {
    const c = PAR_ID.get(id);
    const n = listeNoms(noms);
    return `- ${c.nom} (${c.pays}) — competition_id « ${c.id} »${n ? ` — noms d'équipes à écrire exactement ainsi : ${n}` : ''}`;
  });
  if (autres) lignes.push(`- Autres compétitions de football (tous pays, hommes et femmes) : les ${maxAutres} matchs les plus suivis au maximum — competition_id « autre », avec le nom, le pays et la catégorie de la compétition.`);

  return `${ENTETE}

MISSION : liste tous les matchs joués le ${dateLongue(date)} (${date}), entre 00:00 et 23:59 heure de Paris, dans ces compétitions :
${lignes.join('\n')}

RÈGLES
1. Un match n'apparaît que si tu l'as vu sur une source fiable (site officiel de la compétition ou du club, L'Équipe, BBC Sport, ESPN, Flashscore, SofaScore…) : indique son URL dans « source ».
2. Heure du coup d'envoi convertie en UTC, format AAAA-MM-JJTHH:MM:SSZ (heure de Paris = UTC+2 de fin mars à fin octobre, UTC+1 le reste de l'année).
3. Noms d'équipes : ceux de la liste de la compétition quand elle est fournie, à l'identique ; sinon le nom officiel courant.
4. Stade ou ville inconnus : null. Rien de deviné.
5. Une compétition sans match ce jour-là n'apparaît pas.
6. categorie : « H » (hommes), « F » (femmes) ou « INT » (sélections nationales).

RÉPONSE : uniquement un bloc \`\`\`json de cette forme :
{"type":"liste-matchs","date":"${date}","matchs":[{"competition_id":"…","competition":"nom","pays":"…","categorie":"H","domicile":"…","exterieur":"…","coup_envoi":"AAAA-MM-JJTHH:MM:SSZ","stade":{"nom":"…","ville":"…"},"source":"https://…"}]}
${SUITE}`;
}

const FORMAT_FICHE = `{
  "domicile": "…", "exterieur": "…", "competition_id": "…", "competition": "nom de la compétition", "coup_envoi": "AAAA-MM-JJTHH:MM:SSZ",
  "stade": {"nom": "…", "ville": "…"} ou null,
  "enjeu": "phrase courte et factuelle (places au classement, derby, qualification…)" ou null,
  "equipes": {"domicile": EQUIPE, "exterieur": EQUIPE},
  "h2h": [{"date": "AAAA-MM-JJ", "score": "2-1", "score_mt": "1-0"}],
  "arbitre": {"nom": "…", "cartons_moy": 4.1, "penaltys_moy": 0.3} ou null,
  "meteo": {"temperature": 14, "vent": 12, "pluie": 0} ou null,
  "buteurs": [{"nom": "…", "equipe": "D", "buts_par_90": 0.45, "tirs_par_90": 2.8, "tireur_penalty": true, "coups_de_pied_arretes": false, "minutes_prevues": 85}],
  "cotes": {
    "total_buts": {"over_0_5": COTE, "over_1_5": COTE, "over_2_5": COTE, "over_3_5": COTE, "over_4_5": COTE, "over_5_5": COTE,
                   "under_0_5": COTE, "under_1_5": COTE, "under_2_5": COTE, "under_3_5": COTE, "under_4_5": COTE, "under_5_5": COTE},
    "mt_over_0_5": COTE, "mt_over_1_5": COTE,
    "buteur": [{"nom": "…", "equipe": "D", "cote": COTE}]
  } ou null,
  "sources": {"classement": "URL", "forme": "URL", "stats": "URL", "h2h": "URL", "effectifs": "URL", "buteurs": "URL", "cotes": "URL", "arbitre": "URL", "meteo": "URL", "elo": "URL"}
}
EQUIPE = {
  "nom": "…", "elo": 1712 ou null,
  "classement": {"rang": 3, "points": 16, "joues": 7, "bp": 15, "bc": 6} ou null,
  "forme": [{"date": "AAAA-MM-JJ", "adversaire": "…", "lieu": "D", "score": "2-1", "score_mt": "1-0"}],
  "stats": {"buts_marques_moy": 1.8, "buts_encaisses_moy": 0.9, "buts_mt_marques_moy": 0.8, "buts_mt_encaisses_moy": 0.4,
            "xg_moy": 1.7, "tirs_cadres_moy": 5.2, "pct_over15": 86, "pct_over25": 57, "pct_over35": 29, "pct_but_avant_30": 43,
            "buts_par_tranche": {"matchs": 7, "marques": [1, 2, 3, 2, 3, 4], "encaisses": [0, 1, 1, 2, 1, 1]}} ou null,
  "absents": [{"nom": "…", "raison": "Blessure (genou)"}],
  "compo_probable": ["11 noms"] ou null
}
COTE = {"meilleure": 1.85, "bookmaker": "nom du bookmaker"} ou null`;

/** Étape 2 — fiches complètes de 1 à 3 matchs. matchs : [{ domicile, exterieur, competition_id, competition, pays, coup_envoi, noms_equipes? }] */
export function promptFiches(matchs) {
  const liste = matchs
    .map((m, i) => {
      const nom = PAR_ID.get(m.competition_id)?.nom ?? m.competition ?? 'compétition inconnue';
      const n = listeNoms(m.noms_equipes);
      return `${i + 1}. ${m.domicile} vs ${m.exterieur} — ${nom}${m.pays ? ` (${m.pays})` : ''} — competition_id « ${m.competition_id} » — coup d'envoi ${m.coup_envoi} (${heure(m.coup_envoi)} heure de Paris)${n ? `\n   Noms d'équipes de cette compétition, à écrire exactement ainsi (y compris pour les adversaires de « forme ») : ${n}` : ''}`;
    })
    .join('\n');

  return `${ENTETE}

MATCHS À DOCUMENTER
${liste}

POUR CHAQUE MATCH, remplis exactement ce format (JSON) :
${FORMAT_FICHE}

SIGNIFICATION DES CHAMPS
- forme : les 10 derniers matchs officiels de l'équipe, le plus récent d'abord ; lieu « D » = à domicile, « E » = à l'extérieur ; score et score_mt (mi-temps) vus de l'équipe : buts pour-buts contre.
- h2h : les 10 dernières confrontations directes au maximum, la plus récente d'abord ; score vu du club qui reçoit AUJOURD'HUI, même si le match s'est joué chez l'autre.
- stats : saison en cours, moyennes PAR MATCH ; pct_* en pourcentage de 0 à 100 (pct_over25 = part des matchs de l'équipe finis avec 3 buts ou plus) ; buts_par_tranche = buts marqués et encaissés par tranche de 15 minutes (0-15, 16-30, 31-45, 46-60, 61-75, 76-90).
- absents : [] si la source n'annonce aucun absent, null si tu n'as pas trouvé l'information.
- buteurs : 3 à 5 joueurs par équipe, les plus dangereux ; equipe « D » ou « E » ; minutes_prevues = minutes probables de jeu.
- elo : note de clubelo.com si elle existe.
- meteo : prévision pour l'heure du match (°C, km/h, mm/h).
- cotes : cotes décimales actuelles ; « meilleure » = la plus haute trouvée sur un comparateur (Oddsportal, Oddschecker…) ou chez un bookmaker.

RÈGLES
1. Chaque bloc rempli doit avoir son URL dans « sources » (classement, forme, stats, h2h, effectifs pour absents et compo, buteurs, cotes, arbitre, meteo, elo) ; si un bloc vient de plusieurs pages, mets la liste de leurs URL : ["URL 1", "URL 2"]. Un bloc sans source sera ignoré par le site.
2. Recopie ce que publient les sources (SofaScore, FBref, FootyStats, Transfermarkt, WhoScored, site officiel…) ; ne reconstitue pas une statistique de mémoire. Une stat non publiée vaut null.
3. Ne recopie jamais une cote que tu n'as pas vue.
4. Dates AAAA-MM-JJ, heures en UTC, nombres décimaux avec un point.
5. Ne calcule ni probabilité, ni value, ni qualité : le site s'en charge.

RÉPONSE : uniquement un bloc \`\`\`json de cette forme : {"type":"fiches-matchs","matchs":[ …un objet par match… ]}
${SUITE}`;
}

/** Étape 4 — résultats après le match (pour résoudre les paris du journal). */
export function promptResultats(matchs) {
  const liste = matchs.map((m, i) => `${i + 1}. ${m.domicile} vs ${m.exterieur} — coup d'envoi ${m.coup_envoi} (${heure(m.coup_envoi)} heure de Paris)`).join('\n');
  return `${ENTETE}

MATCHS DONT JE VEUX LE RÉSULTAT DÉFINITIF
${liste}

Pour chaque match :
{"domicile": "…", "exterieur": "…", "coup_envoi": "AAAA-MM-JJTHH:MM:SSZ",
 "statut": "termine" | "reporte" | "abandonne" | null,
 "score": "2-1", "score_mt": "1-0",
 "buteurs": [{"nom": "…", "equipe": "D", "minute": 23, "csc": false}],
 "source": "URL"}

RÈGLES
1. score = score à la fin du temps réglementaire (90 minutes + arrêts de jeu), SANS prolongation ni tirs au but ; score_mt = score à la mi-temps ; les deux vus du club qui reçoit (domicile-extérieur).
2. buteurs : tous les buts du match ; equipe « D » ou « E » = équipe du joueur ; « csc »: true pour un but contre son camp (il compte pour l'adversaire).
3. Match pas encore terminé ou résultat introuvable : statut null et score null. N'invente rien.
4. source obligatoire (page du match sur un site fiable).

RÉPONSE : uniquement un bloc \`\`\`json de cette forme : {"type":"resultats-matchs","matchs":[ … ]}
${SUITE}`;
}

/** Étape 3 — mise à jour avant le match : cotes, absents, compositions, météo. */
export function promptMiseAJour(matchs) {
  const liste = matchs.map((m, i) => `${i + 1}. ${m.domicile} vs ${m.exterieur} — coup d'envoi ${m.coup_envoi} (${heure(m.coup_envoi)} heure de Paris)`).join('\n');
  return `${ENTETE}

MATCHS À METTRE À JOUR (juste avant le coup d'envoi)
${liste}

Pour chaque match, donne uniquement les informations les plus récentes :
{"domicile": "…", "exterieur": "…", "coup_envoi": "AAAA-MM-JJTHH:MM:SSZ",
 "cotes": {"total_buts": {"over_0_5": COTE, …, "over_5_5": COTE, "under_0_5": COTE, …, "under_5_5": COTE}, "mt_over_0_5": COTE, "mt_over_1_5": COTE, "buteur": [{"nom": "…", "equipe": "D", "cote": COTE}]} ou null,
 "absents": {"domicile": [{"nom": "…", "raison": "…"}], "exterieur": [ … ]},
 "compo_probable": {"domicile": ["11 noms"] ou null, "exterieur": ["11 noms"] ou null},
 "meteo": {"temperature": 14, "vent": 12, "pluie": 0} ou null,
 "sources": {"cotes": "URL", "effectifs": "URL", "meteo": "URL"}}
COTE = {"meilleure": 1.85, "bookmaker": "nom du bookmaker"} ou null

RÈGLES
1. Chaque bloc rempli doit avoir son URL dans « sources » ; un bloc sans source sera ignoré.
2. Compositions officielles si elles sont publiées, sinon compositions probables d'une source sérieuse ; null si rien.
3. absents : [] si aucun absent annoncé, null si information introuvable.
4. Ne recopie jamais une cote que tu n'as pas vue.

RÉPONSE : uniquement un bloc \`\`\`json de cette forme : {"type":"maj-matchs","matchs":[ … ]}
${SUITE}`;
}

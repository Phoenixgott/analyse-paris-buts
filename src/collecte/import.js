// Import des réponses de l'IA (collecte par prompt). Fonctions pures : la réponse collée + les données
// déjà connues entrent, des objets au schéma du match + un rapport sortent. Principe : se méfier.
//   - bloc sans URL de source → ignoré ; valeur hors bornes → null ; date de forme/h2h pas antérieure
//     au match → écartée ; cotes dans le mauvais ordre ou à marge impossible → écartées ;
//   - une donnée déjà connue n'est jamais effacée par un null ; la cote d'ouverture est conservée ;
//   - le résultat final doit respecter le schéma, sinon le match est refusé (et le rapport dit pourquoi).
import SCHEMA from '../../schema/match.schema.json';
import { valider } from '../../schema/valider.js';
import { calculerQualite } from '../../schema/qualite.js';
import { ID_PALIER_2, PAR_ID } from './competitions.js';
import { nomCanonique, normaliserTexte } from './noms.js';
import { jourParis } from '../format.js';

export const VERSION_SCHEMA = '1.1.0';
const CLES_SOURCES = ['classement', 'forme', 'stats', 'h2h', 'effectifs', 'buteurs', 'cotes', 'arbitre', 'meteo', 'elo'];
const LIGNES = [0, 1, 2, 3, 4, 5];

// --------------------------------------------------------------------------------------------
// Extraction du JSON dans la réponse
// --------------------------------------------------------------------------------------------
export function extraireReponse(texte) {
  const brut = String(texte ?? '');
  const blocs = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(brut))) blocs.push(m[1]);
  if (!blocs.length) {
    const i = brut.indexOf('{');
    const j = brut.lastIndexOf('}');
    if (i >= 0 && j > i) blocs.push(brut.slice(i, j + 1));
  }
  const objets = [];
  const erreurs = [];
  for (const b of blocs) {
    const t = b.trim();
    try {
      objets.push(JSON.parse(t));
    } catch {
      try {
        objets.push(JSON.parse(t.replace(/,\s*([}\]])/g, '$1'))); // virgule finale oubliée par l'IA
      } catch (e) {
        erreurs.push(`Bloc JSON illisible (${e.message}). Recopie toute la réponse, y compris la fin du bloc.`);
      }
    }
  }
  if (!blocs.length) erreurs.push('Aucun bloc JSON trouvé dans le texte collé.');
  return { objets, erreurs, suite: /SUITE DISPONIBLE/i.test(brut) };
}

// --------------------------------------------------------------------------------------------
// Petits contrôles de valeurs
// --------------------------------------------------------------------------------------------
export function nombre(v, min, max) {
  let n = v;
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    n = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
}
const entier = (v, min, max) => {
  const n = nombre(v, min, max);
  return n != null && Number.isInteger(n) ? n : null;
};
const texte = (v, max = 160) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const booleen = (v) => (v === true || v === false ? v : null);
const lieuDE = (v) => (v === 'D' || v === 'E' ? v : null);
const jour = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null);
// Une source = une URL, ou une liste d'URL (la forme de deux équipes vient souvent de plusieurs pages).
const urlSimple = (v) => (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null);
const url = (v) => {
  const liste = (Array.isArray(v) ? v : [v]).map(urlSimple).filter(Boolean);
  return liste.length ? liste.join(' ; ') : null;
};
const r2 = (x) => Math.round(x * 100) / 100;

export function score(v) {
  if (typeof v !== 'string') return null;
  const m = /^\s*(\d{1,2})\s*[-:–]\s*(\d{1,2})\s*$/.exec(v);
  return m ? `${Number(m[1])}-${Number(m[2])}` : null;
}

/** Instant avec fuseau explicite (Z ou ±hh:mm) → UTC « …Z » ; sans fuseau : refusé (ambigu). */
export function instantUtc(v) {
  if (typeof v !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(v.trim())) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export const slug = (s) => normaliserTexte(s).replace(/\s+/g, '-').slice(0, 36) || 'x';
export const idMatch = (coupEnvoi, dom, ext) => `${jourParis(new Date(coupEnvoi))}-${slug(dom)}-${slug(ext)}`;

const toutNull = (obj) => Object.values(obj).every((v) => v == null);

// --------------------------------------------------------------------------------------------
// Compétition et noms
// --------------------------------------------------------------------------------------------
function competitionDe(brut) {
  const c = PAR_ID.get(brut.competition_id);
  if (c) return { id: c.id, nom: c.nom, pays: c.pays, categorie: c.categorie, palier: 1 };
  const nom = texte(brut.competition, 80);
  const categorie = ['H', 'F', 'INT'].includes(brut.categorie) ? brut.categorie : 'H';
  return { id: nom ? `${ID_PALIER_2}-${slug(nom)}` : ID_PALIER_2, nom: nom ?? 'Compétition inconnue', pays: texte(brut.pays, 60), categorie, palier: 2 };
}

function canoniser(nom, liste, rapport, etiquette) {
  const n = texte(nom, 80);
  if (!n || !liste?.length) return n;
  const c = nomCanonique(n, liste);
  if (!c) {
    rapport.avertissements.push({ match: etiquette, message: `« ${n} » introuvable dans l'historique de la ligue : le modèle s'appuiera sur sa forme seulement.` });
    return n;
  }
  if (!c.exact) rapport.avertissements.push({ match: etiquette, message: `« ${n} » rapproché de « ${c.nom} » (nom de l'historique).` });
  return c.nom;
}

// --------------------------------------------------------------------------------------------
// Blocs d'une fiche
// --------------------------------------------------------------------------------------------
function cote(brut, ancienne) {
  if (brut == null || typeof brut !== 'object') return null;
  const meilleure = nombre(brut.meilleure, 1.01, 100);
  if (meilleure == null) return null;
  const ouverture = ancienne?.ouverture ?? ancienne?.meilleure ?? meilleure;
  return { meilleure, bookmaker: texte(brut.bookmaker, 40), ouverture, mouvement: r2(meilleure - ouverture) };
}

function cotesBloc(brut, ancien, rapport, etiquette) {
  if (!brut || typeof brut !== 'object') return null;
  let total = null;
  if (brut.total_buts && typeof brut.total_buts === 'object') {
    total = {};
    for (const sens of ['over', 'under']) for (const k of LIGNES) total[`${sens}_${k}_5`] = cote(brut.total_buts[`${sens}_${k}_5`], ancien?.total_buts?.[`${sens}_${k}_5`]);
    // Marge impossible sur une ligne (Plus + Moins) : la paire est écartée.
    for (const k of LIGNES) {
      const o = total[`over_${k}_5`]?.meilleure;
      const u = total[`under_${k}_5`]?.meilleure;
      if (o && u) {
        const s = 1 / o + 1 / u;
        if (s < 0.97 || s > 1.25) {
          total[`over_${k}_5`] = null;
          total[`under_${k}_5`] = null;
          rapport.ecartes.push({ match: etiquette, raison: `Cotes Plus/Moins ${k},5 incohérentes entre elles (marge ${Math.round((s - 1) * 100)} %).` });
        }
      }
    }
    // Plus de k,5 doit coter de plus en plus haut ; Moins de k,5 de plus en plus bas.
    const ordre = (sens, croissant) => {
      const v = LIGNES.map((k) => total[`${sens}_${k}_5`]?.meilleure).filter((x) => x != null);
      return v.every((x, i) => i === 0 || (croissant ? x >= v[i - 1] : x <= v[i - 1]));
    };
    if (!ordre('over', true) || !ordre('under', false)) {
      rapport.ecartes.push({ match: etiquette, raison: 'Cotes du total de buts dans un ordre impossible : toutes écartées.' });
      total = null;
    } else if (toutNull(total)) total = null;
  }
  let mt05 = cote(brut.mt_over_0_5, ancien?.mt_over_0_5);
  let mt15 = cote(brut.mt_over_1_5, ancien?.mt_over_1_5);
  if (mt05 && total?.over_0_5 && mt05.meilleure < total.over_0_5.meilleure) {
    rapport.ecartes.push({ match: etiquette, raison: 'Cote « +0,5 but en 1re MT » plus basse que « +0,5 but » sur le match : écartée.' });
    mt05 = null;
  }
  if (mt05 && mt15 && mt15.meilleure < mt05.meilleure) {
    rapport.ecartes.push({ match: etiquette, raison: 'Cote « +1,5 but en 1re MT » plus basse que « +0,5 » : écartée.' });
    mt15 = null;
  }
  const anciensButeurs = new Map((ancien?.buteur ?? []).map((b) => [normaliserTexte(b.nom), b.cote]));
  const buteur = Array.isArray(brut.buteur)
    ? brut.buteur
        .map((b) => ({ nom: texte(b?.nom, 60), equipe: lieuDE(b?.equipe), cote: cote(b?.cote, anciensButeurs.get(normaliserTexte(b?.nom))) }))
        .filter((b) => b.nom && b.cote)
    : null;
  const bloc = { total_buts: total, mt_over_0_5: mt05, mt_over_1_5: mt15, buteur: buteur?.length ? buteur : null };
  return toutNull(bloc) ? null : bloc;
}

function forme(brut, jourMatch, nomsLigue, rapport, etiquette) {
  if (!Array.isArray(brut)) return null;
  const valides = [];
  let rejetes = 0;
  for (const f of brut) {
    const d = jour(f?.date);
    const s = score(f?.score);
    const lieu = lieuDE(f?.lieu);
    if (!d || d >= jourMatch || !s || !lieu) {
      rejetes++;
      continue;
    }
    let mt = score(f?.score_mt);
    if (mt) {
      const [a, b] = s.split('-').map(Number);
      const [c, e] = mt.split('-').map(Number);
      if (c > a || e > b) mt = null; // plus de buts à la pause qu'à la fin : incohérent
    }
    const adv = texte(f?.adversaire, 80);
    const canon = adv && nomsLigue?.length ? nomCanonique(adv, nomsLigue) : null;
    valides.push({ date: d, adversaire: canon?.nom ?? adv, lieu, score: s, score_mt: mt });
  }
  if (rejetes) rapport.ecartes.push({ match: etiquette, raison: `${rejetes} match(s) de forme écarté(s) (date absente ou pas antérieure au match, score ou lieu illisible).` });
  valides.sort((a, b) => b.date.localeCompare(a.date));
  return valides.length ? valides.slice(0, 10) : null;
}

function h2hBloc(brut, jourMatch, rapport, etiquette) {
  if (!Array.isArray(brut)) return null;
  const v = brut
    .map((h) => ({ date: jour(h?.date), score: score(h?.score), score_mt: score(h?.score_mt) }))
    .filter((h) => h.date && h.date < jourMatch && h.score);
  if (v.length < brut.length) rapport.ecartes.push({ match: etiquette, raison: `${brut.length - v.length} confrontation(s) écartée(s) (date ou score illisible, ou pas antérieure au match).` });
  v.sort((a, b) => b.date.localeCompare(a.date));
  return v.length ? v.slice(0, 10) : null;
}

function statsBloc(brut, rapport, etiquette) {
  if (!brut || typeof brut !== 'object') return null;
  const moy = (k) => nombre(brut[k], 0, 10);
  const pct = (k) => nombre(brut[k], 0, 100);
  const s = {
    buts_marques_moy: moy('buts_marques_moy'),
    buts_encaisses_moy: moy('buts_encaisses_moy'),
    buts_mt_marques_moy: moy('buts_mt_marques_moy'),
    buts_mt_encaisses_moy: moy('buts_mt_encaisses_moy'),
    xg_moy: moy('xg_moy'),
    tirs_cadres_moy: nombre(brut.tirs_cadres_moy, 0, 30),
    pct_over15: pct('pct_over15'),
    pct_over25: pct('pct_over25'),
    pct_over35: pct('pct_over35'),
    pct_but_avant_30: pct('pct_but_avant_30'),
    buts_par_tranche: null,
  };
  if (s.pct_over15 != null && s.pct_over25 != null && s.pct_over25 > s.pct_over15) s.pct_over25 = null;
  if (s.pct_over25 != null && s.pct_over35 != null && s.pct_over35 > s.pct_over25) s.pct_over35 = null;
  const t = brut.buts_par_tranche;
  if (t && typeof t === 'object') {
    const six = (a) => (Array.isArray(a) && a.length === 6 && a.every((x) => entier(x, 0, 200) != null) ? a.map(Number) : null);
    const tr = { matchs: entier(t.matchs, 1, 80), marques: six(t.marques), encaisses: six(t.encaisses) };
    const coherent = (liste, moyenne) => liste == null || moyenne == null || tr.matchs == null || Math.abs(liste.reduce((a, b) => a + b, 0) / tr.matchs - moyenne) <= 0.35;
    if (tr.matchs && (tr.marques || tr.encaisses) && coherent(tr.marques, s.buts_marques_moy) && coherent(tr.encaisses, s.buts_encaisses_moy)) s.buts_par_tranche = tr;
    else rapport.ecartes.push({ match: etiquette, raison: 'Buts par tranche de 15 min incomplets ou incohérents avec les moyennes : écartés.' });
  }
  return toutNull(s) ? null : s;
}

function classementBloc(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const c = { rang: entier(brut.rang, 1, 40), points: entier(brut.points, 0, 200), joues: entier(brut.joues, 0, 60), bp: entier(brut.bp, 0, 300), bc: entier(brut.bc, 0, 300) };
  if (c.points != null && c.joues != null && c.points > 3 * c.joues) return null; // impossible
  return toutNull(c) ? null : c;
}

// --------------------------------------------------------------------------------------------
// Fiche complète
// --------------------------------------------------------------------------------------------
function construireFiche(brut, ctx, rapport) {
  const coupEnvoi = instantUtc(brut?.coup_envoi);
  const competition = competitionDe(brut ?? {});
  const nomsLigue = ctx.noms?.get(competition.id) ?? null;
  const etiquetteBrute = `${texte(brut?.domicile, 60) ?? '?'} – ${texte(brut?.exterieur, 60) ?? '?'}`;
  if (!coupEnvoi || !texte(brut?.domicile) || !texte(brut?.exterieur)) {
    rapport.ecartes.push({ match: etiquetteBrute, raison: 'Équipes ou heure du coup d’envoi (UTC avec « Z ») manquantes : fiche refusée.' });
    return null;
  }
  const dom = canoniser(brut.domicile, nomsLigue, rapport, etiquetteBrute);
  const ext = canoniser(brut.exterieur, nomsLigue, rapport, etiquetteBrute);
  const etiquette = `${dom} – ${ext}`;
  const jourMatch = coupEnvoi.slice(0, 10);

  const sources = {};
  for (const k of CLES_SOURCES) sources[k] = url(brut.sources?.[k]);
  const sansSource = [];
  const avecSource = (cle, valeur) => {
    if (valeur == null) return null;
    if (sources[cle]) return valeur;
    sansSource.push(cle);
    return null;
  };

  const equipe = (b, nom) => {
    const f = avecSource('forme', forme(b?.forme, jourMatch, nomsLigue, rapport, etiquette));
    const absents = Array.isArray(b?.absents) ? b.absents.map((a) => ({ nom: texte(a?.nom, 60), raison: texte(a?.raison, 60) })).filter((a) => a.nom) : null;
    const compo = Array.isArray(b?.compo_probable) ? b.compo_probable.map((n) => texte(n, 60)).filter(Boolean).slice(0, 11) : null;
    return {
      id: null,
      nom,
      elo: avecSource('elo', nombre(b?.elo, 500, 2500)),
      classement: avecSource('classement', classementBloc(b?.classement)),
      forme: f,
      stats: avecSource('stats', statsBloc(b?.stats, rapport, etiquette)),
      // Calculé par le site depuis la forme (date du dernier match), pas recopié.
      jours_repos: f ? Math.round((Date.parse(`${jourMatch}T12:00:00Z`) - Date.parse(`${f[0].date}T12:00:00Z`)) / 86400000) : null,
      absents: avecSource('effectifs', absents),
      compo_probable: avecSource('effectifs', compo?.length ? compo : null),
    };
  };

  const arbitre = brut.arbitre && typeof brut.arbitre === 'object'
    ? { nom: texte(brut.arbitre.nom, 60), cartons_moy: nombre(brut.arbitre.cartons_moy, 0, 15), penaltys_moy: nombre(brut.arbitre.penaltys_moy, 0, 3) }
    : null;
  const meteo = brut.meteo && typeof brut.meteo === 'object'
    ? { temperature: nombre(brut.meteo.temperature, -30, 50), vent: nombre(brut.meteo.vent, 0, 200), pluie: nombre(brut.meteo.pluie, 0, 100) }
    : null;
  const buteurs = Array.isArray(brut.buteurs)
    ? brut.buteurs
        .map((b) => ({
          nom: texte(b?.nom, 60),
          equipe: lieuDE(b?.equipe),
          buts_par_90: nombre(b?.buts_par_90, 0, 3),
          tirs_par_90: nombre(b?.tirs_par_90, 0, 15),
          tireur_penalty: booleen(b?.tireur_penalty),
          coups_de_pied_arretes: booleen(b?.coups_de_pied_arretes),
          minutes_prevues: entier(b?.minutes_prevues, 0, 120),
        }))
        .filter((b) => b.nom && b.equipe)
    : null;

  const id = idMatch(coupEnvoi, dom, ext);
  const ancien = ctx.matchs?.get(id) ?? null;
  // Palier 2 : la compétition peut ne pas être répétée dans la fiche ; on la reprend de la liste du jour.
  const annonce = ctx.annonces?.get(id);
  const competitionFinale = competition.palier === 2 && !texte(brut.competition) && annonce ? annonce.competition : competition;
  const stade = brut.stade && typeof brut.stade === 'object' ? { nom: texte(brut.stade.nom, 80), ville: texte(brut.stade.ville, 60) } : null;

  const match = {
    schema_version: VERSION_SCHEMA,
    demo: false,
    match_id: id,
    generated_at: ctx.maintenant,
    competition: competitionFinale,
    coup_envoi: coupEnvoi,
    stade: stade && !toutNull(stade) ? stade : null,
    enjeu: texte(brut.enjeu, 200),
    equipes: { domicile: equipe(brut.equipes?.domicile, dom), exterieur: equipe(brut.equipes?.exterieur, ext) },
    h2h: avecSource('h2h', h2hBloc(brut.h2h, jourMatch, rapport, etiquette)),
    arbitre: avecSource('arbitre', arbitre && !toutNull(arbitre) ? arbitre : null),
    meteo: avecSource('meteo', meteo && !toutNull(meteo) ? meteo : null),
    buteurs: avecSource('buteurs', buteurs?.length ? buteurs : null),
    cotes: avecSource('cotes', cotesBloc(brut.cotes, ancien?.cotes, rapport, etiquette)),
    qualite_donnees: 0,
    sources: CLES_SOURCES.filter((k) => sources[k]).map((k) => ({ nom: `${k} : ${sources[k]}`, recupere_le: ctx.maintenant })),
  };
  if (sansSource.length) {
    rapport.ecartes.push({ match: etiquette, raison: `Bloc(s) sans URL de source, ignoré(s) : ${[...new Set(sansSource)].join(', ')}.` });
  }
  return { match: ancien ? fusionnerMatch(ancien, match) : match, nouveau: !ancien };
}

const BLOCS_MATCH = ['stade', 'enjeu', 'h2h', 'arbitre', 'meteo', 'buteurs'];
const BLOCS_EQUIPE = ['elo', 'classement', 'forme', 'stats', 'jours_repos', 'absents', 'compo_probable'];

/** Cotes fusionnées par sous-bloc : des cotes de mi-temps seules n'effacent pas celles du total. */
export function fusionnerCotes(ancien, nouveau) {
  if (!nouveau) return ancien ? structuredClone(ancien) : null;
  if (!ancien) return structuredClone(nouveau);
  const c = {};
  for (const k of ['total_buts', 'mt_over_0_5', 'mt_over_1_5', 'buteur']) c[k] = structuredClone(nouveau[k] ?? ancien[k] ?? null);
  return c;
}

/** Le nouveau remplace l'ancien bloc par bloc ; un bloc absent (null) du nouveau garde l'ancien. */
export function fusionnerMatch(ancien, nouveau) {
  const m = structuredClone(nouveau);
  for (const k of BLOCS_MATCH) if (m[k] == null && ancien[k] != null) m[k] = structuredClone(ancien[k]);
  m.cotes = fusionnerCotes(ancien.cotes, nouveau.cotes);
  for (const cote of ['domicile', 'exterieur']) {
    for (const k of BLOCS_EQUIPE) if (m.equipes[cote][k] == null && ancien.equipes[cote][k] != null) m.equipes[cote][k] = structuredClone(ancien.equipes[cote][k]);
  }
  const vus = new Set(m.sources.map((s) => s.nom.split(' : ')[0]));
  m.sources = [...m.sources, ...ancien.sources.filter((s) => !vus.has(s.nom.split(' : ')[0]))];
  return m;
}

// --------------------------------------------------------------------------------------------
// Types de réponse
// --------------------------------------------------------------------------------------------
function importerListe(obj, ctx, rapport) {
  const annonces = [];
  const date = jour(obj.date) ?? ctx.date ?? null;
  for (const brut of Array.isArray(obj.matchs) ? obj.matchs : []) {
    const coupEnvoi = instantUtc(brut?.coup_envoi);
    const competition = competitionDe(brut ?? {});
    const etiquette = `${texte(brut?.domicile, 60) ?? '?'} – ${texte(brut?.exterieur, 60) ?? '?'}`;
    if (!coupEnvoi || !texte(brut?.domicile) || !texte(brut?.exterieur)) {
      rapport.ecartes.push({ match: etiquette, raison: 'Équipes ou heure (UTC avec « Z ») manquantes.' });
      continue;
    }
    if (!url(brut.source)) {
      rapport.ecartes.push({ match: etiquette, raison: 'Aucune URL de source : match non retenu (il pourrait être inventé).' });
      continue;
    }
    if (date && jourParis(new Date(coupEnvoi)) !== date) {
      rapport.ecartes.push({ match: etiquette, raison: `Joué le ${jourParis(new Date(coupEnvoi))} (heure de Paris), pas le ${date}.` });
      continue;
    }
    const noms = ctx.noms?.get(competition.id) ?? null;
    const domicile = canoniser(brut.domicile, noms, rapport, etiquette);
    const exterieur = canoniser(brut.exterieur, noms, rapport, etiquette);
    const stade = brut.stade && typeof brut.stade === 'object' ? { nom: texte(brut.stade.nom, 80), ville: texte(brut.stade.ville, 60) } : null;
    annonces.push({
      id: idMatch(coupEnvoi, domicile, exterieur),
      date: jourParis(new Date(coupEnvoi)),
      competition,
      domicile,
      exterieur,
      coup_envoi: coupEnvoi,
      stade: stade && !toutNull(stade) ? stade : null,
      source: url(brut.source),
      importe_le: ctx.maintenant,
    });
  }
  return annonces;
}

function importerMiseAJour(obj, ctx, rapport) {
  const sortie = [];
  for (const brut of Array.isArray(obj.matchs) ? obj.matchs : []) {
    const coupEnvoi = instantUtc(brut?.coup_envoi);
    const etiquette = `${texte(brut?.domicile, 60) ?? '?'} – ${texte(brut?.exterieur, 60) ?? '?'}`;
    if (!coupEnvoi) {
      rapport.ecartes.push({ match: etiquette, raison: 'Heure du coup d’envoi (UTC avec « Z ») manquante.' });
      continue;
    }
    // Retrouve la fiche : même jour, mêmes équipes (noms rapprochés si besoin).
    const candidats = [...(ctx.matchs?.values() ?? [])].filter((m) => jourParis(new Date(m.coup_envoi)) === jourParis(new Date(coupEnvoi)));
    const ancien = candidats.find((m) => {
      const noms = [m.equipes.domicile.nom, m.equipes.exterieur.nom];
      return nomCanonique(brut.domicile, noms)?.nom === noms[0] && nomCanonique(brut.exterieur, noms)?.nom === noms[1];
    });
    if (!ancien) {
      rapport.ecartes.push({ match: etiquette, raison: 'Aucune fiche importée pour ce match : importe d’abord sa fiche complète (étape 2).' });
      continue;
    }
    const src = { cotes: url(brut.sources?.cotes), effectifs: url(brut.sources?.effectifs), meteo: url(brut.sources?.meteo) };
    const m = structuredClone(ancien);
    const changes = [];
    const utilisees = new Set();
    const cotes = cotesBloc(brut.cotes, ancien.cotes, rapport, etiquette);
    if (cotes && src.cotes) {
      m.cotes = fusionnerCotes(ancien.cotes, cotes);
      changes.push('cotes');
      utilisees.add('cotes');
    } else if (cotes) rapport.ecartes.push({ match: etiquette, raison: 'Cotes sans URL de source : ignorées.' });
    for (const cote of ['domicile', 'exterieur']) {
      const abs = brut.absents?.[cote];
      const compo = brut.compo_probable?.[cote];
      if ((Array.isArray(abs) || Array.isArray(compo)) && !src.effectifs) {
        rapport.ecartes.push({ match: etiquette, raison: `Absents/compo (${cote}) sans URL de source : ignorés.` });
        continue;
      }
      if (Array.isArray(abs)) {
        m.equipes[cote].absents = abs.map((a) => ({ nom: texte(a?.nom, 60), raison: texte(a?.raison, 60) })).filter((a) => a.nom);
        changes.push(`absents ${cote}`);
        utilisees.add('effectifs');
      }
      if (Array.isArray(compo) && compo.length) {
        m.equipes[cote].compo_probable = compo.map((n) => texte(n, 60)).filter(Boolean).slice(0, 11);
        changes.push(`compo ${cote}`);
        utilisees.add('effectifs');
      }
    }
    if (brut.meteo && typeof brut.meteo === 'object') {
      const me = { temperature: nombre(brut.meteo.temperature, -30, 50), vent: nombre(brut.meteo.vent, 0, 200), pluie: nombre(brut.meteo.pluie, 0, 100) };
      if (!toutNull(me) && src.meteo) {
        m.meteo = me;
        changes.push('météo');
        utilisees.add('meteo');
      }
    }
    m.generated_at = ctx.maintenant;
    for (const k of utilisees) {
      m.sources = [...m.sources.filter((s) => !s.nom.startsWith(`${k} : `)), { nom: `${k} : ${src[k]}`, recupere_le: ctx.maintenant }];
    }
    sortie.push({ match: m, changes });
  }
  return sortie;
}

/**
 * ctx : { maintenant (ISO « …Z »), date (AAAA-MM-JJ attendue pour une liste), noms (Map compétition → noms
 * de l'historique), matchs (Map match_id → fiche déjà connue), annonces (Map id → match de la liste du jour) }.
 * Renvoie { types, annonces, matchs, rapport }.
 */
export function importerReponse(texteColle, ctx) {
  const { objets, erreurs, suite } = extraireReponse(texteColle);
  const rapport = { erreurs: [...erreurs], ecartes: [], avertissements: [], nouveaux: [], mis_a_jour: [], annonces: 0, suite };
  const annonces = [];
  const matchs = new Map();
  const connus = new Map(ctx.matchs ?? []);
  const types = [];

  const finaliser = (m, nouveau, changes) => {
    m.qualite_donnees = calculerQualite(m);
    const erreursSchema = valider(m, SCHEMA);
    if (erreursSchema.length) {
      rapport.ecartes.push({ match: `${m.equipes.domicile.nom} – ${m.equipes.exterieur.nom}`, raison: `Fiche refusée, non conforme au schéma : ${erreursSchema.slice(0, 3).join(' ; ')}` });
      return;
    }
    matchs.set(m.match_id, m);
    connus.set(m.match_id, m);
    const libelle = `${m.equipes.domicile.nom} – ${m.equipes.exterieur.nom} (qualité ${m.qualite_donnees}/100${changes ? ` ; ${changes.join(', ')}` : ''})`;
    (nouveau ? rapport.nouveaux : rapport.mis_a_jour).push(libelle);
  };

  for (const obj of objets) {
    const type = obj?.type;
    types.push(type ?? 'inconnu');
    if (type === 'liste-matchs') {
      const a = importerListe(obj, ctx, rapport);
      annonces.push(...a);
      rapport.annonces += a.length;
    } else if (type === 'fiches-matchs') {
      for (const brut of Array.isArray(obj.matchs) ? obj.matchs : []) {
        const r = construireFiche(brut, { ...ctx, matchs: connus }, rapport);
        if (r) finaliser(r.match, r.nouveau);
      }
    } else if (type === 'maj-matchs') {
      for (const r of importerMiseAJour(obj, { ...ctx, matchs: connus }, rapport)) finaliser(r.match, false, r.changes.length ? r.changes : ['rien de nouveau']);
    } else {
      rapport.erreurs.push(`Type de réponse inconnu (« ${type ?? 'absent'} ») : attendu liste-matchs, fiches-matchs ou maj-matchs.`);
    }
  }
  return { types, annonces, matchs: [...matchs.values()], rapport };
}

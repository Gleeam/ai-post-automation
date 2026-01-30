/**
 * Service de recherche de tendances tech
 * Utilise Brave Search API, Serper.dev ou News API
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { getTrendSearchQueries, getRandomCategory, TOPICS } from '../config/topics.js';
import { shuffleArray } from '../utils/helpers.js';

/**
 * Rechercher des tendances via Brave Search API
 * Documentation: https://api-dashboard.search.brave.com/app/documentation
 * Gratuit: 2000 requêtes/mois
 */
export async function fetchBraveSearchTrends(query, options = {}) {
  const apiKey = process.env.BRAVE_API_KEY;
  
  if (!apiKey) {
    logger.debug('BRAVE_API_KEY non configurée');
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      count: options.limit || 10,
      search_lang: options.language || 'fr',
      freshness: 'pm', // Past month
      text_decorations: 'false',
      spellcheck: 'false'
    });

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    return (data.web?.results || []).map(result => ({
      title: result.title,
      description: result.description,
      url: result.url,
      source: new URL(result.url).hostname,
      publishedAt: result.age || null
    }));
  } catch (error) {
    logger.error('Erreur Brave Search:', error.message);
    return [];
  }
}

/**
 * Rechercher des tendances via Serper.dev
 * Documentation: https://serper.dev/
 * Gratuit: 2500 requêtes, puis $50/50K
 */
export async function fetchSerperTrends(query, options = {}) {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    logger.debug('SERPER_API_KEY non configurée');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        gl: options.country || 'fr',
        hl: options.language || 'fr',
        num: options.limit || 10,
        tbs: 'qdr:m' // Past month
      })
    });
    
    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.organic || []).map(result => ({
      title: result.title,
      description: result.snippet,
      url: result.link,
      source: new URL(result.link).hostname,
      publishedAt: result.date || null
    }));
  } catch (error) {
    logger.error('Erreur Serper:', error.message);
    return [];
  }
}

/**
 * Rechercher des tendances via News API
 * Documentation: https://newsapi.org/
 * Gratuit: 100 requêtes/jour
 */
export async function fetchNewsAPITrends(query, options = {}) {
  const apiKey = process.env.NEWS_API_KEY;
  
  if (!apiKey) {
    logger.debug('NEWS_API_KEY non configurée');
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      language: options.language || 'fr',
      sortBy: 'publishedAt',
      pageSize: options.limit || 10,
      apiKey
    });

    const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
    
    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.articles || []).map(article => ({
      title: article.title,
      description: article.description,
      source: article.source?.name,
      url: article.url,
      publishedAt: article.publishedAt
    }));
  } catch (error) {
    logger.error('Erreur News API:', error.message);
    return [];
  }
}

/**
 * Recherche web unifiée - utilise l'API disponible
 * Priorité: Brave > Serper > News API > Fallback
 */
export async function fetchWebSearch(query, options = {}) {
  // Essayer Brave Search en premier (meilleur ratio gratuit)
  if (process.env.BRAVE_API_KEY) {
    const results = await fetchBraveSearchTrends(query, options);
    if (results.length > 0) {
      logger.debug(`Brave Search: ${results.length} résultats`);
      return results;
    }
  }

  // Essayer Serper.dev ensuite
  if (process.env.SERPER_API_KEY) {
    const results = await fetchSerperTrends(query, options);
    if (results.length > 0) {
      logger.debug(`Serper: ${results.length} résultats`);
      return results;
    }
  }

  // Fallback sur News API
  if (process.env.NEWS_API_KEY) {
    const results = await fetchNewsAPITrends(query, options);
    if (results.length > 0) {
      logger.debug(`News API: ${results.length} résultats`);
      return results;
    }
  }

  logger.warn('Aucune API de recherche configurée');
  return [];
}

/**
 * Obtenir des sujets tendances combinés
 */
export async function getTrendingTopics(category = null, options = {}) {
  logger.info('Recherche de sujets tendances...');
  
  const topics = [];
  let searchQueries;

  if (category && TOPICS[category]) {
    searchQueries = TOPICS[category].searchQueries;
  } else {
    // Sélectionner des requêtes aléatoires de différentes catégories
    searchQueries = shuffleArray(getTrendSearchQueries()).slice(0, 5);
  }

  // Recherche web unifiée (Brave/Serper/News API)
  for (const query of searchQueries.slice(0, 3)) {
    const webResults = await fetchWebSearch(query, options);
    topics.push(...webResults);
  }

  // Complément avec News API pour les actualités fraîches
  if (process.env.NEWS_API_KEY) {
    for (const query of searchQueries.slice(0, 2)) {
      const newsResults = await fetchNewsAPITrends(query, options);
      topics.push(...newsResults);
    }
  }

  // Dédupliquer par titre (similitude approximative)
  const uniqueTopics = [];
  const seenTitles = new Set();

  for (const topic of topics) {
    const normalizedTitle = topic.title.toLowerCase().slice(0, 50);
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueTopics.push(topic);
    }
  }

  logger.info(`${uniqueTopics.length} sujets tendances identifiés`);
  return uniqueTopics;
}

/**
 * Générer des suggestions de sujets sans API externe
 * Fallback quand les APIs ne sont pas configurées
 */
export function generateTopicSuggestions(category = null) {
  const cat = category ? TOPICS[category] : getRandomCategory();
  
  const templates = [
    "Guide complet : {keyword} en {year}",
    "{keyword} : les meilleures pratiques à adopter",
    "Comment optimiser {keyword} pour de meilleures performances",
    "{keyword} vs alternatives : comparatif détaillé",
    "Les erreurs courantes avec {keyword} et comment les éviter",
    "Pourquoi {keyword} révolutionne le développement moderne",
    "De débutant à expert : maîtriser {keyword}",
    "{keyword} : retour d'expérience et conseils pratiques",
    "L'avenir de {keyword} : tendances et prédictions",
    "Intégrer {keyword} dans votre stack technique"
  ];

  const year = new Date().getFullYear();
  const suggestions = [];

  // Générer des suggestions basées sur les mots-clés
  const keywords = shuffleArray(cat.keywords).slice(0, 5);
  
  for (const keyword of keywords) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    suggestions.push({
      title: template
        .replace('{keyword}', keyword.charAt(0).toUpperCase() + keyword.slice(1))
        .replace('{year}', year.toString()),
      category: cat.name,
      keyword
    });
  }

  return suggestions;
}

/**
 * Analyser la pertinence d'un sujet
 */
export function analyzeTopicRelevance(topic, keywords) {
  const titleLower = topic.title.toLowerCase();
  const descLower = (topic.description || '').toLowerCase();
  
  let score = 0;
  
  for (const keyword of keywords) {
    if (titleLower.includes(keyword.toLowerCase())) score += 2;
    if (descLower.includes(keyword.toLowerCase())) score += 1;
  }
  
  return score;
}

/**
 * Obtenir le meilleur sujet pour une catégorie
 */
export async function getBestTopicForCategory(categoryId) {
  const category = TOPICS[categoryId];
  
  if (!category) {
    throw new Error(`Catégorie inconnue: ${categoryId}`);
  }

  // Essayer d'obtenir des tendances
  const trends = await getTrendingTopics(categoryId);
  
  if (trends.length > 0) {
    // Scorer et trier par pertinence
    const scoredTopics = trends.map(topic => ({
      ...topic,
      relevanceScore: analyzeTopicRelevance(topic, category.keywords)
    }));
    
    scoredTopics.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    if (scoredTopics[0].relevanceScore > 0) {
      return {
        source: 'trending',
        ...scoredTopics[0]
      };
    }
  }

  // Fallback : suggestions générées
  const suggestions = generateTopicSuggestions(categoryId);
  return {
    source: 'generated',
    ...suggestions[0]
  };
}

export default {
  fetchBraveSearchTrends,
  fetchSerperTrends,
  fetchNewsAPITrends,
  fetchWebSearch,
  getTrendingTopics,
  generateTopicSuggestions,
  analyzeTopicRelevance,
  getBestTopicForCategory
};

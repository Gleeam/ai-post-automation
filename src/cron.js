#!/usr/bin/env node

/**
 * Script d'automatisation CRON pour Gleeam
 * 
 * Exécution non-interactive pour génération automatique d'articles
 * 
 * Usage:
 *   node src/cron.js                    # 1 article aléatoire, brouillon
 *   node src/cron.js --count 3          # 3 articles
 *   node src/cron.js --publish          # Publier directement
 *   node src/cron.js --multilingual     # Traduire en FR/EN/ES
 *   node src/cron.js --category webDevelopment
 */

import 'dotenv/config';
import { logger } from './utils/logger.js';
import { testOpenAIConnection } from './services/openai.js';
import { testConnection as testDBConnection, createPost, disconnectDatabase, generateUniqueSlug } from './services/database.js';
import { generateTopicSuggestions, getBestTopicForCategory } from './services/trends.js';
import { generateArticle } from './generators/article.js';
import { generateMultilingualArticle, toPayloadLocaleFormat, SUPPORTED_LOCALES } from './generators/translator.js';
import { getAllCategories, getRandomCategory } from './config/topics.js';

// Configuration par défaut
const DEFAULT_CONFIG = {
  count: 1,
  publish: false,
  multilingual: false,
  category: null,
  language: 'fr',
  dryRun: false
};

/**
 * Parser les arguments de ligne de commande
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
      case '-n':
        config.count = parseInt(args[++i], 10) || 1;
        break;
      case '--publish':
      case '-p':
        config.publish = true;
        break;
      case '--multilingual':
      case '-m':
        config.multilingual = true;
        break;
      case '--category':
      case '-c':
        config.category = args[++i];
        break;
      case '--language':
      case '-l':
        config.language = args[++i];
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return config;
}

/**
 * Afficher l'aide
 */
function showHelp() {
  console.log(`
Gleeam Article Automation - Mode CRON

Usage: node src/cron.js [options]

Options:
  -n, --count <n>       Nombre d'articles à générer (défaut: 1)
  -p, --publish         Publier directement (défaut: brouillon)
  -m, --multilingual    Traduire en FR/EN/ES
  -c, --category <id>   Catégorie spécifique (ex: webDevelopment, artificialIntelligence)
  -l, --language <lang> Langue source (fr, en, es) (défaut: fr)
  --dry-run             Générer sans sauvegarder en base
  -h, --help            Afficher cette aide

Catégories disponibles:
  - webDevelopment      Développement Web
  - mobileDevelopment   Développement Mobile
  - artificialIntelligence  IA & Machine Learning
  - blockchain          Blockchain & Web3
  - softwareArchitecture    Architecture Logicielle
  - databases           Bases de Données
  - dataAnalytics       Analyse de Données
  - cloudDevOps         Cloud & DevOps
  - cybersecurity       Cybersécurité
  - uxDesign            UX/UI Design

Exemples:
  node src/cron.js                              # 1 article aléatoire
  node src/cron.js -n 3 -p                      # 3 articles publiés
  node src/cron.js -c artificialIntelligence   # 1 article IA
  node src/cron.js -n 2 -m -p                   # 2 articles multilingues publiés
`);
}

/**
 * Sélectionner un sujet pour l'article
 */
async function selectTopic(config) {
  let category;
  
  if (config.category) {
    const allCategories = getAllCategories();
    category = allCategories.find(c => c.id === config.category);
    if (!category) {
      logger.warn(`Catégorie "${config.category}" inconnue, sélection aléatoire`);
      category = getRandomCategory();
    }
  } else {
    category = getRandomCategory();
  }

  logger.info(`Catégorie: ${category.emoji} ${category.name}`);

  // Essayer de trouver un sujet tendance
  try {
    const trendingTopic = await getBestTopicForCategory(category.id);
    if (trendingTopic.source === 'trending') {
      logger.info(`Sujet tendance trouvé: ${trendingTopic.title}`);
      return {
        ...trendingTopic,
        category: category.id
      };
    }
  } catch (error) {
    logger.debug('Pas de tendance, utilisation des suggestions');
  }

  // Fallback: suggestion générée
  const suggestions = generateTopicSuggestions(category.id);
  const topic = suggestions[Math.floor(Math.random() * suggestions.length)];
  
  logger.info(`Sujet sélectionné: ${topic.title}`);
  
  return {
    title: topic.title,
    category: category.id,
    keyword: topic.keyword
  };
}

/**
 * Sauvegarder l'article en base
 */
async function saveArticle(article, config) {
  if (config.dryRun) {
    logger.info('[DRY-RUN] Article non sauvegardé');
    logger.info(`Titre: ${article.title}`);
    logger.info(`Slug: ${article.slug}`);
    return { id: 'dry-run', slug: article.slug };
  }

  const uniqueSlug = await generateUniqueSlug(article.slug);
  const { _generation, ...articleData } = article;

  let postData;

  if (config.multilingual) {
    logger.info('Génération des traductions...');
    const multilingualArticle = await generateMultilingualArticle(
      articleData,
      config.language,
      SUPPORTED_LOCALES.filter(l => l !== config.language)
    );
    
    postData = {
      ...multilingualArticle,
      slug: uniqueSlug,
      status: config.publish ? 'published' : 'draft',
      publishedAt: config.publish ? new Date() : null
    };
  } else {
    const localizedArticle = toPayloadLocaleFormat(articleData, config.language);
    
    postData = {
      ...localizedArticle,
      slug: uniqueSlug,
      status: config.publish ? 'published' : 'draft',
      publishedAt: config.publish ? new Date() : null
    };
  }

  const result = await createPost(postData);
  
  logger.success(`Article ${config.publish ? 'publié' : 'sauvegardé'}: ${result.id}`);
  
  return result;
}

/**
 * Exécution principale
 */
async function main() {
  const startTime = Date.now();
  const config = parseArgs();
  
  logger.header('GLEEAM CRON - GÉNÉRATION AUTOMATIQUE');
  logger.info(`Configuration: ${JSON.stringify(config)}`);
  logger.info(`Date: ${new Date().toISOString()}`);
  
  // Vérifications
  const openaiOk = await testOpenAIConnection();
  if (!openaiOk) {
    logger.error('Connexion OpenAI échouée');
    process.exit(1);
  }

  if (!config.dryRun) {
    const dbOk = await testDBConnection();
    if (!dbOk) {
      logger.error('Connexion MongoDB échouée');
      process.exit(1);
    }
  }

  // Génération des articles
  const results = {
    success: [],
    errors: []
  };

  for (let i = 0; i < config.count; i++) {
    logger.divider();
    logger.info(`Article ${i + 1}/${config.count}`);
    
    try {
      // Sélectionner le sujet
      const topic = await selectTopic(config);
      
      // Générer l'article
      const article = await generateArticle(topic, {
        category: topic.category,
        language: config.language
      });
      
      // Sauvegarder
      const saved = await saveArticle(article, config);
      
      results.success.push({
        title: article.title,
        slug: saved.slug,
        id: saved.id
      });

      // Pause entre les articles
      if (i < config.count - 1) {
        logger.info('Pause de 10 secondes...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (error) {
      logger.error(`Erreur: ${error.message}`);
      results.errors.push({
        index: i + 1,
        error: error.message
      });
    }
  }

  // Résumé
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  logger.divider();
  logger.header('RÉSUMÉ');
  logger.info(`Durée totale: ${duration}s`);
  logger.success(`Articles générés: ${results.success.length}`);
  
  if (results.success.length > 0) {
    results.success.forEach(a => {
      logger.info(`  ✓ ${a.title} (${a.slug})`);
    });
  }
  
  if (results.errors.length > 0) {
    logger.warn(`Erreurs: ${results.errors.length}`);
    results.errors.forEach(e => {
      logger.error(`  ✗ Article ${e.index}: ${e.error}`);
    });
  }

  // Cleanup
  await disconnectDatabase();
  
  // Exit code basé sur le succès
  process.exit(results.errors.length > 0 ? 1 : 0);
}

// Gestion des erreurs non capturées
process.on('uncaughtException', async (error) => {
  logger.error('Erreur non capturée:', error.message);
  await disconnectDatabase();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  logger.error('Promesse rejetée:', error.message);
  await disconnectDatabase();
  process.exit(1);
});

// Exécution
main();

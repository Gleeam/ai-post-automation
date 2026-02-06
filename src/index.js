#!/usr/bin/env node

/**
 * Gleeam Article Automation
 * Script principal de génération d'articles SEO-optimisés
 */

import 'dotenv/config';
import { program } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';

import { logger } from './utils/logger.js';
import { testOpenAIConnection } from './services/openai.js';
import { testConnection as testDBConnection, createPost, disconnectDatabase, generateUniqueSlug } from './services/database.js';
import { getTrendingTopics, generateTopicSuggestions, getBestTopicForCategory } from './services/trends.js';
import { generateArticle, generateArticleBatch } from './generators/article.js';
import { analyzeSEOScore } from './generators/seo.js';
import { generateMultilingualArticle, toPayloadLocaleFormat, SUPPORTED_LOCALES, LOCALE_NAMES } from './generators/translator.js';
import { getAllCategories, getRandomCategory } from './config/topics.js';

/**
 * Afficher le banner
 */
function showBanner() {
  console.log(chalk.cyan(`
   ██████╗ ██╗     ███████╗███████╗ █████╗ ███╗   ███╗
  ██╔════╝ ██║     ██╔════╝██╔════╝██╔══██╗████╗ ████║
  ██║  ███╗██║     █████╗  █████╗  ███████║██╔████╔██║
  ██║   ██║██║     ██╔══╝  ██╔══╝  ██╔══██║██║╚██╔╝██║
  ╚██████╔╝███████╗███████╗███████╗██║  ██║██║ ╚═╝ ██║
   ╚═════╝ ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
  `));
  console.log(chalk.gray('  Article Automation System v1.0.0\n'));
}

/**
 * Vérifier les prérequis
 */
async function checkPrerequisites() {
  const spinner = ora('Vérification des prérequis...').start();
  
  // Vérifier OpenAI
  const openaiOk = await testOpenAIConnection();
  if (!openaiOk) {
    spinner.fail('Connexion OpenAI échouée');
    process.exit(1);
  }

  // Vérifier MongoDB
  const dbOk = await testDBConnection();
  if (!dbOk) {
    spinner.warn('Connexion MongoDB échouée - Mode aperçu uniquement');
    return false;
  }

  spinner.succeed('Prérequis vérifiés');
  return true;
}

/**
 * Mode interactif principal
 */
async function interactiveMode() {
  showBanner();
  const canSaveToDB = await checkPrerequisites();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Que souhaitez-vous faire ?',
      choices: [
        { name: '📝 Générer un article sur un sujet spécifique', value: 'generate_specific' },
        { name: '🔥 Générer un article sur une tendance actuelle', value: 'generate_trending' },
        { name: '🎲 Générer un article sur un sujet aléatoire', value: 'generate_random' },
        { name: '📊 Rechercher les tendances tech du moment', value: 'research' },
        { name: '💡 Obtenir des suggestions de sujets', value: 'suggestions' },
        new inquirer.Separator(),
        { name: '❌ Quitter', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'generate_specific':
      await handleSpecificGeneration(canSaveToDB);
      break;
    case 'generate_trending':
      await handleTrendingGeneration(canSaveToDB);
      break;
    case 'generate_random':
      await handleRandomGeneration(canSaveToDB);
      break;
    case 'research':
      await handleResearch();
      break;
    case 'suggestions':
      await handleSuggestions();
      break;
    case 'exit':
      console.log(chalk.gray('\nÀ bientôt ! 👋\n'));
      await disconnectDatabase();
      process.exit(0);
  }

  // Retour au menu principal
  console.log('\n');
  await interactiveMode();
}

/**
 * Générer un article sur un sujet spécifique
 */
async function handleSpecificGeneration(canSaveToDB) {
  const { topic, category, language, researchOnline } = await inquirer.prompt([
    {
      type: 'input',
      name: 'topic',
      message: 'Quel est le sujet de l\'article ?',
      validate: input => input.length > 10 || 'Le sujet doit faire au moins 10 caractères'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Quelle catégorie ?',
      choices: getAllCategories().map(c => ({ name: `${c.emoji} ${c.name}`, value: c.id }))
    },
    {
      type: 'list',
      name: 'language',
      message: 'Langue de l\'article ?',
      choices: [
        { name: '🇫🇷 Français', value: 'fr' },
        { name: '🇬🇧 English', value: 'en' },
        { name: '🇪🇸 Español', value: 'es' }
      ],
      default: 'fr'
    },
    {
      type: 'confirm',
      name: 'researchOnline',
      message: 'Rechercher des infos actuelles sur internet ?',
      default: true
    }
  ]);

  const spinner = ora(researchOnline 
    ? 'Recherche d\'informations et génération de l\'article...' 
    : 'Génération de l\'article en cours...'
  ).start();
  
  try {
    const article = await generateArticle(topic, { category, language, researchOnline });
    spinner.succeed('Article généré !');
    
    await displayArticlePreview(article);
    await handleArticleSave(article, canSaveToDB);
  } catch (error) {
    spinner.fail(`Erreur: ${error.message}`);
  }
}

/**
 * Générer un article sur une tendance
 */
async function handleTrendingGeneration(canSaveToDB) {
  const spinner = ora('Recherche des tendances...').start();
  
  try {
    const { category } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Dans quelle catégorie chercher ?',
        choices: [
          { name: '🌐 Toutes les catégories', value: null },
          ...getAllCategories().map(c => ({ name: `${c.emoji} ${c.name}`, value: c.id }))
        ]
      }
    ]);

    spinner.text = 'Analyse des tendances...';
    
    let topic;
    if (category) {
      topic = await getBestTopicForCategory(category);
    } else {
      const trends = await getTrendingTopics();
      if (trends.length === 0) {
        spinner.warn('Aucune tendance trouvée, génération de suggestions...');
        const suggestions = generateTopicSuggestions();
        topic = suggestions[0];
      } else {
        spinner.succeed(`${trends.length} tendances trouvées`);
        
        const { selectedTrend } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTrend',
            message: 'Sélectionnez un sujet tendance :',
            choices: trends.slice(0, 10).map((t, i) => ({
              name: `${i + 1}. ${t.title.slice(0, 70)}${t.title.length > 70 ? '...' : ''}`,
              value: t
            }))
          }
        ]);
        topic = selectedTrend;
      }
    }

    spinner.text = 'Génération de l\'article...';
    spinner.start();
    
    const article = await generateArticle(topic);
    spinner.succeed('Article généré !');
    
    await displayArticlePreview(article);
    await handleArticleSave(article, canSaveToDB);
  } catch (error) {
    spinner.fail(`Erreur: ${error.message}`);
  }
}

/**
 * Générer un article sur un sujet aléatoire
 */
async function handleRandomGeneration(canSaveToDB) {
  const spinner = ora('Sélection d\'un sujet aléatoire...').start();
  
  try {
    const category = getRandomCategory();
    const suggestions = generateTopicSuggestions(category.id);
    const topic = suggestions[Math.floor(Math.random() * suggestions.length)];
    
    spinner.text = `Sujet: ${topic.title}`;
    spinner.succeed();
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Générer un article sur "${topic.title}" ?`,
        default: true
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Génération annulée.'));
      return;
    }

    const genSpinner = ora('Génération de l\'article...').start();
    const article = await generateArticle(topic.title, { category: category.id });
    genSpinner.succeed('Article généré !');
    
    await displayArticlePreview(article);
    await handleArticleSave(article, canSaveToDB);
  } catch (error) {
    spinner.fail(`Erreur: ${error.message}`);
  }
}

/**
 * Rechercher les tendances
 */
async function handleResearch() {
  const spinner = ora('Recherche des tendances tech...').start();
  
  try {
    const trends = await getTrendingTopics();
    spinner.succeed(`${trends.length} tendances trouvées`);
    
    if (trends.length === 0) {
      console.log(chalk.yellow('\nAucune tendance trouvée. Vérifiez vos clés API.'));
      return;
    }

    console.log(chalk.bold('\n📈 Tendances Tech du Moment\n'));
    
    trends.slice(0, 15).forEach((trend, i) => {
      console.log(chalk.cyan(`${i + 1}. ${trend.title}`));
      if (trend.description) {
        console.log(chalk.gray(`   ${trend.description.slice(0, 100)}...`));
      }
      if (trend.source) {
        console.log(chalk.gray(`   Source: ${trend.source}`));
      }
      console.log('');
    });
  } catch (error) {
    spinner.fail(`Erreur: ${error.message}`);
  }
}

/**
 * Obtenir des suggestions de sujets
 */
async function handleSuggestions() {
  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Pour quelle catégorie ?',
      choices: getAllCategories().map(c => ({ name: `${c.emoji} ${c.name}`, value: c.id }))
    }
  ]);

  const suggestions = generateTopicSuggestions(category);
  
  console.log(chalk.bold('\n💡 Suggestions d\'Articles\n'));
  
  suggestions.forEach((suggestion, i) => {
    console.log(chalk.cyan(`${i + 1}. ${suggestion.title}`));
    console.log(chalk.gray(`   Mot-clé: ${suggestion.keyword}`));
    console.log('');
  });
}

/**
 * Afficher un aperçu de l'article
 */
async function displayArticlePreview(article) {
  console.log(chalk.bold('\n' + '═'.repeat(60)));
  console.log(chalk.bold.green(' 📄 APERÇU DE L\'ARTICLE'));
  console.log(chalk.bold('═'.repeat(60) + '\n'));
  
  console.log(chalk.bold('Titre: ') + chalk.white(article.title));
  console.log(chalk.bold('Slug: ') + chalk.gray(article.slug));
  console.log(chalk.bold('Auteur: ') + chalk.gray(article.author));
  console.log(chalk.bold('Temps de lecture: ') + chalk.gray(`${article.readingTime} min`));
  
  console.log(chalk.bold('\n📊 SEO'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.bold('Meta Title: ') + chalk.white(article.seo.metaTitle));
  console.log(chalk.bold('Meta Description: ') + chalk.white(article.seo.metaDescription));
  console.log(chalk.bold('Keywords: ') + chalk.gray(article.seo.keywords));
  console.log(chalk.bold('Tags: ') + chalk.gray(article.tags.map(t => t.tag).join(', ')));
  
  // Score SEO
  const seoScore = analyzeSEOScore(article);
  console.log(chalk.bold('\n🎯 Score SEO: ') + 
    (seoScore.percentage >= 75 ? chalk.green : seoScore.percentage >= 50 ? chalk.yellow : chalk.red)(
      `${seoScore.percentage}% (${seoScore.level})`
    )
  );
  
  if (seoScore.feedback.length > 0) {
    console.log(chalk.gray('   Suggestions:'));
    seoScore.feedback.slice(0, 3).forEach(f => console.log(chalk.gray(`   - ${f}`)));
  }

  console.log(chalk.bold('\n📝 Extrait du contenu'));
  console.log(chalk.gray('─'.repeat(40)));
  const preview = article.content.slice(0, 500).replace(/\n/g, ' ').trim();
  console.log(chalk.white(preview + '...'));
  
  console.log(chalk.gray('\n' + '─'.repeat(60)));
}

/**
 * Gérer la sauvegarde de l'article
 */
async function handleArticleSave(article, canSaveToDB, sourceLocale = 'fr') {
  const choices = [
    { name: '👀 Voir le contenu complet', value: 'view' },
    { name: '📋 Copier en JSON', value: 'json' }
  ];

  if (canSaveToDB) {
    choices.unshift(
      { name: '💾 Sauvegarder en brouillon (langue unique)', value: 'save_draft' },
      { name: '🚀 Publier (langue unique)', value: 'publish' },
      { name: '🌍 Traduire et sauvegarder (FR + EN + ES)', value: 'save_multilingual' },
      { name: '🌍 Traduire et publier (FR + EN + ES)', value: 'publish_multilingual' }
    );
  }

  choices.push({ name: '❌ Ne pas sauvegarder', value: 'skip' });

  const { saveAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'saveAction',
      message: 'Que faire avec cet article ?',
      choices
    }
  ]);

  switch (saveAction) {
    case 'save_draft':
      await saveArticle(article, false, false, sourceLocale);
      break;
    case 'publish':
      await saveArticle(article, true, false, sourceLocale);
      break;
    case 'save_multilingual':
      await saveArticle(article, false, true, sourceLocale);
      break;
    case 'publish_multilingual':
      await saveArticle(article, true, true, sourceLocale);
      break;
    case 'view':
      console.log(chalk.bold('\n📄 CONTENU COMPLET\n'));
      console.log(article.content);
      break;
    case 'json':
      console.log(chalk.bold('\n📋 JSON\n'));
      const { _generation, ...cleanArticle } = article;
      console.log(JSON.stringify(cleanArticle, null, 2));
      break;
  }
}

/**
 * Sauvegarder l'article en base
 */
async function saveArticle(article, publish = false, multilingual = false, sourceLocale = 'fr') {
  let spinner;
  
  try {
    // Générer un slug unique
    const uniqueSlug = await generateUniqueSlug(article.slug);
    
    // Préparer les données pour Payload CMS
    const { _generation, ...articleData } = article;
    
    let postData;
    
    if (multilingual) {
      // Génération multilingue
      spinner = ora('Traduction en cours (FR → EN → ES)...').start();
      
      const multilingualArticle = await generateMultilingualArticle(
        articleData, 
        sourceLocale,
        SUPPORTED_LOCALES.filter(l => l !== sourceLocale)
      );
      
      spinner.succeed('Traductions générées !');
      spinner = ora('Sauvegarde en cours...').start();
      
      postData = {
        ...multilingualArticle,
        slug: uniqueSlug,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : null
      };
    } else {
      // Langue unique - format Payload avec locale
      spinner = ora('Sauvegarde en cours...').start();
      
      const localizedArticle = toPayloadLocaleFormat(articleData, sourceLocale);
      
      postData = {
        ...localizedArticle,
        slug: uniqueSlug,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : null
      };
    }

    const result = await createPost(postData);
    
    spinner.succeed(
      publish 
        ? `Article publié ! ID: ${result.id}` 
        : `Brouillon sauvegardé ! ID: ${result.id}`
    );
    
    console.log(chalk.gray(`Slug: ${uniqueSlug}`));
    
    if (multilingual) {
      console.log(chalk.green(`✓ Disponible en: ${SUPPORTED_LOCALES.map(l => LOCALE_NAMES[l]).join(', ')}`));
    } else {
      console.log(chalk.gray(`Langue: ${LOCALE_NAMES[sourceLocale]}`));
    }
  } catch (error) {
    if (spinner) spinner.fail(`Erreur de sauvegarde: ${error.message}`);
    else logger.error(`Erreur de sauvegarde: ${error.message}`);
  }
}

// Configuration CLI
program
  .name('gleeam-article')
  .description('Générateur d\'articles SEO pour Gleeam')
  .version('1.0.0');

program
  .option('-t, --topic <topic>', 'Sujet de l\'article')
  .option('-c, --category <category>', 'Catégorie de l\'article')
  .option('-l, --language <lang>', 'Langue source (fr, en, es)', 'fr')
  .option('-m, --multilingual', 'Générer dans toutes les langues (FR + EN + ES)')
  .option('-r, --research', 'Rechercher des infos actuelles sur internet avant de générer')
  .option('--research-only', 'Rechercher les tendances uniquement')
  .option('--batch', 'Mode batch (plusieurs articles)')
  .option('--count <n>', 'Nombre d\'articles en batch', '3')
  .option('--auto-publish', 'Publier automatiquement')
  .action(async (options) => {
    showBanner();

    if (options.researchOnly) {
      await handleResearch();
      await disconnectDatabase();
      return;
    }

    if (options.topic) {
      // Mode direct avec sujet
      const canSaveToDB = await checkPrerequisites();
      
      // Afficher les options actives
      if (options.research) {
        console.log(chalk.cyan('🔍 Recherche d\'informations actuelles activée'));
      }
      if (options.multilingual) {
        console.log(chalk.cyan('🌍 Génération multilingue activée (FR + EN + ES)'));
      }
      
      const spinner = ora(options.research 
        ? 'Recherche d\'informations et génération de l\'article...' 
        : 'Génération de l\'article...'
      ).start();
      
      try {
        const article = await generateArticle(options.topic, {
          category: options.category,
          language: options.language,
          autoPublish: options.autoPublish,
          researchOnline: options.research
        });
        spinner.succeed('Article généré !');
        
        await displayArticlePreview(article);
        
        if (canSaveToDB && options.autoPublish) {
          await saveArticle(article, true, options.multilingual, options.language);
        } else if (canSaveToDB) {
          await handleArticleSave(article, canSaveToDB, options.language);
        }
      } catch (error) {
        spinner.fail(`Erreur: ${error.message}`);
      }
      
      await disconnectDatabase();
      return;
    }

    if (options.batch) {
      // Mode batch
      const canSaveToDB = await checkPrerequisites();
      const count = parseInt(options.count, 10);
      
      console.log(chalk.cyan(`\nGénération de ${count} articles...\n`));
      
      const topics = [];
      const categories = getAllCategories();
      
      for (let i = 0; i < count; i++) {
        const cat = categories[i % categories.length];
        const suggestions = generateTopicSuggestions(cat.id);
        topics.push({
          ...suggestions[0],
          category: cat.id
        });
      }

      const { articles, errors } = await generateArticleBatch(topics, {
        language: options.language,
        autoPublish: options.autoPublish
      });

      if (canSaveToDB && articles.length > 0) {
        const { saveAll } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'saveAll',
            message: `Sauvegarder les ${articles.length} articles ?`,
            default: true
          }
        ]);

        if (saveAll) {
          for (const article of articles) {
            await saveArticle(article, options.autoPublish, options.multilingual, options.language);
          }
        }
      }

      await disconnectDatabase();
      return;
    }

    // Mode interactif par défaut
    await interactiveMode();
  });

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
  console.log(chalk.gray('\n\nFermeture...'));
  await disconnectDatabase();
  process.exit(0);
});

// Lancement
program.parse();

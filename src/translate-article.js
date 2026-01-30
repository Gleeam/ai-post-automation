#!/usr/bin/env node

/**
 * Script pour traduire un article existant
 * 
 * Usage:
 *   node src/translate-article.js --slug mon-article
 *   node src/translate-article.js --id 697c490f2fa6430863ce9032
 */

import 'dotenv/config';
import { program } from 'commander';
import ora from 'ora';
import chalk from 'chalk';

import { logger } from './utils/logger.js';
import { testOpenAIConnection } from './services/openai.js';
import { 
  connectDatabase, 
  disconnectDatabase, 
  getPostsCollection,
  updatePost
} from './services/database.js';
import { 
  generateMultilingualArticle, 
  SUPPORTED_LOCALES, 
  LOCALE_NAMES 
} from './generators/translator.js';
import { ObjectId } from 'mongodb';

/**
 * Trouver un article par slug ou ID
 */
async function findArticle(slug, id) {
  const collection = await getPostsCollection();
  
  if (id) {
    return await collection.findOne({ _id: new ObjectId(id) });
  }
  
  if (slug) {
    return await collection.findOne({ slug });
  }
  
  return null;
}

/**
 * Extraire le contenu mono-langue d'un article (pour re-traduction)
 */
function extractSingleLocaleContent(article, locale = 'fr') {
  // Si l'article est déjà en format localisé, extraire la langue source
  const getLocalized = (field) => {
    if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
      return field[locale] || Object.values(field)[0] || '';
    }
    return field || '';
  };

  return {
    title: getLocalized(article.title),
    slug: article.slug,
    excerpt: getLocalized(article.excerpt),
    content: getLocalized(article.content),
    coverImage: article.coverImage,
    seo: {
      metaTitle: getLocalized(article.seo?.metaTitle),
      metaDescription: getLocalized(article.seo?.metaDescription),
      keywords: getLocalized(article.seo?.keywords),
      ogImage: article.seo?.ogImage,
      canonicalUrl: article.seo?.canonicalUrl,
      noIndex: article.seo?.noIndex
    },
    status: article.status,
    publishedAt: article.publishedAt,
    tags: article.tags,
    author: article.author,
    readingTime: article.readingTime
  };
}

/**
 * Programme principal
 */
async function main() {
  program
    .name('translate-article')
    .description('Traduire un article existant en multilingue')
    .option('-s, --slug <slug>', 'Slug de l\'article')
    .option('-i, --id <id>', 'ID MongoDB de l\'article')
    .option('-l, --source-locale <locale>', 'Langue source', 'fr')
    .option('--dry-run', 'Afficher sans sauvegarder')
    .parse();

  const options = program.opts();

  if (!options.slug && !options.id) {
    console.error(chalk.red('Erreur: Spécifiez --slug ou --id'));
    process.exit(1);
  }

  logger.header('TRADUCTION D\'ARTICLE EXISTANT');

  // Vérifications
  const openaiOk = await testOpenAIConnection();
  if (!openaiOk) {
    logger.error('Connexion OpenAI échouée');
    process.exit(1);
  }

  await connectDatabase();

  // Trouver l'article
  const spinner = ora('Recherche de l\'article...').start();
  
  const article = await findArticle(options.slug, options.id);
  
  if (!article) {
    spinner.fail('Article non trouvé');
    await disconnectDatabase();
    process.exit(1);
  }

  spinner.succeed(`Article trouvé: ${article.slug}`);
  
  // Extraire le contenu source
  const sourceArticle = extractSingleLocaleContent(article, options.sourceLocale);
  
  console.log(chalk.gray(`\nTitre: ${sourceArticle.title}`));
  console.log(chalk.gray(`Contenu: ${sourceArticle.content?.length || 0} caractères`));
  console.log(chalk.gray(`Langue source: ${LOCALE_NAMES[options.sourceLocale]}`));
  console.log(chalk.gray(`Langues cibles: ${SUPPORTED_LOCALES.filter(l => l !== options.sourceLocale).map(l => LOCALE_NAMES[l]).join(', ')}`));

  // Traduire
  const translateSpinner = ora('Traduction en cours...').start();
  
  try {
    const multilingualArticle = await generateMultilingualArticle(
      sourceArticle,
      options.sourceLocale,
      SUPPORTED_LOCALES.filter(l => l !== options.sourceLocale)
    );

    translateSpinner.succeed('Traductions générées !');

    if (options.dryRun) {
      logger.info('[DRY-RUN] Article non sauvegardé');
      console.log(chalk.bold('\nAperçu des traductions:'));
      
      for (const locale of SUPPORTED_LOCALES) {
        console.log(chalk.cyan(`\n${LOCALE_NAMES[locale]}:`));
        console.log(chalk.gray(`  Titre: ${multilingualArticle.title[locale]?.slice(0, 60)}...`));
        console.log(chalk.gray(`  Contenu: ${multilingualArticle.content[locale]?.length || 0} caractères`));
      }
    } else {
      // Sauvegarder
      const saveSpinner = ora('Sauvegarde...').start();
      
      await updatePost(article._id.toString(), {
        title: multilingualArticle.title,
        excerpt: multilingualArticle.excerpt,
        content: multilingualArticle.content,
        seo: multilingualArticle.seo
      });

      saveSpinner.succeed('Article mis à jour !');
      
      console.log(chalk.green(`\n✓ Traductions sauvegardées pour: ${SUPPORTED_LOCALES.map(l => LOCALE_NAMES[l]).join(', ')}`));
    }
    
  } catch (error) {
    translateSpinner.fail(`Erreur: ${error.message}`);
  }

  await disconnectDatabase();
}

// Gestion des erreurs
process.on('uncaughtException', async (error) => {
  logger.error('Erreur:', error.message);
  await disconnectDatabase();
  process.exit(1);
});

main();

/**
 * Générateur d'articles complets
 * 
 * Processus en 4 étapes :
 * 1. Recherche et analyse du sujet
 * 2. Création du plan détaillé
 * 3. Génération du contenu
 * 4. Optimisation SEO
 */

import { generateCompletion, generateJSON } from '../services/openai.js';
import { 
  SYSTEM_PROMPT_ARTICLE, 
  SYSTEM_PROMPT_TOPIC_RESEARCH,
  SYSTEM_PROMPT_OUTLINE,
  generateArticlePrompt,
  generateOutlinePrompt,
  generateTopicResearchPrompt
} from '../prompts/templates.js';
import { generateSEO } from './seo.js';
import { logger } from '../utils/logger.js';
import { 
  generateSlug, 
  estimateReadingTime, 
  cleanMarkdown,
  validateSEOStructure,
  formatTags,
  generatePublishDate
} from '../utils/helpers.js';

/**
 * Étape 1: Rechercher et affiner un sujet
 */
export async function researchTopic(input) {
  logger.step(1, 6, 'Recherche et analyse du sujet');
  
  const prompt = generateTopicResearchPrompt(input);
  
  const result = await generateJSON(
    SYSTEM_PROMPT_TOPIC_RESEARCH,
    prompt
  );

  logger.info(`Angle proposé: ${result.angle}`);
  logger.info(`Titre: ${result.proposedTitle}`);

  return result;
}

/**
 * Étape 2: Générer le plan détaillé de l'article
 */
export async function generateOutline(topic, options = {}) {
  logger.step(2, 6, 'Création du plan détaillé');
  
  const prompt = generateOutlinePrompt(topic, options);
  
  const outline = await generateJSON(
    SYSTEM_PROMPT_OUTLINE,
    prompt
  );

  // Valider la structure du plan
  if (!outline.sections || outline.sections.length === 0) {
    throw new Error('Plan invalide: aucune section générée');
  }

  logger.info(`Plan créé: ${outline.sections.length} sections`);
  outline.sections.forEach((section, i) => {
    logger.debug(`  ${i + 1}. ${section.h2}`);
  });

  return outline;
}

/**
 * Étape 3: Générer le contenu de l'article à partir du plan
 */
export async function generateContent(topic, outline, options = {}) {
  logger.step(3, 6, 'Génération du contenu');
  
  const prompt = generateArticlePrompt(topic, {
    ...options,
    outline
  });
  
  const content = await generateCompletion(
    SYSTEM_PROMPT_ARTICLE,
    prompt,
    {
      temperature: 0.85,
      frequencyPenalty: 0.4,
      presencePenalty: 0.3,
      maxTokens: 6000
    }
  );

  const cleanedContent = cleanMarkdown(content);
  const wordCount = cleanedContent.split(/\s+/).length;
  
  logger.info(`Contenu généré: ${wordCount} mots`);

  return cleanedContent;
}

/**
 * Post-traiter le contenu pour plus de naturel
 */
function postProcessContent(content) {
  let processed = content;

  // Variations mineures pour plus de naturel
  const replacements = [
    [/très important/gi, () => Math.random() > 0.5 ? 'crucial' : 'essentiel'],
    [/il est important de noter/gi, () => Math.random() > 0.5 ? 'à noter' : 'point important'],
    [/en conclusion/gi, () => Math.random() > 0.5 ? 'pour conclure' : 'en définitive'],
    [/de plus en plus/gi, () => Math.random() > 0.5 ? 'toujours plus' : 'de plus en plus'],
    [/il faut/gi, () => Math.random() > 0.5 ? 'on doit' : 'il convient de'],
  ];

  for (const [pattern, replacement] of replacements) {
    processed = processed.replace(pattern, replacement);
  }

  return processed;
}

/**
 * Générer un article complet (processus en 4 étapes)
 */
export async function generateArticle(input, options = {}) {
  logger.header('GÉNÉRATION D\'ARTICLE');
  
  try {
    // ═══════════════════════════════════════════
    // ÉTAPE 1: Recherche du sujet
    // ═══════════════════════════════════════════
    let topic;
    if (typeof input === 'string' || !input.proposedTitle) {
      topic = await researchTopic(input);
    } else {
      topic = input;
      logger.step(1, 6, 'Sujet déjà analysé');
      logger.info(`Titre: ${topic.proposedTitle}`);
    }

    // Préparer les options
    const articleOptions = {
      category: topic.category || options.category,
      keywords: topic.keyPoints || options.keywords || [],
      tone: options.tone || 'professionnel et accessible',
      targetLength: options.targetLength || '1800-2200',
      language: options.language || process.env.DEFAULT_LANGUAGE || 'fr'
    };

    // ═══════════════════════════════════════════
    // ÉTAPE 2: Génération du plan
    // ═══════════════════════════════════════════
    const outline = await generateOutline(topic, articleOptions);

    // ═══════════════════════════════════════════
    // ÉTAPE 3: Génération du contenu
    // ═══════════════════════════════════════════
    const rawContent = await generateContent(topic, outline, articleOptions);
    
    // ═══════════════════════════════════════════
    // ÉTAPE 4: Post-traitement
    // ═══════════════════════════════════════════
    logger.step(4, 6, 'Post-traitement du contenu');
    const content = postProcessContent(rawContent);

    // ═══════════════════════════════════════════
    // ÉTAPE 5: Génération SEO
    // ═══════════════════════════════════════════
    logger.step(5, 6, 'Génération des métadonnées SEO');
    const title = outline.title || topic.proposedTitle || topic.title;
    const seo = await generateSEO({
      title,
      content,
      category: articleOptions.category,
      suggestedKeywords: articleOptions.keywords
    });

    // ═══════════════════════════════════════════
    // ÉTAPE 6: Assemblage final
    // ═══════════════════════════════════════════
    logger.step(6, 6, 'Assemblage de l\'article final');
    
    const slug = generateSlug(title);
    const readingTime = estimateReadingTime(content);

    const article = {
      title,
      slug,
      excerpt: seo.excerpt,
      content,
      coverImage: options.coverImage || null,
      seo: {
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        keywords: seo.keywords,
        ogImage: options.ogImage || null,
        canonicalUrl: null,
        noIndex: false
      },
      status: options.autoPublish ? 'published' : 'draft',
      publishedAt: options.autoPublish ? generatePublishDate() : null,
      tags: formatTags(seo.tags),
      author: options.author || process.env.DEFAULT_AUTHOR || 'Gleeam',
      readingTime,
      // Métadonnées de génération (pour debug, non sauvegardées)
      _generation: {
        topic: topic.originalTopic || input,
        angle: topic.angle,
        outline: {
          sectionsCount: outline.sections.length,
          sections: outline.sections.map(s => s.h2)
        },
        generatedAt: new Date().toISOString()
      }
    };

    // Validation SEO
    const validation = validateSEOStructure(article);
    if (!validation.valid) {
      logger.warn('Problèmes SEO détectés:');
      validation.issues.forEach(issue => logger.warn(`  - ${issue}`));
    } else {
      logger.success('Structure SEO validée');
    }

    logger.divider();
    logger.success('Article généré avec succès!');
    logger.info(`Titre: ${article.title}`);
    logger.info(`Slug: ${article.slug}`);
    logger.info(`Mots: ${content.split(/\s+/).length}`);
    logger.info(`Sections: ${outline.sections.length}`);
    logger.info(`Temps de lecture: ${readingTime} min`);

    return article;

  } catch (error) {
    logger.error('Erreur lors de la génération:', error.message);
    throw error;
  }
}

/**
 * Générer plusieurs articles en batch
 */
export async function generateArticleBatch(topics, options = {}) {
  const articles = [];
  const errors = [];

  logger.header(`GÉNÉRATION BATCH: ${topics.length} ARTICLES`);

  for (let i = 0; i < topics.length; i++) {
    logger.info(`\n══════ Article ${i + 1}/${topics.length} ══════`);
    
    try {
      const article = await generateArticle(topics[i], options);
      articles.push(article);
      
      // Pause entre les générations
      if (i < topics.length - 1) {
        logger.info('Pause de 5 secondes...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      logger.error(`Erreur article ${i + 1}:`, error.message);
      errors.push({ topic: topics[i], error: error.message });
    }
  }

  logger.header('RÉSUMÉ BATCH');
  logger.success(`Articles générés: ${articles.length}`);
  if (errors.length > 0) {
    logger.warn(`Erreurs: ${errors.length}`);
  }

  return { articles, errors };
}

export default {
  researchTopic,
  generateOutline,
  generateContent,
  generateArticle,
  generateArticleBatch
};

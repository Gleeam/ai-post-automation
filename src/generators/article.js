/**
 * Générateur d'articles complets
 * 
 * Processus :
 * 1. (Optionnel) Recherche web d'informations actuelles
 * 2. Analyse du sujet + plan détaillé (un seul appel API)
 * 3. Génération du contenu
 * 4. Post-traitement (nettoyage IA, markdown)
 * 5. Métadonnées SEO + assemblage final
 */

import { generateCompletion, generateJSON } from '../services/openai.js';
import { 
  SYSTEM_PROMPT_ARTICLE, 
  SYSTEM_PROMPT_TOPIC_AND_OUTLINE,
  AI_PHRASES_BLACKLIST,
  generateArticlePrompt
} from '../prompts/templates.js';
import { generateSEO } from './seo.js';
import { researchTopicOnline } from '../services/trends.js';
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
 * Analyser le sujet ET générer le plan en un seul appel API
 */
export async function researchTopicAndOutline(input, options = {}) {
  
  const {
    category = 'Développement Web',
    language = 'fr',
    onlineContext = null
  } = options;
  
  const langLabel = language === 'fr' ? 'Français' : language === 'en' ? 'English' : 'Español';
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  
  let prompt = `Sujet à traiter : ${inputStr}

Blog cible : Gleeam (agence web/tech), audience francophone mixte (développeurs, décideurs, curieux de tech).
Catégorie : ${category}
Langue : ${langLabel}`;

  if (onlineContext) {
    prompt += `

--- Informations récentes (recherche web) ---
${onlineContext}
--- Fin informations ---`;
  }

  prompt += `

Analyse ce sujet, détermine le meilleur angle et type d'article, puis génère directement le plan structuré complet.`;

  const result = await generateJSON(
    SYSTEM_PROMPT_TOPIC_AND_OUTLINE,
    prompt,
    { maxTokens: 4000 }
  );

  // Valider la structure
  if (!result.sections || result.sections.length === 0) {
    throw new Error('Plan invalide: aucune section générée');
  }

  // Assurer que le champ title existe (harmonisation)
  if (!result.title && result.proposedTitle) {
    result.title = result.proposedTitle;
  }

  logger.info(`Type: ${result.articleType || 'analyse'}`);
  logger.info(`Angle: ${result.angle}`);
  logger.info(`Titre: ${result.title}`);
  logger.info(`Plan: ${result.sections.length} sections`);
  result.sections.forEach((section, i) => {
    logger.debug(`  ${i + 1}. ${section.h2}`);
  });

  return result;
}

/**
 * Générer le contenu de l'article à partir du plan
 */
export async function generateContent(topic, outline, options = {}) {
  
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
 * Post-traiter le contenu pour nettoyer les patterns IA et garantir un résultat publiable
 */
function postProcessContent(content) {
  let processed = content;

  // ── 1. Supprimer les titres H1 accidentels ──
  processed = processed.replace(/^# .+$/gm, '');

  // ── 2. Supprimer les titres méta/génériques qui n'apportent rien au lecteur ──
  const genericHeadings = [
    /^#{2,3}\s*(introduction|conclusion|en résumé|pour résumer|ce qu'il faut retenir|pour aller plus loin|faq|questions fréquentes|en bref|récapitulatif|mot de la fin|le mot de la fin)\s*$/gim
  ];
  for (const pattern of genericHeadings) {
    processed = processed.replace(pattern, '');
  }

  // ── 3. Supprimer les méta-commentaires ──
  const metaComments = [
    /^.*(?:dans cette section|dans cet article|nous allons (?:voir|explorer|découvrir|aborder)|voyons maintenant|penchons-nous sur|intéressons-nous à|commençons par|avant d'aller plus loin).*$/gim,
  ];
  for (const pattern of metaComments) {
    // Ne supprimer que si la ligne est clairement une phrase de transition méta
    // (on vérifie que la ligne fait moins de 120 chars pour éviter de supprimer des paragraphes entiers)
    processed = processed.replace(pattern, (match) => {
      return match.length < 120 ? '' : match;
    });
  }

  // ── 4. Détecter et logger les phrases typiques IA, puis les supprimer quand c'est safe ──
  const aiPhrasesFound = [];
  for (const phrase of AI_PHRASES_BLACKLIST) {
    const regex = new RegExp(phrase, 'gi');
    const matches = processed.match(regex);
    if (matches) {
      matches.forEach(m => aiPhrasesFound.push(m));
    }
  }
  
  if (aiPhrasesFound.length > 0) {
    logger.warn(`${aiPhrasesFound.length} tournure(s) IA détectée(s) :`);
    // Dédupliquer pour l'affichage
    const unique = [...new Set(aiPhrasesFound.map(p => p.toLowerCase()))];
    unique.forEach(p => logger.warn(`  → "${p}"`));
    
    // Supprimer les tournures IA quand elles apparaissent en début de phrase
    for (const phrase of AI_PHRASES_BLACKLIST) {
      // Début de phrase : après un saut de ligne, ou en tout début de texte
      const startOfSentence = new RegExp(`(^|\\n)${phrase},?\\s*`, 'gim');
      processed = processed.replace(startOfSentence, '$1');
      
      // Après un point + espace (milieu de paragraphe, début de nouvelle phrase)
      const afterPeriod = new RegExp(`(\\. )${phrase},?\\s*`, 'gim');
      processed = processed.replace(afterPeriod, '$1');
    }
    
    // Nettoyer les doubles espaces et lignes vides laissés par les suppressions
    processed = processed.replace(/ {2,}/g, ' ');
    processed = processed.replace(/^\s+$/gm, '');
  }

  // ── 5. Nettoyer les doubles sauts de ligne excessifs (artefacts de suppressions) ──
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // ── 6. S'assurer qu'il y a un saut de ligne avant et après chaque titre ──
  processed = processed.replace(/([^\n])\n(#{2,3}\s)/g, '$1\n\n$2');
  processed = processed.replace(/(#{2,3}\s.+)\n([^\n#])/g, '$1\n\n$2');

  // ── 7. Nettoyer le début et la fin ──
  processed = processed.trim();

  return processed;
}

/**
 * Générer un article complet (processus en 4 étapes)
 * @param {string|object} input - Sujet ou objet topic
 * @param {object} options - Options de génération
 * @param {boolean} options.researchOnline - Rechercher des infos actuelles sur internet
 */
export async function generateArticle(input, options = {}) {
  logger.header('GÉNÉRATION D\'ARTICLE');
  const totalSteps = options.researchOnline ? 5 : 4;
  
  try {
    // ═══════════════════════════════════════════
    // ÉTAPE 0 (optionnelle): Recherche web en parallèle avec rien (c'est la première chose)
    // ═══════════════════════════════════════════
    let onlineContext = null;
    if (options.researchOnline) {
      logger.step(1, totalSteps, 'Recherche d\'informations actuelles en ligne');
      const searchTopic = typeof input === 'string' ? input : (input.proposedTitle || input.title || input);
      const onlineResearch = await researchTopicOnline(searchTopic, {
        language: options.language || 'fr'
      });
      
      if (onlineResearch.hasRecentData) {
        logger.success(`${onlineResearch.sourcesCount} sources trouvées`);
        onlineContext = onlineResearch.contextSummary;
      } else {
        logger.warn('Aucune source récente trouvée');
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 2 (ou 1): Analyse du sujet + plan (UN SEUL appel API)
    // ═══════════════════════════════════════════
    const stepOffset = options.researchOnline ? 1 : 0;
    let outline;
    
    if (typeof input === 'string' || !input.sections) {
      logger.step(1 + stepOffset, totalSteps, 'Analyse du sujet et création du plan');
      const topicInput = typeof input === 'string' ? input : (input.proposedTitle || input.title || input);
      outline = await researchTopicAndOutline(topicInput, {
        category: options.category,
        language: options.language || process.env.DEFAULT_LANGUAGE || 'fr',
        onlineContext
      });
    } else {
      // Déjà un outline complet
      outline = input;
      logger.step(1 + stepOffset, totalSteps, 'Plan déjà fourni');
    }

    // Préparer les options pour la rédaction
    const articleOptions = {
      category: outline.category || options.category,
      keywords: outline.keyPoints || options.keywords || [],
      tone: options.tone || 'professionnel et accessible',
      targetLength: options.targetLength || '1800-2200',
      language: options.language || process.env.DEFAULT_LANGUAGE || 'fr',
      onlineContext
    };

    // ═══════════════════════════════════════════
    // ÉTAPE 3 (ou 2): Génération du contenu
    // ═══════════════════════════════════════════
    logger.step(2 + stepOffset, totalSteps, 'Génération du contenu');
    const rawContent = await generateContent(outline, outline, articleOptions);
    
    // ═══════════════════════════════════════════
    // ÉTAPE 4 (ou 3): Post-traitement (instantané, pas d'API)
    // ═══════════════════════════════════════════
    logger.step(3 + stepOffset, totalSteps, 'Post-traitement du contenu');
    const content = postProcessContent(rawContent);

    // ═══════════════════════════════════════════
    // ÉTAPE 5 (ou 4): Génération SEO
    // ═══════════════════════════════════════════
    logger.step(4 + stepOffset, totalSteps, 'Métadonnées SEO + assemblage');
    const title = outline.title || outline.proposedTitle;
    const seo = await generateSEO({
      title,
      content,
      category: articleOptions.category,
      suggestedKeywords: articleOptions.keywords
    });

    // ═══════════════════════════════════════════
    // Assemblage final (pas d'appel API)
    // ═══════════════════════════════════════════
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
      _generation: {
        topic: outline.originalTopic || input,
        angle: outline.angle,
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
  researchTopicAndOutline,
  generateContent,
  generateArticle,
  generateArticleBatch
};

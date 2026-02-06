/**
 * Service de traduction d'articles pour le multilingue
 * Gère la traduction FR <-> EN <-> ES pour Payload CMS
 * 
 * Optimisé : traductions parallèles par langue et par champ
 */

import { generateCompletion, generateJSON } from '../services/openai.js';
import { logger } from '../utils/logger.js';

export const SUPPORTED_LOCALES = ['fr', 'en', 'es'];

export const LOCALE_NAMES = {
  fr: 'Français',
  en: 'English',
  es: 'Español'
};

/**
 * Prompt système pour la traduction
 */
const SYSTEM_PROMPT_TRANSLATE = `Tu es un traducteur professionnel spécialisé dans le contenu tech et web.

Règles :
- Préserve le sens, le ton et le style conversationnel
- Utilise des expressions idiomatiques naturelles (pas de traduction littérale)
- Conserve exactement la structure Markdown (##, ###, listes, code, liens)
- Garde les termes tech anglais universels (API, framework, backend, etc.)
- Retourne UNIQUEMENT le texte traduit, sans commentaires.`;

/**
 * Prompt système pour la traduction SEO (retourne du JSON)
 */
const SYSTEM_PROMPT_TRANSLATE_SEO = `Tu es un traducteur SEO professionnel. Tu traduis des métadonnées SEO en respectant les contraintes de longueur.

Règles :
- Meta title : 50-60 caractères max
- Meta description : 150-160 caractères max
- Keywords : traduis et adapte au marché cible
- Excerpt : traduis naturellement

Réponds TOUJOURS en JSON valide avec exactement ces clés : metaTitle, metaDescription, keywords, excerpt`;

/**
 * Traduire un texte dans une langue cible
 * Gère les textes longs en un seul appel (le modèle supporte 8000+ tokens en sortie)
 */
export async function translateText(text, targetLocale, sourceLocale = 'fr') {
  if (!text || text.trim().length === 0) return text;
  if (targetLocale === sourceLocale) return text;

  const prompt = `Traduis du ${LOCALE_NAMES[sourceLocale]} vers le ${LOCALE_NAMES[targetLocale]}. Conserve le formatage Markdown.

---
${text}
---`;

  const translated = await generateCompletion(
    SYSTEM_PROMPT_TRANSLATE,
    prompt,
    { maxTokens: 8000 }
  );

  return translated.trim();
}

/**
 * Traduire les métadonnées SEO (utilise generateJSON pour un parsing fiable)
 */
export async function translateSEO(seo, targetLocale, sourceLocale = 'fr') {
  if (targetLocale === sourceLocale) return seo;

  const prompt = `Traduis du ${LOCALE_NAMES[sourceLocale]} vers le ${LOCALE_NAMES[targetLocale]} :

Meta Title: ${seo.metaTitle}
Meta Description: ${seo.metaDescription}
Keywords: ${seo.keywords}
Excerpt: ${seo.excerpt}`;

  try {
    return await generateJSON(
      SYSTEM_PROMPT_TRANSLATE_SEO,
      prompt,
      { maxTokens: 1000 }
    );
  } catch (e) {
    logger.warn(`Erreur parsing traduction SEO ${targetLocale}, fallback`);
    return seo;
  }
}

/**
 * Traduire tous les champs d'un article vers UNE langue cible
 * Lance contenu + (titre + excerpt + SEO) en parallèle
 */
async function translateArticleToLocale(article, targetLocale, sourceLocale) {
  // Le contenu est le plus long → le lancer en parallèle avec les petits champs
  const [content, title, excerpt, translatedSEO] = await Promise.all([
    translateText(article.content, targetLocale, sourceLocale),
    translateText(article.title, targetLocale, sourceLocale),
    translateText(article.excerpt, targetLocale, sourceLocale),
    translateSEO(
      {
        metaTitle: article.seo.metaTitle,
        metaDescription: article.seo.metaDescription,
        keywords: article.seo.keywords,
        excerpt: article.excerpt
      },
      targetLocale,
      sourceLocale
    )
  ]);

  return { content, title, excerpt, translatedSEO };
}

/**
 * Générer un article multilingue complet
 * Toutes les langues sont traduites en PARALLÈLE
 */
export async function generateMultilingualArticle(article, sourceLocale = 'fr', targetLocales = null) {
  const locales = targetLocales || SUPPORTED_LOCALES.filter(l => l !== sourceLocale);
  
  logger.info(`Traduction parallèle vers: ${locales.map(l => LOCALE_NAMES[l]).join(', ')}`);

  // Structure multilingue pour Payload CMS
  const multilingualArticle = {
    slug: article.slug,
    coverImage: article.coverImage,
    status: article.status,
    publishedAt: article.publishedAt,
    author: article.author,
    readingTime: article.readingTime,
    title: { [sourceLocale]: article.title },
    excerpt: { [sourceLocale]: article.excerpt },
    content: { [sourceLocale]: article.content },
    seo: {
      metaTitle: { [sourceLocale]: article.seo.metaTitle },
      metaDescription: { [sourceLocale]: article.seo.metaDescription },
      keywords: { [sourceLocale]: article.seo.keywords },
      ogImage: article.seo.ogImage,
      canonicalUrl: article.seo.canonicalUrl,
      noIndex: article.seo.noIndex
    },
    tags: article.tags
  };

  // Lancer TOUTES les langues en parallèle
  const translationPromises = locales.map(async (locale) => {
    logger.info(`  → ${LOCALE_NAMES[locale]}...`);
    try {
      const result = await translateArticleToLocale(article, locale, sourceLocale);
      logger.success(`  ✓ ${LOCALE_NAMES[locale]} terminé`);
      return { locale, result, error: null };
    } catch (error) {
      logger.error(`  ✗ Erreur ${locale}: ${error.message}`);
      return { locale, result: null, error };
    }
  });

  const results = await Promise.all(translationPromises);

  // Assembler les résultats
  for (const { locale, result, error } of results) {
    if (result) {
      multilingualArticle.title[locale] = result.title;
      multilingualArticle.excerpt[locale] = result.excerpt;
      multilingualArticle.content[locale] = result.content;
      multilingualArticle.seo.metaTitle[locale] = result.translatedSEO.metaTitle;
      multilingualArticle.seo.metaDescription[locale] = result.translatedSEO.metaDescription;
      multilingualArticle.seo.keywords[locale] = result.translatedSEO.keywords;
    } else {
      // Fallback : contenu source
      multilingualArticle.title[locale] = article.title;
      multilingualArticle.excerpt[locale] = article.excerpt;
      multilingualArticle.content[locale] = article.content;
      multilingualArticle.seo.metaTitle[locale] = article.seo.metaTitle;
      multilingualArticle.seo.metaDescription[locale] = article.seo.metaDescription;
      multilingualArticle.seo.keywords[locale] = article.seo.keywords;
    }
  }

  return multilingualArticle;
}

/**
 * Convertir un article simple en structure multilingue (sans traduction)
 * Utile pour sauvegarder un article mono-langue dans Payload
 */
export function toPayloadLocaleFormat(article, locale = 'fr') {
  return {
    slug: article.slug,
    coverImage: article.coverImage,
    status: article.status,
    publishedAt: article.publishedAt,
    author: article.author,
    readingTime: article.readingTime,
    tags: article.tags,
    
    title: { [locale]: article.title },
    excerpt: { [locale]: article.excerpt },
    content: { [locale]: article.content },
    seo: {
      metaTitle: { [locale]: article.seo.metaTitle },
      metaDescription: { [locale]: article.seo.metaDescription },
      keywords: { [locale]: article.seo.keywords },
      ogImage: article.seo.ogImage,
      canonicalUrl: article.seo.canonicalUrl,
      noIndex: article.seo.noIndex
    }
  };
}

export default {
  translateText,
  translateSEO,
  generateMultilingualArticle,
  toPayloadLocaleFormat,
  SUPPORTED_LOCALES,
  LOCALE_NAMES
};

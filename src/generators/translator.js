/**
 * Service de traduction d'articles pour le multilingue
 * Gère la traduction FR <-> EN <-> ES pour Payload CMS
 */

import { generateCompletion } from '../services/openai.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

export const SUPPORTED_LOCALES = ['fr', 'en', 'es'];

export const LOCALE_NAMES = {
  fr: 'Français',
  en: 'English',
  es: 'Español'
};

/**
 * Prompt système pour la traduction
 */
const SYSTEM_PROMPT_TRANSLATE = `Tu es un traducteur professionnel spécialisé dans le contenu tech et web. Tu traduis des articles de blog tout en :

## Règles de traduction

1. **Préserver le sens et le ton** : Garde le style conversationnel, professionnel mais accessible
2. **Adapter les expressions** : Utilise des expressions idiomatiques naturelles dans la langue cible (pas de traduction littérale)
3. **Garder la structure** : Conserve exactement la même structure Markdown (H2, H3, listes, etc.)
4. **Termes techniques** : 
   - Garde les termes tech anglais universels (API, framework, backend, etc.)
   - Adapte les acronymes si nécessaire
5. **SEO** : La traduction doit rester naturelle et optimisée pour le référencement
6. **Longueur** : La traduction peut légèrement varier en longueur, c'est normal

## Format de sortie

Retourne UNIQUEMENT le texte traduit, sans commentaires ni explications.`;

/**
 * Traduire un texte dans une langue cible
 */
export async function translateText(text, targetLocale, sourceLocale = 'fr') {
  if (!text || text.trim().length === 0) {
    return text;
  }

  if (targetLocale === sourceLocale) {
    return text;
  }

  // Pour les textes longs, on traduit par sections
  const MAX_CHUNK_SIZE = 3000; // ~750 tokens en entrée
  
  if (text.length > MAX_CHUNK_SIZE) {
    logger.debug(`Texte long (${text.length} car), traduction par sections...`);
    return await translateLongText(text, targetLocale, sourceLocale);
  }

  const prompt = `Traduis ce texte du ${LOCALE_NAMES[sourceLocale]} vers le ${LOCALE_NAMES[targetLocale]}.

Texte à traduire :
---
${text}
---

Traduction en ${LOCALE_NAMES[targetLocale]} :`;

  const translated = await generateCompletion(
    SYSTEM_PROMPT_TRANSLATE,
    prompt,
    {
      maxTokens: 4000 // Suffisant pour ~3000 caractères traduits
    }
  );

  return translated.trim();
}

/**
 * Traduire un texte long par sections (pour éviter les limites de tokens)
 */
async function translateLongText(text, targetLocale, sourceLocale) {
  // Découper par paragraphes ou sections markdown
  const sections = text.split(/\n(?=##?\s)/);
  const translatedSections = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (section.trim().length === 0) {
      translatedSections.push(section);
      continue;
    }

    logger.debug(`  Section ${i + 1}/${sections.length} (${section.length} car)`);

    const prompt = `Traduis ce texte du ${LOCALE_NAMES[sourceLocale]} vers le ${LOCALE_NAMES[targetLocale]}.
Conserve exactement le formatage Markdown (titres ##, listes, code, etc.).

Texte :
---
${section}
---

Traduction :`;

    try {
      const translated = await generateCompletion(
        SYSTEM_PROMPT_TRANSLATE,
        prompt,
        { maxTokens: 4000 }
      );
      translatedSections.push(translated.trim());
    } catch (error) {
      logger.warn(`  Erreur section ${i + 1}, conservation de l'original`);
      translatedSections.push(section);
    }

    // Pause entre sections pour éviter rate limiting
    if (i < sections.length - 1) {
      await sleep(500);
    }
  }

  return translatedSections.join('\n\n');
}

/**
 * Traduire les métadonnées SEO
 */
export async function translateSEO(seo, targetLocale, sourceLocale = 'fr') {
  if (targetLocale === sourceLocale) {
    return seo;
  }

  const prompt = `Traduis ces métadonnées SEO du ${LOCALE_NAMES[sourceLocale]} vers le ${LOCALE_NAMES[targetLocale]}.
Respecte les contraintes de longueur SEO (meta title: 50-60 car, meta description: 150-160 car).

Meta Title: ${seo.metaTitle}
Meta Description: ${seo.metaDescription}
Keywords: ${seo.keywords}
Excerpt: ${seo.excerpt}

Réponds en JSON avec exactement ces clés : metaTitle, metaDescription, keywords, excerpt`;

  const translated = await generateCompletion(
    SYSTEM_PROMPT_TRANSLATE,
    prompt,
    { temperature: 0.3 }
  );

  try {
    // Essayer de parser le JSON
    const jsonMatch = translated.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    logger.warn('Erreur parsing traduction SEO, utilisation du fallback');
  }

  // Fallback : retourner l'original
  return seo;
}

/**
 * Générer un article multilingue complet
 * Prend un article dans une langue source et génère les traductions
 */
export async function generateMultilingualArticle(article, sourceLocale = 'fr', targetLocales = null) {
  const locales = targetLocales || SUPPORTED_LOCALES.filter(l => l !== sourceLocale);
  
  logger.info(`Traduction de l'article vers: ${locales.join(', ')}`);

  // Structure multilingue pour Payload CMS
  const multilingualArticle = {
    // Champs non localisés
    slug: article.slug,
    coverImage: article.coverImage,
    status: article.status,
    publishedAt: article.publishedAt,
    author: article.author,
    readingTime: article.readingTime,
    
    // Champs localisés - initialiser avec la langue source
    title: {
      [sourceLocale]: article.title
    },
    excerpt: {
      [sourceLocale]: article.excerpt
    },
    content: {
      [sourceLocale]: article.content
    },
    seo: {
      metaTitle: { [sourceLocale]: article.seo.metaTitle },
      metaDescription: { [sourceLocale]: article.seo.metaDescription },
      keywords: { [sourceLocale]: article.seo.keywords },
      ogImage: article.seo.ogImage,
      canonicalUrl: article.seo.canonicalUrl,
      noIndex: article.seo.noIndex
    },
    tags: article.tags // Tags restent en langue source généralement
  };

  // Traduire vers chaque langue cible
  for (const locale of locales) {
    logger.info(`  → Traduction vers ${LOCALE_NAMES[locale]}...`);
    
    try {
      // Traduire le titre
      multilingualArticle.title[locale] = await translateText(
        article.title, 
        locale, 
        sourceLocale
      );
      
      // Petite pause pour éviter le rate limiting
      await sleep(1000);
      
      // Traduire l'excerpt
      multilingualArticle.excerpt[locale] = await translateText(
        article.excerpt,
        locale,
        sourceLocale
      );
      
      await sleep(1000);
      
      // Traduire le contenu principal
      multilingualArticle.content[locale] = await translateText(
        article.content,
        locale,
        sourceLocale
      );
      
      await sleep(1000);
      
      // Traduire les métadonnées SEO
      const translatedSEO = await translateSEO(
        {
          metaTitle: article.seo.metaTitle,
          metaDescription: article.seo.metaDescription,
          keywords: article.seo.keywords,
          excerpt: article.excerpt
        },
        locale,
        sourceLocale
      );
      
      multilingualArticle.seo.metaTitle[locale] = translatedSEO.metaTitle;
      multilingualArticle.seo.metaDescription[locale] = translatedSEO.metaDescription;
      multilingualArticle.seo.keywords[locale] = translatedSEO.keywords;
      
      logger.success(`  ✓ ${LOCALE_NAMES[locale]} terminé`);
      
      // Pause entre les langues
      await sleep(2000);
      
    } catch (error) {
      logger.error(`  ✗ Erreur traduction ${locale}:`, error.message);
      // Fallback : utiliser le contenu source
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

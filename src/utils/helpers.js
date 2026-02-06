/**
 * Utilitaires et helpers
 */

import slugify from 'slugify';

/**
 * Générer un slug SEO-friendly
 */
export function generateSlug(text) {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'fr',
    remove: /[*+~.()'"!:@]/g
  });
}

/**
 * Estimer le temps de lecture (en minutes)
 * Basé sur 200 mots par minute (lecture moyenne)
 */
export function estimateReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Tronquer un texte à une longueur maximale
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Nettoyer et formater le contenu Markdown
 */
export function cleanMarkdown(content) {
  let cleaned = content;

  // Retirer les blocs de code markdown qui wrappent tout l'article (```markdown ... ```)
  cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\n/i, '');
  cleaned = cleaned.replace(/\n```\s*$/i, '');

  // Supprimer les éventuels H1 en début d'article (sera ajouté séparément)
  cleaned = cleaned.replace(/^#\s+.+\n+/, '');

  // Normaliser les sauts de ligne
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Assurer un espacement correct autour des titres
  cleaned = cleaned.replace(/([^\n])\n(#{2,3}\s)/g, '$1\n\n$2');
  cleaned = cleaned.replace(/(#{2,3}\s.+)\n([^\n#])/g, '$1\n\n$2');

  // Tabs en espaces
  cleaned = cleaned.replace(/\t/g, '  ');

  // Supprimer les espaces en fin de ligne
  cleaned = cleaned.replace(/ +$/gm, '');

  // Trim début/fin
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extraire les headings du contenu Markdown
 */
export function extractHeadings(markdown) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim()
    });
  }

  return headings;
}

/**
 * Valider la structure SEO d'un article
 */
export function validateSEOStructure(article) {
  const issues = [];

  // Vérifier le titre
  if (!article.title || article.title.length < 10) {
    issues.push('Le titre est trop court (min 10 caractères)');
  }
  if (article.title && article.title.length > 70) {
    issues.push('Le titre est trop long (max 70 caractères)');
  }

  // Vérifier la meta description
  if (!article.seo?.metaDescription || article.seo.metaDescription.length < 50) {
    issues.push('La meta description est trop courte (min 50 caractères)');
  }
  if (article.seo?.metaDescription && article.seo.metaDescription.length > 160) {
    issues.push('La meta description est trop longue (max 160 caractères)');
  }

  // Vérifier le contenu
  if (!article.content || article.content.length < 500) {
    issues.push('Le contenu est trop court (min 500 caractères)');
  }

  // Vérifier la présence de headings
  const headings = extractHeadings(article.content || '');
  const hasH2 = headings.some(h => h.level === 2);
  if (!hasH2) {
    issues.push('L\'article devrait contenir au moins un H2');
  }

  // Vérifier les mots-clés
  if (!article.seo?.keywords || article.seo.keywords.split(',').length < 3) {
    issues.push('Ajoutez au moins 3 mots-clés');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Générer une date de publication
 */
export function generatePublishDate(daysFromNow = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Formater les tags pour Payload CMS
 */
export function formatTags(tags) {
  if (typeof tags === 'string') {
    tags = tags.split(',').map(t => t.trim());
  }
  return tags.map(tag => ({ tag }));
}

/**
 * Pause asynchrone
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry une fonction avec backoff exponentiel
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Randomiser un tableau
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default {
  generateSlug,
  estimateReadingTime,
  truncateText,
  cleanMarkdown,
  extractHeadings,
  validateSEOStructure,
  generatePublishDate,
  formatTags,
  sleep,
  retryWithBackoff,
  shuffleArray
};

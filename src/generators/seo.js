/**
 * Générateur de métadonnées SEO optimisées
 */

import { generateJSON } from '../services/openai.js';
import { SYSTEM_PROMPT_SEO, generateSEOPrompt } from '../prompts/templates.js';
import { logger } from '../utils/logger.js';
import { truncateText } from '../utils/helpers.js';

/**
 * Générer les métadonnées SEO pour un article
 */
export async function generateSEO(article) {
  logger.debug('Génération des métadonnées SEO...');

  const prompt = generateSEOPrompt(article);
  
  const seo = await generateJSON(SYSTEM_PROMPT_SEO, prompt, {
    temperature: 0.6 // Plus conservateur pour le SEO
  });

  // Validation et ajustement des longueurs
  const validated = validateAndAdjustSEO(seo, article);

  logger.debug('Métadonnées SEO générées');
  return validated;
}

/**
 * Valider et ajuster les métadonnées SEO
 */
function validateAndAdjustSEO(seo, article) {
  const result = { ...seo };

  // Meta Title: 50-60 caractères
  if (!result.metaTitle || result.metaTitle.length < 10) {
    result.metaTitle = truncateText(article.title, 60);
  } else if (result.metaTitle.length > 60) {
    result.metaTitle = truncateText(result.metaTitle, 60);
  }

  // Meta Description: 150-160 caractères
  if (!result.metaDescription || result.metaDescription.length < 50) {
    result.metaDescription = truncateText(
      article.content?.replace(/[#*_\[\]]/g, '').slice(0, 200) || '',
      160
    );
  } else if (result.metaDescription.length > 160) {
    result.metaDescription = truncateText(result.metaDescription, 160);
  }

  // Excerpt: 150-200 caractères
  if (!result.excerpt || result.excerpt.length < 50) {
    result.excerpt = result.metaDescription;
  } else if (result.excerpt.length > 200) {
    result.excerpt = truncateText(result.excerpt, 200);
  }

  // Keywords: normaliser le format
  if (typeof result.keywords === 'string') {
    // Déjà une string, nettoyer
    result.keywords = result.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0)
      .slice(0, 8) // Max 8 keywords
      .join(', ');
  } else if (Array.isArray(result.keywords)) {
    result.keywords = result.keywords
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0)
      .slice(0, 8)
      .join(', ');
  } else {
    result.keywords = '';
  }

  // Tags: normaliser en tableau
  if (typeof result.tags === 'string') {
    result.tags = result.tags.split(',').map(t => t.trim()).filter(Boolean);
  } else if (!Array.isArray(result.tags)) {
    result.tags = [];
  }
  result.tags = result.tags.slice(0, 5); // Max 5 tags

  return result;
}

/**
 * Analyser le score SEO d'un article
 */
export function analyzeSEOScore(article) {
  const scores = {
    title: 0,
    metaTitle: 0,
    metaDescription: 0,
    keywords: 0,
    content: 0,
    structure: 0
  };

  const feedback = [];

  // Score du titre (0-20)
  if (article.title) {
    const titleLength = article.title.length;
    if (titleLength >= 30 && titleLength <= 70) {
      scores.title = 20;
    } else if (titleLength >= 20 && titleLength <= 80) {
      scores.title = 15;
      feedback.push('Titre légèrement hors de la plage optimale (30-70 caractères)');
    } else {
      scores.title = 10;
      feedback.push('Titre trop court ou trop long');
    }
  }

  // Score du meta title (0-15)
  if (article.seo?.metaTitle) {
    const metaTitleLength = article.seo.metaTitle.length;
    if (metaTitleLength >= 50 && metaTitleLength <= 60) {
      scores.metaTitle = 15;
    } else if (metaTitleLength >= 40 && metaTitleLength <= 65) {
      scores.metaTitle = 12;
      feedback.push('Meta title légèrement hors de la plage optimale (50-60 caractères)');
    } else {
      scores.metaTitle = 8;
      feedback.push('Meta title à optimiser');
    }
  }

  // Score de la meta description (0-15)
  if (article.seo?.metaDescription) {
    const descLength = article.seo.metaDescription.length;
    if (descLength >= 150 && descLength <= 160) {
      scores.metaDescription = 15;
    } else if (descLength >= 120 && descLength <= 170) {
      scores.metaDescription = 12;
      feedback.push('Meta description légèrement hors de la plage optimale');
    } else {
      scores.metaDescription = 8;
      feedback.push('Meta description à optimiser');
    }
  }

  // Score des keywords (0-15)
  if (article.seo?.keywords) {
    const keywordCount = article.seo.keywords.split(',').filter(k => k.trim()).length;
    if (keywordCount >= 5 && keywordCount <= 8) {
      scores.keywords = 15;
    } else if (keywordCount >= 3 && keywordCount <= 10) {
      scores.keywords = 12;
      feedback.push('Nombre de keywords non optimal (visez 5-8)');
    } else {
      scores.keywords = 8;
      feedback.push('Ajustez le nombre de keywords');
    }
  }

  // Score du contenu (0-20)
  if (article.content) {
    const wordCount = article.content.split(/\s+/).length;
    if (wordCount >= 1500 && wordCount <= 2500) {
      scores.content = 20;
    } else if (wordCount >= 1000 && wordCount <= 3000) {
      scores.content = 15;
      feedback.push('Longueur du contenu non optimale (visez 1500-2500 mots)');
    } else if (wordCount >= 500) {
      scores.content = 10;
      feedback.push('Contenu un peu court pour un bon SEO');
    } else {
      scores.content = 5;
      feedback.push('Contenu trop court');
    }
  }

  // Score de la structure (0-15)
  const h2Count = (article.content?.match(/^## /gm) || []).length;
  const h3Count = (article.content?.match(/^### /gm) || []).length;
  
  if (h2Count >= 4 && h2Count <= 8) {
    scores.structure += 10;
  } else if (h2Count >= 2) {
    scores.structure += 6;
    feedback.push('Ajoutez plus de sous-titres H2 (4-8 recommandés)');
  } else {
    scores.structure += 3;
    feedback.push('Structure insuffisante: ajoutez des H2');
  }

  if (h3Count >= 2) {
    scores.structure += 5;
  } else {
    scores.structure += 2;
    feedback.push('Considérez ajouter des H3 pour plus de structure');
  }

  // Calcul du score total
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const maxScore = 100;
  const percentage = Math.round((totalScore / maxScore) * 100);

  // Déterminer le niveau
  let level;
  if (percentage >= 90) level = 'Excellent';
  else if (percentage >= 75) level = 'Bon';
  else if (percentage >= 60) level = 'Acceptable';
  else if (percentage >= 40) level = 'À améliorer';
  else level = 'Faible';

  return {
    scores,
    totalScore,
    maxScore,
    percentage,
    level,
    feedback
  };
}

/**
 * Générer des suggestions d'amélioration SEO
 */
export function generateSEOSuggestions(article) {
  const suggestions = [];

  // Vérifier le titre
  if (!article.title?.includes(' : ') && !article.title?.includes(' - ')) {
    suggestions.push({
      field: 'title',
      priority: 'medium',
      suggestion: 'Considérez ajouter un séparateur (: ou -) pour structurer le titre'
    });
  }

  // Vérifier les liens internes (mention)
  if (!article.content?.includes('[')) {
    suggestions.push({
      field: 'content',
      priority: 'high',
      suggestion: 'Ajoutez des liens internes vers d\'autres articles du blog'
    });
  }

  // Vérifier les images
  if (!article.coverImage) {
    suggestions.push({
      field: 'coverImage',
      priority: 'high',
      suggestion: 'Ajoutez une image de couverture (1200x630px recommandé)'
    });
  }

  // Vérifier les listes à puces
  const bulletCount = (article.content?.match(/^- /gm) || []).length;
  if (bulletCount < 3) {
    suggestions.push({
      field: 'content',
      priority: 'low',
      suggestion: 'Ajoutez des listes à puces pour améliorer la lisibilité'
    });
  }

  return suggestions;
}

export default {
  generateSEO,
  analyzeSEOScore,
  generateSEOSuggestions
};

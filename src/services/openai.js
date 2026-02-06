/**
 * Service OpenAI pour la génération de contenu
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/helpers.js';

let openaiClient = null;

/**
 * Modèles qui utilisent max_completion_tokens au lieu de max_tokens
 * Inclut GPT-4o, GPT-5 family, et modèles de raisonnement
 */
const MODELS_WITH_COMPLETION_TOKENS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5.2',
  'o1', 'o1-mini', 'o1-preview',
  'o3', 'o3-mini', 'o4-mini'
];

/**
 * Vérifie si le modèle utilise max_completion_tokens
 */
function usesCompletionTokens(model) {
  return MODELS_WITH_COMPLETION_TOKENS.some(m => model.startsWith(m));
}

/**
 * Vérifie si le modèle ne supporte pas temperature/top_p personnalisés
 * Inclut: modèles de raisonnement (o1, o3, o4) et GPT-5 family
 */
function doesNotSupportTemperature(model) {
  return (
    model.startsWith('o1') || 
    model.startsWith('o3') || 
    model.startsWith('o4') ||
    model.startsWith('gpt-5')
  );
}

/**
 * Initialiser le client OpenAI
 */
export function initOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non définie dans le fichier .env');
  }

  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  logger.info('Client OpenAI initialisé');
  return openaiClient;
}

/**
 * Obtenir le client OpenAI
 */
export function getOpenAI() {
  if (!openaiClient) {
    return initOpenAI();
  }
  return openaiClient;
}

/**
 * Générer une complétion avec OpenAI
 */
export async function generateCompletion(systemPrompt, userPrompt, options = {}) {
  const client = getOpenAI();
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-5-mini';
  
  logger.debug(`Génération avec modèle: ${model}`);

  // Construire les paramètres selon le modèle
  const params = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  // Paramètre de tokens selon le modèle
  const maxTokens = options.maxTokens ?? 8000;
  if (usesCompletionTokens(model)) {
    params.max_completion_tokens = maxTokens;
  } else {
    params.max_tokens = maxTokens;
  }

  // Les modèles o1/o3 ne supportent pas certains paramètres
  if (!doesNotSupportTemperature(model)) {
    params.temperature = options.temperature ?? 0.8;
    params.top_p = options.topP ?? 0.9;
    params.frequency_penalty = options.frequencyPenalty ?? 0.3;
    params.presence_penalty = options.presencePenalty ?? 0.2;
  }

  logger.debug(`Paramètres: ${JSON.stringify({ model, maxTokens, isReasoning: doesNotSupportTemperature(model) })}`);

  const completion = await retryWithBackoff(async () => {
    return await client.chat.completions.create(params);
  }, 3, 2000);

  // Debug de la réponse
  const finishReason = completion.choices[0]?.finish_reason;
  logger.debug(`Finish reason: ${finishReason}`);

  const message = completion.choices[0]?.message;
  const content = message?.content;

  // Vérifier si le modèle a refusé
  if (message?.refusal) {
    logger.error('Le modèle a refusé de générer:', message.refusal);
    throw new Error(`Génération refusée: ${message.refusal}`);
  }

  // Vérifier si la génération s'est arrêtée prématurément
  if (finishReason === 'length') {
    logger.warn(`Génération tronquée (max_tokens: ${maxTokens}) - le contenu peut être incomplet`);
  }

  if (!content || content.trim() === '') {
    if (finishReason === 'length') {
      throw new Error('Contenu vide : le modèle n\'a pas eu assez de tokens pour générer une réponse');
    }
    logger.error('Réponse vide. Choices:', JSON.stringify(completion.choices, null, 2));
    throw new Error('Aucun contenu généré par OpenAI');
  }

  logger.debug(`Tokens utilisés: ${completion.usage?.total_tokens || 'N/A'}`);

  return content;
}

/**
 * Générer du contenu JSON structuré
 * Gère automatiquement le retry avec plus de tokens si finish_reason === "length"
 */
export async function generateJSON(systemPrompt, userPrompt, options = {}) {
  const client = getOpenAI();
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-5-mini';
  
  let maxTokens = options.maxTokens ?? 4000;
  const maxRetries = 2; // On peut retenter 2 fois avec plus de tokens

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Construire les paramètres selon le modèle
    const params = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    };

    if (usesCompletionTokens(model)) {
      params.max_completion_tokens = maxTokens;
    } else {
      params.max_tokens = maxTokens;
    }

    if (!doesNotSupportTemperature(model)) {
      params.temperature = options.temperature ?? 0.7;
    }

    const completion = await retryWithBackoff(async () => {
      return await client.chat.completions.create(params);
    }, 3, 2000);

    const finishReason = completion.choices[0]?.finish_reason;
    const content = completion.choices[0]?.message?.content;

    // Cas 1 : réponse tronquée (finish_reason: "length") — retenter avec plus de tokens
    if (finishReason === 'length' && attempt < maxRetries) {
      const oldMax = maxTokens;
      maxTokens = Math.min(maxTokens * 2, 16000);
      logger.warn(`JSON tronqué (finish_reason: length, max_tokens: ${oldMax}). Retry avec ${maxTokens} tokens...`);
      continue;
    }

    // Cas 2 : contenu vide malgré les retries
    if (!content || content.trim() === '') {
      // Si c'est un problème de length, donner un message clair
      if (finishReason === 'length') {
        logger.error(`Réponse JSON vide après ${attempt + 1} tentative(s) (finish_reason: length, max_tokens: ${maxTokens})`);
        throw new Error('Génération JSON échouée : le modèle manque de tokens pour compléter la réponse. Essayez de réduire la taille du prompt ou d\'augmenter max_tokens.');
      }
      logger.error('Réponse JSON vide. Choices:', JSON.stringify(completion.choices, null, 2));
      throw new Error('Aucun contenu JSON généré par OpenAI');
    }

    // Cas 3 : on a du contenu, essayer de parser
    // Si tronqué (length) mais on a du contenu partiel, tenter de le réparer
    let jsonStr = content;
    if (finishReason === 'length') {
      logger.warn('JSON potentiellement tronqué, tentative de réparation...');
      jsonStr = repairTruncatedJSON(content);
    }

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      // Si c'est un problème de troncature et qu'on peut retenter
      if (finishReason === 'length' && attempt < maxRetries) {
        const oldMax = maxTokens;
        maxTokens = Math.min(maxTokens * 2, 16000);
        logger.warn(`JSON invalide (tronqué). Retry avec ${maxTokens} tokens (était ${oldMax})...`);
        continue;
      }
      logger.error('Erreur parsing JSON:', content.slice(0, 500));
      throw new Error('Le contenu généré n\'est pas un JSON valide');
    }
  }
}

/**
 * Tenter de réparer un JSON tronqué
 * Ferme les chaînes, tableaux et objets ouverts
 */
function repairTruncatedJSON(content) {
  let json = content.trim();
  
  // Compter les accolades et crochets ouverts/fermés
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;
  
  for (const char of json) {
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
  }
  
  // Si on est dans une string non fermée, la fermer
  if (inString) {
    json += '"';
  }
  
  // Fermer les crochets manquants
  while (brackets > 0) {
    json += ']';
    brackets--;
  }
  
  // Fermer les accolades manquantes
  while (braces > 0) {
    json += '}';
    braces--;
  }
  
  return json;
}

/**
 * Vérifier la connexion OpenAI
 * Vérifie simplement que la clé API est configurée et que le client s'initialise
 * (pas d'appel réseau — le premier vrai appel servira de test)
 */
export async function testOpenAIConnection() {
  try {
    getOpenAI(); // Vérifie que la clé API est présente et le client s'initialise
    logger.success('Client OpenAI prêt');
    return true;
  } catch (error) {
    logger.error('Erreur configuration OpenAI:', error.message);
    return false;
  }
}

export default {
  initOpenAI,
  getOpenAI,
  generateCompletion,
  generateJSON,
  testOpenAIConnection
};

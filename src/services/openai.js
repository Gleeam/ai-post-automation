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
    logger.warn('Génération tronquée - limite de tokens atteinte');
  }

  if (!content) {
    logger.error('Réponse vide. Choices:', JSON.stringify(completion.choices, null, 2));
    throw new Error('Aucun contenu généré par OpenAI');
  }

  logger.debug(`Tokens utilisés: ${completion.usage?.total_tokens || 'N/A'}`);

  return content;
}

/**
 * Générer du contenu JSON structuré
 */
export async function generateJSON(systemPrompt, userPrompt, options = {}) {
  const client = getOpenAI();
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-5-mini';

  // Construire les paramètres selon le modèle
  const params = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  };

  // Paramètre de tokens selon le modèle
  const maxTokens = options.maxTokens ?? 4000;
  if (usesCompletionTokens(model)) {
    params.max_completion_tokens = maxTokens;
  } else {
    params.max_tokens = maxTokens;
  }

  // Les modèles o1/o3 ne supportent pas temperature
  if (!doesNotSupportTemperature(model)) {
    params.temperature = options.temperature ?? 0.7;
  }

  const completion = await retryWithBackoff(async () => {
    return await client.chat.completions.create(params);
  }, 3, 2000);

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    logger.error('Réponse JSON vide. Choices:', JSON.stringify(completion.choices, null, 2));
    throw new Error('Aucun contenu JSON généré par OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    logger.error('Erreur parsing JSON:', content);
    throw new Error('Le contenu généré n\'est pas un JSON valide');
  }
}

/**
 * Vérifier la connexion OpenAI
 */
export async function testOpenAIConnection() {
  try {
    const client = getOpenAI();
    await client.models.list();
    logger.success('Connexion OpenAI vérifiée');
    return true;
  } catch (error) {
    logger.error('Erreur connexion OpenAI:', error.message);
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

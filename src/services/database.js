/**
 * Service de connexion à la base de données MongoDB
 */

import { MongoClient, ObjectId } from 'mongodb';
import { logger } from '../utils/logger.js';

let client = null;
let db = null;

/**
 * Connecter à MongoDB
 */
export async function connectDatabase() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MONGODB_URI non définie dans le fichier .env');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    // Extraire le nom de la base de données de l'URI
    const dbName = uri.split('/').pop()?.split('?')[0] || 'gleeam-blog';
    db = client.db(dbName);
    
    logger.success(`Connecté à MongoDB: ${dbName}`);
    return db;
  } catch (error) {
    logger.error('Erreur connexion MongoDB:', error.message);
    throw error;
  }
}

/**
 * Déconnecter de MongoDB
 */
export async function disconnectDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('Déconnecté de MongoDB');
  }
}

/**
 * Obtenir la collection des articles
 */
export async function getPostsCollection() {
  const database = await connectDatabase();
  return database.collection('posts');
}

/**
 * Créer un nouvel article
 */
export async function createPost(articleData) {
  const collection = await getPostsCollection();
  
  const document = {
    ...articleData,
    _id: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await collection.insertOne(document);
  
  logger.success(`Article créé avec ID: ${result.insertedId}`);
  
  return {
    id: result.insertedId.toString(),
    ...document
  };
}

/**
 * Mettre à jour un article
 */
export async function updatePost(id, updates) {
  const collection = await getPostsCollection();
  
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    { 
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    throw new Error(`Article non trouvé: ${id}`);
  }

  logger.success(`Article mis à jour: ${id}`);
  return result;
}

/**
 * Trouver un article par slug
 */
export async function findPostBySlug(slug) {
  const collection = await getPostsCollection();
  return await collection.findOne({ slug });
}

/**
 * Vérifier si un slug existe déjà
 */
export async function slugExists(slug) {
  const post = await findPostBySlug(slug);
  return !!post;
}

/**
 * Générer un slug unique
 */
export async function generateUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  
  while (await slugExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Lister les articles récents
 */
export async function getRecentPosts(limit = 10) {
  const collection = await getPostsCollection();
  
  return await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Compter le nombre total d'articles
 */
export async function countPosts() {
  const collection = await getPostsCollection();
  return await collection.countDocuments();
}

/**
 * Tester la connexion
 */
export async function testConnection() {
  try {
    await connectDatabase();
    const count = await countPosts();
    logger.info(`Articles existants dans la base: ${count}`);
    return true;
  } catch (error) {
    logger.error('Test de connexion échoué:', error.message);
    return false;
  }
}

export default {
  connectDatabase,
  disconnectDatabase,
  getPostsCollection,
  createPost,
  updatePost,
  findPostBySlug,
  slugExists,
  generateUniqueSlug,
  getRecentPosts,
  countPosts,
  testConnection
};

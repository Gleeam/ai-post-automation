/**
 * Configuration des thématiques pour la génération d'articles
 * Catégories, mots-clés et tendances pour le contenu tech
 */

export const TOPICS = {
  webDevelopment: {
    name: 'Développement Web',
    emoji: '🌐',
    keywords: [
      'frontend', 'backend', 'full-stack', 'javascript', 'typescript',
      'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte',
      'node.js', 'express', 'nestjs', 'api rest', 'graphql',
      'html5', 'css3', 'tailwind', 'sass', 'responsive design',
      'performance web', 'progressive web app', 'pwa', 'jamstack',
      'server-side rendering', 'static site generation', 'edge computing'
    ],
    searchQueries: [
      'web development trends 2026',
      'frontend framework comparison',
      'backend technologies news',
      'javascript ecosystem updates'
    ]
  },

  mobileDevelopment: {
    name: 'Développement Mobile',
    emoji: '📱',
    keywords: [
      'ios', 'android', 'swift', 'kotlin', 'react native', 'flutter',
      'cross-platform', 'mobile app', 'app store optimization',
      'mobile ui/ux', 'push notifications', 'offline-first',
      'mobile security', 'app performance', 'wearables', 'iot mobile'
    ],
    searchQueries: [
      'mobile development trends 2026',
      'flutter vs react native',
      'ios android development news',
      'mobile app best practices'
    ]
  },

  artificialIntelligence: {
    name: 'Intelligence Artificielle',
    emoji: '🤖',
    keywords: [
      'machine learning', 'deep learning', 'nlp', 'computer vision',
      'ia générative', 'chatgpt', 'gpt', 'claude', 'llm', 'transformers',
      'prompt engineering', 'fine-tuning', 'rag', 'embeddings',
      'tensorflow', 'pytorch', 'hugging face', 'openai', 'anthropic',
      'automatisation ia', 'agents ia', 'multimodal ai'
    ],
    searchQueries: [
      'artificial intelligence news 2026',
      'generative ai developments',
      'llm updates and releases',
      'ai in software development'
    ]
  },

  blockchain: {
    name: 'Blockchain & Web3',
    emoji: '⛓️',
    keywords: [
      'blockchain', 'ethereum', 'solidity', 'smart contracts', 'defi',
      'nft', 'web3', 'dao', 'tokenomics', 'layer 2', 'polygon',
      'bitcoin', 'crypto', 'wallet', 'dapp', 'ipfs', 'decentralization',
      'consensus', 'proof of stake', 'zk-rollups', 'cross-chain'
    ],
    searchQueries: [
      'blockchain technology news 2026',
      'web3 development updates',
      'ethereum ecosystem news',
      'defi and crypto trends'
    ]
  },

  softwareArchitecture: {
    name: 'Architecture Logicielle',
    emoji: '🏗️',
    keywords: [
      'microservices', 'monolithe', 'architecture hexagonale', 'ddd',
      'design patterns', 'solid', 'clean architecture', 'cqrs',
      'event sourcing', 'api design', 'scalabilité', 'haute disponibilité',
      'load balancing', 'caching', 'message queue', 'kafka', 'rabbitmq',
      'service mesh', 'kubernetes', 'containerization', 'docker'
    ],
    searchQueries: [
      'software architecture patterns 2026',
      'microservices best practices',
      'system design trends',
      'scalable architecture news'
    ]
  },

  databases: {
    name: 'Bases de Données',
    emoji: '🗄️',
    keywords: [
      'sql', 'nosql', 'postgresql', 'mongodb', 'mysql', 'redis',
      'elasticsearch', 'graphdb', 'time series', 'vector database',
      'orm', 'query optimization', 'indexing', 'sharding', 'replication',
      'acid', 'cap theorem', 'data modeling', 'migration', 'backup'
    ],
    searchQueries: [
      'database technology trends 2026',
      'sql vs nosql comparison',
      'vector database news',
      'database performance optimization'
    ]
  },

  dataAnalytics: {
    name: 'Analyse de Données',
    emoji: '📊',
    keywords: [
      'data science', 'business intelligence', 'data visualization',
      'tableau', 'power bi', 'python data', 'pandas', 'numpy',
      'data pipeline', 'etl', 'data warehouse', 'data lake',
      'big data', 'spark', 'hadoop', 'analytics', 'kpi', 'reporting',
      'predictive analytics', 'data governance', 'data quality'
    ],
    searchQueries: [
      'data analytics trends 2026',
      'business intelligence news',
      'data science tools updates',
      'big data technology news'
    ]
  },

  cloudDevOps: {
    name: 'Cloud & DevOps',
    emoji: '☁️',
    keywords: [
      'aws', 'azure', 'google cloud', 'cloud native', 'serverless',
      'ci/cd', 'github actions', 'gitlab ci', 'jenkins', 'terraform',
      'infrastructure as code', 'monitoring', 'observability', 'logging',
      'kubernetes', 'helm', 'gitops', 'sre', 'incident management'
    ],
    searchQueries: [
      'cloud computing trends 2026',
      'devops best practices',
      'kubernetes news updates',
      'serverless architecture news'
    ]
  },

  cybersecurity: {
    name: 'Cybersécurité',
    emoji: '🔒',
    keywords: [
      'sécurité web', 'owasp', 'penetration testing', 'vulnerability',
      'encryption', 'authentication', 'oauth', 'jwt', 'zero trust',
      'soc', 'siem', 'threat detection', 'ransomware', 'phishing',
      'compliance', 'gdpr', 'security audit', 'devsecops'
    ],
    searchQueries: [
      'cybersecurity threats 2026',
      'web security best practices',
      'data protection news',
      'security vulnerabilities updates'
    ]
  },

  uxDesign: {
    name: 'UX/UI Design',
    emoji: '🎨',
    keywords: [
      'user experience', 'user interface', 'design system', 'figma',
      'prototyping', 'wireframing', 'usability testing', 'accessibility',
      'wcag', 'design thinking', 'user research', 'interaction design',
      'motion design', 'responsive design', 'design tokens', 'atomic design'
    ],
    searchQueries: [
      'ux design trends 2026',
      'ui design best practices',
      'accessibility standards news',
      'design tools updates'
    ]
  }
};

/**
 * Obtenir toutes les catégories
 */
export function getAllCategories() {
  return Object.entries(TOPICS).map(([key, value]) => ({
    id: key,
    ...value
  }));
}

/**
 * Obtenir une catégorie aléatoire
 */
export function getRandomCategory() {
  const categories = Object.keys(TOPICS);
  const randomIndex = Math.floor(Math.random() * categories.length);
  const key = categories[randomIndex];
  return { id: key, ...TOPICS[key] };
}

/**
 * Obtenir les mots-clés de toutes les catégories
 */
export function getAllKeywords() {
  return Object.values(TOPICS).flatMap(topic => topic.keywords);
}

/**
 * Obtenir les requêtes de recherche pour les tendances
 */
export function getTrendSearchQueries() {
  return Object.values(TOPICS).flatMap(topic => topic.searchQueries);
}

export default TOPICS;

# 🚀 Gleeam Article Automation

Script d'automatisation pour la génération d'articles SEO-optimisés, avec support multilingue et intégration CMS.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5-purple.svg)](https://openai.com/)

## ✨ Fonctionnalités

- **🔍 Recherche de tendances** : Identification automatique des sujets d'actualité via Brave Search, Serper.dev ou News API
- **🤖 Génération IA avancée** : Contenu naturel et difficile à détecter comme généré par IA
- **📝 Processus en 6 étapes** : Analyse du sujet → Plan détaillé → Rédaction → Post-traitement → SEO → Assemblage
- **🔎 Optimisation SEO complète** : Meta title, description, keywords, structure H1-H6, scoring SEO
- **🌍 Multi-langue** : Génération et traduction automatique FR ↔ EN ↔ ES
- **⏰ Automatisation CRON** : Script dédié pour la génération planifiée
- **💾 Intégration CMS** : Publication directe vers Payload CMS / MongoDB

## 📦 Installation

```bash
git clone https://github.com/gleeam/article-automation.git
cd article-automation
npm install
cp .env.example .env
```

Éditez `.env` avec vos clés API.

## ⚙️ Configuration

### Variables d'environnement

```env
# Obligatoire
OPENAI_API_KEY=sk-votre-clé
OPENAI_MODEL=gpt-5-mini          # ou gpt-5-nano, gpt-5.2, gpt-4o-mini
MONGODB_URI=mongodb://localhost:27017/gleeam-blog

# APIs de recherche (au moins une recommandée)
BRAVE_API_KEY=votre-clé          # 2000 req/mois gratuites
SERPER_API_KEY=votre-clé         # 2500 req gratuites
NEWS_API_KEY=votre-clé           # 100 req/jour gratuites

# Options
DEFAULT_LANGUAGE=fr
DEFAULT_AUTHOR=Gleeam
LOG_LEVEL=info
```

### Modèles OpenAI supportés

| Modèle | Usage | Coût |
|--------|-------|------|
| `gpt-5-mini` | **Recommandé** - Équilibré | $$ |
| `gpt-5-nano` | Tâches simples, rapide | $ |
| `gpt-5.2` | Tâches complexes | $$$ |
| `gpt-4o-mini` | Alternative stable | $$ |

### APIs de recherche de tendances

| API | Quota gratuit | Inscription |
|-----|---------------|-------------|
| **Brave Search** | 2000 req/mois | [brave.com/search/api](https://brave.com/search/api/) |
| **Serper.dev** | 2500 req | [serper.dev](https://serper.dev/) |
| **News API** | 100 req/jour | [newsapi.org](https://newsapi.org/) |

Le script utilise automatiquement l'API disponible : Brave → Serper → News API → Fallback local.

## 🚀 Utilisation

### Mode interactif

```bash
npm start
```

Menu interactif avec options :
- Générer sur un sujet spécifique
- Générer sur une tendance actuelle
- Générer sur un sujet aléatoire
- Rechercher les tendances
- Obtenir des suggestions

### Ligne de commande

```bash
# Article sur un sujet
npm run generate -- --topic "Les nouveautés de Next.js 16"

# Avec catégorie spécifique
npm run generate -- --topic "L'IA en 2026" -c artificialIntelligence

# Multilingue (FR + EN + ES)
npm run generate -- --topic "Web3 et blockchain" --multilingual

# Rechercher les tendances
npm run research

# Génération en batch
npm run batch -- --count 5
```

### Options CLI

| Option | Description |
|--------|-------------|
| `-t, --topic <sujet>` | Sujet de l'article |
| `-c, --category <id>` | Catégorie (voir liste ci-dessous) |
| `-l, --language <lang>` | Langue source (fr, en, es) |
| `-m, --multilingual` | Traduire en FR + EN + ES |
| `--auto-publish` | Publier directement |

## ⏰ Automatisation CRON

### Script dédié

```bash
# 1 article aléatoire (brouillon)
npm run cron

# 1 article publié + multilingue
npm run cron:daily

# 5 articles publiés + multilingues
npm run cron:weekly
```

### Options CRON

```bash
node src/cron.js [options]

Options:
  -n, --count <n>       Nombre d'articles (défaut: 1)
  -p, --publish         Publier directement
  -m, --multilingual    Traduire FR/EN/ES
  -c, --category <id>   Catégorie spécifique
  --dry-run             Tester sans sauvegarder
```

### Configuration crontab

```bash
# Éditer la crontab
crontab -e

# Génération quotidienne à 9h
0 9 * * * cd /path/to/automations && node src/cron.js -p -m >> logs/cron.log 2>&1

# Génération hebdomadaire (lundi 8h, 3 articles)
0 8 * * 1 cd /path/to/automations && node src/cron.js -n 3 -p -m >> logs/cron.log 2>&1
```

## 📂 Catégories disponibles

| ID | Catégorie |
|----|-----------|
| `webDevelopment` | 🌐 Développement Web |
| `mobileDevelopment` | 📱 Développement Mobile |
| `artificialIntelligence` | 🤖 Intelligence Artificielle |
| `blockchain` | ⛓️ Blockchain & Web3 |
| `softwareArchitecture` | 🏗️ Architecture Logicielle |
| `databases` | 🗄️ Bases de Données |
| `dataAnalytics` | 📊 Analyse de Données |
| `cloudDevOps` | ☁️ Cloud & DevOps |
| `cybersecurity` | 🔒 Cybersécurité |
| `uxDesign` | 🎨 UX/UI Design |

## 🔧 Processus de génération

Le script utilise un processus en **6 étapes** pour une qualité optimale :

```
1. 🔍 Analyse du sujet     → Angle original, titre accrocheur
2. 📋 Création du plan     → Structure H2/H3 détaillée
3. ✍️  Rédaction           → Contenu basé sur le plan
4. 🔄 Post-traitement      → Variations naturelles, anti-détection IA
5. 🎯 Optimisation SEO     → Meta tags, keywords, scoring
6. 📦 Assemblage final     → Validation et formatage CMS
```

## 🎨 Qualité du contenu

Techniques utilisées pour un contenu naturel :

- **Ton conversationnel** : Proche mais professionnel
- **Variations syntaxiques** : Phrases courtes et longues alternées
- **Expressions idiomatiques** : Tournures françaises naturelles
- **Questions rhétoriques** : Engagement du lecteur
- **Exemples concrets** : Contextualisation pratique
- **Normalisation** : Pas de texte en MAJUSCULES abusives

## 📁 Structure du projet

```
automations/
├── .env.example          # Template variables d'environnement
├── .gitignore            # Fichiers ignorés
├── package.json          # Dépendances et scripts
├── README.md             # Documentation (ce fichier)
└── src/
    ├── index.js          # CLI interactif
    ├── cron.js           # Script automatisation CRON
    ├── config/
    │   └── topics.js     # Catégories et mots-clés
    ├── services/
    │   ├── openai.js     # Client OpenAI (GPT-5 compatible)
    │   ├── trends.js     # Brave/Serper/News API
    │   └── database.js   # MongoDB / Payload CMS
    ├── generators/
    │   ├── article.js    # Générateur principal (6 étapes)
    │   ├── seo.js        # Optimisation et scoring SEO
    │   └── translator.js # Traduction multilingue
    ├── prompts/
    │   └── templates.js  # Prompts optimisés anti-détection
    └── utils/
        ├── logger.js     # Logging coloré
        └── helpers.js    # Utilitaires (slug, SEO, caps)
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 License

MIT © [Gleeam](https://gleeam.com)

---

**[English version](README.en.md)** | Made with ❤️ by Gleeam

/**
 * Module de logging avec coloration et niveaux
 */

import chalk from 'chalk';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Formatter la date pour les logs
 */
function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Logger avec différents niveaux
 */
export const logger = {
  error: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(
        chalk.red(`[${getTimestamp()}] ❌ ERROR:`),
        chalk.red(message),
        ...args
      );
    }
  },

  warn: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(
        chalk.yellow(`[${getTimestamp()}] ⚠️  WARN:`),
        chalk.yellow(message),
        ...args
      );
    }
  },

  info: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(
        chalk.blue(`[${getTimestamp()}] ℹ️  INFO:`),
        message,
        ...args
      );
    }
  },

  success: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(
        chalk.green(`[${getTimestamp()}] ✅ SUCCESS:`),
        chalk.green(message),
        ...args
      );
    }
  },

  debug: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(
        chalk.gray(`[${getTimestamp()}] 🔍 DEBUG:`),
        chalk.gray(message),
        ...args
      );
    }
  },

  step: (stepNumber, totalSteps, message) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(
        chalk.cyan(`\n[${getTimestamp()}] 📍 STEP ${stepNumber}/${totalSteps}:`),
        chalk.cyan(message)
      );
    }
  },

  divider: () => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
    }
  },

  header: (title) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(chalk.bold.magenta(`\n${'═'.repeat(60)}`));
      console.log(chalk.bold.magenta(`  ${title}`));
      console.log(chalk.bold.magenta(`${'═'.repeat(60)}\n`));
    }
  },

  json: (label, data) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(chalk.gray(`[${getTimestamp()}] 📄 ${label}:`));
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }
};

export default logger;

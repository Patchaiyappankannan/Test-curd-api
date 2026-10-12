const path = require('node:path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');
const { migrateProducts } = require('../migrations/create-products');

dotenv.config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../../../.env') });

function getDatabaseConfig() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }

  const databaseName = process.env.DB_NAME;
  if (!/^[A-Za-z-]+$/.test(databaseName)) {
    throw new Error('DB_NAME may contain only letters and hyphens.');
  }

  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
  }

  return {
    host: process.env.DB_HOST,
    port,
    database: databaseName,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mssql',
    logging: false,
    dialectOptions: {
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
      }
    },
    pool: { min: 0, max: 5, acquire: 30000, idle: 10000 }
  };
}

function createConnection(config, database = config.database) {
  return new Sequelize(database, config.username, config.password, {
    dialect: config.dialect,
    host: config.host,
    port: config.port,
    logging: config.logging,
    dialectOptions: config.dialectOptions,
    pool: config.pool
  });
}

async function ensureDatabase(config) {
  const admin = createConnection(config, 'master');
  try {
    await admin.authenticate();
    await admin.query(
      `IF DB_ID(N'${config.database}') IS NULL CREATE DATABASE [${config.database}];`
    );
  } finally {
    await admin.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function initializeDatabase() {
  const config = getDatabaseConfig();
  const attempts = Number(process.env.DB_RETRY_ATTEMPTS || 30);
  const retryDelay = Number(process.env.DB_RETRY_DELAY_MS || 2000);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let sequelize;
    try {
      await ensureDatabase(config);
      sequelize = createConnection(config);
      await sequelize.authenticate();
      await migrateProducts(sequelize);
      return sequelize;
    } catch (error) {
      if (sequelize) await sequelize.close().catch(() => {});
      if (attempt === attempts) throw error;
      console.error(`Database is not ready (attempt ${attempt}/${attempts}): ${error.message}`);
      await delay(retryDelay);
    }
  }

  throw new Error('Database initialization failed.');
}

module.exports = { initializeDatabase };
const express = require('express');
const { initializeDatabase } = require('./config/database');
const { defineProduct } = require('./models/product');
const { createProductsRouter } = require('./routes/products');

function createApp(sequelize) {
  const app = express();
  const Product = defineProduct(sequelize);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', async (req, res) => {
    await sequelize.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use('/api/products', createProductsRouter(Product));
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body contains invalid JSON.' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'The product could not be saved with the supplied values.' });
    }
    console.error(error);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

async function start() {
  const sequelize = await initializeDatabase();
  const app = createApp(sequelize);
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Products API listening on port ${port}.`);
  });

  const shutdown = () => server.close(async () => {
    await sequelize.close();
    process.exit(0);
  });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error('API startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { createApp, start };
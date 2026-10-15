const { Router } = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'));
const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      fs.mkdir(uploadDirectory, { recursive: true }, (error) => callback(error, uploadDirectory));
    },
    filename: (req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${allowedImageTypes.get(file.mimetype) || ''}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, allowedImageTypes.has(file.mimetype))
});

function deleteImage(imageUrl) {
  if (!imageUrl) return;
  const fileName = path.basename(imageUrl);
  fs.unlink(path.join(uploadDirectory, fileName), () => {});
}

function validateProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const name = typeof body.Name === 'string' ? body.Name.trim() : '';
  const description = body.Description == null ? '' : body.Description;
  const hasPrice = body.Price !== undefined && body.Price !== null && String(body.Price).trim() !== '';
  const hasStock = body.Stock !== undefined && body.Stock !== null && String(body.Stock).trim() !== '';
  const price = Number(body.Price);
  const stock = Number(body.Stock);

  if (!name || name.length > 120) return { error: 'Name is required and must be at most 120 characters.' };
  if (typeof description !== 'string' || description.length > 1000) {
    return { error: 'Description must be at most 1000 characters.' };
  }
  if (!hasPrice || !Number.isFinite(price) || price < 0 || price > 99999999.99 || Math.round(price * 100) !== price * 100) {
    return { error: 'Price must be a non-negative amount with at most two decimal places.' };
  }
  if (!hasStock || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) {
    return { error: 'Stock must be a non-negative whole number.' };
  }

  return { value: { Name: name, Description: description.trim(), Price: price, Stock: stock } };
}

function createProductsRouter(Product) {
  const router = Router();
  const getId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  router.get('/', async (req, res) => {
    const products = await Product.findAll({ order: [['Id', 'DESC']] });
    res.json(products);
  });

  router.get('/:id', async (req, res) => {
    const id = getId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Product ID must be a positive integer.' });
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
  });

  router.post('/', async (req, res) => {
    const result = validateProduct(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const product = await Product.create(result.value);
    res.status(201).json(product);
  });

  router.post('/:id/image', upload.single('image'), async (req, res) => {
    const id = getId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Product ID must be a positive integer.' });
    if (!req.file) return res.status(400).json({ error: 'Upload a JPEG, PNG, or WebP image up to 5 MB.' });

    const product = await Product.findByPk(id);
    if (!product) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Product not found.' });
    }

    const previousImage = product.ImageUrl;
    await product.update({ ImageUrl: `/api/uploads/${req.file.filename}` });
    deleteImage(previousImage);
    res.json(product);
  });

  router.put('/:id', async (req, res) => {
    const result = validateProduct(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const id = getId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Product ID must be a positive integer.' });
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    await product.update(result.value);
    res.json(product);
  });

  router.delete('/:id', async (req, res) => {
    const id = getId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Product ID must be a positive integer.' });
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const imageUrl = product.ImageUrl;
    await product.destroy();
    deleteImage(imageUrl);
    res.status(204).end();
  });

  return router;
}

module.exports = { createProductsRouter };

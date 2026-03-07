const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateAdmin } = require('../middleware/auth');

// Validation helper
function validateProduct(data) {
    const errors = [];
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Product name is required.');
    }
    if (data.name && data.name.length > 200) {
        errors.push('Product name must be under 200 characters.');
    }
    if (data.price === undefined || data.price === null || isNaN(Number(data.price)) || Number(data.price) <= 0) {
        errors.push('Price must be a positive number.');
    }
    if (data.price && Number(data.price) > 999999) {
        errors.push('Price is too high.');
    }
    if (data.description && data.description.length > 2000) {
        errors.push('Description must be under 2000 characters.');
    }
    if (data.category && data.category.length > 50) {
        errors.push('Category must be under 50 characters.');
    }
    return errors;
}

// GET /api/products - public list
router.get('/', (req, res) => {
    const db = getDb();
    const products = db.prepare('SELECT * FROM products WHERE in_stock = 1 ORDER BY created_at DESC').all();
    res.json(products);
});

// GET /api/products/all - admin: all products including out of stock
router.get('/all', authenticateAdmin, (req, res) => {
    const db = getDb();
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
});

// POST /api/products - admin only
router.post('/', authenticateAdmin, (req, res) => {
    const errors = validateProduct(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { name, price, description, badge, tag, image, category, in_stock } = req.body;
    const db = getDb();

    const result = db.prepare(
        'INSERT INTO products (name, price, description, badge, tag, image, category, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
        name.trim(),
        Number(price),
        (description || '').trim(),
        (badge || 'DIRECTLY IMPORTED').trim(),
        (tag || '').trim(),
        (image || '').trim(),
        (category || '').trim(),
        in_stock !== undefined ? (in_stock ? 1 : 0) : 1
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
});

// PUT /api/products/:id - admin only
router.put('/:id', authenticateAdmin, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const errors = validateProduct(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { name, price, description, badge, tag, image, category, in_stock } = req.body;

    db.prepare(
        'UPDATE products SET name=?, price=?, description=?, badge=?, tag=?, image=?, category=?, in_stock=? WHERE id=?'
    ).run(
        name.trim(),
        Number(price),
        (description || '').trim(),
        (badge || existing.badge).trim(),
        (tag || existing.tag).trim(),
        (image || existing.image).trim(),
        (category || existing.category).trim(),
        in_stock !== undefined ? (in_stock ? 1 : 0) : existing.in_stock,
        req.params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
});

// DELETE /api/products/:id - admin only
router.delete('/:id', authenticateAdmin, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted.' });
});

module.exports = router;

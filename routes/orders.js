const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getDb } = require('../database');
const { authenticateAdmin } = require('../middleware/auth');

// Rate limit checkout: 10 requests per 15 minutes per IP
const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many checkout attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Validation
function validateOrder(data) {
    const errors = [];
    if (!data.customer_name || typeof data.customer_name !== 'string' || data.customer_name.trim().length < 2) {
        errors.push('Customer name is required (min 2 characters).');
    }
    if (data.customer_name && data.customer_name.length > 100) {
        errors.push('Customer name is too long.');
    }
    if (!data.customer_phone || typeof data.customer_phone !== 'string') {
        errors.push('Phone number is required.');
    }
    if (data.customer_phone && !/^[\d\s\+\-()]{7,20}$/.test(data.customer_phone.trim())) {
        errors.push('Invalid phone number format.');
    }
    if (data.customer_email && typeof data.customer_email === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customer_email.trim())) {
            errors.push('Invalid email format.');
        }
    }
    if (!data.address || typeof data.address !== 'string' || data.address.trim().length < 5) {
        errors.push('Delivery address is required (min 5 characters).');
    }
    if (data.address && data.address.length > 500) {
        errors.push('Address is too long.');
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push('Order must contain at least one item.');
    }
    if (data.items && data.items.length > 50) {
        errors.push('Too many items in order.');
    }
    if (data.items) {
        for (const item of data.items) {
            if (!item.product_id || !item.quantity || item.quantity < 1) {
                errors.push('Each item must have a valid product_id and quantity.');
                break;
            }
            if (item.quantity > 100) {
                errors.push('Quantity per item cannot exceed 100.');
                break;
            }
        }
    }
    return errors;
}

// POST /api/orders - create order (checkout)
router.post('/', checkoutLimiter, (req, res) => {
    const errors = validateOrder(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { customer_name, customer_email, customer_phone, address, city, items } = req.body;
    const db = getDb();

    // Verify all products exist and calculate total
    let total = 0;
    const resolvedItems = [];
    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND in_stock = 1').get(item.product_id);
        if (!product) {
            return res.status(400).json({ error: `Product with id ${item.product_id} not found or out of stock.` });
        }
        total += product.price * item.quantity;
        resolvedItems.push({
            product_id: product.id,
            product_name: product.name,
            quantity: item.quantity,
            price: product.price
        });
    }

    // Insert order
    const result = db.prepare(
        'INSERT INTO orders (customer_name, customer_email, customer_phone, address, city, total) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
        customer_name.trim(),
        (customer_email || '').trim(),
        customer_phone.trim(),
        address.trim(),
        (city || '').trim(),
        total
    );

    const orderId = result.lastInsertRowid;

    // Insert order items
    const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
    );
    for (const item of resolvedItems) {
        insertItem.run(orderId, item.product_id, item.product_name, item.quantity, item.price);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.status(201).json({ order, items: orderItems });
});

// GET /api/orders - admin only
router.get('/', authenticateAdmin, (req, res) => {
    const db = getDb();
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json(orders);
});

// GET /api/orders/:id - admin only
router.get('/:id', authenticateAdmin, (req, res) => {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order, items });
});

// PUT /api/orders/:id/status - admin only
router.put('/:id/status', authenticateAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(updated);
});

module.exports = router;

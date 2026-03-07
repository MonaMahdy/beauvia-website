const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../database');

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;
const PAYMOB_BASE_URL = 'https://accept.paymob.com/v1';

// POST /api/paymob/pay - initiate payment for an order
router.post('/pay', async (req, res) => {
    const { order_id } = req.body;

    if (!order_id) {
        return res.status(400).json({ error: 'order_id is required.' });
    }

    if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID) {
        return res.status(500).json({ error: 'Payment gateway not configured.' });
    }

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.payment_status === 'paid') {
        return res.status(400).json({ error: 'Order is already paid.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order_id);

    try {
        // Step 1: Get auth token
        const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
            api_key: PAYMOB_API_KEY
        });
        const authToken = authRes.data.token;

        // Step 2: Create order on Paymob
        const paymobOrderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
            auth_token: authToken,
            delivery_needed: false,
            amount_cents: Math.round(order.total * 100),
            currency: 'EGP',
            items: items.map(item => ({
                name: item.product_name,
                amount_cents: Math.round(item.price * 100),
                quantity: item.quantity,
                description: item.product_name
            }))
        });
        const paymobOrderId = paymobOrderRes.data.id;

        // Step 3: Generate payment key
        const paymentKeyRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
            auth_token: authToken,
            amount_cents: Math.round(order.total * 100),
            expiration: 3600,
            order_id: paymobOrderId,
            billing_data: {
                first_name: order.customer_name.split(' ')[0] || 'N/A',
                last_name: order.customer_name.split(' ').slice(1).join(' ') || 'N/A',
                email: order.customer_email || 'na@beauvia.net',
                phone_number: order.customer_phone,
                street: order.address,
                city: order.city || 'Cairo',
                country: 'EG',
                apartment: 'N/A',
                floor: 'N/A',
                building: 'N/A',
                shipping_method: 'N/A',
                postal_code: 'N/A',
                state: 'N/A'
            },
            currency: 'EGP',
            integration_id: Number(PAYMOB_INTEGRATION_ID)
        });
        const paymentKey = paymentKeyRes.data.token;

        // Update order with paymob_order_id
        db.prepare('UPDATE orders SET paymob_order_id = ? WHERE id = ?').run(String(paymobOrderId), order_id);

        // Return iframe URL
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID || ''}?payment_token=${paymentKey}`;

        res.json({
            payment_url: iframeUrl,
            payment_key: paymentKey,
            paymob_order_id: paymobOrderId
        });
    } catch (err) {
        console.error('Paymob error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
    }
});

// POST /api/paymob/callback - Paymob transaction callback (webhook)
router.post('/callback', (req, res) => {
    const data = req.body;

    // Verify HMAC if secret is configured
    if (PAYMOB_HMAC_SECRET && req.query.hmac) {
        const obj = data.obj;
        const hmacString = [
            obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
            obj.has_parent_transaction, obj.id, obj.integration_id,
            obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded,
            obj.is_standalone_payment, obj.is_voided, obj.order?.id,
            obj.owner, obj.pending, obj.source_data?.pan, obj.source_data?.sub_type,
            obj.source_data?.type, obj.success
        ].join('');

        const calculatedHmac = crypto
            .createHmac('sha512', PAYMOB_HMAC_SECRET)
            .update(hmacString)
            .digest('hex');

        if (calculatedHmac !== req.query.hmac) {
            console.error('HMAC verification failed');
            return res.status(403).json({ error: 'Invalid HMAC.' });
        }
    }

    // Update order payment status
    if (data.obj && data.obj.order) {
        const paymobOrderId = String(data.obj.order.id);
        const success = data.obj.success;
        const db = getDb();

        const order = db.prepare('SELECT * FROM orders WHERE paymob_order_id = ?').get(paymobOrderId);
        if (order) {
            const newPaymentStatus = success ? 'paid' : 'failed';
            const newStatus = success ? 'confirmed' : order.status;
            db.prepare('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?')
                .run(newPaymentStatus, newStatus, order.id);
            console.log(`Order ${order.id} payment: ${newPaymentStatus}`);
        }
    }

    res.json({ received: true });
});

// GET /api/paymob/status/:orderId - check payment status
router.get('/status/:orderId', (req, res) => {
    const db = getDb();
    const order = db.prepare('SELECT id, payment_status, status, total FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
});

module.exports = router;

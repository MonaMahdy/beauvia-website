require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize database
initDatabase();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/paymob', require('./routes/paymob'));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        const filePath = path.join(__dirname, 'public', req.path);
        res.sendFile(filePath, (err) => {
            if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
});

app.listen(PORT, () => {
    console.log(`BEAUVIA&CO server running on port ${PORT}`);
});

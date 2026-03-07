const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { JWT_SECRET, authenticateAdmin } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input.' });
    }

    if (username.length > 50 || password.length > 100) {
        return res.status(400).json({ error: 'Input too long.' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({ token, username: admin.username });
});

// PUT /api/auth/password - change password
router.put('/password', authenticateAdmin, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new password required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

    if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.admin.id);

    res.json({ message: 'Password updated successfully.' });
});

module.exports = router;

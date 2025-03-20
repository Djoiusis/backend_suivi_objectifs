const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const router = express.Router();
const prisma = new PrismaClient();

// Inscription d'un consultant (par un admin)
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const consultant = await prisma.consultant.create({
            data: { username, password: hashedPassword }
        });
        res.json(consultant);
    } catch (error) {
        res.status(400).json({ error: 'Utilisateur déjà existant' });
    }
});

// Connexion
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const consultant = await prisma.consultant.findUnique({ where: { username } });
    if (!consultant) return res.status(401).json({ error: 'Utilisateur non trouvé' });

    const validPassword = await bcrypt.compare(password, consultant.password);
    if (!validPassword) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ userId: consultant.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

module.exports = router;
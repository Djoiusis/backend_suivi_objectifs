const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  try {
    // Vérifie si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Utilisateur déjà existant' });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer le nouvel utilisateur
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'CONSULTANT', // 👈 Par défaut
      },
    });

    res.status(201).json({ message: 'Utilisateur créé', user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Find user by username
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    // 2. Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // 3. Generate JWT token
    const token = jwt.sign(
      {
        userid: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;

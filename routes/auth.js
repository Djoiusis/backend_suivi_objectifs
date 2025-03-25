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

module.exports = router;

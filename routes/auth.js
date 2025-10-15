const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }
  next();
}

function requireAdminOrBUM(req, res, next) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'BUM') {
    return res.status(403).json({ error: 'Accès réservé aux admins et BUM' });
  }
  next();
}

// Route login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { id: user.id, userid: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        businessUnitId: user.businessUnitId,
        bumId: user.bumId
      } 
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route register (optionnel)
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password,
        role: 'CONSULTANT'
      }
    });

    res.status(201).json({ message: 'Utilisateur créé', user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(400).json({ error: 'Erreur création utilisateur' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireAdminOrBUM = requireAdminOrBUM;

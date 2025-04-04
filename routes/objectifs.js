const express = require('express');
const { PrismaClient } = require('@prisma/client');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();
const prisma = new PrismaClient();

// 🔒 Récupérer tous les objectifs (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const objectifs = await prisma.objectif.findMany({
      include: { user: { select: { username: true, role: true } } }
    });
    res.json(objectifs);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des objectifs" });
  }
});

// 🔒 Ajouter un objectif (consultant connecté)
router.post('/', verifyToken, async (req, res) => {
  const { description } = req.body;
  try {
    const objectif = await prisma.objectif.create({
      data: {
        description,
        userId: req.user.userId, // pris depuis le token
      },
    });
    res.status(201).json(objectif);
  } catch (error) {
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});

// 🔒 Mettre à jour le statut d’un objectif (consultant ou admin)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const objectif = await prisma.objectif.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    res.json(objectif);
  } catch (error) {
    res.status(400).json({ error: "Impossible de mettre à jour l'objectif" });
  }
});

module.exports = router;

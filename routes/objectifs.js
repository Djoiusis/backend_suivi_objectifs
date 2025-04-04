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
        status: "En cours",
        validatedbyadmin: false,
        user: {
          connect: { id: req.user.userId }
        }
      }
    });
    res.status(201).json(objectif);
  } catch (error) {
    console.error("💥 ERREUR CRÉATION OBJECTIF:", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});


// Voir les objectifs de l'utilisateur connecté
router.get('/mine', verifyToken, async (req, res) => {
  console.log('🔐 Utilisateur connecté :', req.user);
  try {
    const objectifs = await prisma.objectif.findMany({
      where: {
        userid: req.user.userid
      }
    });
    res.json(objectifs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des objectifs personnels" });
  }
});


// 🔒 Mettre à jour le statut d’un objectif (consultant ou admin)
router.put('/:id/valider', verifyToken, requireAdmin, async (req, res) => {
  const objectifId = parseInt(req.params.id);

  try {
    const objectif = await prisma.objectif.update({
      where: { id: objectifId },
      data: {
        validatedbyadmin: true,
        status: 'Validé' // 👈 on met aussi à jour le statut ici
      }
    });

    res.json({ message: 'Objectif validé avec succès', objectif });
  } catch (error) {
    console.error("💥 Erreur validation objectif :", error);
    res.status(400).json({ error: "Impossible de valider l'objectif" });
  }
});

module.exports = router;

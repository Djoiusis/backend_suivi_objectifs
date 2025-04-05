const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();
const prisma = new PrismaClient();

// 🔒 Récupérer tous les utilisateurs (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true }
  });
  res.json(users);
});

// 🔒 Ajouter un utilisateur (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Utilisateur déjà existant' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'CONSULTANT',
      },
    });

    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// 🔒 Supprimer un utilisateur (admin uniquement)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    await prisma.user.delete({
      where: { id: userId }
    });
    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("💥 Erreur suppression user :", error);
    res.status(400).json({ error: "Impossible de supprimer l'utilisateur" });
  }
});

module.exports = router;

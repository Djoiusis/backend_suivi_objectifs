const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('../middleware/auth');

const prisma = new PrismaClient();

// Récupérer tous les utilisateurs (ADMIN seulement)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        businessUnit: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Erreur récupération users:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les consultants de ma BU (BUM)
router.get('/my-team', verifyToken, requireAdminOrBUM, async (req, res) => {
  try {
    const where = req.user.role === 'BUM' 
      ? { businessUnit: req.user.businessUnit, role: 'CONSULTANT' }
      : { role: 'CONSULTANT' };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        businessUnit: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Erreur récupération team:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un utilisateur (ADMIN seulement)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { nom, prenom, email, password, role, businessUnit } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        nom,
        prenom,
        email,
        password: hashedPassword,
        role: role || 'CONSULTANT',
        businessUnit
      }
    });

    res.status(201).json({ 
      message: 'Utilisateur créé',
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        businessUnit: user.businessUnit
      }
    });
  } catch (error) {
    console.error('Erreur création user:', error);
    res.status(400).json({ error: 'Erreur création utilisateur' });
  }
});

// Mettre à jour un utilisateur (ADMIN seulement)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nom, prenom, email, role, businessUnit, password } = req.body;

  try {
    const data = { nom, prenom, email, role, businessUnit };
    
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        businessUnit: true
      }
    });

    res.json({ message: 'Utilisateur mis à jour', user });
  } catch (error) {
    console.error('Erreur update user:', error);
    res.status(400).json({ error: 'Erreur mise à jour' });
  }
});

// Supprimer un utilisateur (ADMIN seulement)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('Erreur suppression user:', error);
    res.status(400).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;

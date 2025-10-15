const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('auth');

const prisma = new PrismaClient();

// Récupérer tous les utilisateurs (ADMIN seulement)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        businessUnitId: true,
        bumId: true,
        createdAt: true,
        businessUnit: { select: { id: true, nom: true } }
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
      ? { bumId: req.user.id, role: 'CONSULTANT' }
      : { role: 'CONSULTANT' };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        role: true,
        businessUnitId: true,
        createdAt: true,
        businessUnit: { select: { id: true, nom: true } }
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
  const { username, password, role, businessUnitId, bumId } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password,
        role: role || 'CONSULTANT',
        businessUnitId: businessUnitId ? parseInt(businessUnitId) : null,
        bumId: bumId ? parseInt(bumId) : null
      },
      include: {
        businessUnit: { select: { id: true, nom: true } }
      }
    });

    res.status(201).json({ 
      message: 'Utilisateur créé',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        businessUnitId: user.businessUnitId,
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
  const { username, role, businessUnitId, bumId, password } = req.body;

  try {
    const data = { 
      username, 
      role, 
      businessUnitId: businessUnitId ? parseInt(businessUnitId) : null,
      bumId: bumId ? parseInt(bumId) : null
    };
    
    if (password) {
      data.password = password;
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      include: {
        businessUnit: { select: { id: true, nom: true } }
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

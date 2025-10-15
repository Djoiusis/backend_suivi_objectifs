const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('./auth');

const prisma = new PrismaClient();

// Récupérer les catégories (globales + personnelles du consultant)
router.get('/', verifyToken, async (req, res) => {
  try {
    const categories = await prisma.categorie.findMany({
      where: {
        OR: [
          { userid: null }, // Catégories globales
          { userid: req.user.id } // Catégories personnelles
        ]
      },
      include: {
        user: { select: { id: true, username: true } },
        _count: { select: { objectifs: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer toutes les catégories (ADMIN seulement)
router.get('/all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const categories = await prisma.categorie.findMany({
      include: {
        user: { select: { id: true, username: true } },
        _count: { select: { objectifs: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une catégorie
router.post('/', verifyToken, async (req, res) => {
  const { nom, description, couleur, isGlobal } = req.body;

  if (!nom) {
    return res.status(400).json({ error: 'Nom requis' });
  }

  try {
    // Seul ADMIN peut créer des catégories globales
    const userid = (isGlobal && req.user.role === 'ADMIN') ? null : req.user.id;

    const categorie = await prisma.categorie.create({
      data: {
        nom,
        description,
        couleur,
        userid
      }
    });

    res.status(201).json({ message: 'Catégorie créée', categorie });
  } catch (error) {
    console.error('Erreur création catégorie:', error);
    res.status(400).json({ error: 'Erreur création catégorie' });
  }
});

// Mettre à jour une catégorie
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nom, description, couleur } = req.body;

  try {
    const categorie = await prisma.categorie.findUnique({
      where: { id: parseInt(id) }
    });

    if (!categorie) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    // Vérifier les permissions
    if (categorie.userid !== null && categorie.userid !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const updated = await prisma.categorie.update({
      where: { id: parseInt(id) },
      data: { nom, description, couleur }
    });

    res.json({ message: 'Catégorie mise à jour', categorie: updated });
  } catch (error) {
    console.error('Erreur update catégorie:', error);
    res.status(400).json({ error: 'Erreur mise à jour' });
  }
});

// Supprimer une catégorie
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const categorie = await prisma.categorie.findUnique({
      where: { id: parseInt(id) }
    });

    if (!categorie) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    // Vérifier les permissions
    if (categorie.userid !== null && categorie.userid !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await prisma.categorie.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Catégorie supprimée' });
  } catch (error) {
    console.error('Erreur suppression catégorie:', error);
    res.status(400).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;

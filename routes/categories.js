const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('./auth');

const prisma = new PrismaClient();

// Récupérer les catégories (globales + personnelles du consultant)
router.get('/', verifyToken, async (req, res) => {
  try {
    const where = {
      OR: [
        { userid: null }, // Catégories globales
        { userid: req.user.userid } // Catégories personnelles
      ]
    };

    const categories = await prisma.categorie.findMany({
      where,
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

  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: 'Nom requis' });
  }

  try {
    // Seul ADMIN peut créer des catégories globales
    const userid = (isGlobal && req.user.role === 'ADMIN') ? null : req.user.userid;

    const categorie = await prisma.categorie.create({
      data: {
        nom: nom.trim(),
        description: description || null,
        couleur: couleur || null,
        userid
      }
    });

    res.status(201).json({ message: 'Catégorie créée', categorie });
  } catch (error) {
    console.error('Erreur création catégorie:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cette catégorie existe déjà' });
    }
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
    if (categorie.userid !== null && categorie.userid !== req.user.userid && req.user.role !== 'ADMIN') {
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
    if (categorie.userid !== null && categorie.userid !== req.user.userid && req.user.role !== 'ADMIN') {
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

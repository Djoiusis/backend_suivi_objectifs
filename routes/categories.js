const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();
const prisma = new PrismaClient();

// 📋 Récupérer toutes les catégories (accessible à tous)
router.get('/', verifyToken, async (req, res) => {
  try {
    const categories = await prisma.categorie.findMany({
      orderBy: { ordre: 'asc' },
      include: {
        _count: {
          select: { objectifs: true }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➕ Créer une catégorie (admin uniquement)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { nom, description, couleur, icone, ordre } = req.body;

  console.log('📝 Tentative création catégorie:', { nom, icone, couleur });

  if (!nom) {
    return res.status(400).json({ error: 'Le nom est requis' });
  }

  try {
    // Générer une couleur aléatoire si non fournie
    const colors = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899', '#ef4444'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const categorie = await prisma.categorie.create({
      data: {
        nom,
        description: description || null,
        couleur: couleur || randomColor,
        icone: icone || '📌',
        ordre: ordre || 0
      }
    });
    
    console.log('✅ Catégorie créée avec succès:', categorie);
    res.status(201).json(categorie);
  } catch (error) {
    console.error('❌ Erreur création catégorie:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cette catégorie existe déjà' });
    }
    
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
});

// ✏️ Modifier une catégorie (admin uniquement)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nom, description, couleur, icone, ordre } = req.body;

  try {
    const categorie = await prisma.categorie.update({
      where: { id: parseInt(id) },
      data: {
        ...(nom && { nom }),
        ...(description !== undefined && { description }),
        ...(couleur && { couleur }),
        ...(icone !== undefined && { icone }),
        ...(ordre !== undefined && { ordre })
      }
    });
    res.json(categorie);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    console.error('Erreur modification catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🗑️ Supprimer une catégorie (admin uniquement)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier s'il y a des objectifs liés
    const objectifsCount = await prisma.objectif.count({
      where: { categorieId: parseInt(id) }
    });

    if (objectifsCount > 0) {
      return res.status(400).json({ 
        error: `Impossible de supprimer : ${objectifsCount} objectif(s) lié(s)` 
      });
    }

    await prisma.categorie.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    console.error('Erreur suppression catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

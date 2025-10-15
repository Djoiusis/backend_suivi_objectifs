const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('./auth');

const prisma = new PrismaClient();

// Couleurs par défaut
const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

function getRandomColor() {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

// Récupérer les catégories (globales + pour un consultant spécifique)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { consultantId } = req.query;
    
    let where = {};

    if (consultantId) {
      // Si consultantId fourni, ne montrer QUE les catégories globales + celles du consultant
      where = {
        OR: [
          { userid: null },                    // Catégories globales
          { userid: parseInt(consultantId) }   // Catégories du consultant spécifique
        ]
      };
      console.log(`📂 Récupération catégories pour consultant ${consultantId}`);
    } else if (req.user.role === 'CONSULTANT') {
      // Consultant connecté : ses catégories + globales
      where = {
        OR: [
          { userid: null },
          { userid: req.user.userid }
        ]
      };
      console.log(`📂 Récupération catégories pour consultant connecté ${req.user.userid}`);
    } else {
      // ADMIN/BUM sans consultantId : toutes les catégories globales uniquement
      where = { userid: null };
      console.log('📂 Récupération catégories globales uniquement');
    }

    const categories = await prisma.categorie.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
        _count: { select: { objectifs: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`✅ ${categories.length} catégorie(s) trouvée(s)`);
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une catégorie
router.post('/', verifyToken, async (req, res) => {
  const { nom, description, couleur, consultantId } = req.body;

  console.log('📝 Création catégorie:', { 
    nom, 
    consultantId, 
    role: req.user.role,
    userId: req.user.userid 
  });

  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: 'Nom requis' });
  }

  try {
    let userid = null; // Par défaut globale

    // Si consultantId fourni, créer pour ce consultant
    if (consultantId) {
      // Vérifier les permissions
      if (req.user.role === 'BUM') {
        const consultant = await prisma.user.findUnique({
          where: { id: parseInt(consultantId) }
        });
        if (!consultant || consultant.bumId !== req.user.userid) {
          return res.status(403).json({ error: 'Non autorisé - ce consultant ne fait pas partie de votre équipe' });
        }
        console.log(`✅ BUM autorisé à créer une catégorie pour le consultant ${consultant.username}`);
      }
      userid = parseInt(consultantId);
    } else if (req.user.role === 'CONSULTANT') {
      // Si consultant connecté sans consultantId, créer pour lui
      userid = req.user.userid;
    }
    // Sinon reste null (globale) pour ADMIN/BUM

    const categorie = await prisma.categorie.create({
      data: {
        nom: nom.trim(),
        description: description?.trim() || null,
        couleur: couleur || getRandomColor(),
        userid
      }
    });

    console.log('✅ Catégorie créée:', { 
      id: categorie.id, 
      nom: categorie.nom, 
      userid: categorie.userid 
    });
    
    res.status(201).json(categorie);
  } catch (error) {
    console.error('Erreur création catégorie:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cette catégorie existe déjà pour cet utilisateur' });
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

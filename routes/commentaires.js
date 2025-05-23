const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const verifyToken = require('../middlewares/verifyToken'); // Utilisation de votre middleware existant

// Récupérer tous les commentaires d'un objectif
router.get('/:objectifId/commentaires', verifyToken, async (req, res) => {
  try {
    const { objectifId } = req.params;
    
    const commentaires = await prisma.commentaire.findMany({
      where: { 
        objectifId: parseInt(objectifId) 
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(commentaires);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Ajouter un commentaire à un objectif
router.post('/:objectifId/commentaires', verifyToken, async (req, res) => {
  try {
    const { objectifId } = req.params;
    const { contenu } = req.body;
    const userId = req.user.id;
    
    if (!contenu) {
      return res.status(400).json({ message: 'Le contenu du commentaire est requis' });
    }
    
    // Vérifier si l'objectif existe
    const objectif = await prisma.objectif.findUnique({
      where: { id: parseInt(objectifId) }
    });
    
    if (!objectif) {
      return res.status(404).json({ message: 'Objectif non trouvé' });
    }
    
    // Créer le commentaire
    const commentaire = await prisma.commentaire.create({
      data: {
        contenu,
        objectif: {
          connect: { id: parseInt(objectifId) }
        },
        user: {
          connect: { id: userId }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });
    
    res.status(201).json(commentaire);
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Modifier un commentaire
router.put('/objectifs/commentaire/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { contenu } = req.body;
    const userId = req.user.id;
    
    if (!contenu) {
      return res.status(400).json({ message: 'Le contenu du commentaire est requis' });
    }
    
    // Vérifier si le commentaire existe
    const commentaire = await prisma.commentaire.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!commentaire) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    // Vérifier si l'utilisateur est autorisé à modifier ce commentaire
    if (commentaire.userid !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Non autorisé à modifier ce commentaire' });
    }
    
    // Mettre à jour le commentaire
    const updatedCommentaire = await prisma.commentaire.update({
      where: { id: parseInt(id) },
      data: { contenu },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });
    
    res.json(updatedCommentaire);
  } catch (error) {
    console.error('Erreur lors de la modification du commentaire:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Supprimer un commentaire
router.delete('/commentaire/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Vérifier si le commentaire existe
    const commentaire = await prisma.commentaire.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!commentaire) {
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }
    
    // Vérifier si l'utilisateur est autorisé à supprimer ce commentaire
    if (commentaire.userid !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Non autorisé à supprimer ce commentaire' });
    }
    
    // Supprimer le commentaire
    await prisma.commentaire.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Commentaire supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;

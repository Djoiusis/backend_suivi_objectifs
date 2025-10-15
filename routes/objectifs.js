const express = require('express');
const { PrismaClient } = require('@prisma/client');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');
const requireBUM = require('../middlewares/requireBUM');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware pour ADMIN ou BUM
const requireAdminOrBUM = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'BUM') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs et BUM' });
  }
  next();
};

// Voir les objectifs de l'utilisateur connecté avec filtre par année
router.get('/mine/:annee?', verifyToken, async (req, res) => {
  console.log('🔍 Utilisateur connecté :', req.user);
  const annee = req.params.annee ? parseInt(req.params.annee) : new Date().getFullYear();
  
  try {
    const objectifs = await prisma.objectif.findMany({
      where: {
        userid: req.user.id || req.user.userid,
        annee: annee
      }
    });
    res.json(objectifs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des objectifs personnels" });
  }
});

// Voir les objectifs d'un utilisateur spécifique avec filtre par année
router.get('/:userId/:annee?', verifyToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const annee = req.params.annee ? parseInt(req.params.annee) : new Date().getFullYear();

  try {
    const objectifs = await prisma.objectif.findMany({
      where: { 
        userid: userId,
        annee: annee 
      },
      include: {
        commentaires: {
          include: {
            user: { select: { username: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    res.json(objectifs);
  } catch (error) {
    console.error("💥 Erreur récupération objectifs user :", error);
    res.status(500).json({ error: "Impossible de récupérer les objectifs de l'utilisateur" });
  }
});

// Ajouter un objectif (consultant connecté) avec année
router.post('/', verifyToken, async (req, res) => {
  const { description, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();
  const userId = req.user.id || req.user.userid;

  if (!userId) {
    return res.status(403).json({ error: "Utilisateur non identifié correctement" });
  }

  try {
    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        annee: annee || currentYear,
        user: {
          connect: { id: userId }
        },
        ...(categorieId && {
          categorie: {
            connect: { id: parseInt(categorieId) }
          }
        })
      }
    });
    res.status(201).json(objectif);
  } catch (error) {
    console.error("💥 ERREUR CRÉATION OBJECTIF:", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});

// Supprimer un objectif (ADMIN ou BUM)
router.delete('/:id', verifyToken, requireAdminOrBUM, async (req, res) => {
  const objectifId = parseInt(req.params.id);

  try {
    await prisma.objectif.delete({
      where: { id: objectifId }
    });

    res.json({ message: 'Objectif supprimé avec succès' });
  } catch (error) {
    console.error("💥 Erreur suppression objectif :", error);
    res.status(400).json({ error: "Impossible de supprimer l'objectif" });
  }
});

// Ajout de commentaire (tous les utilisateurs authentifiés)
router.post('/:id/commentaires', verifyToken, async (req, res) => {
  const objectifId = parseInt(req.params.id);
  const { contenu } = req.body;

  console.log('=== DEBUG AJOUT COMMENTAIRE ===');
  console.log('objectifId:', objectifId);
  console.log('contenu:', contenu);
  console.log('req.user:', req.user);
  
  if (!req.user || (!req.user.id && !req.user.userid)) {
    console.error('❌ Erreur: req.user ne contient pas d\'ID');
    return res.status(403).json({ error: "Utilisateur non identifié correctement" });
  }
  
  const userId = req.user.id || req.user.userid;
  console.log('userId extrait:', userId);
  
  if (!contenu) {
    return res.status(400).json({ error: "Le contenu du commentaire est requis" });
  }

  try {
    const objectif = await prisma.objectif.findUnique({
      where: { id: objectifId }
    });
    
    if (!objectif) {
      console.error(`❌ Objectif ${objectifId} non trouvé`);
      return res.status(404).json({ error: "Objectif non trouvé" });
    }
    
    console.log('✅ Objectif trouvé, création du commentaire...');
    
    const commentaire = await prisma.commentaire.create({
      data: {
        contenu,
        objectif: { connect: { id: objectifId } },
        user: { connect: { id: parseInt(userId) } }
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
    
    console.log('✅ Commentaire créé avec succès:', commentaire.id);
    
    res.status(201).json(commentaire);
  } catch (error) {
    console.error('❌ Erreur ajout commentaire:', error);
    res.status(500).json({ 
      error: "Impossible d'ajouter le commentaire", 
      details: error.message
    });
  }
});

// Récupération des commentaires
router.get('/:id/commentaires', verifyToken, async (req, res) => {
  const objectifId = parseInt(req.params.id);
  
  console.log('=== DEBUG RÉCUPÉRATION COMMENTAIRES ===');
  console.log('objectifId:', objectifId);

  try {
    const objectif = await prisma.objectif.findUnique({
      where: { id: objectifId }
    });
    
    if (!objectif) {
      console.error(`❌ Objectif ${objectifId} non trouvé`);
      return res.status(404).json({ error: "Objectif non trouvé" });
    }
    
    const commentaires = await prisma.commentaire.findMany({
      where: { objectifId },
      include: {
        user: { 
          select: { 
            id: true, 
            username: true, 
            role: true 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`✅ ${commentaires.length} commentaires récupérés`);
    
    res.json(commentaires);
  } catch (error) {
    console.error('❌ Erreur récupération commentaires:', error);
    res.status(500).json({ 
      error: "Impossible de récupérer les commentaires",
      details: error.message 
    });
  }
});

// Mise à jour d'un commentaire (auteur, ADMIN ou BUM)
router.put('/commentaire/:id', verifyToken, async (req, res) => {
  const commentId = parseInt(req.params.id);
  const { contenu } = req.body;
  const userId = req.user.id || req.user.userid;
  
  if (!userId) {
    return res.status(403).json({ error: "Utilisateur non authentifié" });
  }

  try {
    const commentaire = await prisma.commentaire.findUnique({
      where: { id: commentId },
      include: { user: true }
    });

    if (!commentaire) {
      return res.status(404).json({ error: "Commentaire non trouvé" });
    }

    // Vérifier si l'utilisateur est l'auteur, admin ou BUM
    if (commentaire.userid !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'BUM') {
      return res.status(403).json({ error: "Non autorisé à modifier ce commentaire" });
    }

    const updatedCommentaire = await prisma.commentaire.update({
      where: { id: commentId },
      data: { contenu },
      include: {
        user: { select: { username: true, role: true } }
      }
    });

    res.json(updatedCommentaire);
  } catch (error) {
    console.error('💥 Erreur mise à jour commentaire:', error);
    res.status(500).json({ error: "Impossible de modifier le commentaire" });
  }
});

// Suppression d'un commentaire (auteur, ADMIN ou BUM)
router.delete('/commentaire/:id', verifyToken, async (req, res) => {
  const commentId = parseInt(req.params.id);
  const userId = req.user.id || req.user.userid;
  
  if (!userId) {
    return res.status(403).json({ error: "Utilisateur non authentifié" });
  }

  try {
    const commentaire = await prisma.commentaire.findUnique({
      where: { id: commentId }
    });

    if (!commentaire) {
      return res.status(404).json({ error: "Commentaire non trouvé" });
    }

    // Vérifier si l'utilisateur est l'auteur, admin ou BUM
    if (commentaire.userid !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'BUM') {
      return res.status(403).json({ error: "Non autorisé à supprimer ce commentaire" });
    }

    await prisma.commentaire.delete({
      where: { id: commentId }
    });

    res.json({ message: "Commentaire supprimé avec succès" });
  } catch (error) {
    console.error('💥 Erreur suppression commentaire:', error);
    res.status(500).json({ error: "Impossible de supprimer le commentaire" });
  }
});

// Valider un objectif (ADMIN ou BUM)
router.put('/:id/valider', verifyToken, requireAdminOrBUM, async (req, res) => {
  const objectifId = parseInt(req.params.id);

  try {
    const objectif = await prisma.objectif.update({
      where: { id: objectifId },
      data: {
        validatedbyadmin: true,
        status: 'Validé'
      }
    });

    res.json({ message: 'Objectif validé avec succès', objectif });
  } catch (error) {
    console.error("💥 Erreur validation objectif :", error);
    res.status(400).json({ error: "Impossible de valider l'objectif" });
  }
});

// Mettre à jour le statut d'un objectif (tous les utilisateurs authentifiés)
router.patch('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Champ 'status' requis" });
  }

  try {
    const objectif = await prisma.objectif.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.json({ message: 'Statut mis à jour', objectif });
  } catch (error) {
    console.error("Erreur update statut:", error);
    res.status(404).json({ error: "Objectif introuvable ou erreur serveur" });
  }
});

// Créer un objectif pour un utilisateur (ADMIN ou BUM)
router.post('/admin', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { description, userId, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();

  console.log('🎯 Création objectif:', { description, userId, annee, categorieId });

  if (!description || !userId) {
    return res.status(400).json({ error: "Champs 'description' et 'userId' requis" });
  }

  try {
    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        annee: annee || currentYear,
        user: {
          connect: { id: parseInt(userId) }
        },
        ...(categorieId && {
          categorie: {
            connect: { id: parseInt(categorieId) }
          }
        })
      }
    });
    
    console.log('✅ Objectif créé:', objectif);
    res.status(201).json({ message: "Objectif créé pour le user", objectif });
  } catch (error) {
    console.error("💥 Erreur création objectif :", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});

// Créer un objectif pour plusieurs utilisateurs (ADMIN ou BUM)
router.post('/admin/multiple', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { description, userIds, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();

  if (!description || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "Champs 'description' et 'userIds[]' requis" });
  }

  try {
    const objectifs = await Promise.all(
      userIds.map(userId =>
        prisma.objectif.create({
          data: {
            description,
            status: "En cours",
            validatedbyadmin: false,
            annee: parseInt(annee) || currentYear,
            user: { connect: { id: parseInt(userId) } },
            ...(categorieId && {
              categorie: {
                connect: { id: parseInt(categorieId) }
              }
            })
          }
        })
      )
    );

    res.status(201).json({ message: "Objectifs créés pour les utilisateurs", objectifs });
  } catch (error) {
    console.error("💥 Erreur création multiple :", error);
    res.status(400).json({ error: "Erreur création des objectifs" });
  }
});

module.exports = router;

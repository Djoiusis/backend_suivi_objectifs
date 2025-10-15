const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('./auth');

const prisma = new PrismaClient();

// Récupérer les objectifs du consultant connecté
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { annee } = req.query;

  try {
    const where = { userid: userId };
    if (annee) {
      where.annee = parseInt(annee);
    }

    const objectifs = await prisma.objectif.findMany({
      where,
      include: {
        categorie: true,
        commentaires: {
          include: { 
            user: { select: { id: true, username: true, role: true } } 
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(objectifs);
  } catch (error) {
    console.error('Erreur récupération objectifs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les objectifs (ADMIN) ou de mes consultants (BUM)
router.get('/all', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { annee } = req.query;

  try {
    const where = {};
    if (annee) {
      where.annee = parseInt(annee);
    }

    if (req.user.role === 'BUM') {
      where.user = { bumId: req.user.id };
    }

    const objectifs = await prisma.objectif.findMany({
      where,
      include: {
        user: { 
          select: { 
            id: true, 
            username: true, 
            businessUnitId: true,
            businessUnit: { select: { nom: true } }
          } 
        },
        categorie: true,
        commentaires: {
          include: { 
            user: { select: { id: true, username: true, role: true } } 
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(objectifs);
  } catch (error) {
    console.error('Erreur récupération objectifs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un objectif pour un utilisateur (ADMIN ou BUM)
router.post('/admin', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { description, userid, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();

  if (!description || !userid) {
    return res.status(400).json({ error: "Champs 'description' et 'userid' requis" });
  }

  try {
    if (req.user.role === 'BUM') {
      const targetUser = await prisma.user.findUnique({
        where: { id: parseInt(userid) }
      });

      if (!targetUser || targetUser.bumId !== req.user.id) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des objectifs que pour vos consultants' });
      }
    }

    if (categorieId) {
      const categorie = await prisma.categorie.findUnique({
        where: { id: parseInt(categorieId) }
      });

      if (!categorie) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }

      if (categorie.userid !== null && categorie.userid !== parseInt(userid)) {
        return res.status(403).json({ error: 'Catégorie invalide pour ce consultant' });
      }
    }

    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        annee: annee || currentYear,
        userid: parseInt(userid),
        categorieId: categorieId ? parseInt(categorieId) : null
      }
    });
    
    res.status(201).json({ message: "Objectif créé", objectif });
  } catch (error) {
    console.error("Erreur création objectif:", error);
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
    if (req.user.role === 'BUM') {
      const targetUsers = await prisma.user.findMany({
        where: { id: { in: userIds.map(id => parseInt(id)) } }
      });

      const allMyConsultants = targetUsers.every(u => u.bumId === req.user.id);
      if (!allMyConsultants) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des objectifs que pour vos consultants' });
      }
    }

    const objectifs = await Promise.all(
      userIds.map(userid =>
        prisma.objectif.create({
          data: {
            description,
            status: "En cours",
            validatedbyadmin: false,
            annee: parseInt(annee) || currentYear,
            userid: parseInt(userid),
            categorieId: categorieId ? parseInt(categorieId) : null
          }
        })
      )
    );

    res.status(201).json({ message: "Objectifs créés", objectifs });
  } catch (error) {
    console.error("Erreur création multiple:", error);
    res.status(400).json({ error: "Erreur création des objectifs" });
  }
});

// Mettre à jour un objectif
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { description, status, categorieId, validatedbyadmin } = req.body;

  try {
    const objectif = await prisma.objectif.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!objectif) {
      return res.status(404).json({ error: 'Objectif non trouvé' });
    }

    const isOwner = objectif.userid === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const isBUMOfUser = req.user.role === 'BUM' && objectif.user.bumId === req.user.id;

    if (!isOwner && !isAdmin && !isBUMOfUser) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (validatedbyadmin !== undefined) {
      if (req.user.role === 'CONSULTANT') {
        return res.status(403).json({ error: 'Seul un admin ou BUM peut valider' });
      }
      if (req.user.role === 'BUM' && !isBUMOfUser) {
        return res.status(403).json({ error: 'Vous ne pouvez valider que les objectifs de vos consultants' });
      }
    }

    const data = {};
    if (description) data.description = description;
    if (status) data.status = status;
    if (categorieId !== undefined) data.categorieId = categorieId ? parseInt(categorieId) : null;
    if (validatedbyadmin !== undefined) data.validatedbyadmin = validatedbyadmin;

    const updated = await prisma.objectif.update({
      where: { id: parseInt(id) },
      data,
      include: { categorie: true }
    });

    res.json({ message: 'Objectif mis à jour', objectif: updated });
  } catch (error) {
    console.error('Erreur update objectif:', error);
    res.status(400).json({ error: 'Erreur mise à jour' });
  }
});

// Supprimer un objectif
router.delete('/:id', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { id } = req.params;

  try {
    const objectif = await prisma.objectif.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!objectif) {
      return res.status(404).json({ error: 'Objectif non trouvé' });
    }

    if (req.user.role === 'BUM' && objectif.user.bumId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await prisma.objectif.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Objectif supprimé' });
  } catch (error) {
    console.error('Erreur suppression objectif:', error);
    res.status(400).json({ error: 'Erreur suppression' });
  }
});

// Ajouter un commentaire
router.post('/:id/commentaires', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { contenu } = req.body;

  if (!contenu) {
    return res.status(400).json({ error: 'Contenu requis' });
  }

  try {
    const commentaire = await prisma.commentaire.create({
      data: {
        contenu,
        objectifId: parseInt(id),
        userid: req.user.id
      },
      include: {
        user: { select: { id: true, username: true, role: true } }
      }
    });

    res.status(201).json({ message: 'Commentaire ajouté', commentaire });
  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(400).json({ error: 'Erreur ajout commentaire' });
  }
});

module.exports = router;

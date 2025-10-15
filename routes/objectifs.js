const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireAdmin, requireAdminOrBUM } = require('../middleware/auth');

const prisma = new PrismaClient();

// Récupérer les objectifs du consultant connecté
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { annee } = req.query;

  try {
    const where = { userId };
    if (annee) {
      where.annee = parseInt(annee);
    }

    const objectifs = await prisma.objectif.findMany({
      where,
      include: {
        categorie: true,
        commentaires: {
          include: { user: { select: { nom: true, prenom: true, role: true } } }
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

// Récupérer tous les objectifs (ADMIN) ou de ma BU (BUM)
router.get('/all', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { annee } = req.query;

  try {
    const where = {};
    if (annee) {
      where.annee = parseInt(annee);
    }

    // Si BUM, filtrer par businessUnit
    if (req.user.role === 'BUM') {
      where.user = {
        businessUnit: req.user.businessUnit
      };
    }

    const objectifs = await prisma.objectif.findMany({
      where,
      include: {
        user: { select: { id: true, nom: true, prenom: true, businessUnit: true } },
        categorie: true,
        commentaires: {
          include: { user: { select: { nom: true, prenom: true, role: true } } }
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
  const { description, userId, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();

  if (!description || !userId) {
    return res.status(400).json({ error: "Champs 'description' et 'userId' requis" });
  }

  try {
    // Si BUM, vérifier que le user est dans sa BU
    if (req.user.role === 'BUM') {
      const targetUser = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      });

      if (!targetUser || targetUser.businessUnit !== req.user.businessUnit) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des objectifs que pour votre BU' });
      }
    }

    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        annee: annee || currentYear,
        user: { connect: { id: parseInt(userId) } },
        ...(categorieId && {
          categorie: { connect: { id: parseInt(categorieId) } }
        })
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
    // Si BUM, vérifier que tous les users sont dans sa BU
    if (req.user.role === 'BUM') {
      const targetUsers = await prisma.user.findMany({
        where: { id: { in: userIds.map(id => parseInt(id)) } }
      });

      const allInBU = targetUsers.every(u => u.businessUnit === req.user.businessUnit);
      if (!allInBU) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des objectifs que pour votre BU' });
      }
    }

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
              categorie: { connect: { id: parseInt(categorieId) } }
            })
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

    // Vérifications de permissions
    const isOwner = objectif.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const isBUMOfUser = req.user.role === 'BUM' && objectif.user.businessUnit === req.user.businessUnit;

    if (!isOwner && !isAdmin && !isBUMOfUser) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Seul l'admin peut valider
    if (validatedbyadmin !== undefined && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Seul un admin peut valider' });
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

    // BUM peut supprimer seulement dans sa BU
    if (req.user.role === 'BUM' && objectif.user.businessUnit !== req.user.businessUnit) {
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
        objectif: { connect: { id: parseInt(id) } },
        user: { connect: { id: req.user.id } }
      },
      include: {
        user: { select: { nom: true, prenom: true, role: true } }
      }
    });

    res.status(201).json({ message: 'Commentaire ajouté', commentaire });
  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(400).json({ error: 'Erreur ajout commentaire' });
  }
});

module.exports = router;

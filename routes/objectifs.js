const express = require('express');
const { PrismaClient } = require('@prisma/client');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();
const prisma = new PrismaClient();

// 🔒 Récupérer tous les objectifs (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const objectifs = await prisma.objectif.findMany({
      include: { user: { select: { username: true, role: true } } }
    });
    res.json(objectifs);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des objectifs" });
  }
});

// 🔒 Ajouter un objectif (consultant connecté)
router.post('/', verifyToken, async (req, res) => {
  const { description } = req.body;

  try {
    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        user: {
          connect: { id: req.user.userid }
        }
      }
    });
    res.status(201).json(objectif);
  } catch (error) {
    console.error("💥 ERREUR CRÉATION OBJECTIF:", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});


// Voir les objectifs de l'utilisateur connecté
router.get('/mine', verifyToken, async (req, res) => {
  console.log('🔐 Utilisateur connecté :', req.user);
  try {
    const objectifs = await prisma.objectif.findMany({
      where: {
        userid: req.user.userid
      }
    });
    res.json(objectifs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des objectifs personnels" });
  }
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
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

router.post('/:id/commentaires', verifyToken, async (req, res) => {
  const objectifId = parseInt(req.params.id);
  const { contenu } = req.body;

  try {
    const commentaire = await prisma.commentaire.create({
      data: {
        contenu,
        objectif: { connect: { id: objectifId } },
        user: { connect: { id: req.user.userid } }
      }
    });

    res.status(201).json({ message: 'Commentaire ajouté', commentaire });
  } catch (error) {
    console.error('💥 Erreur ajout commentaire multiple :', error);
    res.status(400).json({ error: "Impossible d'ajouter le commentaire" });
  }
});

router.get('/:id/commentaires', verifyToken, async (req, res) => {
  const objectifId = parseInt(req.params.id);

  try {
    const commentaires = await prisma.commentaire.findMany({
      where: { objectifId },
      include: {
        user: { select: { username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(commentaires);
  } catch (error) {
    console.error('💥 Erreur récupération commentaires :', error);
    res.status(500).json({ error: "Impossible de récupérer les commentaires" });
  }
});


// 🔒 Mettre à jour le statut d’un objectif (consultant ou admin)
router.put('/:id/valider', verifyToken, requireAdmin, async (req, res) => {
  const objectifId = parseInt(req.params.id);

  try {
    const objectif = await prisma.objectif.update({
      where: { id: objectifId },
      data: {
        validatedbyadmin: true,
        status: 'Validé' // 👈 on met aussi à jour le statut ici
      }
    });

    res.json({ message: 'Objectif validé avec succès', objectif });
  } catch (error) {
    console.error("💥 Erreur validation objectif :", error);
    res.status(400).json({ error: "Impossible de valider l'objectif" });
  }
});

// 🔒 Mettre à jour uniquement le statut d’un objectif (consultant ou admin)
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

// 🔒 Admin : créer un objectif pour un utilisateur donné
router.post('/admin', verifyToken, requireAdmin, async (req, res) => {
  const { description, userId } = req.body;

  if (!description || !userId) {
    return res.status(400).json({ error: "Champs 'description' et 'userId' requis" });
  }

  try {
    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        user: {
          connect: { id: parseInt(userId) }
        }
      }
    });
    res.status(201).json({ message: "Objectif créé pour le user", objectif });
  } catch (error) {
    console.error("💥 Erreur création objectif admin :", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});

// 🔒 Admin : créer un objectif pour plusieurs utilisateurs
router.post('/admin/multiple', verifyToken, requireAdmin, async (req, res) => {
  const { description, userIds } = req.body;

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
            user: { connect: { id: parseInt(userId) } }
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

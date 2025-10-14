const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const verifyToken = require('../middlewares/verifyToken');
const requireBUM = require('../middlewares/requireBUM');

const prisma = new PrismaClient();

// ⚠️ IMPORTANT : verifyToken DOIT s'exécuter sur TOUTES les routes
router.use(verifyToken);

// ==================== GET STATISTIQUES BUM ====================
router.get('/stats', requireBUM, async (req, res) => {
  try {
    const bumId = req.user.id;

    const consultants = await prisma.user.findMany({
      where: { bumId: bumId },
      include: {
        objectifs: {
          select: {
            id: true,
            status: true,
            validatedbyadmin: true
          }
        }
      }
    });

    const totalConsultants = consultants.length;
    
    let totalObjectifs = 0;
    let objectifsValides = 0;
    let objectifsEnCours = 0;

    consultants.forEach(consultant => {
      totalObjectifs += consultant.objectifs.length;
      consultant.objectifs.forEach(objectif => {
        if (objectif.validatedbyadmin) {
          objectifsValides++;
        }
        if (objectif.status === 'En cours') {
          objectifsEnCours++;
        }
      });
    });

    const tauxValidation = totalObjectifs > 0 
      ? Math.round((objectifsValides / totalObjectifs) * 100) 
      : 0;

    res.json({
      totalConsultants,
      totalObjectifs,
      objectifsValides,
      objectifsEnCours,
      tauxValidation
    });
  } catch (error) {
    console.error('Erreur récupération stats BUM:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== GET BUSINESS UNIT ====================
router.get('/my-bu', requireBUM, async (req, res) => {
  try {
    const bumId = req.user.userId;

    const bum = await prisma.user.findUnique({
      where: { id: bumId },
      include: {
        businessUnit: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!bum || !bum.businessUnit) {
      return res.status(404).json({ error: 'Business Unit non trouvée' });
    }

    res.json(bum.businessUnit);
  } catch (error) {
    console.error('Erreur récupération Business Unit:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== GET CONSULTANTS ====================
router.get('/consultants', requireBUM, async (req, res) => {
  try {
    const bumId = req.user.userId;

    const consultants = await prisma.user.findMany({
      where: { 
        bumId: bumId,
        role: 'CONSULTANT'
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        businessUnit: {
          select: {
            id: true,
            nom: true
          }
        },
        bum: {
          select: {
            id: true,
            username: true
          }
        },
        objectifs: {
          select: {
            id: true,
            description: true,
            status: true,
            validatedbyadmin: true,
            annee: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.json(consultants);
  } catch (error) {
    console.error('Erreur récupération consultants:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== CREATE CONSULTANT ====================
router.post('/consultants', requireBUM, async (req, res) => {
  try {
    const { username, password } = req.body;
    const bumId = req.user.userId;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier si le username existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ce username existe déjà' });
    }

    // Récupérer la businessUnitId du BUM
    const bum = await prisma.user.findUnique({
      where: { id: bumId },
      select: { businessUnitId: true }
    });

    if (!bum || !bum.businessUnitId) {
      return res.status(400).json({ error: 'BUM non associé à une Business Unit' });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer le consultant
    const newConsultant = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'CONSULTANT',
        businessUnitId: bum.businessUnitId,
        bumId: bumId
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        businessUnit: {
          select: {
            id: true,
            nom: true
          }
        },
        bum: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.status(201).json(newConsultant);
  } catch (error) {
    console.error('Erreur création consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== DELETE CONSULTANT ====================
router.delete('/consultants/:id', requireBUM, async (req, res) => {
  try {
    const consultantId = parseInt(req.params.id);
    const bumId = req.user.userId;

    if (isNaN(consultantId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const consultant = await prisma.user.findUnique({
      where: { id: consultantId },
      select: {
        id: true,
        bumId: true,
        role: true
      }
    });

    if (!consultant) {
      return res.status(404).json({ error: 'Consultant non trouvé' });
    }

    if (consultant.bumId !== bumId) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres consultants' });
    }

    if (consultant.role !== 'CONSULTANT') {
      return res.status(400).json({ error: 'Vous ne pouvez supprimer que des consultants' });
    }

    await prisma.user.delete({
      where: { id: consultantId }
    });

    res.json({ message: 'Consultant supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

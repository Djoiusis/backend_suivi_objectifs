// routes/bum.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const requireBUM = require('../middleware/requireBUM');

const prisma = new PrismaClient();

// ==================== GET STATISTIQUES BUM ====================
// GET /bum/stats - Récupérer les statistiques pour le dashboard
router.get('/stats', requireBUM, async (req, res) => {
  try {
    const bumId = req.user.userId;

    // Récupérer tous les consultants du BUM
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

    // Calculer les statistiques
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
// GET /bum/my-bu - Récupérer la Business Unit du BUM
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
// GET /bum/consultants - Récupérer tous les consultants du BUM
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
// POST /bum/consultants - Créer un nouveau consultant
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
// DELETE /bum/consultants/:id - Supprimer un consultant
router.delete('/consultants/:id', requireBUM, async (req, res) => {
  try {
    const consultantId = parseInt(req.params.id);
    const bumId = req.user.userId;

    if (isNaN(consultantId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    // Vérifier que le consultant appartient bien à ce BUM
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

    // Supprimer le consultant (cascade supprimera les objectifs liés)
    await prisma.user.delete({
      where: { id: consultantId }
    });

    res.json({ message: 'Consultant supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== GET OBJECTIFS D'UN CONSULTANT ====================
// GET /bum/consultants/:id/objectifs - Récupérer les objectifs d'un consultant spécifique
router.get('/consultants/:id/objectifs', requireBUM, async (req, res) => {
  try {
    const consultantId = parseInt(req.params.id);
    const bumId = req.user.userId;

    if (isNaN(consultantId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    // Vérifier que le consultant appartient bien à ce BUM
    const consultant = await prisma.user.findUnique({
      where: { id: consultantId },
      select: {
        id: true,
        username: true,
        bumId: true,
        objectifs: {
          include: {
            categorie: {
              select: {
                id: true,
                nom: true,
                couleur: true
              }
            },
            commentaires: {
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
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!consultant) {
      return res.status(404).json({ error: 'Consultant non trouvé' });
    }

    if (consultant.bumId !== bumId) {
      return res.status(403).json({ error: 'Vous ne pouvez voir que les objectifs de vos consultants' });
    }

    res.json({
      consultant: {
        id: consultant.id,
        username: consultant.username
      },
      objectifs: consultant.objectifs
    });
  } catch (error) {
    console.error('Erreur récupération objectifs consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== UPDATE OBJECTIF (Valider/Rejeter) ====================
// PATCH /bum/objectifs/:id - Valider ou commenter un objectif
router.patch('/objectifs/:id', requireBUM, async (req, res) => {
  try {
    const objectifId = parseInt(req.params.id);
    const bumId = req.user.userId;
    const { validatedbyadmin, status, commentaire } = req.body;

    if (isNaN(objectifId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    // Vérifier que l'objectif appartient à un consultant du BUM
    const objectif = await prisma.objectif.findUnique({
      where: { id: objectifId },
      include: {
        user: {
          select: {
            bumId: true
          }
        }
      }
    });

    if (!objectif) {
      return res.status(404).json({ error: 'Objectif non trouvé' });
    }

    if (objectif.user.bumId !== bumId) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que les objectifs de vos consultants' });
    }

    // Mettre à jour l'objectif
    const updateData = {};
    if (typeof validatedbyadmin !== 'undefined') {
      updateData.validatedbyadmin = validatedbyadmin;
    }
    if (status) {
      updateData.status = status;
    }

    const updatedObjectif = await prisma.objectif.update({
      where: { id: objectifId },
      data: updateData,
      include: {
        categorie: true,
        commentaires: {
          include: {
            user: {
              select: {
                username: true,
                role: true
              }
            }
          }
        }
      }
    });

    // Ajouter un commentaire si fourni
    if (commentaire) {
      await prisma.commentaire.create({
        data: {
          contenu: commentaire,
          objectifId: objectifId,
          userid: bumId
        }
      });
    }

    res.json(updatedObjectif);
  } catch (error) {
    console.error('Erreur mise à jour objectif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

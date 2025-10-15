const { sendWelcomeEmail } = require('./emailService');
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Helper : Récupérer l'utilisateur depuis le token
async function getUserFromToken(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'Token manquant' });
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Récupérer l'utilisateur complet depuis la DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userid },
      select: {
        id: true,
        username: true,
        role: true,
        businessUnitId: true,
        bumId: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return null;
    }

    if (user.role !== 'BUM') {
      res.status(403).json({ error: 'Accès réservé aux BUM' });
      return null;
    }

    return user;
  } catch (error) {
    console.error('Erreur vérification token:', error);
    res.status(401).json({ error: 'Token invalide' });
    return null;
  }
}

// ==================== GET STATISTIQUES BUM ====================
router.get('/stats', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return; // Erreur déjà envoyée

  try {
    const bumId = user.id;

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
router.get('/my-bu', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const bum = await prisma.user.findUnique({
      where: { id: user.id },
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
router.get('/consultants', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const consultants = await prisma.user.findMany({
      where: { 
        bumId: user.id,
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
router.post('/consultants', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const { username, password } = req.body;

    console.log('📝 Création consultant par BUM:', user.username);
    console.log('   - Nouveau username:', username);
    console.log('   - BUM ID:', user.id);
    console.log('   - Business Unit ID:', user.businessUnitId);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ce username existe déjà' });
    }

    if (!user.businessUnitId) {
      return res.status(400).json({ error: 'BUM non associé à une Business Unit' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newConsultant = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'CONSULTANT',
        businessUnitId: user.businessUnitId,
        bumId: user.id
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

    console.log('✅ Consultant créé:', newConsultant.username);

    res.status(201).json(newConsultant);
  } catch (error) {
    console.error('❌ Erreur création consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== DELETE CONSULTANT ====================
router.delete('/consultants/:id', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const consultantId = parseInt(req.params.id);

    if (isNaN(consultantId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const consultant = await prisma.user.findUnique({
      where: { id: consultantId },
      select: {
        id: true,
        username: true,
        bumId: true,
        role: true
      }
    });

    if (!consultant) {
      return res.status(404).json({ error: 'Consultant non trouvé' });
    }

    if (consultant.bumId !== user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres consultants' });
    }

    if (consultant.role !== 'CONSULTANT') {
      return res.status(400).json({ error: 'Vous ne pouvez supprimer que des consultants' });
    }

    await prisma.user.delete({
      where: { id: consultantId }
    });

    console.log('🗑️ Consultant supprimé:', consultant.username);

    res.json({ message: 'Consultant supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression consultant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== GET OBJECTIFS D'UN CONSULTANT ====================
router.get('/consultants/:id/objectifs', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const consultantId = parseInt(req.params.id);

    if (isNaN(consultantId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

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

    if (consultant.bumId !== user.id) {
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
router.patch('/objectifs/:id', async (req, res) => {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  try {
    const objectifId = parseInt(req.params.id);
    const { validatedbyadmin, status, commentaire } = req.body;

    if (isNaN(objectifId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

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

    if (objectif.user.bumId !== user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que les objectifs de vos consultants' });
    }

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

    if (commentaire) {
      await prisma.commentaire.create({
        data: {
          contenu: commentaire,
          objectifId: objectifId,
          userid: user.id
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

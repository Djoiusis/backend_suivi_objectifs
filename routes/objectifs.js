const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer tous les objectifs
router.get('/', async (req, res) => {
    try {
        const objectifs = await prisma.objectif.findMany();
        res.json(objectifs);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des objectifs" });
    }
});

// Ajouter un objectif
router.post('/', async (req, res) => {
    const { description, consultantId } = req.body;
    try {
        const objectif = await prisma.objectif.create({
            data: { description, consultantId }
        });
        res.json(objectif);
    } catch (error) {
        res.status(400).json({ error: "Impossible de créer l'objectif" });
    }
});

// Mettre à jour le statut d’un objectif
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const objectif = await prisma.objectif.update({
            where: { id: parseInt(id) },
            data: { status }
        });
        res.json(objectif);
    } catch (error) {
        res.status(400).json({ error: "Impossible de mettre à jour l'objectif" });
    }
});

module.exports = router; // ✅ obligatoire

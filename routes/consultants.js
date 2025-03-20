const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Récupérer tous les consultants
router.get('/', async (req, res) => {
    const consultants = await prisma.consultant.findMany();
    res.json(consultants);
});

// Ajouter un consultant
router.post('/', async (req, res) => {
    const { username, password } = req.body;
    try {
        const consultant = await prisma.consultant.create({
            data: { username, password }
        });
        res.json(consultant);
    } catch (error) {
        res.status(400).json({ error: "Impossible de créer le consultant" });
    }
});

module.exports = router;

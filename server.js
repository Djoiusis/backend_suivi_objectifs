const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const consultantRoutes = require('./routes/consultants');
const objectifsRoutes = require('./routes/objectifs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/auth', authRoutes);
app.use('/consultants', consultantRoutes);
app.use('/objectifs', objectifsRoutes);

// Test de connexion à la base de données
prisma.$connect()
    .then(() => console.log('🗄️ Connecté à la base de données PostgreSQL'))
    .catch(err => console.error('❌ Erreur de connexion DB:', err));

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
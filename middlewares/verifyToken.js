const jwt = require('jsonwebtoken');
require('dotenv').config();

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérification du contenu du token pour déboguer
    console.log('Contenu du token décodé:', decoded);
    
    // Normalement, le token contient déjà les bonnes propriétés si généré correctement
    // Il n'y a pas besoin de renommer userid en id ou vice versa, tout dépend de comment
    // le token a été généré dans auth.js
    req.user = decoded;
    
    // Log pour déboguer
    console.log('req.user défini:', req.user);
    
    next();
  } catch (err) {
    console.error('Erreur de token JWT:', err);
    return res.status(403).json({ error: 'Token invalide' });
  }
}

module.exports = verifyToken;

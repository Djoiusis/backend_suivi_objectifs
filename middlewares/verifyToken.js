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
    req.user = decoded; // ➕ Ajoute les infos user dans req.user
    next();
  } catch (err) {
    console.error('Erreur de token JWT:', err);
    return res.status(403).json({ error: 'Token invalide' });
  }
}

module.exports = verifyToken;

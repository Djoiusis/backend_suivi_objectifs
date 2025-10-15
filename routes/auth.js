const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }
  next();
}

function requireAdminOrBUM(req, res, next) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'BUM') {
    return res.status(403).json({ error: 'Accès réservé aux admins et BUM' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin, requireAdminOrBUM };

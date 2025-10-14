// middleware/requireBUM.js
function requireBUM(req, res, next) {
  if (req.user.role !== 'BUM') {
    return res.status(403).json({ error: 'Accès réservé aux BUM' });
  }
  next();
}


module.exports = requireBUM;

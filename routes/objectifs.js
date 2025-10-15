// Créer un objectif pour un utilisateur (ADMIN ou BUM)
router.post('/admin', verifyToken, requireAdminOrBUM, async (req, res) => {
  const { description, userId, userid, annee, categorieId } = req.body;
  const currentYear = new Date().getFullYear();

  // Accepter userId ou userid
  const targetUserId = userId || userid;

  console.log('🎯 Création objectif:', { description, targetUserId, annee, categorieId, role: req.user.role });

  if (!description || !targetUserId) {
    return res.status(400).json({ error: "Champs 'description' et 'userId' requis" });
  }

  try {
    if (req.user.role === 'BUM') {
      const targetUser = await prisma.user.findUnique({
        where: { id: parseInt(targetUserId) }
      });

      if (!targetUser || targetUser.bumId !== req.user.userid) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des objectifs que pour vos consultants' });
      }
    }

    if (categorieId) {
      const categorie = await prisma.categorie.findUnique({
        where: { id: parseInt(categorieId) }
      });

      if (!categorie) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }

      if (categorie.userid !== null && categorie.userid !== parseInt(targetUserId)) {
        return res.status(403).json({ error: 'Catégorie invalide pour ce consultant' });
      }
    }

    const objectif = await prisma.objectif.create({
      data: {
        description,
        status: "En cours",
        validatedbyadmin: false,
        annee: annee || currentYear,
        userid: parseInt(targetUserId),
        categorieId: categorieId ? parseInt(categorieId) : null
      }
    });
    
    console.log('✅ Objectif créé:', objectif);
    res.status(201).json({ message: "Objectif créé", objectif });
  } catch (error) {
    console.error("❌ Erreur création objectif:", error);
    res.status(400).json({ error: "Impossible de créer l'objectif" });
  }
});

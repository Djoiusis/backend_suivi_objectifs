const axios = require('axios');

async function sendWelcomeEmail(consultantEmail, username, password) {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    
    if (!brevoApiKey) {
      console.error('❌ BREVO_API_KEY not configured');
      return false;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
          .credentials { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
          .info { background: #eff6ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">🎯 Bienvenue sur la plateforme Objectifs</h2>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            <p>Votre compte consultant a été créé avec succès.</p>
            
            <div class="credentials">
              <h3>🔑 Vos identifiants de connexion</h3>
              <p><strong>Nom d'utilisateur :</strong> ${username}</p>
              <p><strong>Mot de passe :</strong> ${password}</p>
            </div>
            
            <div class="info">
              <p>📱 Vous pouvez maintenant vous connecter à l'application pour :</p>
              <ul>
                <li>Consulter vos objectifs</li>
                <li>Suivre votre progression</li>
                <li>Échanger avec votre manager</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px;">À bientôt !</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const payload = {
      sender: {
        name: "Plateforme Objectifs",
        email: "noreply@votre-domaine.com"
      },
      to: [
        {
          email: consultantEmail,
          name: username
        }
      ],
      subject: "🎯 Vos identifiants de connexion - Plateforme Objectifs",
      htmlContent: htmlContent
    };

    console.log(`📧 Envoi email à ${consultantEmail}...`);
    
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.status === 201) {
      console.log(`✅ Email envoyé avec succès à ${consultantEmail}`);
      console.log(`📬 Message ID: ${response.data.messageId}`);
      return true;
    } else {
      console.error(`❌ Erreur envoi email: Status ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    return false;
  }
}

module.exports = { sendWelcomeEmail };

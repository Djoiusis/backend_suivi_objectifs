const https = require('https');

async function sendWelcomeEmail(consultantEmail, username, password) {
  return new Promise((resolve, reject) => {
    try {
      const brevoApiKey = process.env.BREVO_API_KEY;
      
      if (!brevoApiKey) {
        console.error('❌ BREVO_API_KEY not configured');
        resolve(false);
        return;
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

              <div style="text-align: center;">
                <a href="https://objectifs-consultants.talentaccess.ch/" class="button">
                  🚀 Accéder à la plateforme
                </a>
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

      const payload = JSON.stringify({
        sender: {
          name: "Plateforme Objectifs",
          email: "admin@talentaccess.ch"
        },
        to: [
          {
            email: consultantEmail,
            name: username
          }
        ],
        subject: "🎯 Vos identifiants de connexion - Plateforme Objectifs",
        htmlContent: htmlContent
      });

      const options = {
        hostname: 'api.brevo.com',
        port: 443,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      console.log(`📧 Envoi email à ${consultantEmail}...`);

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 201) {
            const response = JSON.parse(data);
            console.log(`✅ Email envoyé avec succès à ${consultantEmail}`);
            console.log(`📬 Message ID: ${response.messageId}`);
            resolve(true);
          } else {
            console.error(`❌ Erreur envoi email: Status ${res.statusCode}`);
            console.error(`Response: ${data}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Erreur envoi email:', error.message);
        resolve(false);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.error('❌ Timeout envoi email');
        resolve(false);
      });

      req.write(payload);
      req.end();

    } catch (error) {
      console.error('❌ Erreur envoi email:', error.message);
      resolve(false);
    }
  });
}

module.exports = { sendWelcomeEmail };

// on va simuler une vraie attaque SQL injection sur BaloPay, puis montrer comment la bloquer.

// le scenario BaloPay
// un utilisateur malveillant essaie de se connecter a BaloPay sans connaitre le mot de passe

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loginDangereux(email) {
  // ❌ CONCATENATION DIRECTE - DANGEREUX
  const query = `SELECT * FROM users WHERE email = '${email}'`;

  console.log("Requete executee:", query);

  const result = await pool.query(query);

  if (result.rows.length > 0) {
    console.log("✅Connexion reussie:", result.rows[0].email);
  } else {
    console.log("❌Utilisateur non trouve");
  }

  await pool.end();
}

// L'attaquant tape ceci comme email
const emailMaveillant = "' OR '1' ='1";
loginDangereux(emailMaveillant);

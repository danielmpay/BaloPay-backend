require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loginSecurise(email) {
  // ✅ REQUÊTE PARAMÉTRÉE — sécurisé
  const query = "SELECT * FROM users WHERE email = $1";

  console.log("Requete SQL:", query);
  console.log("Valeur envoyee separement:", email);

  const result = await pool.query(query, [email]);

  if (result.rows.length > 0) {
    console.log("✅ Connexion réussie:", result.rows[0].email);
  } else {
    console.log("❌ Attaque bloquée — utilisateur non trouvé");
  }

  await pool.end();
}
// la meme attaque
const emailMalveillant = "'OR '1'='1";
loginSecurise(emailMalveillant);

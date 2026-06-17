require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testQuery() {
  try {
    const email = "balo@balopay.com";

    const result = await pool.query(
      "SELECT id, email, balance FROM users WHERE email= $1",
      [email]
    );

    console.log("✅ Utilisateur trouve:", result.rows[0]);
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await pool.end();
  }
}
testQuery();

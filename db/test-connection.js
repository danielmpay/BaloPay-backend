require("dotenv").config();

const pool = require("./pool");

async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL connecté:", result.rows[0].now);
  } catch (error) {
    console.error("❌ Erreur connexion:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();

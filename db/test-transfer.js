require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function transferMoney(senderEmail, receiverEmail, amount) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE users SET balance = balance - $1 WHERE email = $2",
      [amount, senderEmail]
    );

    await client.query(
      "UPDATE users SET balance = balance + $1 WHERE email = $2",
      [amount, receiverEmail]
    );

    await client.query("COMMIT");
    console.log(`✅ Transfert de ${amount} AED reussi`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Transfert annulé:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}
transferMoney("balo@balopay.com", "ali@balopay.com", 100);

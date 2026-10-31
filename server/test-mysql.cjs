
require("dotenv").config();

const mysql = require("mysql2/promise");

async function testConnection() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✅ MySQL connection successful!");

    const [tables] = await connection.query("SHOW TABLES");
    console.log("Tables found:");

    for (const table of tables) {
      console.log(Object.values(table)[0]);
    }

    const [result] = await connection.query(
      "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion"
    );

    console.log("Database:", result[0].databaseName);
    console.log("MySQL version:", result[0].mysqlVersion);
  } catch (error) {
    console.error("❌ MySQL connection failed.");
    console.error("Error code:", error.code || "UNKNOWN");
    console.error("Message:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();

const mysql = require('mysql2');

if (!process.env.MYSQL_URL) {
  console.error('❌ MYSQL_URL is missing');
} else {
  console.log('✅ MYSQL_URL found');
}

const pool = mysql.createPool(process.env.MYSQL_URL);

module.exports = pool;

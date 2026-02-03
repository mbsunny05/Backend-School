// reset-admin.js
const bcrypt = require('bcrypt')
const mysql = require('mysql2')

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'pass123',
  database: 'school_management_db',
})

bcrypt.hash('Admin@123', 10, (err, hash) => {
  if (err) throw err

  pool.query(
    `
    UPDATE users
    SET password = ?, status='active'
    WHERE username = 'admin3'
    `,
    [hash],
    () => {
      console.log('✅ Admin password reset to Admin@123')
      process.exit()
    }
  )
})

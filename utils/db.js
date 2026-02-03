const mysql2=require('mysql2')

const pool=mysql2.createPool({
    host:'localhost',
    user:'root',
    password:'pass123',
    database:'school_Management_db'
})

module.exports=pool
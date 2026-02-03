const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const pool = require('../utils/db')
const result = require('../utils/result')
const verifyToken = require('./verifyToken')

const router = express.Router()
const SALT_ROUNDS = 10

function adminOnly(req, res) {
    console.log(req.user)
    if (req.user.role !== 'admin') {
        res.send(result.createResult('Access denied: Admin only'))
        return false
    }
    return true
}

/* =========================
   REGISTRATION (ADMIN USE)
========================= */
router.post('/registration', verifyToken, (req, res) => {
    if (!adminOnly(req, res)) return
    const { fname, role, date, salary, roll_no, reg_no, class_id } = req.body
    
    const username = reg_no
    const password = reg_no
    
    if (!fname || !username || !password || !role || !date) {
        return res.send(result.createResult('Missing required fields'))
    }

    const sqlUser = `
        INSERT INTO users (username, password, role)
        VALUES (?, ?, ?)
    `

    const sqlEmployee = `
        INSERT INTO employees (user_id, reg_no, fname, joining_date, salary)
        VALUES (?, ?, ?, ?, ?)
    `

    const sqlStudent = `
        INSERT INTO students (user_id, fname, admission_date, roll_no, reg_no, class_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `

    pool.getConnection((err, connection) => {
        if (err) return res.send(result.createResult(err))

        connection.beginTransaction(err => {
            if (err) {
                connection.release()
                return res.send(result.createResult(err))
            }

            bcrypt.hash(password, SALT_ROUNDS, (err, hashedPassword) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release()
                        res.send(result.createResult(err))
                    })
                }

                connection.query(sqlUser, [username, hashedPassword, role], (err, userResult) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release()
                            res.send(result.createResult(err))
                        })
                    }

                    const user_id = userResult.insertId

                    const roleQuery =
                        role === 'student'
                            ? {
                                  sql: sqlStudent,
                                  values: [user_id, fname, date, roll_no, reg_no, class_id],
                                  successMsg: 'Student registered successfully'
                              }
                            : {
                                  sql: sqlEmployee,
                                  values: [user_id, reg_no, fname, date, salary ],
                                  successMsg: 'Employee registered successfully'
                              }

                    connection.query(roleQuery.sql, roleQuery.values, err => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release()
                                res.send(result.createResult(err))
                            })
                        }

                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release()
                                    res.send(result.createResult(err))
                                })
                            }

                            connection.release()
                            res.send(result.createResult(null, roleQuery.successMsg))
                        })
                    })
                })
            })
        })
    })
})

/* =========================
   SINGLE LOGIN (ALL ROLES)
========================= */
router.post('/signin', (req, res) => {
    console.log('REQ BODY:', req.body)
    const { username, password } = req.body
    console.log('USERNAME:', username)
    console.log('PASSWORD:', password)

    const sql = `
        SELECT user_id, username, password, role, status
        FROM users
        WHERE username = ? AND status = 'active'
    `

    pool.query(sql, [username], (err, data) => {
        if (err || data.length === 0) {
            console.log("hhh")
            return res.status(401).send(
                result.createResult('Invalid credentials')
              )
        }

        bcrypt.compare(password, data[0].password, (err, isMatch) => {
            if (err) {
                console.log("mmmmm")
                return res.send(result.createResult(err))
            }

            if (!isMatch) {
                console.log("kkkkk")
                return res.status(401).send(
                    result.createResult('Invalid credentials')
                  )
            }

            const payload = {
                user_id: data[0].user_id,
                role: data[0].role,
            }

            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            )

            res.send(
                result.createResult(null, {
                    token,
                    role: data[0].role,
                })
            )
        })
    })
})

module.exports = router

const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

function adminOnly(req, res) {
    if (req.user.role !== 'admin') {
        res.send(result.createResult('Access denied: Admin only'))
        return false
    }
    return true
}

/* =====================================================
   1. GET ALL USERS
===================================================== */
router.get('/all', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT user_id, username, role, status FROM users',
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   2. GET USERS BY ROLE
===================================================== */
router.get('/role/:role', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT user_id, username, status FROM users WHERE role=?',
        [req.params.role],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   3. GET USER BY ID
===================================================== */
router.get('/:id', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT user_id, username, role, status FROM users WHERE user_id=?',
        [req.params.id],
        (err, data) => res.send(result.createResult(err, data[0]))
    )
})

/* =====================================================
   4. ACTIVATE USER
===================================================== */
router.put('/:id/activate', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        "UPDATE users SET status='active' WHERE user_id=?",
        [req.params.id],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   5. DEACTIVATE USER
===================================================== */
router.put('/:id/deactivate', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        "UPDATE users SET status='inactive' WHERE user_id=?",
        [req.params.id],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   6. DELETE USER (CASCADE)
===================================================== */
router.delete('/:id', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'DELETE FROM users WHERE user_id=?',
        [req.params.id],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   7. RESET USER PASSWORD (ADMIN)
===================================================== */
router.put('/:id/reset-password', (req, res) => {
    if (!adminOnly(req, res)) return

    const bcrypt = require('bcrypt')
    const SALT = 10
    const { new_password } = req.body

    bcrypt.hash(new_password, SALT, (err, hash) => {
        if (err) return res.send(result.createResult(err))

        pool.query(
            'UPDATE users SET password=? WHERE user_id=?',
            [hash, req.params.id],
            (err, data) => res.send(result.createResult(err, data))
        )
    })
})

/* =====================================================
   8. USER COUNT (DASHBOARD)
===================================================== */
router.get('/stats/count', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT role, COUNT(*) AS total FROM users GROUP BY role',
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   9. INACTIVE USERS
===================================================== */
router.get('/status/inactive', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        "SELECT user_id, username, role FROM users WHERE status='inactive'",
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   10. SEARCH USER
===================================================== */
router.get('/search/:keyword', (req, res) => {
    if (!adminOnly(req, res)) return

    const key = `%${req.params.keyword}%`

    pool.query(
        'SELECT user_id, username, role FROM users WHERE username LIKE ?',
        [key],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   11. LAST CREATED USERS
===================================================== */
router.get('/recent/:limit', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT user_id, username, role FROM users ORDER BY created_at DESC LIMIT ?',
        [Number(req.params.limit)],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   12. UPDATE USER ROLE
===================================================== */
router.put('/:id/role', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'UPDATE users SET role=? WHERE user_id=?',
        [req.body.role, req.params.id],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   13. USER STATUS CHECK
===================================================== */
router.get('/:id/status', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT status FROM users WHERE user_id=?',
        [req.params.id],
        (err, data) => res.send(result.createResult(err, data[0]))
    )
})

/* =====================================================
   14. BULK USER DEACTIVATION
===================================================== */
router.put('/bulk/deactivate', (req, res) => {
    if (!adminOnly(req, res)) return

    const { user_ids } = req.body

    pool.query(
        'UPDATE users SET status="inactive" WHERE user_id IN (?)',
        [user_ids],
        (err, data) => res.send(result.createResult(err, data))
    )
})

/* =====================================================
   15. VERIFY USER EXISTS
===================================================== */
router.get('/exists/:username', (req, res) => {
    if (!adminOnly(req, res)) return

    pool.query(
        'SELECT COUNT(*) AS count FROM users WHERE username=?',
        [req.params.username],
        (err, data) => res.send(result.createResult(err, data[0]))
    )
})

module.exports = router

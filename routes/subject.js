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

    // /* =====================================================
    // 2. GET ALL SUBJECTS
    // ===================================================== */
    // router.get('/getAll', (req, res) => {
    //     pool.query('SELECT subject_id,subject_name,class_id,teacher_id FROM subjects', (err, data) => {
    //         res.send(result.createResult(err, data))
    //     })
    // })

    /* =====================================================
    3. GET SUBJECT BY ID
    ===================================================== */
    router.get('/:id', (req, res) => {
        pool.query(
            'SELECT subject_id,subject_name,class_id,teacher_id FROM subjects WHERE subject_id=?',
            [req.params.id],
            (err, data) => res.send(result.createResult(err, data[0]))
        )
    })


    /* =====================================================
    5. CHANGE SUBJECT TEACHER (ADMIN)
    ===================================================== */
    // router.put('/assign-teacher', (req, res) => {
    //     if (!adminOnly(req, res)) return

    //     const { subject_id, teacher_id } = req.body

    //     pool.query(
    //         'UPDATE subjects SET teacher_id=? WHERE subject_id=?',
    //         [teacher_id, subject_id],
    //         (err, data) => res.send(result.createResult(err, data))
    //     )
    // })

    /* =====================================================
    6. DELETE SUBJECT (ADMIN)
    ===================================================== */
    router.delete('/:id', (req, res) => {
        if (!adminOnly(req, res)) return

        pool.query(
            'DELETE FROM subjects WHERE subject_id=?',
            [req.params.id],
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    7. GET SUBJECTS BY CLASS
    ===================================================== */
    router.get('/class/:class_id', (req, res) => {
        pool.query(
            'SELECT * FROM subjects WHERE class_id=?',
            [req.params.class_id],
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    8. GET SUBJECTS BY TEACHER
    ===================================================== */
    router.get('/teacher/:employee_id', (req, res) => {
        pool.query(
            'SELECT * FROM subjects WHERE teacher_id=?',
            [req.params.employee_id],
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    9. GET SUBJECTS FOR LOGGED-IN STUDENT
    ===================================================== */
    router.get('/my/class', (req, res) => {
        if (req.user.role !== 'student') {
            return res.send(result.createResult('Access denied'))
        }

        const sql = `
            SELECT 
                sub.subject_name,
                CONCAT(e.fname,' ',e.lname) AS teacher_name
            FROM students s
            JOIN subjects sub ON s.class_id=sub.class_id
            JOIN employees e ON sub.teacher_id=e.employee_id
            WHERE s.user_id=?
        `
        pool.query(sql, [req.user.user_id], (err, data) => {
            res.send(result.createResult(err, data))
        })
    })

    /* =====================================================
    10. SUBJECT COUNT PER CLASS
    ===================================================== */
    router.get('/stats/class-wise', (req, res) => {
        const sql = `
            SELECT 
                c.class_name,
                c.section,
                COUNT(sub.subject_id) AS total_subjects
            FROM classes c
            LEFT JOIN subjects sub ON c.class_id=sub.class_id
            GROUP BY c.class_id
        `
        pool.query(sql, (err, data) => {
            res.send(result.createResult(err, data))
        })
    })

    /* =====================================================
    11. SUBJECT COUNT PER TEACHER
    ===================================================== */
    router.get('/stats/teacher-wise', (req, res) => {
        const sql = `
            SELECT 
                CONCAT(e.fname,' ',e.lname) AS teacher_name,
                COUNT(sub.subject_id) AS total_subjects
            FROM employees e
            LEFT JOIN subjects sub ON e.employee_id=sub.teacher_id
            GROUP BY e.employee_id
        `
        pool.query(sql, (err, data) => {
            res.send(result.createResult(err, data))
        })
    })

    /* =====================================================
    12. UNASSIGNED SUBJECTS
    ===================================================== */
    router.get('/unassigned/teacher', (req, res) => {
        pool.query(
            'SELECT * FROM subjects WHERE teacher_id IS NULL',
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    13. SEARCH SUBJECTS
    ===================================================== */
    router.get('/search/:keyword', (req, res) => {
        const key = `%${req.params.keyword}%`

        pool.query(
            'SELECT * FROM subjects WHERE subject_name LIKE ?',
            [key],
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    14. SUBJECT DROPDOWN (CLASS)
    ===================================================== */
    router.get('/dropdown/:class_id', (req, res) => {
        pool.query(
            'SELECT subject_id, subject_name FROM subjects WHERE class_id=?',
            [req.params.class_id],
            (err, data) => res.send(result.createResult(err, data))
        )
    })

    /* =====================================================
    15. SUBJECT + CLASS + TEACHER DETAILS
    ===================================================== */
    router.get('/details/full', (req, res) => {
        const sql = `
            SELECT 
                sub.subject_name,
                c.class_name,
                c.section,
                CONCAT(e.fname,' ',e.lname) AS teacher_name
            FROM subjects sub
            JOIN classes c ON sub.class_id=c.class_id
            JOIN employees e ON sub.teacher_id=e.employee_id
        `
        pool.query(sql, (err, data) => {
            res.send(result.createResult(err, data))
        })
    })

    module.exports = router

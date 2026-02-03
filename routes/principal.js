const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

/* =========================
   PRINCIPAL ONLY GUARD
========================= */
function principalOnly(req, res) {
    if (req.user.role !== 'principal') {
        res.send(result.createResult('Access denied: Principal only'))
        return false
    }
    return true
}

/* =====================================================
   1. GET PRINCIPAL PROFILE
===================================================== */
router.get('/profile', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            e.employee_id,
            e.fname,
            e.lname,
            e.mobile,
            e.email,
            e.gender,
            e.joining_date
        FROM employees e
        WHERE e.user_id = ?
    `
    pool.query(sql, [req.user.user_id], (err, data) => {
        res.send(result.createResult(err, data[0]))
    })
})

/* =====================================================
   2. VIEW ALL TEACHERS
===================================================== */
router.get('/teachers', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            e.employee_id,
            e.fname,
            e.lname,
            e.mobile,
            e.email,
            e.gender,
            e.joining_date,
            e.salary,
            u.status
        FROM employees e
        JOIN users u ON e.user_id = u.user_id
        WHERE u.role = 'teacher'
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =====================================================
   3. VIEW ALL STUDENTS
===================================================== */
router.get('/students', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            s.student_id,
            s.roll_no,
            s.reg_no,
            s.fname,
            s.lname,
            s.gender,
            s.mobile,
            s.email,
            c.class_name,
            c.section,
            u.status
        FROM students s
        JOIN users u ON s.user_id = u.user_id
        JOIN classes c ON s.class_id = c.class_id
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =====================================================
   4. TEACHER-WISE STUDENT LIST
===================================================== */
router.get('/teacher/:employee_id/students', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT DISTINCT
            s.student_id,
            s.roll_no,
            s.fname,
            s.lname,
            c.class_name,
            c.section
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN subjects sub ON sub.class_id = c.class_id
        WHERE sub.teacher_id = ?
    `
    pool.query(sql, [req.params.employee_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =====================================================
   5. CLASS-WISE STUDENT COUNT
===================================================== */
router.get('/students/classcount', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            c.class_name,
            c.section,
            COUNT(s.student_id) AS total_students
        FROM classes c
        LEFT JOIN students s ON c.class_id = s.class_id
        GROUP BY c.class_id
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =====================================================
   6. FEES OVERVIEW (READ ONLY)
===================================================== */
router.get('/accounts/fees', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            f.fee_id,
            s.reg_no,
            CONCAT(s.fname,' ',s.lname) AS student_name,
            fc.category_name,
            f.amount,
            f.fee_month,
            f.fee_year,
            f.payment_date,
            f.status
        FROM fees f
        JOIN students s ON f.student_id = s.student_id
        JOIN fee_categories fc ON f.category_id = fc.category_id
        ORDER BY f.payment_date DESC
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =====================================================
   7. FEES DASHBOARD SUMMARY
===================================================== */
router.get('/dashboard/accounts', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            status,
            SUM(amount) AS total_amount
        FROM fees
        GROUP BY status
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})


router.get('/stats/teachers/count', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT COUNT(*) AS total_teachers
        FROM users
        WHERE role='teacher'
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/stats/classes/count', (req, res) => {
    if (!principalOnly(req, res)) return

    pool.query(
        'SELECT COUNT(*) AS total_classes FROM classes',
        (err, data) => res.send(result.createResult(err, data))
    )
})
router.get('/stats/students/gender', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT gender, COUNT(*) AS count
        FROM students
        GROUP BY gender
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})
router.get('/stats/employees/gender', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT gender, COUNT(*) AS count
        FROM employees
        GROUP BY gender
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/subjects/class-wise', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            c.class_name,
            c.section,
            COUNT(sub.subject_id) AS total_subjects
        FROM classes c
        LEFT JOIN subjects sub ON c.class_id = sub.class_id
        GROUP BY c.class_id
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/teachers/workload', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            e.employee_id,
            CONCAT(e.fname,' ',e.lname) AS teacher_name,
            COUNT(sub.subject_id) AS subject_count
        FROM employees e
        LEFT JOIN subjects sub ON e.employee_id = sub.teacher_id
        GROUP BY e.employee_id
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})
router.get('/attendance/employees/summary/:month/:year', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            status,
            COUNT(*) AS count
        FROM attendance_employees
        WHERE MONTH(attendance_date)=?
          AND YEAR(attendance_date)=?
        GROUP BY status
    `
    pool.query(sql, [req.params.month, req.params.year], (err, data) => {
        res.send(result.createResult(err, data))
    })
})
router.get('/academics/top-students', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            s.student_id,
            CONCAT(s.fname,' ',s.lname) AS student_name,
            AVG(m.marks_obtained) AS avg_marks
        FROM marks m
        JOIN students s ON m.student_id=s.student_id
        GROUP BY s.student_id
        ORDER BY avg_marks DESC
        LIMIT 10
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})
router.get('/academics/subject-performance', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT 
            sub.subject_name,
            AVG(m.marks_obtained) AS avg_marks
        FROM marks m
        JOIN subjects sub ON m.subject_id=sub.subject_id
        GROUP BY sub.subject_id
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/users/inactive', (req, res) => {
    if (!principalOnly(req, res)) return

    const sql = `
        SELECT user_id, username, role
        FROM users
        WHERE status='inactive'
    `
    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})


module.exports = router

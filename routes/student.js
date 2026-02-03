const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

/* =========================
   STUDENT ONLY GUARD
========================= */
function studentOnly(req, res) {
    if (req.user.role !== 'student') {
        res.send(result.createResult('Access denied: Student only'))
        return false
    }
    return true
}

/* =========================
   1. CURRENT ENROLLMENT SNAPSHOT
========================= */
router.get('/current-enrollment', (req, res) => {
    if (!studentOnly(req, res)) return

    const sql = `
        SELECT
            se.enrollment_id,
            se.student_master_id,
            se.roll_no,
            se.admission_date,
            ay.academic_year_id,
            ay.year_name AS academic_year,
            c.class_id,
            c.class_level,
            c.division,
            CONCAT(e.fname,' ',IFNULL(e.lname,'')) AS class_teacher
        FROM student_enrollments se
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        JOIN classes c ON c.class_id = se.class_id
        LEFT JOIN employees e ON e.employee_id = c.class_teacher_id
        WHERE se.user_id = ?
          AND ay.is_active = TRUE
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        if (err) return res.send(result.createResult(err))
        if (!data.length) return res.send(result.createResult('No active enrollment found'))
        res.send(result.createResult(null, data[0]))
    })
})

/* =========================
   2. ALL ENROLLMENTS (HISTORY)
========================= */
router.get('/all-enrollments', (req, res) => {
    if (!studentOnly(req, res)) return

    const sql = `
        SELECT
            se.enrollment_id,
            se.roll_no,
            c.class_level,
            c.division,
            ay.year_name,
            ay.is_active,
            ay.start_date,
            ay.end_date
        FROM student_enrollments se
        JOIN classes c ON c.class_id = se.class_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        WHERE se.user_id = ?
        ORDER BY ay.start_date DESC
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   3. STUDENT PROFILE
========================= */
router.get('/profile', (req, res) => {
    if (!studentOnly(req, res)) return

    const sql = `
        SELECT
            sm.student_master_id,
            sm.reg_no,
            sm.fname,
            sm.lname,
            sm.mother_name,
            sm.gender,
            sm.dob,
            sm.email,
            sm.mobile,
            sm.address,
            se.roll_no,
            se.admission_date,
            c.class_level,
            c.division,
            ay.year_name
        FROM student_enrollments se
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN classes c ON c.class_id = se.class_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        WHERE se.user_id = ?
          AND ay.is_active = TRUE
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        if (err) return res.send(result.createResult(err))
        if (!data.length) return res.send(result.createResult('Student record not found'))
        res.send(result.createResult(null, data[0]))
    })
})

/* =========================
   4. UPDATE PROFILE (MASTER DATA)
========================= */
router.put('/profile/update', (req, res) => {
    if (!studentOnly(req, res)) return

    const { mobile, email, address } = req.body

    // Get student_master_id from enrollment
    pool.query(
        `SELECT sm.student_master_id 
         FROM student_enrollments se
         JOIN student_master sm ON sm.student_master_id = se.student_master_id
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         WHERE se.user_id = ? AND ay.is_active = TRUE`,
        [req.user.user_id],
        (err, rows) => {
            if (err) return res.send(result.createResult(err))
            if (!rows.length) return res.send(result.createResult('Student not found'))

            const student_master_id = rows[0].student_master_id

            pool.query(
                'UPDATE student_master SET mobile=?, email=?, address=? WHERE student_master_id=?',
                [mobile, email, address, student_master_id],
                err => res.send(result.createResult(err, 'Profile updated successfully'))
            )
        }
    )
})

/* =========================
   5. DASHBOARD
========================= */
router.get('/dashboard', (req, res) => {
    if (!studentOnly(req, res)) return

    const sql = `
        SELECT
            se.enrollment_id,
            se.roll_no,
            c.class_level,
            c.division,
            ay.year_name,
            CONCAT(e.fname,' ',IFNULL(e.lname,'')) AS class_teacher,
            
            (SELECT COUNT(*) 
             FROM attendance_students a
             WHERE a.enrollment_id = se.enrollment_id) AS total_days,
            
            (SELECT COUNT(*) 
             FROM attendance_students a
             WHERE a.enrollment_id = se.enrollment_id AND a.status='Present') AS present_days,
            
            (SELECT JSON_ARRAYAGG(subject_name)
             FROM subjects s
             WHERE s.class_id = se.class_id
             AND s.academic_year_id = se.academic_year_id) AS subjects
        FROM student_enrollments se
        JOIN classes c ON c.class_id = se.class_id
        LEFT JOIN employees e ON e.employee_id = c.class_teacher_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        WHERE se.user_id = ?
          AND ay.is_active = TRUE
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, data[0]))
    })
})

/* =========================
   6. MARKS (BY ENROLLMENT)
========================= */
router.get('/marks', (req, res) => {
    if (!studentOnly(req, res)) return

    const { enrollment_id } = req.query

    const sql = `
        SELECT
            sub.subject_name,
            ex.exam_name,
            m.marks_obtained,
            m.max_marks,
            m.grade
        FROM marks m
        JOIN subjects sub ON sub.subject_id = m.subject_id
        JOIN exams ex ON ex.exam_id = m.exam_id
        WHERE m.enrollment_id = ?
        ORDER BY ex.exam_name, sub.subject_name
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   7. ATTENDANCE (MONTH-WISE)
========================= */
router.get('/attendance', (req, res) => {
    if (!studentOnly(req, res)) return

    const { enrollment_id, month, year } = req.query

    const sql = `
        SELECT attendance_date, status
        FROM attendance_students
        WHERE enrollment_id = ?
          AND MONTH(attendance_date) = ?
          AND YEAR(attendance_date) = ?
        ORDER BY attendance_date
    `

    pool.query(sql, [enrollment_id, month, year], (err, rows) => {
        if (err) return res.send(result.createResult(err))

        const present = rows.filter(r => r.status === 'Present').length

        res.send(result.createResult(null, {
            total_days: rows.length,
            present_days: present,
            absent_days: rows.length - present,
            records: rows
        }))
    })
})

/* =========================
   8. FEE SUMMARY
========================= */
router.get('/fees', (req, res) => {
    if (!studentOnly(req, res)) return

    const { enrollment_id } = req.query

    const sql = `
        SELECT
            sfa.total_amount,
            IFNULL(SUM(fp.amount_paid), 0) AS paid_amount,
            (sfa.total_amount - IFNULL(SUM(fp.amount_paid), 0)) AS due_amount,
            sfa.assigned_date
        FROM student_fee_assignments sfa
        LEFT JOIN fee_payments fp ON fp.enrollment_id = sfa.enrollment_id
        WHERE sfa.enrollment_id = ?
        GROUP BY sfa.assignment_id, sfa.total_amount, sfa.assigned_date
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, data[0] || { 
            total_amount: 0, 
            paid_amount: 0, 
            due_amount: 0 
        }))
    })
})

/* =========================
   9. FEE PAYMENT HISTORY
========================= */
router.get('/fees-history', (req, res) => {
    if (!studentOnly(req, res)) return

    const { enrollment_id } = req.query

    const sql = `
        SELECT
            fp.payment_id,
            fp.amount_paid,
            fp.payment_date,
            fp.payment_mode,
            fp.receipt_no
        FROM fee_payments fp
        WHERE fp.enrollment_id = ?
        ORDER BY fp.payment_date DESC
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   10. PROGRESS REPORT
========================= */
router.get('/progress-report', (req, res) => {
    if (!studentOnly(req, res)) return

    const { enrollment_id } = req.query

    const sql = `
        SELECT
            ex.exam_name,
            COUNT(DISTINCT m.subject_id) as subjects_count,
            SUM(m.marks_obtained) as total_obtained,
            SUM(m.max_marks) as total_max,
            ROUND((SUM(m.marks_obtained) / SUM(m.max_marks)) * 100, 2) as percentage
        FROM marks m
        JOIN exams ex ON ex.exam_id = m.exam_id
        WHERE m.enrollment_id = ?
        GROUP BY ex.exam_id, ex.exam_name
        ORDER BY ex.exam_name
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   11. CHANGE PASSWORD
========================= */
const bcrypt = require('bcrypt')

router.put('/change-password', async (req, res) => {
    if (!studentOnly(req, res)) return

    const { old_password, new_password } = req.body

    if (!old_password || !new_password) {
        return res.send(result.createResult('Old and new password required'))
    }

    pool.query(
        'SELECT password FROM users WHERE user_id=?',
        [req.user.user_id],
        async (err, rows) => {
            if (err) return res.send(result.createResult(err))
            if (!rows.length) return res.send(result.createResult('User not found'))

            const valid = await bcrypt.compare(old_password, rows[0].password)
            if (!valid) return res.send(result.createResult('Old password incorrect'))

            const hashed = await bcrypt.hash(new_password, 10)

            pool.query(
                'UPDATE users SET password=? WHERE user_id=?',
                [hashed, req.user.user_id],
                err => res.send(result.createResult(err, 'Password updated successfully'))
            )
        }
    )
})

module.exports = router
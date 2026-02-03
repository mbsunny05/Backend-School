const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

/* =========================
   ACCOUNTANT ONLY GUARD
========================= */
function accountantOnly(req, res) {
    if (req.user.role !== 'accountant') {
        res.send(result.createResult('Access denied: Accountant only'))
        return false
    }
    return true
}

/* =========================
   1. ACCOUNTANT PROFILE
========================= */
router.get('/profile', (req, res) => {
    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT
            e.employee_id,
            e.fname,
            e.lname,
            e.reg_no,
            e.gender,
            e.mobile,
            e.email,
            e.joining_date,
            e.salary,
            u.username
        FROM employees e
        JOIN users u ON u.user_id = e.user_id
        WHERE e.user_id = ?
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        if (err) return res.send(result.createResult(err))
        if (!data.length) return res.send(result.createResult('Accountant not found'))
        res.send(result.createResult(null, data[0]))
    })
})

/* =========================
   2. UPDATE PROFILE
========================= */
router.put('/profile/update', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { fname, lname, gender, mobile, email } = req.body

    const sql = `
        UPDATE employees 
        SET fname=?, lname=?, gender=?, mobile=?, email=?
        WHERE user_id=?
    `

    pool.query(sql, [fname, lname, gender, mobile, email, req.user.user_id], (err) => {
        res.send(result.createResult(err, 'Profile updated successfully'))
    })
})

/* =========================
   3. DASHBOARD STATS
========================= */
router.get('/dashboard', (req, res) => {
    if (!accountantOnly(req, res)) return

    const queries = [
        // Total students (active year)
        `SELECT COUNT(*) as total_students
         FROM student_enrollments se
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         WHERE ay.is_active = TRUE`,
        
        // Monthly collection (current month)
        `SELECT IFNULL(SUM(amount_paid), 0) as monthly_collection
         FROM fee_payments
         WHERE MONTH(payment_date) = MONTH(CURRENT_DATE())
           AND YEAR(payment_date) = YEAR(CURRENT_DATE())`,
        
        // Total collected (all time)
        `SELECT IFNULL(SUM(amount_paid), 0) as total_collected
         FROM fee_payments`,
        
        // Total pending
        `SELECT IFNULL(SUM(sfa.total_amount - IFNULL(paid.total_paid, 0)), 0) as total_pending
         FROM student_fee_assignments sfa
         JOIN student_enrollments se ON se.enrollment_id = sfa.enrollment_id
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         LEFT JOIN (
             SELECT enrollment_id, SUM(amount_paid) as total_paid
             FROM fee_payments
             GROUP BY enrollment_id
         ) paid ON paid.enrollment_id = sfa.enrollment_id
         WHERE ay.is_active = TRUE`
    ]

    Promise.all(queries.map(q => new Promise((resolve, reject) => {
        pool.query(q, (err, data) => {
            if (err) reject(err)
            else resolve(data[0])
        })
    })))
    .then(results => {
        res.send(result.createResult(null, {
            total_students: results[0].total_students,
            monthly_collection: results[1].monthly_collection,
            total_collected: results[2].total_collected,
            total_pending: results[3].total_pending
        }))
    })
    .catch(err => res.send(result.createResult(err)))
})

/* =========================
   4. ALL STUDENTS WITH FEE STATUS
========================= */
router.get('/students/fees', (req, res) => {
    console.log('here')
    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT
            se.enrollment_id,
            sm.student_master_id,
            sm.reg_no,
            CONCAT(sm.fname, ' ', IFNULL(sm.lname, '')) as student_name,
            se.roll_no,
            c.class_level,
            c.division,
            sm.mobile,
            ay.year_name,
            IFNULL(sfa.total_amount, 0) as total_amount,
            IFNULL(SUM(fp.amount_paid), 0) as total_paid,
            (IFNULL(sfa.total_amount, 0) - IFNULL(SUM(fp.amount_paid), 0)) as total_pending
        FROM student_enrollments se
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN classes c ON c.class_id = se.class_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        LEFT JOIN student_fee_assignments sfa ON sfa.enrollment_id = se.enrollment_id
        LEFT JOIN fee_payments fp ON fp.enrollment_id = se.enrollment_id
        WHERE ay.is_active = TRUE
        GROUP BY se.enrollment_id, sm.student_master_id, sm.reg_no, student_name, 
                 se.roll_no, c.class_level, c.division, sm.mobile, ay.year_name, sfa.total_amount
        ORDER BY c.class_level, c.division, se.roll_no
    `

    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   5. ASSIGN FEE TO STUDENT
========================= */
router.post('/fees/assign', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { enrollment_id, total_amount, assigned_date } = req.body

    // Check if already assigned
    pool.query(
        'SELECT assignment_id FROM student_fee_assignments WHERE enrollment_id=?',
        [enrollment_id],
        (err, rows) => {
            if (err) return res.send(result.createResult(err))

            if (rows.length > 0) {
                // Update existing assignment
                pool.query(
                    'UPDATE student_fee_assignments SET total_amount=?, assigned_date=? WHERE enrollment_id=?',
                    [total_amount, assigned_date, enrollment_id],
                    err => res.send(result.createResult(err, 'Fee updated successfully'))
                )
            } else {
                // Insert new assignment
                pool.query(
                    'INSERT INTO student_fee_assignments (enrollment_id, total_amount, assigned_date) VALUES (?, ?, ?)',
                    [enrollment_id, total_amount, assigned_date],
                    err => res.send(result.createResult(err, 'Fee assigned successfully'))
                )
            }
        }
    )
})

/* =========================
   6. BULK FEE ASSIGNMENT (BY CLASS)
========================= */
router.post('/fees/assign-bulk', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { class_id, total_amount, assigned_date } = req.body

    // Get all enrollments for the class in active year
    pool.query(
        `SELECT se.enrollment_id
         FROM student_enrollments se
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         WHERE se.class_id = ? AND ay.is_active = TRUE`,
        [class_id],
        (err, enrollments) => {
            if (err) return res.send(result.createResult(err))
            if (!enrollments.length) return res.send(result.createResult('No students found in this class'))

            const values = enrollments.map(e => [e.enrollment_id, total_amount, assigned_date])

            // Insert or update fee assignments
            pool.query(
                `INSERT INTO student_fee_assignments (enrollment_id, total_amount, assigned_date) 
                 VALUES ? 
                 ON DUPLICATE KEY UPDATE total_amount=VALUES(total_amount), assigned_date=VALUES(assigned_date)`,
                [values],
                err => res.send(result.createResult(err, `Fee assigned to ${enrollments.length} students`))
            )
        }
    )
})

/* =========================
   7. COLLECT FEE PAYMENT
========================= */
router.post('/fees/collect', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { enrollment_id, amount_paid, payment_date, payment_mode } = req.body

    // Generate receipt number
    const receiptNo = `RCP${Date.now()}`

    pool.query(
        'INSERT INTO fee_payments (enrollment_id, amount_paid, payment_date, payment_mode, receipt_no) VALUES (?, ?, ?, ?, ?)',
        [enrollment_id, amount_paid, payment_date, payment_mode || 'Cash', receiptNo],
        (err) => {
            if (err) return res.send(result.createResult(err))
            res.send(result.createResult(null, { 
                message: 'Payment recorded successfully',
                receipt_no: receiptNo 
            }))
        }
    )
})

/* =========================
   8. STUDENT FEE DETAILS
========================= */
router.get('/student/:enrollment_id/fees', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { enrollment_id } = req.params

    const sql = `
        SELECT
            sfa.total_amount,
            IFNULL(SUM(fp.amount_paid), 0) as total_paid,
            (sfa.total_amount - IFNULL(SUM(fp.amount_paid), 0)) as balance,
            sfa.assigned_date
        FROM student_fee_assignments sfa
        LEFT JOIN fee_payments fp ON fp.enrollment_id = sfa.enrollment_id
        WHERE sfa.enrollment_id = ?
        GROUP BY sfa.assignment_id, sfa.total_amount, sfa.assigned_date
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        res.send(result.createResult(err, data[0]))
    })
})

/* =========================
   9. PAYMENT HISTORY FOR STUDENT
========================= */
router.get('/student/:enrollment_id/payments', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { enrollment_id } = req.params

    const sql = `
        SELECT
            payment_id,
            amount_paid,
            payment_date,
            payment_mode,
            receipt_no
        FROM fee_payments
        WHERE enrollment_id = ?
        ORDER BY payment_date DESC
    `

    pool.query(sql, [enrollment_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   10. RECENT TRANSACTIONS
========================= */
router.get('/transactions/recent', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { limit = 50 } = req.query

    const sql = `
        SELECT
            fp.payment_id,
            fp.amount_paid,
            fp.payment_date,
            fp.payment_mode,
            fp.receipt_no,
            CONCAT(sm.fname, ' ', IFNULL(sm.lname, '')) as student_name,
            sm.reg_no,
            c.class_level,
            c.division
        FROM fee_payments fp
        JOIN student_enrollments se ON se.enrollment_id = fp.enrollment_id
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN classes c ON c.class_id = se.class_id
        ORDER BY fp.payment_date DESC, fp.payment_id DESC
        LIMIT ?
    `

    pool.query(sql, [parseInt(limit)], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   11. DEFAULTERS (PENDING FEES)
========================= */
router.get('/defaulters', (req, res) => {
    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT
            se.enrollment_id,
            CONCAT(sm.fname, ' ', IFNULL(sm.lname, '')) as student_name,
            sm.reg_no,
            se.roll_no,
            c.class_level,
            c.division,
            sm.mobile,
            sfa.total_amount,
            IFNULL(SUM(fp.amount_paid), 0) as total_paid,
            (sfa.total_amount - IFNULL(SUM(fp.amount_paid), 0)) as pending_amount
        FROM student_fee_assignments sfa
        JOIN student_enrollments se ON se.enrollment_id = sfa.enrollment_id
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN classes c ON c.class_id = se.class_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        LEFT JOIN fee_payments fp ON fp.enrollment_id = sfa.enrollment_id
        WHERE ay.is_active = TRUE
        GROUP BY se.enrollment_id, student_name, sm.reg_no, se.roll_no, 
                 c.class_level, c.division, sm.mobile, sfa.total_amount
        HAVING pending_amount > 0
        ORDER BY pending_amount DESC
    `

    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   12. CLASS-WISE FEE REPORT
========================= */
router.get('/reports/class-wise', (req, res) => {
    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT
            c.class_level,
            c.division,
            COUNT(DISTINCT se.enrollment_id) as total_students,
            SUM(sfa.total_amount) as total_fee,
            SUM(IFNULL(paid.total_paid, 0)) as total_collected,
            (SUM(sfa.total_amount) - SUM(IFNULL(paid.total_paid, 0))) as total_pending
        FROM classes c
        JOIN student_enrollments se ON se.class_id = c.class_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        LEFT JOIN student_fee_assignments sfa ON sfa.enrollment_id = se.enrollment_id
        LEFT JOIN (
            SELECT enrollment_id, SUM(amount_paid) as total_paid
            FROM fee_payments
            GROUP BY enrollment_id
        ) paid ON paid.enrollment_id = se.enrollment_id
        WHERE ay.is_active = TRUE
        GROUP BY c.class_id, c.class_level, c.division
        ORDER BY c.class_level, c.division
    `

    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   13. MONTHLY COLLECTION REPORT
========================= */
router.get('/reports/monthly', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { year } = req.query

    const sql = `
        SELECT
            MONTH(payment_date) as month,
            MONTHNAME(payment_date) as month_name,
            COUNT(*) as transaction_count,
            SUM(amount_paid) as total_collected
        FROM fee_payments
        WHERE YEAR(payment_date) = ?
        GROUP BY MONTH(payment_date), MONTHNAME(payment_date)
        ORDER BY month
    `

    pool.query(sql, [year || new Date().getFullYear()], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   14. DATE RANGE REPORT
========================= */
router.get('/reports/date-range', (req, res) => {
    if (!accountantOnly(req, res)) return

    const { start_date, end_date } = req.query

    const sql = `
        SELECT
            DATE(payment_date) as payment_date,
            COUNT(*) as transactions,
            SUM(amount_paid) as total_collected
        FROM fee_payments
        WHERE payment_date BETWEEN ? AND ?
        GROUP BY DATE(payment_date)
        ORDER BY payment_date
    `

    pool.query(sql, [start_date, end_date], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   15. PAYMENT MODE REPORT
========================= */
router.get('/reports/payment-modes', (req, res) => {
    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT
            payment_mode,
            COUNT(*) as transaction_count,
            SUM(amount_paid) as total_amount
        FROM fee_payments
        WHERE YEAR(payment_date) = YEAR(CURRENT_DATE())
        GROUP BY payment_mode
        ORDER BY total_amount DESC
    `

    pool.query(sql, (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   16. CHANGE PASSWORD
========================= */
const bcrypt = require('bcrypt')

router.put('/change-password', async (req, res) => {
    if (!accountantOnly(req, res)) return

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
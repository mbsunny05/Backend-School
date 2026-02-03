const express = require('express')

const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

function accountantOnly(req, res) {
    if (!req.user || req.user.role !== 'accountant') {
        res.send(result.createResult('Access denied: Accountant only'))
        return false
    }
    return true
}

//1.UPDATE PROFILE 
//(here we user id as it comes from jwt so one accountant cant update other accountant )
//(employee id from body can change details for another accountant)
//sp give token which accountant we want to change

router.put('/profile/update', (req, res) => {

    if (!accountantOnly(req, res)) return

    const {
        fname, mname, lname,
        gender, mobile, address, email
    } = req.body

    const sql = `
        UPDATE employees
        SET
            fname = ?,
            mname = ?,
            lname = ?,
            gender = ?,
            mobile = ?,
            address = ?,
            email = ?
        WHERE user_id = ?
    `

    pool.query(
        sql,
        [
            fname,
            mname,
            lname,
            gender,
            mobile,
            address,
            email,
            req.user.user_id
        ],
        (err, data) => {

            if (err) {
                return res.send(result.createResult(err))
            }

            // 🔥 THIS IS THE KEY CHECK
            if (data.affectedRows === 0) {
                return res.send(
                    result.createResult('Employee profile not found')
                )
            }

            res.send(
                result.createResult(null, 'Profile updated successfully')
            )
        }
    )
})


  //2.update img

  router.put('/profile/update-image', (req, res) => {

    console.log(req.user)
    if (!accountantOnly(req, res)) return   

    const { image } = req.body

    if (!image) {
        return res.send(
            result.createResult('Image path is required')
        )
    }

    const sql = `
        UPDATE employees
        SET image = ?
        WHERE user_id = ?
    `

    pool.query(
        sql,
        [image, req.user.user_id],
        (err, data) => {

            if (err) {
                return res.send(result.createResult(err))
            }

            // IMPORTANT check
            if (data.affectedRows === 0) {
                return res.send(
                    result.createResult('Employee profile not found')
                )
            }

            res.send(
                result.createResult(null, 'Profile image updated successfully')
            )
        }
    )
})

//get rprofile

router.get('/profile', (req, res) => {

    if (!accountantOnly(req, res)) return

    const sql = `
        SELECT 
            e.employee_id,
            e.fname,
            e.mname,
            e.lname,
            e.gender,
            e.mobile,
            e.email,
            e.address,
            e.image,
            DATE_FORMAT(e.joining_date, '%Y-%m-%d') AS joining_date,
            u.username,
            u.status
        FROM employees e
        JOIN users u ON e.user_id = u.user_id
        WHERE e.user_id = ?
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        if (rows.length === 0) {
            return res.send(
                result.createResult('Accountant profile not found')
            )
        }

        res.send(result.createResult(null, rows[0]))
    })
})


// /* =========================
//    FEE CATEGORY
// ========================= */
// router.post('/feecategory', (req, res) => {
//     const { category_name, amount } = req.body

//     const sql = `
//         INSERT INTO fee_category (category_name, amount)
//         VALUES (?, ?)
//     `

//     pool.query(sql, [category_name, amount], (err, data) => {
//         if (err && err.code === 'ER_DUP_ENTRY') {
//             return res.send(result.createResult('Fee category already exists'))
//         }
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/getAllcategory', (req, res) => {
//     pool.query('SELECT * FROM fee_category', (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =========================
//    FEES ASSIGN & PAY
// ========================= */
// router.post('/fees', (req, res) => {
//     const { student_id, category_id, amount, month } = req.body

//     const sql = `
//         INSERT INTO fees (student_id, category_id, amount, month)
//         VALUES (?, ?, ?, ?)
//     `

//     pool.query(sql, [student_id, category_id, amount, month], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.put('/fees/:id/pay', (req, res) => {
//     const { receipt_no, payment_date } = req.body

//     const sql = `
//         UPDATE fees
//         SET status='Paid',
//             receipt_no=?,
//             payment_date=?
//         WHERE fee_id=?
//     `

//     pool.query(sql, [receipt_no, payment_date, req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =========================
//    FEES FETCHING
// ========================= */
// router.get('/fees/student/:id', (req, res) => {
//     const sql = `
//         SELECT f.fee_id, f.month, f.amount, f.status,
//                f.payment_date, fc.category_name
//         FROM fees f
//         JOIN fee_category fc ON f.category_id = fc.category_id
//         WHERE f.student_id = ?
//         ORDER BY f.month
//     `

//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/getAllfees', (req, res) => {
//     const sql = `
//         SELECT f.fee_id, s.reg_no,
//                CONCAT(s.fname,' ',s.lname) AS student_name,
//                fc.category_name, f.month, f.amount, f.status
//         FROM fees f
//         JOIN student s ON f.student_id = s.student_id
//         JOIN fee_category fc ON f.category_id = fc.category_id
//         ORDER BY f.month
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =========================
//    REPORTS
// ========================= */
// router.post('/reports/monthly', (req, res) => {
//     const { month } = req.body

//     const sql = `
//         SELECT month, SUM(amount) AS total_collection
//         FROM fees
//         WHERE status='Paid' AND month=?
//         GROUP BY month
//     `

//     pool.query(sql, [month], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/fees/pending', (req, res) => {
//     const sql = `
//         SELECT s.reg_no,
//                CONCAT(s.fname,' ',s.lname) AS student_name,
//                f.month, f.amount
//         FROM fees f
//         JOIN student s ON f.student_id = s.student_id
//         WHERE f.status='Pending'
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.delete('/feecategory/:id', (req, res) => {
//     const checkSql = `
//         SELECT COUNT(*) AS count
//         FROM fees
//         WHERE category_id=?
//     `

//     pool.query(checkSql, [req.params.id], (err, data) => {
//         if (data[0].count > 0) {
//             return res.send(
//                 result.createResult('Category already used, cannot delete')
//             )
//         }

//         pool.query(
//             'DELETE FROM fee_category WHERE category_id=?',
//             [req.params.id],
//             (err, delData) => {
//                 res.send(result.createResult(err, delData))
//             }
//         )
//     })
// })

// router.put('/feecategory/:id', (req, res) => {
//     const { amount } = req.body

//     const sql = `
//         UPDATE fee_category
//         SET amount=?
//         WHERE category_id=?
//     `

//     pool.query(sql, [amount, req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/fees/month/:month', (req, res) => {
//     const sql = `
//         SELECT s.reg_no,
//                CONCAT(s.fname,' ',s.lname) AS student_name,
//                fc.category_name,
//                f.amount,
//                f.status
//         FROM fees f
//         JOIN student s ON f.student_id=s.student_id
//         JOIN fee_category fc ON f.category_id=fc.category_id
//         WHERE f.month=?
//     `

//     pool.query(sql, [req.params.month], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/fees/summary/student/:id', (req, res) => {
//     const sql = `
//         SELECT 
//             SUM(CASE WHEN status='Paid' THEN amount ELSE 0 END) AS paid_amount,
//             SUM(CASE WHEN status='Pending' THEN amount ELSE 0 END) AS pending_amount
//         FROM fees
//         WHERE student_id=?
//     `

//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/fees/receipt/:id', (req, res) => {
//     const sql = `
//         SELECT 
//             f.receipt_no,
//             f.payment_date,
//             f.amount,
//             fc.category_name,
//             CONCAT(s.fname,' ',s.lname) AS student_name,
//             s.reg_no
//         FROM fees f
//         JOIN student s ON f.student_id=s.student_id
//         JOIN fee_category fc ON f.category_id=fc.category_id
//         WHERE f.fee_id=?
//     `

//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })
// router.get('/fees/receipt/:id', (req, res) => {
//     const sql = `
//         SELECT 
//             f.receipt_no,
//             f.payment_date,
//             f.amount,
//             fc.category_name,
//             CONCAT(s.fname,' ',s.lname) AS student_name,
//             s.reg_no
//         FROM fees f
//         JOIN student s ON f.student_id=s.student_id
//         JOIN fee_category fc ON f.category_id=fc.category_id
//         WHERE f.fee_id=?
//     `

//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/reports/daily/:date', (req, res) => {
//     const sql = `
//         SELECT 
//             receipt_no,
//             amount,
//             payment_date
//         FROM fees
//         WHERE status='Paid'
//           AND DATE(payment_date)=?
//     `

//     pool.query(sql, [req.params.date], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })
// router.get('/dashboard/summary', (req, res) => {
//     const sql = `
//         SELECT 
//             SUM(amount) AS total_collection,
//             COUNT(*) AS total_transactions
//         FROM fees
//         WHERE status='Paid'
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// router.get('/dashboard/pending', (req, res) => {
//     const sql = `
//         SELECT COUNT(*) AS pending_count
//         FROM fees
//         WHERE status='Pending'
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })


module.exports = router

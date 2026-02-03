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

// /* =====================================================
//    1. GET OWN PROFILE
// ===================================================== */
// router.get('/profile', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             s.student_id,
//             s.roll_no,
//             s.reg_no,
//             s.fname,
//             s.lname,
//             s.gender,
//             s.email,
//             s.mobile,
//             s.address,
//             c.class_name,
//             c.section
//         FROM students s
//         JOIN classes c ON s.class_id = c.class_id
//         WHERE s.user_id = ?
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data[0]))
//     })
// })

// /* =====================================================
//    2. GET MY CLASS DETAILS
// ===================================================== */
// router.get('/class', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             c.class_name,
//             c.section,
//             CONCAT(e.fname,' ',e.lname) AS class_teacher
//         FROM students s
//         JOIN classes c ON s.class_id = c.class_id
//         LEFT JOIN employees e ON c.class_teacher_id = e.employee_id
//         WHERE s.user_id = ?
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data[0]))
//     })
// })

// /* =====================================================
//    3. GET MY SUBJECTS
// ===================================================== */
// router.get('/subjects', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             sub.subject_name,
//             CONCAT(e.fname,' ',e.lname) AS teacher_name
//         FROM students s
//         JOIN subjects sub ON s.class_id = sub.class_id
//         JOIN employees e ON sub.teacher_id = e.employee_id
//         WHERE s.user_id = ?
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    4. GET MY ATTENDANCE
// ===================================================== */
// router.get('/attendance', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT attendance_date, status
//         FROM attendance_students
//         WHERE student_id = (
//             SELECT student_id FROM students WHERE user_id=?
//         )
//         ORDER BY attendance_date DESC
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    5. GET MY MARKS
// ===================================================== */
// router.get('/marks', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             sub.subject_name,
//             m.marks_obtained,
//             m.max_marks,
//             m.grade
//         FROM marks m
//         JOIN subjects sub ON m.subject_id = sub.subject_id
//         WHERE m.student_id = (
//             SELECT student_id FROM students WHERE user_id=?
//         )
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    6. GET MY FEES
// ===================================================== */
// router.get('/fees', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             fc.category_name,
//             f.amount,
//             f.fee_month,
//             f.fee_year,
//             f.status,
//             f.payment_date
//         FROM fees f
//         JOIN fee_categories fc ON f.category_id = fc.category_id
//         WHERE f.student_id = (
//             SELECT student_id FROM students WHERE user_id=?
//         )
//         ORDER BY f.fee_year DESC, f.fee_month DESC
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// //update
// router.put('/profile/update', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const { fname, mname, lname, mother_name, dob, gender, email, mobile, address } = req.body

//     const sql = `
//         UPDATE students
//         SET 
//             fname=?, 
//             mname=?, 
//             lname=?, 
//             mother_name=?, 
//             dob=?, 
//             gender=?,  
//             email=?, 
//             mobile=?, 
//             address=?
//         WHERE user_id=?
//     `

//     pool.query(
//         sql,
//         [fname, mname, lname, mother_name, dob, gender, email, mobile, address, req.user.user_id],
//         (err, data) => {
//             if (err) {
//                 return res.send(result.createResult(err))
//             }

//             if (data.affectedRows === 0) {
//                 return res.send(
//                     result.createResult('Profile not found or no changes made')
//                 )
//             }

//             res.send(
//                 result.createResult(null, 'Profile updated successfully')
//             )
//         }
//     )
// })


// //GET RANK
// router.get('/academics/class-rank', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             student_id,
//             AVG(marks_obtained) AS avg_marks
//         FROM marks
//         WHERE student_id IN (
//             SELECT student_id FROM students 
//             WHERE class_id = (
//                 SELECT class_id FROM students WHERE user_id=?
//             )
//         )
//         GROUP BY student_id
//         ORDER BY avg_marks DESC
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// //DASHBOARD
// router.get('/dashboard/summary', (req, res) => {
//     if (!studentOnly(req, res)) return

//     const sql = `
//         SELECT 
//             (SELECT COUNT(*) FROM attendance_students 
//              WHERE status='Present' AND student_id=s.student_id) AS present_days,
//             (SELECT COUNT(*) FROM marks WHERE student_id=s.student_id) AS exams_given,
//             (SELECT COUNT(*) FROM fees WHERE status='Pending' AND student_id=s.student_id) AS pending_fees
//         FROM students s
//         WHERE s.user_id=?
//     `
//     pool.query(sql, [req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data[0]))
//     })
// })


// module.exports = router

// STUDENT VIEW PROFILE
router.get('/profile', (req, res) => {
    if (!studentOnly(req, res)) return

    const sql = `
        SELECT
            s.student_id,
            s.reg_no,
            s.roll_no,

            s.fname,
            s.mname,
            s.lname,
            s.mother_name,
            s.gender,
            s.dob,
            s.image,

            s.email,
            s.mobile,
            s.address,

            s.admission_date,

            c.class_name,
            c.section
        FROM students s
        JOIN classes c ON c.class_id = s.class_id
        WHERE s.user_id = ?
    `

    pool.query(sql, [req.user.user_id], (err, data) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        if (!data || data.length === 0) {
            return res.send({
                status: 'error',
                message: 'Student record not found'
            })
        }

        res.send(result.createResult(null, data[0]))
    })
})


// STUDENT DASHBOARD
router.get('/dashboard', (req, res) => {
    if (!studentOnly(req, res)) return
    console.log("inside /dashobard")
      console.log(req.user.user_id)

    const sql = `
        SELECT
            s.student_id,
            s.roll_no,

            c.class_name,
            c.section,

            CONCAT(e.fname, ' ', IFNULL(e.lname,'')) AS class_teacher,

            -- Attendance summary
            (SELECT COUNT(*)
             FROM attendance_students a
             WHERE a.student_id = s.student_id) AS total_days,

            (SELECT COUNT(*)
             FROM attendance_students a
             WHERE a.student_id = s.student_id
             AND a.status = 'Present') AS present_days,

            -- Subjects list
            (
                SELECT JSON_ARRAYAGG(subject_name)
                FROM subjects
                WHERE class_id = s.class_id
            ) AS subjects

        FROM students s
        JOIN classes c ON c.class_id = s.class_id
        LEFT JOIN employees e ON e.employee_id = c.class_teacher_id
        WHERE s.user_id = ?
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        if (err) {
            return res.send(result.createResult(err))
        }

        if (!data || data.length === 0) {
          
            return res.send({
                status: 'error',
                message: 'Student record not found'
            })
        }

        res.send(result.createResult(null, data[0]))
    })
})



// STUDENT VIEW MARKS
router.get('/marks', (req, res) => {
    if (!studentOnly(req, res)) return
      console.log(req.user.user_id)

    const sql = `
        SELECT
            sub.subject_name,
            m.exam_name,
            m.marks_obtained,
            m.max_marks,
            m.grade
        FROM marks m
        JOIN subjects sub ON sub.subject_id = m.subject_id
        JOIN students s ON s.student_id = m.student_id
        WHERE s.user_id = ?
        ORDER BY sub.subject_name, m.created_at
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
          console.log("inside query of marks ")
        res.send(result.createResult(err, data))
    })
})

// STUDENT UPDATE PROFILE
router.put('/profile/update', (req, res) => {
    if (!studentOnly(req, res)) return

    const {
        fname,
        mname,
        lname,
        gender,
        mother_name,
        email,
        mobile,
        address,
        dob
    } = req.body

    const sql = `
        UPDATE students
        SET
            fname = ?,
            mname = ?,
            lname = ?,
            gender = ?,
            mother_name = ?,
            email = ?,
            mobile = ?,
            address = ?,
            dob = ?
        WHERE user_id = ?
    `

    pool.query(
        sql,
        [
            fname,
            mname,
            lname,
            gender,
            mother_name,
            email,
            mobile,
            address,
            dob,
            req.user.user_id
        ],
        (err, resultData) => {

            if (err) {
                // Handle duplicate email / mobile clearly
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.send({
                        status: 'error',
                        message: 'Email or mobile already in use'
                    })
                }
                return res.send(result.createResult(err))
            }

            if (resultData.affectedRows === 0) {
                return res.send({
                    status: 'error',
                    message: 'Student record not found'
                })
            }

            res.send({
                status: 'success',
                message: 'Profile updated successfully'
            })
        }
    )
})


// STUDENT ATTENDANCE DETAILED VIEW
router.get('/attendance', (req, res) => {
    if (!studentOnly(req, res)) return

    const month = req.query.month || new Date().getMonth() + 1
    const year = req.query.year || new Date().getFullYear()

    const sql = `
        SELECT
            a.attendance_date,
            a.status
        FROM attendance_students a
        JOIN students s ON s.student_id = a.student_id
        WHERE s.user_id = ?
        AND MONTH(a.attendance_date) = ?
        AND YEAR(a.attendance_date) = ?
        ORDER BY a.attendance_date
    `

    pool.query(sql, [req.user.user_id, month, year], (err, data) => {
        if (err) {
            return res.send(result.createResult(err))
        }

        // Calculate summary
        const total_days = data.length
        const present_days = data.filter(d => d.status === 'Present').length
        const absent_days = total_days - present_days

        res.send({
            status: 'success',
            data: {
                month,
                year,
                summary: {
                    total_days,
                    present_days,
                    absent_days
                },
                records: data
            }
        })
    })
})


module.exports = router

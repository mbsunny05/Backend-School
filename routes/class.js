// const express = require('express')
// const pool = require('../utils/db')
// const result = require('../utils/result')

// const router = express.Router()


// /* =====================================================
//    8. GET CLASSES WITH CLASS TEACHER NAME
// ===================================================== */
// // router.get('/details/teacher', (req, res) => {
// //     const sql = `
// //         SELECT 
// //             c.class_id,
// //             c.class_name,
// //             c.section,
// //             CONCAT(e.fname,' ',e.lname) AS class_teacher
// //         FROM classes c
// //         LEFT JOIN employees e ON c.class_teacher_id = e.employee_id
// //     `
// //     pool.query(sql, (err, data) => {
// //         res.send(result.createResult(err, data))
// //     })
// // })

// /* =====================================================
//    9. GET CLASSES BY TEACHER (EMPLOYEE)
// ===================================================== */
// // router.get('/teacher/:employee_id', (req, res) => {
// //     pool.query(
// //         'SELECT * FROM classes WHERE class_teacher_id=?',
// //         [req.params.employee_id],
// //         (err, data) => {
// //             res.send(result.createResult(err, data))
// //         }
// //     )
// // })

// /* =====================================================
//    10. GET STUDENT COUNT PER CLASS
// ===================================================== */
// router.get('/stats/student-count', (req, res) => {
//     const sql = `
//         SELECT 
//             c.class_id,
//             c.class_name,
//             c.section,
//             COUNT(s.student_id) AS total_students
//         FROM classes c
//         LEFT JOIN students s ON c.class_id = s.class_id
//         GROUP BY c.class_id
//     `
//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    11. GET CLASSES WITHOUT TEACHER
// ===================================================== */
// router.get('/unassigned/teacher', (req, res) => {
//     pool.query(
//         'SELECT * FROM classes WHERE class_teacher_id IS NULL',
//         (err, data) => {
//             res.send(result.createResult(err, data))
//         }
//     )
// })

// /* =====================================================
//    12. CHECK CLASS EXISTS (NAME + SECTION)
// ===================================================== */
// router.get('/exists/:class_name/:section', (req, res) => {
//     const sql = `
//         SELECT COUNT(*) AS count
//         FROM classes
//         WHERE class_name=? AND section=?
//     `
//     pool.query(
//         sql,
//         [req.params.class_name, req.params.section],
//         (err, data) => {
//             res.send(result.createResult(err, data))
//         }
//     )
// })

// /* =====================================================
//    13. SEARCH CLASSES
// ===================================================== */
// router.get('/search/:keyword', (req, res) => {
//     const key = `%${req.params.keyword}%`

//     pool.query(
//         'SELECT * FROM classes WHERE class_name LIKE ?',
//         [key],
//         (err, data) => {
//             res.send(result.createResult(err, data))
//         }
//     )
// })

// /* =====================================================
//    14. CLASS DROPDOWN API
// ===================================================== */
// router.get('/dropdown/list', (req, res) => {
//     const sql = `
//         SELECT 
//             class_id,
//             CONCAT(class_name,'-',section) AS label
//         FROM classes
//         ORDER BY class_name, section
//     `
//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    15. TOTAL CLASSES COUNT
// ===================================================== */
// router.get('/stats/count', (req, res) => {
//     pool.query(
//         'SELECT COUNT(*) AS total_classes FROM classes',
//         (err, data) => {
//             res.send(result.createResult(err, data))
//         }
//     )
// })

// /* =====================================================
//    16. GET FULL CLASS PROFILE
// ===================================================== */
// router.get('/profile/:id', (req, res) => {
//     const sql = `
//         SELECT 
//             c.class_name,
//             c.section,
//             CONCAT(e.fname,' ',e.lname) AS class_teacher,
//             COUNT(s.student_id) AS total_students
//         FROM classes c
//         LEFT JOIN employees e ON c.class_teacher_id=e.employee_id
//         LEFT JOIN students s ON c.class_id=s.class_id
//         WHERE c.class_id=?
//         GROUP BY c.class_id
//     `
//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// module.exports = router

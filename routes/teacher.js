const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

/* =========================
   TEACHER ONLY GUARD
========================= */
function teacherOnly(req, res) {
    if (req.user.role !== 'teacher') {
        res.send(result.createResult('Access denied: Teacher only'))
        return false
    }
    return true
}

//1.Update Teacher

router.put('/profile/update', (req, res) => {

    if (!teacherOnly(req, res)) return

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
            req.user.user_id  // -- 🔐 identity from token
        ],
        (err, data) => {

            if (err) {
                return res.send(result.createResult(err))
            }

            if (data.affectedRows === 0) {
                return res.send(
                    result.createResult('Teacher profile not found')
                )
            }

            res.send(
                result.createResult(null, 'Teacher profile updated successfully')
            )
        }
    )
})

//update image

router.put('/profile/update-image', (req, res) => {

    if (!teacherOnly(req, res)) return

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

            if (data.affectedRows === 0) {
                return res.send(
                    result.createResult('Teacher profile not found')
                )
            }

            res.send(
                result.createResult(null, 'Teacher profile image updated successfully')
            )
        }
    )
})

//get teacher profile

router.get('/profile', (req, res) => {

    if (!teacherOnly(req, res)) return

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
            e.joining_date,
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
                result.createResult('Teacher profile not found')
            )
        }

        res.send(result.createResult(null, rows[0]))
    })
})

//3.get profile

router.get('/profile', (req, res) => {

    if (!teacherOnly(req, res)) return

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
                result.createResult('Teacher profile not found')
            )
        }

        res.send(result.createResult(null, rows[0]))
    })
})

//4.get class

router.get('/class', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT 
            c.class_id,
            c.class_name,
            c.section
        FROM classes c
        JOIN employees e ON c.class_teacher_id = e.employee_id
        WHERE e.user_id = ?
        ORDER BY c.class_name, c.section
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        if (rows.length === 0) {
            return res.send(
                result.createResult('No class assigned to you')
            )
        }

        // 🔑 RETURN ALL ROWS
        res.send(result.createResult(null, rows))
    })
})

//5.get Subject with Class

router.get('/subjects', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT 
            s.subject_id,
            s.subject_name,
            c.class_id,
            c.class_name,
            c.section
        FROM subjects s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON s.teacher_id = e.employee_id
        WHERE e.user_id = ?
        ORDER BY c.class_name, c.section, s.subject_name
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        if (rows.length === 0) {
            return res.send(
                result.createResult('No subjects assigned to you')
            )
        }

        res.send(result.createResult(null, rows))
    })
})

//6.get students of my class

router.get('/class/students', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT 
            s.student_id,
            s.roll_no,
            s.reg_no,
            s.fname,
            s.mname,
            s.lname,
            s.gender,
            s.mobile,
            s.email
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON c.class_teacher_id = e.employee_id
        WHERE e.user_id = ?
        ORDER BY s.roll_no
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        if (rows.length === 0) {
            return res.send(
                result.createResult('No students found for your class')
            )
        }

        res.send(result.createResult(null, rows))
    })
})

//7.mark attendence

router.post('/attendance/mark', (req, res) => {

    if (!teacherOnly(req, res)) return

    const { attendance_date, students } = req.body

    if (!attendance_date || !Array.isArray(students) || students.length === 0) {
        return res.send(result.createResult('Invalid input'))
    }

    // 1️⃣ Get students of this teacher's class
    const validStudentsSql = `
        SELECT s.student_id
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON c.class_teacher_id = e.employee_id
        WHERE e.user_id = ?
    `

    pool.query(validStudentsSql, [req.user.user_id], (err, rows) => {

        if (err) {
            return res.send(result.createResult(err))
        }

        const allowedStudentIds = rows.map(r => r.student_id)

        // 2️⃣ Filter only valid students
        const filtered = students.filter(s =>
            allowedStudentIds.includes(s.student_id)
        )

        if (filtered.length === 0) {
            return res.send(
                result.createResult('No valid students for your class')
            )
        }

        // 3️⃣ Insert attendance ONLY for valid students
        const sql = `
            INSERT INTO attendance_students (student_id, attendance_date, status)
            VALUES ?
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        `

        const values = filtered.map(s => [
            s.student_id,
            attendance_date,
            s.status
        ])

        pool.query(sql, [values], (err) => {

            if (err) {
                return res.send(result.createResult(err))
            }

            res.send(
                result.createResult(
                    null,
                    `Attendance marked for ${values.length} students`
                )
            )
        })
    })
})


//8.view attendence

router.get('/attendance', (req, res) => {

    if (!teacherOnly(req, res)) return

    const { date } = req.query

    if (!date) {
        return res.send(result.createResult('Date is required'))
    }

    const sql = `
        SELECT 
            s.student_id,
            s.roll_no,
            s.fname,
            s.lname,
            DATE_FORMAT(?, '%Y-%m-%d') AS attendance_date,
            IFNULL(a.status, 'Absent') AS status
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON c.class_teacher_id = e.employee_id
        LEFT JOIN attendance_students a
            ON s.student_id = a.student_id
           AND a.attendance_date = DATE(?)
        WHERE e.user_id = ?
        ORDER BY s.roll_no
    `

    pool.query(
        sql,
        [date, date, req.user.user_id],
        (err, rows) => {

            if (err) {
                return res.send(result.createResult(err))
            }

            res.send(result.createResult(null, rows))
        }
    )
})

//9.Student-wise Attendance Summary (does want year wise or month wise ?)

router.get('/attendance/summary/student/:id', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT
            s.student_id,
            s.fname,
            COUNT(a.attendance_id) AS total_days,
            SUM(a.status = 'Present') AS present_days,
            SUM(a.status = 'Absent') AS absent_days,
            ROUND((SUM(a.status = 'Present') / COUNT(a.attendance_id)) * 100, 2)
                AS attendance_percentage
        FROM attendance_students a
        JOIN students s ON a.student_id = s.student_id
        WHERE s.student_id = ?
        GROUP BY s.student_id
    `

    pool.query(sql, [req.params.id], (err, rows) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, rows[0]))
    })
})

//10.Attendence summary (class)

router.get('/attendance/summary/class', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT
            COUNT(DISTINCT s.student_id) AS total_students,
            COUNT(a.attendance_id) AS total_entries,
            SUM(a.status = 'Present') AS total_present,
            SUM(a.status = 'Absent') AS total_absent
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON c.class_teacher_id = e.employee_id
        LEFT JOIN attendance_students a ON s.student_id = a.student_id
        WHERE e.user_id = ?
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, rows[0]))
    })
})

//------------------------------------------------------------------
//marks
//------------------------------------------------------------------

//Add Marks(only subject teacher can add marks)

//(helper function)

function calculateGrade(obtained, max) {
    const percent = (obtained / max) * 100

    if (percent >= 90) return 'A+'
    if (percent >= 80) return 'A'
    if (percent >= 70) return 'B'
    if (percent >= 60) return 'C'
    if (percent >= 40) return 'D'
    return 'F'
}

router.post('/marks/add', (req, res) => {

    if (!teacherOnly(req, res)) return

    const { subject_id, exam_name, max_marks, marks } = req.body

    if (!subject_id || !exam_name || !max_marks || !Array.isArray(marks)) {
        return res.send(result.createResult('Invalid input'))
    }

    // 1️⃣ Validate subject belongs to teacher
    const subjectSql = `
        SELECT subject_id, class_id
        FROM subjects
        WHERE subject_id = ?
          AND teacher_id = (
              SELECT employee_id
              FROM employees
              WHERE user_id = ?
          )
    `

    pool.query(subjectSql, [subject_id, req.user.user_id], (err, subRows) => {

        if (err) return res.send(result.createResult(err))

        if (subRows.length === 0) {
            return res.send(
                result.createResult('You are not allowed to add marks for this subject')
            )
        }

        // 2️⃣ Get valid students for this subject's class
        const validStudentsSql = `
            SELECT student_id
            FROM students
            WHERE class_id = ?
        `

        pool.query(
            validStudentsSql,
            [subRows[0].class_id],
            (err, studentRows) => {

                if (err) return res.send(result.createResult(err))

                const allowedStudentIds = studentRows.map(s => s.student_id)

                const filteredMarks = marks.filter(m =>
                    allowedStudentIds.includes(m.student_id)
                )

                if (filteredMarks.length === 0) {
                    return res.send(
                        result.createResult('No valid students for this subject')
                    )
                }

                // 3️⃣ Insert / Update marks
                const values = filteredMarks.map(m => {
                    const percent = (m.marks_obtained / max_marks) * 100
                    const grade =
                        percent >= 90 ? 'A+' :
                        percent >= 80 ? 'A' :
                        percent >= 70 ? 'B' :
                        percent >= 60 ? 'C' :
                        percent >= 40 ? 'D' : 'F'

                    return [
                        m.student_id,
                        subject_id,
                        exam_name,
                        m.marks_obtained,
                        max_marks,
                        grade
                    ]
                })

                const insertSql = `
                    INSERT INTO marks
                      (student_id, subject_id, exam_name, marks_obtained, max_marks, grade)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                      marks_obtained = VALUES(marks_obtained),
                      max_marks = VALUES(max_marks),
                      grade = VALUES(grade)
                `

                pool.query(insertSql, [values], (err) => {
                    if (err) return res.send(result.createResult(err))

                    res.send(
                        result.createResult(null, 'Marks added/updated successfully')
                    )
                })
            }
        )
    })
})


//view marks (class teacher only can be admin)

router.get('/class/marks', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT
            s.student_id,
            s.roll_no,
            s.fname,
            s.lname,
            sub.subject_name,
            m.exam_name,
            m.marks_obtained,
            m.max_marks,
            m.grade
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN employees e ON c.class_teacher_id = e.employee_id
        JOIN subjects sub ON sub.class_id = c.class_id
        LEFT JOIN marks m
               ON m.student_id = s.student_id
              AND m.subject_id = sub.subject_id
        WHERE e.user_id = ?
        ORDER BY s.roll_no, sub.subject_name, m.exam_name
    `

    pool.query(sql, [req.user.user_id], (err, rows) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, rows))
    })
})

//view marks (only for subject teacher)

router.get('/marks/view/:subject_id', (req, res) => {

    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT
            s.roll_no,
            s.fname,
            m.exam_name,
            m.marks_obtained,
            m.max_marks,
            m.grade
        FROM marks m
        JOIN students s ON m.student_id = s.student_id
        JOIN subjects sub ON m.subject_id = sub.subject_id
        JOIN employees e ON sub.teacher_id = e.employee_id
        WHERE m.subject_id = ?
          AND e.user_id = ?
        ORDER BY s.roll_no
    `

    pool.query(sql, [req.params.subject_id, req.user.user_id], (err, rows) => {
        if (err) return res.send(result.createResult(err))
        res.send(result.createResult(null, rows))
    })
})

//class performance (class_teacher)

router.get('/class/performance', (req, res) => {

    if (!teacherOnly(req, res)) return

    // 1️⃣ Ensure this teacher is a class teacher
    const classCheckSql = `
        SELECT class_id
        FROM classes c
        JOIN employees e ON c.class_teacher_id = e.employee_id
        WHERE e.user_id = ?
    `

    pool.query(classCheckSql, [req.user.user_id], (err, classRows) => {

        if (err) return res.send(result.createResult(err))

        if (classRows.length === 0) {
            return res.send(
                result.createResult('You are not assigned as a class teacher')
            )
        }

        // 2️⃣ Get class performance
        const sql = `
            SELECT
                s.student_id,
                s.roll_no,
                CONCAT(s.fname, ' ', s.lname) AS student_name,
                COUNT(m.mark_id) AS total_subjects,
                IFNULL(SUM(m.marks_obtained), 0) AS total_marks_obtained,
                IFNULL(SUM(m.max_marks), 0) AS total_max_marks,
                IFNULL(
                    ROUND(
                        (SUM(m.marks_obtained) / SUM(m.max_marks)) * 100,
                        2
                    ),
                    0
                ) AS percentage
            FROM students s
            JOIN classes c ON s.class_id = c.class_id
            JOIN employees e ON c.class_teacher_id = e.employee_id
            LEFT JOIN marks m ON s.student_id = m.student_id
            WHERE e.user_id = ?
            GROUP BY s.student_id
            ORDER BY s.roll_no
        `

        pool.query(sql, [req.user.user_id], (err, rows) => {

            if (err) return res.send(result.createResult(err))

            res.send(result.createResult(null, rows))
        })
    })
})

//top 3 student class only

router.get('/class/top-students', (req, res) => {

    if (!teacherOnly(req, res)) return

    // 1️⃣ Ensure teacher is class teacher
    const classCheckSql = `
        SELECT class_id
        FROM classes c
        JOIN employees e ON c.class_teacher_id = e.employee_id
        WHERE e.user_id = ?
    `

    pool.query(classCheckSql, [req.user.user_id], (err, rows) => {

        if (err) return res.send(result.createResult(err))

        if (rows.length === 0) {
            return res.send(
                result.createResult('You are not assigned as class teacher')
            )
        }

        // 2️⃣ Get top 3 students
        const sql = `
            SELECT
                s.student_id,
                s.roll_no,
                CONCAT(s.fname, ' ', s.lname) AS student_name,
                SUM(m.marks_obtained) AS total_marks_obtained,
                SUM(m.max_marks) AS total_max_marks,
                ROUND(
                    (SUM(m.marks_obtained) / SUM(m.max_marks)) * 100,
                    2
                ) AS percentage
            FROM students s
            JOIN classes c ON s.class_id = c.class_id
            JOIN employees e ON c.class_teacher_id = e.employee_id
            JOIN marks m ON s.student_id = m.student_id
            WHERE e.user_id = ?
            GROUP BY s.student_id
            ORDER BY percentage DESC
            LIMIT 3
        `

        pool.query(sql, [req.user.user_id], (err, data) => {
            if (err) return res.send(result.createResult(err))
            res.send(result.createResult(null, data))
        })
    })
})


// /* =====================================================
//    12. TOP STUDENTS (CLASS)
// ===================================================== */
// router.get('/analytics/top/:class_id', (req, res) => {
//     if (!teacherOnly(req, res)) return

//     const sql = `
//         SELECT 
//             s.student_id,
//             CONCAT(s.fname,' ',s.lname) AS student_name,
//             AVG(m.marks_obtained) AS avg_marks
//         FROM marks m
//         JOIN students s ON m.student_id=s.student_id
//         WHERE s.class_id=?
//         GROUP BY s.student_id
//         ORDER BY avg_marks DESC
//         LIMIT 5
//     `
//     pool.query(sql, [req.params.class_id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    13. SUBJECT PERFORMANCE
// ===================================================== */
// router.get('/analytics/subject/:subject_id', (req, res) => {
//     if (!teacherOnly(req, res)) return

//     pool.query(
//         'SELECT AVG(marks_obtained) AS avg_marks FROM marks WHERE subject_id=?',
//         [req.params.subject_id],
//         (err, data) => res.send(result.createResult(err, data[0]))
//     )
// })

// /* =====================================================
//    14. STUDENT ATTENDANCE DETAIL
// ===================================================== */
// router.get('/attendance/student/:student_id', (req, res) => {
//     if (!teacherOnly(req, res)) return

//     pool.query(
//         'SELECT attendance_date, status FROM attendance_students WHERE student_id=?',
//         [req.params.student_id],
//         (err, data) => res.send(result.createResult(err, data))
//     )
// })

// /* =====================================================
//    15. DASHBOARD SUMMARY
// ===================================================== */
// router.get('/dashboard/summary', (req, res) => {
//     if (!teacherOnly(req, res)) return

//     const sql = `
//         SELECT
//             (SELECT COUNT(*) FROM subjects WHERE teacher_id =
//                 (SELECT employee_id FROM employees WHERE user_id=?)
//             ) AS total_subjects,
//             (SELECT COUNT(*) FROM classes WHERE class_teacher_id =
//                 (SELECT employee_id FROM employees WHERE user_id=?)
//             ) AS total_classes
//     `
//     pool.query(sql, [req.user.user_id, req.user.user_id], (err, data) => {
//         res.send(result.createResult(err, data[0]))
//     })
// })
  
  
module.exports = router

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

/* =========================
   1. TEACHER PROFILE
========================= */
router.get('/profile', (req, res) => {
    if (!teacherOnly(req, res)) return

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
        if (!data.length) return res.send(result.createResult('Teacher not found'))
        res.send(result.createResult(null, data[0]))
    })
})

/* =========================
   2. UPDATE TEACHER PROFILE
========================= */
router.put('/profile/update', (req, res) => {
    if (!teacherOnly(req, res)) return

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
   3. MY CLASSES (ACTIVE YEAR)
========================= */
router.get('/classes', (req, res) => {
    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT DISTINCT
            c.class_id,
            c.class_level,
            c.division,
            ay.year_name,
            COUNT(DISTINCT se.enrollment_id) as student_count
        FROM classes c
        JOIN subjects s ON s.class_id = c.class_id
        JOIN employees e ON e.employee_id = s.teacher_id
        JOIN academic_years ay ON ay.academic_year_id = c.academic_year_id
        LEFT JOIN student_enrollments se ON se.class_id = c.class_id
        WHERE e.user_id = ?
          AND ay.is_active = TRUE
        GROUP BY c.class_id, c.class_level, c.division, ay.year_name
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   4. MY SUBJECTS (ACTIVE YEAR)
========================= */
router.get('/subjects', (req, res) => {
    if (!teacherOnly(req, res)) return

    const sql = `
        SELECT
            s.subject_id,
            s.subject_name,
            c.class_id,
            c.class_level,
            c.division,
            ay.year_name
        FROM subjects s
        JOIN classes c ON c.class_id = s.class_id
        JOIN employees e ON e.employee_id = s.teacher_id
        JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
        WHERE e.user_id = ?
          AND ay.is_active = TRUE
        ORDER BY c.class_level, c.division, s.subject_name
    `

    pool.query(sql, [req.user.user_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   5. CLASS STUDENTS (BY CLASS_ID)
========================= */
router.get('/class/students', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { class_id } = req.query

    const sql = `
        SELECT
            se.enrollment_id,
            se.roll_no,
            sm.student_master_id,
            sm.fname,
            sm.lname,
            sm.gender,
            sm.reg_no
        FROM student_enrollments se
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        WHERE se.class_id = ?
          AND ay.is_active = TRUE
        ORDER BY se.roll_no
    `

    pool.query(sql, [class_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   6. MARK ATTENDANCE (BULK)
========================= */
router.post('/attendance/mark', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { attendance_date, students } = req.body
    // students = [{ enrollment_id, status }, ...]

    if (!attendance_date || !students || !students.length) {
        return res.send(result.createResult('Invalid data'))
    }

    // Delete existing attendance for this date (if re-marking)
    const enrollmentIds = students.map(s => s.enrollment_id)
    
    pool.query(
        'DELETE FROM attendance_students WHERE attendance_date=? AND enrollment_id IN (?)',
        [attendance_date, enrollmentIds],
        (err) => {
            if (err) return res.send(result.createResult(err))

            // Insert new attendance records
            const values = students.map(s => [s.enrollment_id, attendance_date, s.status])
            
            pool.query(
                'INSERT INTO attendance_students (enrollment_id, attendance_date, status) VALUES ?',
                [values],
                (err) => {
                    res.send(result.createResult(err, 'Attendance marked successfully'))
                }
            )
        }
    )
})

/* =========================
   7. GET ATTENDANCE FOR DATE
========================= */
router.get('/attendance', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { class_id, date } = req.query

    const sql = `
        SELECT
            a.attendance_id,
            a.enrollment_id,
            a.status,
            sm.fname,
            sm.lname,
            se.roll_no
        FROM attendance_students a
        JOIN student_enrollments se ON se.enrollment_id = a.enrollment_id
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        WHERE se.class_id = ?
          AND a.attendance_date = ?
        ORDER BY se.roll_no
    `

    pool.query(sql, [class_id, date], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   8. ADD MARKS (BULK)
========================= */
router.post('/marks/add', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { subject_id, exam_name, max_marks, marks } = req.body
    // marks = [{ enrollment_id, marks_obtained }, ...]

    if (!subject_id || !exam_name || !max_marks || !marks || !marks.length) {
        return res.send(result.createResult('Invalid data'))
    }

    // Get or create exam
    pool.query(
        `SELECT exam_id FROM exams WHERE exam_name=? AND academic_year_id=(
            SELECT academic_year_id FROM subjects WHERE subject_id=?
        )`,
        [exam_name, subject_id],
        (err, examRows) => {
            if (err) return res.send(result.createResult(err))

            let examId

            if (examRows.length > 0) {
                examId = examRows[0].exam_id
                insertMarks(examId)
            } else {
                // Create new exam
                pool.query(
                    `INSERT INTO exams (exam_name, academic_year_id) 
                     SELECT ?, academic_year_id FROM subjects WHERE subject_id=?`,
                    [exam_name, subject_id],
                    (err, result) => {
                        if (err) return res.send(result.createResult(err))
                        examId = result.insertId
                        insertMarks(examId)
                    }
                )
            }

            function insertMarks(examId) {
                // Calculate grades
                const calculateGrade = (obtained, max) => {
                    const percentage = (obtained / max) * 100
                    if (percentage >= 90) return 'A+'
                    if (percentage >= 80) return 'A'
                    if (percentage >= 70) return 'B'
                    if (percentage >= 60) return 'C'
                    if (percentage >= 40) return 'D'
                    return 'F'
                }

                const values = marks.map(m => [
                    m.enrollment_id,
                    subject_id,
                    examId,
                    m.marks_obtained,
                    max_marks,
                    calculateGrade(m.marks_obtained, max_marks)
                ])

                // Delete existing marks (if re-entry)
                const enrollmentIds = marks.map(m => m.enrollment_id)
                
                pool.query(
                    'DELETE FROM marks WHERE enrollment_id IN (?) AND subject_id=? AND exam_id=?',
                    [enrollmentIds, subject_id, examId],
                    (err) => {
                        if (err) return res.send(result.createResult(err))

                        // Insert new marks
                        pool.query(
                            'INSERT INTO marks (enrollment_id, subject_id, exam_id, marks_obtained, max_marks, grade) VALUES ?',
                            [values],
                            (err) => {
                                res.send(result.createResult(err, 'Marks added successfully'))
                            }
                        )
                    }
                )
            }
        }
    )
})

/* =========================
   9. CLASS PERFORMANCE
========================= */
router.get('/class/performance', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { class_id } = req.query

    const sql = `
        SELECT
            se.enrollment_id,
            CONCAT(sm.fname, ' ', IFNULL(sm.lname, '')) as student_name,
            se.roll_no,
            sm.reg_no,
            COUNT(DISTINCT m.subject_id) as total_subjects,
            SUM(m.marks_obtained) as total_marks_obtained,
            SUM(m.max_marks) as total_max_marks,
            ROUND((SUM(m.marks_obtained) / SUM(m.max_marks)) * 100, 2) as percentage
        FROM student_enrollments se
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        LEFT JOIN marks m ON m.enrollment_id = se.enrollment_id
        WHERE se.class_id = ?
          AND ay.is_active = TRUE
        GROUP BY se.enrollment_id, sm.fname, sm.lname, se.roll_no, sm.reg_no
        HAVING total_subjects > 0
        ORDER BY percentage DESC
    `

    pool.query(sql, [class_id], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   10. TOP STUDENTS
========================= */
router.get('/class/top-students', (req, res) => {
    if (!teacherOnly(req, res)) return

    const { class_id, limit = 10 } = req.query

    const sql = `
        SELECT
            se.enrollment_id,
            CONCAT(sm.fname, ' ', IFNULL(sm.lname, '')) as student_name,
            se.roll_no,
            SUM(m.marks_obtained) as total_marks_obtained,
            SUM(m.max_marks) as total_max_marks,
            ROUND((SUM(m.marks_obtained) / SUM(m.max_marks)) * 100, 2) as percentage
        FROM student_enrollments se
        JOIN student_master sm ON sm.student_master_id = se.student_master_id
        JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
        LEFT JOIN marks m ON m.enrollment_id = se.enrollment_id
        WHERE se.class_id = ?
          AND ay.is_active = TRUE
        GROUP BY se.enrollment_id, sm.fname, sm.lname, se.roll_no
        HAVING total_marks_obtained IS NOT NULL
        ORDER BY percentage DESC
        LIMIT ?
    `

    pool.query(sql, [class_id, parseInt(limit)], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

/* =========================
   11. TEACHER DASHBOARD
========================= */
router.get('/dashboard', (req, res) => {
    if (!teacherOnly(req, res)) return

    const queries = [
        // Total classes
        `SELECT COUNT(DISTINCT c.class_id) as total_classes
         FROM classes c
         JOIN subjects s ON s.class_id = c.class_id
         JOIN employees e ON e.employee_id = s.teacher_id
         JOIN academic_years ay ON ay.academic_year_id = c.academic_year_id
         WHERE e.user_id = ? AND ay.is_active = TRUE`,
        
        // Total subjects
        `SELECT COUNT(*) as total_subjects
         FROM subjects s
         JOIN employees e ON e.employee_id = s.teacher_id
         JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
         WHERE e.user_id = ? AND ay.is_active = TRUE`,
        
        // Total students
        `SELECT COUNT(DISTINCT se.enrollment_id) as total_students
         FROM student_enrollments se
         JOIN classes c ON c.class_id = se.class_id
         JOIN subjects s ON s.class_id = c.class_id
         JOIN employees e ON e.employee_id = s.teacher_id
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         WHERE e.user_id = ? AND ay.is_active = TRUE`
    ]

    Promise.all(queries.map(q => new Promise((resolve, reject) => {
        pool.query(q, [req.user.user_id], (err, data) => {
            if (err) reject(err)
            else resolve(data[0])
        })
    })))
    .then(results => {
        res.send(result.createResult(null, {
            total_classes: results[0].total_classes,
            total_subjects: results[1].total_subjects,
            total_students: results[2].total_students
        }))
    })
    .catch(err => res.send(result.createResult(err)))
})

/* =========================
   12. CHANGE PASSWORD
========================= */
const bcrypt = require('bcrypt')

router.put('/change-password', async (req, res) => {
    if (!teacherOnly(req, res)) return

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
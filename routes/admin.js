const express = require('express')
const pool = require('../utils/db')
const result = require('../utils/result')

const router = express.Router()

/* =========================
   ADMIN ONLY GUARD
========================= */
function adminOnly(req, res) {
  if (!req.user) {
    res.status(401).send(result.createResult('Unauthorized'))
    return false
  }

  if (req.user.role !== 'admin') {
    res.status(403).send(result.createResult('Admin only'))
    return false
  }

  return true
}


/* =====================================================
   ACADEMIC YEAR (SESSION)
===================================================== */

// create academic year
router.post('/academic-year', (req, res) => {
  if (!adminOnly(req, res)) return

  const { year_name, start_date, end_date } = req.body

  pool.query(
    `INSERT INTO academic_years (year_name,start_date,end_date)
     VALUES (?,?,?)`,
    [year_name, start_date, end_date],
    err => res.send(result.createResult(err, 'Academic year created'))
  )
})

// get all academic years
router.get('/academic-years', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `SELECT * FROM academic_years ORDER BY start_date DESC`,
    (err, data) => res.send(result.createResult(err, data))
  )
})

// close academic year
router.put('/academic-year/close/:id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `UPDATE academic_years SET is_closed=TRUE WHERE academic_year_id=?`,
    [req.params.id],
    err => res.send(result.createResult(err, 'Academic year closed'))
  )
})

/* =====================================================
   DASHBOARD (SESSION WISE)
===================================================== */

router.get('/dashboard/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  const id = req.params.academic_year_id

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM classes WHERE academic_year_id=?) total_classes,
      (SELECT COUNT(*) FROM student_enrollments WHERE academic_year_id=?) total_students,
      (SELECT COUNT(*) FROM users WHERE role='teacher') total_teachers,
      (SELECT COUNT(*) FROM subjects WHERE academic_year_id=?) total_subjects
  `
  pool.query(sql, [id, id, id],
    (err, rows) => res.send(result.createResult(err, rows[0]))
  )
})

/* =====================================================
   CLASSES (ADMIN)
===================================================== */

// add class (session wise)
router.post('/class/add', (req, res) => {
  if (!adminOnly(req, res)) return

  const { class_level, division, academic_year_id } = req.body

  pool.query(
    `INSERT INTO classes (class_level,division,academic_year_id)
     VALUES (?,?,?)`,
    [class_level, division, academic_year_id],
    err => res.send(result.createResult(err, 'Class added'))
  )
})

// get all classes (session wise)
router.get('/classes/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT 
      c.class_id,
      c.class_level,
      c.division,
      c.class_teacher_id,
      IF(
        c.class_teacher_id IS NULL,
        NULL,
        CONCAT(e.fname, ' ', IFNULL(e.lname, ''))
      ) AS class_teacher,
      COUNT(se.enrollment_id) AS total_students
    FROM classes c
    LEFT JOIN employees e
      ON c.class_teacher_id = e.employee_id
    LEFT JOIN student_enrollments se
      ON se.class_id = c.class_id
    WHERE c.academic_year_id = ?
    GROUP BY c.class_id
    ORDER BY c.class_level, c.division
    `,
    [req.params.academic_year_id],
    (err, data) => {
      res.json({
        status: 'success',
        data,
      })
    }
  )
})


// assign / change class teacher
router.put('/class/assign-teacher', (req, res) => {
  if (!adminOnly(req, res)) return

  const { class_id, teacher_id } = req.body

  const sql = `
    UPDATE classes
    SET class_teacher_id=?
    WHERE class_id=?
  `
  pool.query(sql, [teacher_id, class_id],
    err => res.send(result.createResult(err, 'Class teacher assigned'))
  )
})

// full class profile
router.get('/class/profile/:class_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT
      c.class_id,
      c.class_level,
      c.division,
      c.class_teacher_id,
      c.academic_year_id,
      CONCAT(e.fname,' ',IFNULL(e.lname,'')) AS class_teacher,
      COUNT(se.enrollment_id) AS total_students
    FROM classes c
    LEFT JOIN employees e
      ON c.class_teacher_id = e.employee_id
    LEFT JOIN student_enrollments se
      ON se.class_id = c.class_id
    WHERE c.class_id = ?
    GROUP BY c.class_id
    `,
    [req.params.class_id],
    (err, rows) => {
      res.json({
        status: 'success',
        data: rows[0],
      })
    }
  )
})




// student count per class + division
router.get('/count/class-division/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT c.class_level,c.division,COUNT(se.enrollment_id) total_students
    FROM classes c
    LEFT JOIN student_enrollments se ON se.class_id=c.class_id
    WHERE c.academic_year_id=?
    GROUP BY c.class_level,c.division
    `,
    [req.params.academic_year_id],
    (err, data) => res.send(result.createResult(err, data))
  )
})

/* =====================================================
   STUDENTS (ADMIN)
===================================================== */

// get all students (session wise)
router.get('/students/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT
      se.enrollment_id,
      se.class_id,
      se.roll_no,
      se.status,
      sm.reg_no,
      CONCAT(sm.fname,' ',IFNULL(sm.lname,'')) AS name,
      c.class_level,
      c.division
    FROM student_enrollments se
    JOIN student_master sm
      ON se.student_master_id = sm.student_master_id
    JOIN classes c
      ON se.class_id = c.class_id
    WHERE se.academic_year_id = ?
    ORDER BY c.class_level, c.division, se.roll_no
    `,
    [req.params.academic_year_id],
    (err, data) => res.send(result.createResult(err, data))
  )
})


// change student class & roll number
router.put('/student/change-class-roll', (req, res) => {
  if (!adminOnly(req, res)) return

  const { enrollment_id, class_id, roll_no } = req.body

  pool.query(
    `
    UPDATE student_enrollments
    SET class_id=?, roll_no=?
    WHERE enrollment_id=?
    `,
    [class_id, roll_no, enrollment_id],
    err => res.send(result.createResult(err, 'Student updated'))
  )
})

// TOGGLE STUDENT ACADEMIC STATUS
router.put('/student/toggle-status', (req, res) => {
  console.log('🔥 TOGGLE API HIT', req.body)

  if (!adminOnly(req, res)) return

  const { enrollment_id } = req.body

  pool.query(
    `
    UPDATE student_enrollments
    SET status =
      CASE
        WHEN status = 'active' THEN 'left'
        ELSE 'active'
      END
    WHERE enrollment_id = ?
    `,
    [enrollment_id],
    (err, dbResult) => {
      console.log('🔥 DB RESULT', dbResult)

      if (err) {
        return res.status(500).json({
          status: 'error',
          message: err.message,
        })
      }

      res.json({
        status: 'success',
        data: 'Student status updated',
      })
    }
  )
})



/* =====================================================
   PROMOTION (BULK)
===================================================== */

router.post('/students/promote', (req, res) => {
  if (!adminOnly(req, res)) return

  const { class_id } = req.body

  /* 1️⃣ Get current class + academic year */
  pool.query(
    `
    SELECT
      c.class_level,
      c.academic_year_id
    FROM classes c
    WHERE c.class_id = ?
    `,
    [class_id],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid class',
        })
      }

      const currentLevel = Number(rows[0].class_level)
      const fromYear = rows[0].academic_year_id

      /* ❌ Class 10 cannot be promoted */
      if (currentLevel === 10) {
        return res.status(400).json({
          status: 'error',
          message: 'Class 10 students are passed out',
        })
      }

      /* 2️⃣ Get NEXT academic year */
      pool.query(
        `
        SELECT academic_year_id
        FROM academic_years
        WHERE academic_year_id > ?
          AND is_closed = FALSE
        ORDER BY academic_year_id
        LIMIT 1
        `,
        [fromYear],
        (err2, yearRows) => {
          if (err2 || yearRows.length === 0) {
            return res.status(400).json({
              status: 'error',
              message: 'Next academic year not found',
            })
          }

          const toYear = yearRows[0].academic_year_id
          const nextLevel = String(currentLevel + 1)

          /* 3️⃣ Get NEXT class */
          pool.query(
            `
            SELECT class_id
            FROM classes
            WHERE academic_year_id = ?
              AND class_level = ?
            `,
            [toYear, nextLevel],
            (err3, classRows) => {
              if (err3 || classRows.length === 0) {
                return res.status(400).json({
                  status: 'error',
                  message: 'Next class not found',
                })
              }

              const toClass = classRows[0].class_id

              /* 4️⃣ PROMOTE */
              pool.query(
                `
                INSERT INTO student_enrollments
                (student_master_id, academic_year_id, class_id, roll_no, admission_date, user_id)
                SELECT
                  se.student_master_id,
                  ?,
                  ?,
                  (@r:=@r+1),
                  CURDATE(),
                  se.user_id
                FROM student_enrollments se,
                     (SELECT @r:=0) t
                WHERE se.class_id = ?
                  AND se.status = 'active'
                `,
                [toYear, toClass, class_id],
                err4 => {
                  if (err4) {
                    return res.status(500).json({
                      status: 'error',
                      message: err4.message,
                    })
                  }

                  /* mark old as passed */
                  pool.query(
                    `
                    UPDATE student_enrollments
                    SET status='passed'
                    WHERE class_id=?
                    `,
                    [class_id]
                  )

                  res.json({
                    status: 'success',
                    data: `Promoted to Class ${nextLevel}`,
                  })
                }
              )
            }
          )
        }
      )
    }
  )
})


/* =====================================================
   TEACHERS & ACCOUNTANTS (ADMIN)
===================================================== */

// get all teachers
router.get('/teachers', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT 
  e.employee_id,
  e.fname,
  e.lname,
  e.salary,
  u.status,
  u.user_id
FROM employees e
JOIN users u ON e.user_id=u.user_id
WHERE u.role='teacher'
    `,
    (err, data) => res.send(result.createResult(err, data))
  )
})

// get all accountants
router.get('/accountants', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT 
  e.employee_id,
  e.fname,
  e.lname,
  e.salary,
  u.status,
  u.user_id
FROM employees e
JOIN users u ON e.user_id=u.user_id
WHERE u.role='accountant'

    `,
    (err, data) => res.send(result.createResult(err, data))
  )
})

// update teacher salary
router.put('/teacher/update-salary', (req, res) => {
  if (!adminOnly(req, res)) return

  const { employee_id, salary } = req.body

  pool.query(
    `UPDATE employees SET salary=? WHERE employee_id=?`,
    [salary, employee_id],
    err => res.send(result.createResult(err, 'Teacher salary updated'))
  )
})

// update accountant salary
router.put('/accountant/update-salary', (req, res) => {
  if (!adminOnly(req, res)) return

  const { employee_id, salary } = req.body

  pool.query(
    `UPDATE employees SET salary=? WHERE employee_id=?`,
    [salary, employee_id],
    err => res.send(result.createResult(err, 'Accountant salary updated'))
  )
})

// change teacher status
router.put('/teacher/change-status', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `UPDATE users SET status=? WHERE user_id=? AND role='teacher'`,
    [req.body.status, req.body.user_id],
    err => res.send(result.createResult(err, 'Teacher status updated'))
  )
})

// change accountant status
router.put('/accountant/change-status', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `UPDATE users SET status=? WHERE user_id=? AND role='accountant'`,
    [req.body.status, req.body.user_id],
    err => res.send(result.createResult(err, 'Accountant status updated'))
  )
})

/* =====================================================
   SUBJECTS (ADMIN)
===================================================== */

// add subject
router.post('/subject/add', (req, res) => {
  if (!adminOnly(req, res)) return

  const { subject_name,class_id,teacher_id,academic_year_id } = req.body

  pool.query(
    `
    INSERT INTO subjects (subject_name,class_id,teacher_id,academic_year_id)
    VALUES (?,?,?,?)
    `,
    [subject_name,class_id,teacher_id,academic_year_id],
    err => res.send(result.createResult(err, 'Subject added'))
  )
})

// subjects by class
router.get('/class/:class_id/subjects', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT
      s.subject_id,
      s.subject_name,
      s.teacher_id,
      CONCAT(e.fname, ' ', IFNULL(e.lname,'')) AS teacher
    FROM subjects s
    JOIN employees e
      ON s.teacher_id = e.employee_id
    WHERE s.class_id = ?
    `,
    [req.params.class_id],
    (err, data) => {
      res.send(result.createResult(err, data))
    }
  )
})


// subject info
router.get('/subject/:subject_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT s.subject_name,
           c.class_level,c.division,
           CONCAT(e.fname,' ',e.lname) teacher
    FROM subjects s
    JOIN classes c ON s.class_id=c.class_id
    JOIN employees e ON s.teacher_id=e.employee_id
    WHERE s.subject_id=?
    `,
    [req.params.subject_id],
    (err, data) => res.send(result.createResult(err, data[0]))
  )
})

// change subject teacher
router.put('/subject/change-teacher', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `UPDATE subjects SET teacher_id=? WHERE subject_id=?`,
    [req.body.teacher_id, req.body.subject_id],
    err => res.send(result.createResult(err, 'Subject teacher updated'))
  )
})

//FEES

//Add Update Fee Structure
router.post('/fees/structure', (req, res) => {
    if (!adminOnly(req, res)) return
  
    const { class_level, academic_year_id, total_amount } = req.body
  
    const sql = `
      INSERT INTO fee_structures (class_level, academic_year_id, total_amount)
      VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE total_amount=VALUES(total_amount)
    `
    pool.query(sql, [class_level, academic_year_id, total_amount],
      err => res.send(result.createResult(err, 'Fee structure saved'))
    )
  })

//Get Fee Structure (Session-wise)
router.get('/fees/structure/:academic_year_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `SELECT class_level,total_amount
       FROM fee_structures
       WHERE academic_year_id=?
       ORDER BY class_level`,
      [req.params.academic_year_id],
      (err, data) => res.send(result.createResult(err, data))
    )
  })

//Assign Fee to ONE Student
router.post('/fees/assign/student', (req, res) => {
    if (!adminOnly(req, res)) return
  
    const { enrollment_id, total_amount } = req.body
  
    pool.query(
      `INSERT INTO student_fee_assignments
       (enrollment_id,total_amount,assigned_date)
       VALUES (?,?,CURDATE())`,
      [enrollment_id, total_amount],
      err => res.send(result.createResult(err, 'Fee assigned'))
    )
  })

//AUTO-ASSIGN Fees to ENTIRE CLASS
router.post('/fees/assign/class', (req, res) => {
    if (!adminOnly(req, res)) return
  
    const { class_id, academic_year_id } = req.body
  
    const sql = `
      INSERT INTO student_fee_assignments (enrollment_id,total_amount,assigned_date)
      SELECT se.enrollment_id, fs.total_amount, CURDATE()
      FROM student_enrollments se
      JOIN classes c ON se.class_id=c.class_id
      JOIN fee_structures fs
        ON fs.class_level=c.class_level
       AND fs.academic_year_id=?
      WHERE se.class_id=?
    `
    pool.query(sql, [academic_year_id, class_id],
      err => res.send(result.createResult(err, 'Fees assigned to class'))
    )
  })

//FEE COLLECTION (ADMIN)
//Add Payment
router.post('/fees/payment', (req, res) => {
    if (!adminOnly(req, res)) return
  
    const {
      enrollment_id,
      amount_paid,
      payment_date,
      payment_mode,
      receipt_no
    } = req.body
  
    pool.query(
      `INSERT INTO fee_payments
       (enrollment_id,amount_paid,payment_date,payment_mode,receipt_no)
       VALUES (?,?,?,?,?)`,
      [enrollment_id, amount_paid, payment_date, payment_mode, receipt_no],
      err => res.send(result.createResult(err, 'Payment recorded'))
    )
  })

//Student Fee Status
router.get('/fees/student/:enrollment_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `
      SELECT
        sfa.total_amount,
        IFNULL(SUM(fp.amount_paid),0) paid,
        (sfa.total_amount-IFNULL(SUM(fp.amount_paid),0)) pending
      FROM student_fee_assignments sfa
      LEFT JOIN fee_payments fp ON sfa.enrollment_id=fp.enrollment_id
      WHERE sfa.enrollment_id=?
      GROUP BY sfa.total_amount
      `,
      [req.params.enrollment_id],
      (err, rows) => res.send(result.createResult(err, rows[0]))
    )
  })

//Student Payment History
router.get('/fees/student/payments/:enrollment_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `
      SELECT amount_paid,payment_date,payment_mode,receipt_no
      FROM fee_payments
      WHERE enrollment_id=?
      ORDER BY payment_date
      `,
      [req.params.enrollment_id],
      (err, data) => res.send(result.createResult(err, data))
    )
  })

//Fees Report by Class
router.get('/fees/class/:class_id/:academic_year_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `
      SELECT
        sm.reg_no,
        CONCAT(sm.fname,' ',sm.lname) name,
        sfa.total_amount,
        IFNULL(SUM(fp.amount_paid),0) paid,
        (sfa.total_amount-IFNULL(SUM(fp.amount_paid),0)) pending
      FROM student_enrollments se
      JOIN student_master sm ON se.student_master_id=sm.student_master_id
      JOIN student_fee_assignments sfa ON se.enrollment_id=sfa.enrollment_id
      LEFT JOIN fee_payments fp ON se.enrollment_id=fp.enrollment_id
      WHERE se.class_id=? AND se.academic_year_id=?
      GROUP BY se.enrollment_id
      ORDER BY sm.reg_no
      `,
      [req.params.class_id, req.params.academic_year_id],
      (err, data) => res.send(result.createResult(err, data))
    )
  })

//Defaulters List (Session-wise)  
router.get('/fees/defaulters/:academic_year_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `
      SELECT
        sm.reg_no,
        CONCAT(sm.fname,' ',sm.lname) name,
        c.class_level,c.division,
        sfa.total_amount,
        IFNULL(SUM(fp.amount_paid),0) paid,
        (sfa.total_amount-IFNULL(SUM(fp.amount_paid),0)) pending
      FROM student_enrollments se
      JOIN student_master sm ON se.student_master_id=sm.student_master_id
      JOIN classes c ON se.class_id=c.class_id
      JOIN student_fee_assignments sfa ON se.enrollment_id=sfa.enrollment_id
      LEFT JOIN fee_payments fp ON se.enrollment_id=fp.enrollment_id
      WHERE se.academic_year_id=?
      GROUP BY se.enrollment_id
      HAVING pending > 0
      ORDER BY c.class_level,c.division
      `,
      [req.params.academic_year_id],
      (err, data) => res.send(result.createResult(err, data))
    )
  })
  
//School-Level Fee Summary (Dashboard)
router.get('/fees/summary/:academic_year_id', (req, res) => {
    if (!adminOnly(req, res)) return
  
    pool.query(
      `
      SELECT
        SUM(sfa.total_amount) total_fees,
        SUM(fp.amount_paid) collected,
        (SUM(sfa.total_amount)-SUM(fp.amount_paid)) pending
      FROM student_enrollments se
      JOIN student_fee_assignments sfa ON se.enrollment_id=sfa.enrollment_id
      LEFT JOIN fee_payments fp ON se.enrollment_id=fp.enrollment_id
      WHERE se.academic_year_id=?
      `,
      [req.params.academic_year_id],
      (err, rows) => res.send(result.createResult(err, rows[0]))
    )
  })

// ADD STUDENT (ADMIN)
router.post('/student/add', (req, res) => {
  if (!adminOnly(req, res)) return

  const {
    reg_no,
    fname,
    gender,
    roll_no,
    class_id,
    academic_year_id,
    admission_date,
  } = req.body

  if (
    !reg_no ||
    !fname ||
    !gender ||
    !roll_no ||
    !class_id ||
    !academic_year_id ||
    !admission_date
  ) {
    return res.send(result.createResult('Missing required fields'))
  }

  pool.getConnection((err, conn) => {
    if (err) return res.send(result.createResult(err))

    conn.beginTransaction(err => {
      if (err) {
        conn.release()
        return res.send(result.createResult(err))
      }

      // student_master (minimal)
      conn.query(
        `INSERT INTO student_master (reg_no,fname,gender)
         VALUES (?,?,?)`,
        [reg_no, fname, gender],
        (err, masterRes) => {
          if (err) {
            return conn.rollback(() => {
              conn.release()
              res.send(result.createResult(err))
            })
          }

          const student_master_id = masterRes.insertId

          // enrollment
          conn.query(
            `INSERT INTO student_enrollments
             (student_master_id,academic_year_id,class_id,roll_no,admission_date)
             VALUES (?,?,?,?,?)`,
            [
              student_master_id,
              academic_year_id,
              class_id,
              roll_no,
              admission_date,
            ],
            err => {
              if (err) {
                return conn.rollback(() => {
                  conn.release()
                  res.send(result.createResult(err))
                })
              }

              conn.commit(err => {
                if (err) {
                  return conn.rollback(() => {
                    conn.release()
                    res.send(result.createResult(err))
                  })
                }

                conn.release()
                res.send(
                  result.createResult(null, 'Student added successfully')
                )
              })
            }
          )
        }
      )
    })
  })
})

// STUDENTS BY CLASS (ADMIN)
router.get('/students/by-class/:class_id', (req, res) => {
  if (!adminOnly(req, res)) return

  pool.query(
    `
    SELECT
      se.enrollment_id,
      se.roll_no,
      sm.reg_no,
      CONCAT(sm.fname, ' ', IFNULL(sm.lname,'')) AS name,
      se.status
    FROM student_enrollments se
    JOIN student_master sm
      ON se.student_master_id = sm.student_master_id
    WHERE se.class_id = ?
    ORDER BY se.roll_no
    `,
    [req.params.class_id],
    (err, data) => res.send(result.createResult(err, data))
  )
})

// TOGGLE STUDENT ACADEMIC STATUS
router.put('/student/toggle-status', (req, res) => {
  if (!adminOnly(req, res)) return

  const { enrollment_id } = req.body

  pool.query(
    `
    UPDATE student_enrollments
    SET status =
      CASE
        WHEN status = 'active' THEN 'inactive'
        ELSE 'active'
      END
    WHERE enrollment_id = ?
    `,
    [enrollment_id],
    err => res.send(result.createResult(err, 'Student status updated'))
  )
})

module.exports = router



// const express = require('express')
// const pool = require('../utils/db')
// const result = require('../utils/result')
// const bcrypt = require('bcrypt')

// const router = express.Router()

// function adminOnly(req, res) {
//     if (!req.user || req.user.role !== 'admin') {
//         res.send(result.createResult('Access denied: Admin only'))
//         return false
//     }
//     return true
// }

// //---------------------------------------------------------
// //DASHBOARD
// //----------------------------------------------------------

// //dashboard
// router.get('/dashboard', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const sql = `
//         SELECT
//             (SELECT COUNT(*) FROM classes) AS total_classes,
//             (SELECT COUNT(*) FROM students) AS total_students,
//             (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
//             (SELECT COUNT(*) FROM subjects) AS total_subjects
//     `

//     pool.query(sql, (err, rows) => {

//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         res.send(result.createResult(null, rows[0]))
//     })
// })



// //-----------------------------------------------------------------------------------------
// // ALL CLASSES RELATED APIS
// //-----------------------------------------------------------------------------------------

// //insert class
// router.post('/class/add', (req, res) => {
//     if (!adminOnly(req, res)) return
  
//     const { class_name, section, class_teacher_id } = req.body
  
//     if (!class_name || !section) {
//       return res.send(
//         result.createResult('class_name and section are required')
//       )
//     }
  
//     let sql
//     let values
  
//     // ✅ CASE 1: No teacher assigned
//     if (!class_teacher_id) {
//       sql = `
//         INSERT INTO classes (class_name, section, class_teacher_id)
//         VALUES (?, ?, NULL)
//       `
//       values = [class_name, section]
//     } 
//     // ✅ CASE 2: Teacher assigned
//     else {
//       sql = `
//         INSERT INTO classes (class_name, section, class_teacher_id)
//         VALUES (?, ?, ?)
//       `
//       values = [class_name, section, class_teacher_id]
//     }
  
//     pool.query(sql, values, (err, data) => {
//         if (err) {
//           if (err.code === 'ER_DUP_ENTRY') {
//             return res.send(
//               result.createResult('Class and section already exist')
//             )
//           }
//           return res.send(
//             result.createResult('Failed to add class')
//           )
//         }
      
//         res.send(result.createResult(null, 'Class added successfully'))
//       })
      
//   })
  

// /* =====================================================
//     GET ALL CLASSES
// ===================================================== */
// router.get('/class/getAll', (req, res) => {

//     if (!adminOnly(req, res)) return 

//     const sql = `
//         SELECT 
//             c.class_id,
//             c.class_name,
//             c.section,
//             c.class_teacher_id
//         FROM classes c
//         ORDER BY c.class_name, c.section
//     `
//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// /* =====================================================
//    ASSIGN / CHANGE CLASS TEACHER (ADMIN)
// ===================================================== */
// router.put('/class/assign-teacher', (req, res) => {
//     if (!adminOnly(req, res)) return
  
//     const { class_id, class_teacher_id } = req.body
  
//     if (!class_id || !class_teacher_id) {
//       return res.send(
//         result.createResult('class_id and class_teacher_id required')
//       )
//     }
  
//     // 🔍 Step 1: Check role AND status
//     const checkSql = `
//       SELECT u.role, u.status
//       FROM employees e
//       JOIN users u ON e.user_id = u.user_id
//       WHERE e.employee_id = ?
//     `
  
//     pool.query(checkSql, [class_teacher_id], (err, rows) => {
//       if (err) {
//         return res.send(result.createResult(err))
//       }
  
//       if (rows.length === 0) {
//         return res.send(result.createResult('Invalid employee'))
//       }
  
//       const { role, status } = rows[0]
  
//       if (role !== 'teacher') {
//         return res.send(
//           result.createResult('Only teachers can be assigned as class teacher')
//         )
//       }
  
//       if (status !== 'active') {
//         return res.send(
//           result.createResult('Inactive teacher cannot be assigned')
//         )
//       }
  
//       // ✅ Step 2: Assign teacher
//       const updateSql = `
//         UPDATE classes
//         SET class_teacher_id = ?
//         WHERE class_id = ?
//       `
  
//       pool.query(updateSql, [class_teacher_id, class_id], (err, data) => {
//         res.send(result.createResult(err, data))
//       })
//     })
//   })
  

// //Get student count per class + section 

// router.get('/count/class-section', (req, res) => {

//     if (!adminOnly(req, res)) return
//     const sql = `
//         SELECT 
//             CONCAT(c.class_name, c.section) AS class_section,
//             COUNT(s.student_id) AS total_students
//         FROM classes c
//         LEFT JOIN students s ON s.class_id = c.class_id
//         GROUP BY c.class_name, c.section
//         ORDER BY c.class_name, c.section
//     `

//     pool.query(sql, (err, rows) => {
//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         const output = rows.map(r =>
//             `class : ${r.class_section} : Total Student : ${r.total_students}`
//         )

//         res.send(result.createResult(null, output))
//     })
// })


// //Get student count per class only

// router.get('/count/class', (req, res) => {

//     if (!adminOnly(req, res)) return
//     const sql = `
//         SELECT 
//             c.class_name,
//             COUNT(s.student_id) AS total_students
//         FROM classes c
//         LEFT JOIN students s ON s.class_id = c.class_id
//         GROUP BY c.class_name
//         ORDER BY c.class_name
//     `

//     pool.query(sql, (err, rows) => {
//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         const output = rows.map(r =>
//             `class : ${r.class_name} : Total Student : ${r.total_students}`
//         )

//         res.send(result.createResult(null, output))
//     })
// })

// /* =====================================================
//    GET FULL CLASS PROFILE
// ===================================================== */
// router.get('/class-profile/:id', (req, res) => {

//     if (!adminOnly(req, res)) return
//     const sql = `
//         SELECT 
//         c.class_name,
//         c.section,
//         CONCAT_WS(' ', e.fname, e.lname) AS class_teacher,
//         COUNT(s.student_id) AS total_students
//         FROM classes c
//         LEFT JOIN employees e ON c.class_teacher_id = e.employee_id
//         LEFT JOIN students s ON c.class_id = s.class_id
//         WHERE c.class_id = ?
//         GROUP BY c.class_id;

//     `
//     pool.query(sql, [req.params.id], (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// //------------------------------------------------------------------------------
// //TEACHER RELATED APIS
// //------------------------------------------------------------------------------

// //Edit teachers password

// router.put('/teacher/change-password', async (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, new_password } = req.body

//     if (!employee_id || !new_password) {
//         return res.send(result.createResult('employee_id and new_password required'))
//     }

//     // 1️⃣ Check employee role
//     const roleSql = `
//         SELECT u.user_id, u.role
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE e.employee_id = ?
//     `

//     pool.query(roleSql, [employee_id], async (err, rows) => {
//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         if (rows.length === 0) {
//             return res.send(result.createResult('Invalid employee'))
//         }

//         if (rows[0].role !== 'teacher') {
//             return res.send(
//                 result.createResult('Password can be changed only for teachers')
//             )
//         }

//         // 2️⃣ Hash password
//         const hashedPassword = await bcrypt.hash(new_password, 10)

//         // 3️⃣ Update password
//         const updateSql = `
//             UPDATE users
//             SET password = ?
//             WHERE user_id = ?
//         `

//         pool.query(updateSql, [hashedPassword, rows[0].user_id], (err, data) => {
//             res.send(result.createResult(err, 'Teacher password updated successfully'))
//         })
//     })
// })

// //Update Teacher Salary

// router.put('/teacher/update-salary', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, salary } = req.body

//     if (!employee_id || !salary) {
//         return res.send(result.createResult('employee_id and salary required'))
//     }

//     const roleCheckSql = `
//         SELECT u.role
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE e.employee_id = ?
//     `

//     pool.query(roleCheckSql, [employee_id], (err, rows) => {

//         if (err) return res.send(result.createResult(err))

//         if (rows.length === 0) {
//             return res.send(result.createResult('Invalid employee'))
//         }

//         if (rows[0].role !== 'teacher') {
//             return res.send(
//                 result.createResult('Salary can be updated only for teachers')
//             )
//         }

//         const updateSql = `
//             UPDATE employees
//             SET salary = ?
//             WHERE employee_id = ?
//         `

//         pool.query(updateSql, [salary, employee_id], (err) => {
//             res.send(
//                 result.createResult(err, 'Teacher salary updated successfully')
//             )
//         })
//     })
// })

// //change teacher status

// router.put('/teacher/change-status', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, status } = req.body

//     if (!employee_id || !['active','inactive'].includes(status)) {
//         return res.send(result.createResult('Invalid input'))
//     }

//     const sql = `
//         UPDATE users u
//         JOIN employees e ON u.user_id = e.user_id
//         SET u.status = ?
//         WHERE e.employee_id = ? AND u.role = 'teacher'
//     `

//     pool.query(sql, [status, employee_id], (err, data) => {
//         if (data.affectedRows === 0) {
//             return res.send(result.createResult('Teacher not found'))
//         }
//         res.send(result.createResult(null, 'Teacher status updated'))
//     })
// })

// //------------------------------------------------------------------------------
// //Acountant RELATED APIS
// //------------------------------------------------------------------------------

// //Edit accountnt password

// router.put('/accountant/change-password', async (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, new_password } = req.body

//     if (!employee_id || !new_password) {
//         return res.send(result.createResult('employee_id and new_password required'))
//     }

//     // 1️⃣ Check employee role
//     const roleSql = `
//         SELECT u.user_id, u.role
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE e.employee_id = ?
//     `

//     pool.query(roleSql, [employee_id], async (err, rows) => {

//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         if (rows.length === 0) {
//             return res.send(result.createResult('Invalid employee'))
//         }

//         if (rows[0].role !== 'accountant') {
//             return res.send(
//                 result.createResult('Password can be changed only for accountants')
//             )
//         }

//         // 2️⃣ Hash new password
//         const hashedPassword = await bcrypt.hash(new_password, 10)

//         // 3️⃣ Update password
//         const updateSql = `
//             UPDATE users
//             SET password = ?
//             WHERE user_id = ?
//         `

//         pool.query(updateSql, [hashedPassword, rows[0].user_id], (err, data) => {
//             res.send(
//                 result.createResult(err, 'Accountant password updated successfully')
//             )
//         })
//     })
// })

// //update accountant salary 

// router.put('/accountant/update-salary', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, salary } = req.body

//     if (!employee_id || !salary) {
//         return res.send(result.createResult('employee_id and salary required'))
//     }

//     const roleCheckSql = `
//         SELECT u.role
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE e.employee_id = ?
//     `

//     pool.query(roleCheckSql, [employee_id], (err, rows) => {

//         if (err) return res.send(result.createResult(err))

//         if (rows.length === 0) {
//             return res.send(result.createResult('Invalid employee'))
//         }

//         if (rows[0].role !== 'accountant') {
//             return res.send(
//                 result.createResult('Salary can be updated only for accountants')
//             )
//         }

//         const updateSql = `
//             UPDATE employees
//             SET salary = ?
//             WHERE employee_id = ?
//         `

//         pool.query(updateSql, [salary, employee_id], (err) => {
//             res.send(
//                 result.createResult(err, 'Accountant salary updated successfully')
//             )
//         })
//     })
// })

// //change accountant status

// router.put('/accountant/change-status', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { employee_id, status } = req.body

//     if (!employee_id || !['active','inactive'].includes(status)) {
//         return res.send(result.createResult('Invalid input'))
//     }

//     const sql = `
//         UPDATE users u
//         JOIN employees e ON u.user_id = e.user_id
//         SET u.status = ?
//         WHERE e.employee_id = ? AND u.role = 'accountant'
//     `

//     pool.query(sql, [status, employee_id], (err, data) => {
//         if (data.affectedRows === 0) {
//             return res.send(result.createResult('Accountant not found'))
//         }
//         res.send(result.createResult(null, 'Accountant status updated'))
//     })
// })

// // ===============================
// // GET ALL ACCOUNTANTS (ADMIN)
// // ===============================
// router.get('/accountant/getAll', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const sql = `
//         SELECT 
//             e.employee_id,
//             e.fname,
//             e.salary,
//             u.status
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE u.role = 'accountant'
//         ORDER BY e.employee_id DESC
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })


// //---------------------------------------------------------------------------
// //Student Realated API
// //---------------------------------------------------------------------------

// //change password
// router.put('/student/change-password', async (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { student_id, new_password } = req.body

//     if (!student_id || !new_password) {
//         return res.send(
//             result.createResult('student_id and new_password are required')
//         )
//     }

//     // 1️⃣ Get student -> user
//     const sql = `
//         SELECT u.user_id, u.role
//         FROM students s
//         JOIN users u ON s.user_id = u.user_id
//         WHERE s.student_id = ?
//     `

//     pool.query(sql, [student_id], async (err, rows) => {

//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         if (rows.length === 0) {
//             return res.send(
//                 result.createResult('Student login not found')
//             )
//         }

//         if (rows[0].role !== 'student') {
//             return res.send(
//                 result.createResult('Invalid student account')
//             )
//         }

//         // 2️⃣ Hash password
//         const hashedPassword = await bcrypt.hash(new_password, 10)

//         // 3️⃣ Update password
//         const updateSql = `
//             UPDATE users
//             SET password = ?
//             WHERE user_id = ?
//         `

//         pool.query(updateSql, [hashedPassword, rows[0].user_id], (err) => {
//             res.send(
//                 result.createResult(err, 'Student password updated successfully')
//             )
//         })
//     })
// })

// //change roll_no and class_id

// router.put('/student/change-class-roll', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { student_id, class_id, roll_no } = req.body

//     if (!student_id || !class_id || !roll_no) {
//         return res.send(
//             result.createResult('student_id, class_id and roll_no are required')
//         )
//     }

//     // 1️⃣ Check if roll_no already exists in target class
//     const checkSql = `
//         SELECT student_id
//         FROM students
//         WHERE class_id = ? AND roll_no = ? AND student_id <> ?
//     `

//     pool.query(checkSql, [class_id, roll_no, student_id], (err, rows) => {

//         if (err) {
//             return res.send(result.createResult(err))
//         }

//         if (rows.length > 0) {
//             return res.send(
//                 result.createResult('Roll number already exists in this class')
//             )
//         }

//         // 2️⃣ Update class & roll number
//         const updateSql = `
//             UPDATE students
//             SET class_id = ?, roll_no = ?
//             WHERE student_id = ?
//         `

//         pool.query(updateSql, [class_id, roll_no, student_id], (err, data) => {

//             if (err) {
//                 return res.send(result.createResult(err))
//             }

//             if (data.affectedRows === 0) {
//                 return res.send(result.createResult('Student not found'))
//             }

//             res.send(
//                 result.createResult(null, 'Student class and roll number updated successfully')
//             )
//         })
//     })
// })


// //change status
// router.put('/student/change-status', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const { student_id, status } = req.body

//     if (!student_id || !['active','inactive'].includes(status)) {
//         return res.send(result.createResult('Invalid input'))
//     }

//     const sql = `
//         UPDATE users u
//         JOIN students s ON u.user_id = s.user_id
//         SET u.status = ?
//         WHERE s.student_id = ?
//     `

//     pool.query(sql, [status, student_id], (err, data) => {

//         if (data.affectedRows === 0) {
//             return res.send(
//                 result.createResult('Student login not found or already inactive')
//             )
//         }

//         res.send(result.createResult(null, 'Student status updated'))
//     })
// })

// //-----------------------------------------------------------------------------------------------------------
// //subject related ApIS
// //-----------------------------------------------------------------------------------------------------------

// /* =====================================================
//     ADD SUBJECT (ADMIN) (add to class and teacher too)
//     ===================================================== */
//     router.post('/subject/add', (req, res) => {

//         if (!adminOnly(req, res)) return
    
//         const { subject_name, class_id, teacher_id } = req.body
    
//         if (!subject_name || !class_id || !teacher_id) {
//             return res.send(
//                 result.createResult('subject_name, class_id and teacher_id are required')
//             )
//         }
    
//         // 1️⃣ Check teacher role
//         const roleSql = `
//             SELECT u.role
//             FROM employees e
//             JOIN users u ON e.user_id = u.user_id
//             WHERE e.employee_id = ?
//         `
    
//         pool.query(roleSql, [teacher_id], (err, rows) => {
    
//             if (err) return res.send(result.createResult(err))
    
//             if (rows.length === 0) {
//                 return res.send(result.createResult('Invalid teacher'))
//             }
    
//             if (rows[0].role !== 'teacher') {
//                 return res.send(
//                     result.createResult('Subject can be assigned only to a teacher')
//                 )
//             }
    
//             // 2️⃣ Check duplicate subject in same class
//             const duplicateSql = `
//                 SELECT subject_id
//                 FROM subjects
//                 WHERE subject_name = ? AND class_id = ?
//             `
    
//             pool.query(duplicateSql, [subject_name, class_id], (err, rows) => {
    
//                 if (err) return res.send(result.createResult(err))
    
//                 if (rows.length > 0) {
//                     return res.send(
//                         result.createResult('This subject is already assigned to this class')
//                     )
//                 }
    
//                 // 3️⃣ Insert subject
//                 const insertSql = `
//                     INSERT INTO subjects (subject_name, class_id, teacher_id)
//                     VALUES (?, ?, ?)
//                 `
    
//                 pool.query(
//                     insertSql,
//                     [subject_name, class_id, teacher_id],
//                     (err) => {
//                         if (err && err.code === 'ER_DUP_ENTRY') {
//                             return res.send(
//                                 result.createResult('Duplicate subject for this class')
//                             )
//                         }
    
//                         res.send(
//                             result.createResult(null, 'Subject added successfully')
//                         )
//                     }
//                 )
//             })
//         })
//     })
    
//     //get all subject as per class

//     router.get('/class/:class_id/subjects', (req, res) => {

//         if (!adminOnly(req, res)) return
    
//         const { class_id } = req.params
    
//         if (!class_id) {
//             return res.send(result.createResult('class_id is required'))
//         }
    
//         const sql = `
//             SELECT 
//                 s.subject_id,
//                 s.subject_name,
//                 CONCAT_WS(' ', e.fname, e.lname) AS teacher_name
//             FROM subjects s
//             JOIN employees e ON s.teacher_id = e.employee_id
//             WHERE s.class_id = ?
//             ORDER BY s.subject_name
//         `
    
//         pool.query(sql, [class_id], (err, data) => {
//             res.send(result.createResult(err, data))
//         })
//     })    

//     //subject info by id

//     router.get('/subject/:subject_id', (req, res) => {

//         if (!adminOnly(req, res)) return
    
//         const { subject_id } = req.params
    
//         if (!subject_id) {
//             return res.send(result.createResult('subject_id is required'))
//         }
    
//         const sql = `
//             SELECT 
//                 s.subject_id,
//                 s.subject_name,
//                 c.class_name,
//                 c.section,
//                 CONCAT_WS(' ', e.fname, e.lname) AS teacher_name
//             FROM subjects s
//             JOIN classes c ON s.class_id = c.class_id
//             JOIN employees e ON s.teacher_id = e.employee_id
//             WHERE s.subject_id = ?
//         `
    
//         pool.query(sql, [subject_id], (err, data) => {
    
//             if (err) {
//                 return res.send(result.createResult(err))
//             }
    
//             if (data.length === 0) {
//                 return res.send(result.createResult('Subject not found'))
//             }
    
//             res.send(result.createResult(null, data[0]))
//         })
//     })
    
//     //change teacher for subject

//     router.put('/subject/change-teacher', (req, res) => {

//         if (!adminOnly(req, res)) return
    
//         const { subject_id, teacher_id } = req.body
    
//         if (!subject_id || !teacher_id) {
//             return res.send(
//                 result.createResult('subject_id and teacher_id are required')
//             )
//         }
    
//         // 1️⃣ Check teacher role
//         const roleSql = `
//             SELECT u.role
//             FROM employees e
//             JOIN users u ON e.user_id = u.user_id
//             WHERE e.employee_id = ?
//         `
    
//         pool.query(roleSql, [teacher_id], (err, rows) => {
    
//             if (err) {
//                 return res.send(result.createResult(err))
//             }
    
//             if (rows.length === 0) {
//                 return res.send(result.createResult('Invalid teacher'))
//             }
    
//             if (rows[0].role !== 'teacher') {
//                 return res.send(
//                     result.createResult('Only teacher can be assigned to subject')
//                 )
//             }
    
//             // 2️⃣ Update subject teacher
//             const updateSql = `
//                 UPDATE subjects
//                 SET teacher_id = ?
//                 WHERE subject_id = ?
//             `
    
//             pool.query(updateSql, [teacher_id, subject_id], (err, data) => {
    
//                 if (err) {
//                     return res.send(result.createResult(err))
//                 }
    
//                 if (data.affectedRows === 0) {
//                     return res.send(result.createResult('Subject not found'))
//                 }
    
//                 res.send(
//                     result.createResult(null, 'Subject teacher updated successfully')
//                 )
//             })
//         })
//     })

// //=====================================================
// // GET ALL TEACHERS (ADMIN)
// //=====================================================
// router.get('/teachers', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const sql = `
//         SELECT 
//             e.employee_id,
//             e.fname,
//             e.mname,
//             e.lname,
//             e.salary,
//             e.mobile,
//             e.email,
//             u.status
//         FROM employees e
//         JOIN users u ON e.user_id = u.user_id
//         WHERE u.role = 'teacher'
//         ORDER BY e.fname
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

// //=====================================================
// // GET ALL STUDENTS (ADMIN)
// //=====================================================
// router.get('/students', (req, res) => {

//     if (!adminOnly(req, res)) return

//     const sql = `
//         SELECT
//             s.student_id,
//             s.fname,
//             s.mname,
//             s.lname,
//             s.roll_no,
//             c.class_name,
//             c.section,
//             u.status
//         FROM students s
//         LEFT JOIN users u ON s.user_id = u.user_id
//         JOIN classes c ON s.class_id = c.class_id
//         ORDER BY c.class_name, c.section, s.roll_no
//     `

//     pool.query(sql, (err, data) => {
//         res.send(result.createResult(err, data))
//     })
// })

    

// module.exports = router

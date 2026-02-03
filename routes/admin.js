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

// ---------------------------------
// start here 


// const result = require('../utils/result')



/* =========================
   ADMIN ONLY GUARD
========================= */


/* =====================================================
   1️⃣ GET STUDENTS (SESSION WISE)
   Used in: Students.jsx (table load)
===================================================== */router.get('/students/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  const sql = `
    SELECT
      se.enrollment_id,
      se.class_id,
      se.roll_no,

      sm.reg_no,
      CONCAT(sm.fname,' ',IFNULL(sm.lname,'')) AS name,
      c.class_level,
      c.division
    FROM student_enrollments se
    JOIN student_master sm
      ON sm.student_master_id = se.student_master_id
    JOIN classes c
      ON c.class_id = se.class_id
     AND c.academic_year_id = se.academic_year_id   -- 🔥 IMPORTANT FIX
    WHERE se.academic_year_id = ?
    ORDER BY c.class_level, c.division, se.roll_no
  `

  pool.query(sql, [req.params.academic_year_id], (err, data) => {
    res.send(result.createResult(err, data))
  })
})

/* =====================================================
   2️⃣ GET CLASSES (SESSION WISE)
   Used in: Edit Student dialog dropdown
===================================================== */
router.get('/classes/:academic_year_id', (req, res) => {
  if (!adminOnly(req, res)) return

  const sql = `
    SELECT
      class_id,
      class_level,
      division
    FROM classes
    WHERE academic_year_id = ?
    ORDER BY class_level, division
  `

  pool.query(sql, [req.params.academic_year_id], (err, data) => {
    res.send(result.createResult(err, data))
  })
})

/* =====================================================
   3️⃣ CHANGE STUDENT CLASS & ROLL
   Used in: Edit dialog Save
===================================================== */
router.put('/student/change-class-roll', (req, res) => {
  if (!adminOnly(req, res)) return

  const { enrollment_id, class_id, roll_no } = req.body

  if (!enrollment_id || !class_id || !roll_no) {
    return res.send(result.createResult('Missing required fields'))
  }

  const sql = `
    UPDATE student_enrollments
    SET class_id = ?, roll_no = ?
    WHERE enrollment_id = ?
  `

  pool.query(sql, [class_id, roll_no, enrollment_id], err => {
    res.send(result.createResult(err, 'Student updated'))
  })
})

/* =====================================================
   4️⃣ TOGGLE STUDENT STATUS
   Used in: TOGGLE STATUS button
===================================================== */
router.put('/student/toggle-status', (req, res) => {
  if (!adminOnly(req, res)) return

  const { enrollment_id } = req.body

  if (!enrollment_id) {
    return res.send(result.createResult('Enrollment ID required'))
  }

  const sql = `
    UPDATE student_enrollments
    SET status =
      CASE
        WHEN status = 'active' THEN 'inactive'
        ELSE 'active'
      END
    WHERE enrollment_id = ?
  `

  pool.query(sql, [enrollment_id], err => {
    res.send(result.createResult(err, 'Student status updated'))
  })
})



// end here 
// ---------------------------------
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
  console.log("hhhh")
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

router.post('/students/promote', adminOnly, (req, res) => {
  const {
    from_academic_year_id,
    to_academic_year_id,
    from_class_id,
    to_class_id,
  } = req.body

  if (
    !from_academic_year_id ||
    !to_academic_year_id ||
    !from_class_id
  ) {
    return res.send(
      result.createResult('Missing promotion parameters')
    )
  }

  pool.getConnection((err, conn) => {
    if (err) {
      return res.send(result.createResult(err))
    }

    conn.beginTransaction(async err => {
      if (err) {
        conn.release()
        return res.send(result.createResult(err))
      }

      try {
        /* =========================
           1️⃣ GET STUDENTS TO PROMOTE
        ========================= */
        const [students] = await conn
          .promise()
          .query(
            `
            SELECT enrollment_id, student_master_id, roll_no
            FROM student_enrollments
            WHERE academic_year_id = ?
              AND class_id = ?
              AND status = 'active'
          `,
            [from_academic_year_id, from_class_id]
          )

        if (students.length === 0) {
          throw new Error(
            'No students found in this class to promote'
          )
        }

        /* =========================
           2️⃣ CLASS 10 → PASSED OUT
        ========================= */
        if (!to_class_id) {
          await conn
            .promise()
            .query(
              `
              UPDATE student_enrollments
              SET status = 'passed'
              WHERE academic_year_id = ?
                AND class_id = ?
            `,
              [from_academic_year_id, from_class_id]
            )

          await conn.commit()
          conn.release()

          return res.send(
            result.createResult(
              null,
              'Students marked as PASSED successfully'
            )
          )
        }

        /* =========================
           3️⃣ VERIFY TARGET CLASS
        ========================= */
        const [[targetClass]] = await conn
          .promise()
          .query(
            `
            SELECT class_id
            FROM classes
            WHERE class_id = ?
              AND academic_year_id = ?
          `,
            [to_class_id, to_academic_year_id]
          )

        if (!targetClass) {
          throw new Error(
            'Target class does not exist in next academic year'
          )
        }

        /* =========================
           4️⃣ PREVENT DOUBLE PROMOTION
        ========================= */
        const [already] = await conn
          .promise()
          .query(
            `
            SELECT student_master_id
            FROM student_enrollments
            WHERE academic_year_id = ?
              AND class_id = ?
          `,
            [to_academic_year_id, to_class_id]
          )

        if (already.length > 0) {
          throw new Error(
            'Students already promoted to this class'
          )
        }

        /* =========================
           5️⃣ INSERT NEW ENROLLMENTS
        ========================= */
        for (const s of students) {
          await conn
            .promise()
            .query(
              `
              INSERT INTO student_enrollments
              (student_master_id, academic_year_id, class_id, roll_no, status)
              VALUES (?, ?, ?, ?, 'active')
            `,
              [
                s.student_master_id,
                to_academic_year_id,
                to_class_id,
                s.roll_no,
              ]
            )
        }

        /* =========================
           6️⃣ MARK OLD ENROLLMENTS
        ========================= */
        await conn
          .promise()
          .query(
            `
            UPDATE student_enrollments
            SET status = 'promoted'
            WHERE academic_year_id = ?
              AND class_id = ?
          `,
            [from_academic_year_id, from_class_id]
          )

        await conn.commit()
        conn.release()

        res.send(
          result.createResult(
            null,
            `Successfully promoted ${students.length} students`
          )
        )
      } catch (e) {
        await conn.rollback()
        conn.release()
        res.send(result.createResult(e.message))
      }
    })
  })
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




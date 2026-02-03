DROP DATABASE IF EXISTS school_management_db;
CREATE DATABASE school_management_db;
USE school_management_db;

/* =====================================================
   ACADEMIC YEARS
===================================================== */
CREATE TABLE academic_years (
    academic_year_id INT AUTO_INCREMENT PRIMARY KEY,
    year_name VARCHAR(9) UNIQUE NOT NULL,   -- 2024-25
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)AUTO_INCREMENT = 7001;

/* =====================================================
   USERS (LOGIN - ONE PER PERSON)
===================================================== */
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','teacher','accountant','student') NOT NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) AUTO_INCREMENT = 1001;

/* =====================================================
   EMPLOYEES
===================================================== */
CREATE TABLE employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    fname VARCHAR(50) NOT NULL,
    lname VARCHAR(50),
    reg_no VARCHAR(20) UNIQUE NOT NULL,
    gender ENUM('Male','Female','Other'),
    mobile VARCHAR(15) UNIQUE,
    email VARCHAR(100) UNIQUE,
    joining_date DATE,
    salary DECIMAL(10,2),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) AUTO_INCREMENT = 2001;

/* =====================================================
   CLASSES (1–10, A/B/C, YEAR-WISE)
===================================================== */
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    class_level ENUM('1','2','3','4','5','6','7','8','9','10') NOT NULL,
    division ENUM('A','B','C') NOT NULL,
    academic_year_id INT NOT NULL,
    class_teacher_id INT NULL,

    UNIQUE (class_level, division, academic_year_id),

    FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id)
        ON DELETE CASCADE,

    FOREIGN KEY (class_teacher_id)
        REFERENCES employees(employee_id)
        ON DELETE SET NULL
) AUTO_INCREMENT = 3001;

/* =====================================================
   STUDENT MASTER (PERMANENT IDENTITY)
===================================================== */
CREATE TABLE student_master (
    student_master_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_no VARCHAR(20) UNIQUE NOT NULL,
    fname VARCHAR(50) NOT NULL,
    lname VARCHAR(50),
    mother_name VARCHAR(50),
    gender ENUM('Male','Female','Other'),
    dob DATE,
    mobile VARCHAR(15),
    email VARCHAR(100),
    address VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) AUTO_INCREMENT = 301;

/* =====================================================
   STUDENT ENROLLMENTS (YEAR-WISE ACADEMICS)
===================================================== */
CREATE TABLE student_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_master_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    class_id INT NOT NULL,
    roll_no INT NOT NULL,
    admission_date DATE NOT NULL,
    user_id INT NULL,   -- same user reused every year (optional login)

    UNIQUE (student_master_id, academic_year_id),
    UNIQUE (class_id, roll_no),

    FOREIGN KEY (student_master_id)
        REFERENCES student_master(student_master_id)
        ON DELETE CASCADE,

    FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id)
        ON DELETE CASCADE,

    FOREIGN KEY (class_id)
        REFERENCES classes(class_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
) AUTO_INCREMENT = 501;

/* =====================================================
   SUBJECTS (YEAR-WISE)
===================================================== */
CREATE TABLE subjects (
    subject_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(50) NOT NULL,
    class_id INT NOT NULL,
    teacher_id INT NOT NULL,
    academic_year_id INT NOT NULL,

    FOREIGN KEY (class_id)
        REFERENCES classes(class_id)
        ON DELETE CASCADE,

    FOREIGN KEY (teacher_id)
        REFERENCES employees(employee_id)
        ON DELETE CASCADE,

    FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id)
        ON DELETE CASCADE
) AUTO_INCREMENT = 5001;

/* =====================================================
   EXAMS
===================================================== */
CREATE TABLE exams (
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(50) NOT NULL,
    academic_year_id INT NOT NULL,

    UNIQUE (exam_name, academic_year_id),

    FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id)
        ON DELETE CASCADE
)AUTO_INCREMENT = 8001;

/* =====================================================
   MARKS (ENROLLMENT-BASED)
===================================================== */
CREATE TABLE marks (
    mark_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    subject_id INT NOT NULL,
    exam_id INT NOT NULL,
    marks_obtained DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    grade VARCHAR(5),

    UNIQUE (enrollment_id, subject_id, exam_id),

    FOREIGN KEY (enrollment_id)
        REFERENCES student_enrollments(enrollment_id)
        ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE CASCADE,

    FOREIGN KEY (exam_id)
        REFERENCES exams(exam_id)
        ON DELETE CASCADE
) AUTO_INCREMENT = 9001;

/* =====================================================
   ATTENDANCE (ENROLLMENT-BASED)
===================================================== */
CREATE TABLE attendance_students (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present','Absent') NOT NULL,

    UNIQUE (enrollment_id, attendance_date),

    FOREIGN KEY (enrollment_id)
        REFERENCES student_enrollments(enrollment_id)
        ON DELETE CASCADE
) AUTO_INCREMENT = 6001;

/* =====================================================
   FEE STRUCTURE (CLASS + YEAR)
===================================================== */
CREATE TABLE fee_structures (
    structure_id INT AUTO_INCREMENT PRIMARY KEY,
    class_level ENUM('1','2','3','4','5','6','7','8','9','10') NOT NULL,
    academic_year_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,

    UNIQUE (class_level, academic_year_id),

    FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(academic_year_id)
        ON DELETE CASCADE
)AUTO_INCREMENT = 1501;

/* =====================================================
   STUDENT FEE ASSIGNMENT (AT ADMISSION)
===================================================== */
CREATE TABLE student_fee_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    assigned_date DATE NOT NULL,

    FOREIGN KEY (enrollment_id)
        REFERENCES student_enrollments(enrollment_id)
        ON DELETE CASCADE
)AUTO_INCREMENT = 2501;

/* =====================================================
   MULTIPLE FEE PAYMENTS
===================================================== */
CREATE TABLE fee_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('Cash','UPI','Bank') DEFAULT 'Cash',
    receipt_no VARCHAR(50) UNIQUE,

    FOREIGN KEY (enrollment_id)
        REFERENCES student_enrollments(enrollment_id)
        ON DELETE CASCADE
)AUTO_INCREMENT = 3501;

/*Admin clicks “Promote” twice → duplicate enrollments
When year is closed → no new attendance, marks, promotion
Prevents mistakes */

ALTER TABLE academic_years
ADD COLUMN is_closed BOOLEAN DEFAULT FALSE;


ALTER TABLE student_enrollments
ADD COLUMN status ENUM('active','passed','failed','left') DEFAULT 'active';


/* =====================================================
   INDEXES
===================================================== */
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_enrollment_year ON student_enrollments(academic_year_id);
CREATE INDEX idx_marks_enrollment ON marks(enrollment_id);
CREATE INDEX idx_fees_enrollment ON fee_payments(enrollment_id);
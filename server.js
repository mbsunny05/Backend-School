require('dotenv').config()  //secreat for jwt

const express = require('express')
const cors = require('cors')

const verifyToken = require('./routes/verifyToken')


// Routes
const userRouter = require('./routes/user')
const teacherRouter = require('./routes/teacher')
const studentRouter = require('./routes/student')
// const classRouter = require('./routes/class')
const subjectRouter = require('./routes/subject')
const accountantRouter = require('./routes/accountant')
const authRouter = require('./routes/auth')
const adminRouter = require('./routes/admin')

const app = express()

/* =========================
   GLOBAL MIDDLEWARES
========================= */
app.use(cors())
app.use(express.json())

/* =========================
   PUBLIC ROUTES (NO TOKEN)
========================= */
app.use('/auth', authRouter)

/* =========================
   JWT PROTECTED ROUTES
========================= */
app.use(verifyToken)

app.use('/admin', adminRouter)
app.use('/user', userRouter)
app.use('/teacher', teacherRouter)
app.use('/student', studentRouter)
// app.use('/class', classRouter)
app.use('/subject', subjectRouter)
app.use('/accountant', accountantRouter)

/* =========================
   SERVER
========================= */
app.listen(4000, '0.0.0.0', () => {
    console.log('Server started on port 4000')
})

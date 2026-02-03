const jwt = require('jsonwebtoken')
const result = require('../utils/result')

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization']

    if (!authHeader) {
        return res.send(result.createResult('Token required'))
    }

    // Expected format: "Bearer <token>"
    const token = authHeader.split(' ')[1]

    if (!token) {
        return res.send(result.createResult('Invalid token format'))
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.send(result.createResult('Invalid or expired token'))
        }

        // Attach understanding user info to request
        req.user = {
            user_id: decoded.user_id,
            role: decoded.role
        }

        next()
    })
}

module.exports = verifyToken

const bcrypt = require('bcrypt')

bcrypt.compare(
  'Admin123', // EXACTLY what you type in UI
  ' $2b$10$C4p81KZLdn4FQCrZ3t7N0upP5RLL.lPdaprxMnH3kjq1ucfWE3zuC',
  (err, match) => {
    console.log('MATCH =', match)
  }
)

function createResult(err, data) {
    if (err) {
      return {
        status: 'error',
        error: err.message || err
      }
    }
  
    // INSERT / UPDATE / DELETE
    if (typeof data.affectedRows !== 'undefined') {
      if (data.affectedRows === 0) {
        return {
          status: 'error',
          error: 'Operation failed'
        }
      }
    }
  
    return {
      status: 'success',
      data
    }
  }
  
  module.exports = { createResult }
  
const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : error.message
  });
};

module.exports = errorHandler;
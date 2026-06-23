function errorHandler(err, req, res, next) {
  console.error('[API ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Something went wrong on the server.',
  });
}

module.exports = { errorHandler };

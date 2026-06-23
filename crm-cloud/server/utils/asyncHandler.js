/**
 * Wraps an async route handler so a thrown error / rejected promise gets
 * passed to next(err) automatically. Express 4.x does NOT do this on its
 * own for async functions — without this, a thrown error in an async
 * handler would just hang the request or crash the process.
 *
 * Usage: router.get('/path', requireAuth, ah(async (req, res) => { ... }))
 */
function ah(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = { ah };

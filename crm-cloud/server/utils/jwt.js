const jwt = require('jsonwebtoken');

const SECRET = process.env.CRM_JWT_SECRET;
if (!SECRET) {
  console.error('CRM_JWT_SECRET is not set. Set it to a long random string in your hosting provider\'s environment variables.');
  process.exit(1);
}
const EXPIRES_IN = '12h';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };

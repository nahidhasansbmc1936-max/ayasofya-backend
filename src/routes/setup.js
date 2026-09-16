/**
 * ONE-TIME setup route — resets owner account on Render DB
 * Call: POST /api/setup/reset-owner
 * Body: { "secret": "AYASOFYA_SETUP_2024" }
 * DELETE this file after first use.
 */
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');

router.post('/reset-owner', (req, res) => {
  const { secret } = req.body;

  // Simple one-time secret — not a user password, just prevents random calls
  if (secret !== 'AYASOFYA_SETUP_2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db   = getDB();
  const hash = bcrypt.hashSync('AyaOwner2024#', 12);

  // Remove all existing admin accounts
  db.prepare('DELETE FROM admin_users').run();

  // Create fresh owner
  db.prepare(
    `INSERT INTO admin_users (id,name,email,password,role,permissions,is_active)
     VALUES (?,?,?,?,?,?,1)`
  ).run(
    uuidv4(),
    'Owner',
    'ayasofyabrand@gmail.com',
    hash,
    'super_admin',
    JSON.stringify(['*'])
  );

  const owner = db.prepare(
    'SELECT id,name,email,role,is_active FROM admin_users WHERE email=?'
  ).get('ayasofyabrand@gmail.com');

  // Verify hash is correct
  const verify = bcrypt.compareSync('AyaOwner2024#', hash);

  res.json({
    message : 'Owner account reset successfully',
    owner   : owner,
    verified: verify,
    login   : {
      url     : '/admin/login',
      email   : 'ayasofyabrand@gmail.com',
      password: 'AyaOwner2024#',
    },
  });
});

module.exports = router;

const express = require('express');
const {
  getAllUsers,
  getUserById,
  createUser
} = require('../controllers/userController');

const router = express.Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);

module.exports = router;
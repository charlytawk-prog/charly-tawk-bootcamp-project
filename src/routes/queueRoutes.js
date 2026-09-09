const express = require('express');
const {
  getAllQueues,
  getQueueById
} = require('../controllers/queueController');

const router = express.Router();

router.get('/', getAllQueues);
router.get('/:id', getQueueById);

module.exports = router;
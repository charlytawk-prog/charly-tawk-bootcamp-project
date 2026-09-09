const fs = require('fs');
const path = require('path');

const queuesFilePath = path.join(__dirname, '../../data/queues.json');

const readQueues = () => JSON.parse(fs.readFileSync(queuesFilePath, 'utf8'));

const getAllQueues = (req, res, next) => {
  try {
    res.json(readQueues());
  } catch (error) {
    next(error);
  }
};

const getQueueById = (req, res, next) => {
  try {
    const queue = readQueues().find((item) => item.id === req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json(queue);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllQueues, getQueueById };
const fs = require('fs');
const path = require('path');

const ticketsFilePath = path.join(__dirname, '../../data/tickets.json');
const usersFilePath = path.join(__dirname, '../../data/users.json');
const queuesFilePath = path.join(__dirname, '../../data/queues.json');
const ticketStatuses = ['Submitted', 'Pending Review', 'Routed'];

const readTickets = () => JSON.parse(fs.readFileSync(ticketsFilePath, 'utf8'));
const readUsers = () => JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
const readQueues = () => JSON.parse(fs.readFileSync(queuesFilePath, 'utf8'));

const writeTickets = (tickets) => {
  fs.writeFileSync(ticketsFilePath, JSON.stringify(tickets, null, 2), 'utf8');
};

const getAllTickets = (req, res, next) => {
  try {
    res.json(readTickets());
  } catch (error) {
    next(error);
  }
};

const createTicket = (req, res, next) => {
  try {
    if (!readUsers().some((user) => user.id === req.body.userId)) {
      return res.status(400).json({ error: 'Invalid userId: no such user exists' });
    }

    if (!readQueues().some((queue) => queue.id === req.body.queueId)) {
      return res.status(400).json({ error: 'Invalid queueId: no such queue exists' });
    }

    const tickets = readTickets();
    const newTicket = {
      id: `ticket-${Date.now()}`,
      title: req.body.title,
      description: req.body.description,
      status: 'Submitted',
      priority: req.body.priority || 'medium',
      userId: req.body.userId,
      queueId: req.body.queueId,
      createdAt: new Date().toISOString()
    };

    tickets.push(newTicket);
    writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (error) {
    next(error);
  }
};

const updateTicket = (req, res, next) => {
  try {
    const tickets = readTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === req.params.id);

    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!req.body.status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const currentStatus = tickets[ticketIndex].status;
    const currentStatusIndex = ticketStatuses.indexOf(currentStatus);
    const nextStatus = req.body.status;

    if (
      currentStatusIndex === -1
      || ticketStatuses.indexOf(nextStatus) !== currentStatusIndex + 1
    ) {
      return res.status(400).json({
        error: `Invalid transition: cannot move from '${currentStatus}' to '${nextStatus}' directly`
      });
    }

    tickets[ticketIndex].status = req.body.status;
    writeTickets(tickets);
    res.json(tickets[ticketIndex]);
  } catch (error) {
    next(error);
  }
};

const deleteTicket = (req, res, next) => {
  try {
    const tickets = readTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === req.params.id);

    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const [deletedTicket] = tickets.splice(ticketIndex, 1);
    writeTickets(tickets);
    res.json({ message: 'Ticket deleted successfully', ticket: deletedTicket });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTickets,
  createTicket,
  updateTicket,
  deleteTicket
};
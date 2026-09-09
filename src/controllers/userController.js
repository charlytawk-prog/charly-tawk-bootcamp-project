const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../../data/users.json');

const readUsers = () => JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

const writeUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
};

const getAllUsers = (req, res, next) => {
  try {
    res.json(readUsers());
  } catch (error) {
    next(error);
  }
};

const getUserById = (req, res, next) => {
  try {
    const user = readUsers().find((item) => item.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

const createUser = (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const users = readUsers();
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      role: role || 'customer'
    };

    users.push(newUser);
    writeUsers(users);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllUsers, getUserById, createUser };
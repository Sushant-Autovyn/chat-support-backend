const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const Chat = require('../models/chat.model');
const { createChatHelper } = require('../controllers/chat.controller');

const app = express();
app.use(express.json());
app.use('/api/chats', require('../routes/chat.routes'));

let ticketId;

beforeEach(async () => {
  const ticket = await Ticket.create({
    name: 'Test User', email: 'test@test.com',
    phone: '123', issue: 'My issue'
  });
  ticketId = ticket._id.toString();

  await createChatHelper(ticketId, 'user', 'Hello');
  await createChatHelper(ticketId, 'support', 'Hi there, how can I help?');
  await createChatHelper(ticketId, 'user', 'I have a billing issue');
});

describe('GET /api/chats/:ticketId', () => {
  test('✓ returns chat history in chronological order', async () => {
    const res = await request(app).get(`/api/chats/${ticketId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    expect(res.body[0].sender).toBe('user');
    expect(res.body[0].text).toBe('Hello');
    expect(res.body[1].sender).toBe('support');
    expect(res.body[2].sender).toBe('user');
  });

  test('✓ returns empty array for ticket with no messages', async () => {
    const newTicket = await Ticket.create({ name: 'Empty', email: 'e@e.com', phone: '000', issue: 'New' });
    const res = await request(app).get(`/api/chats/${newTicket._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('✓ public endpoint — no auth required (chatbot widget)', async () => {
    const res = await request(app).get(`/api/chats/${ticketId}`);
    expect(res.status).toBe(200);
  });
});

describe('createChatHelper', () => {
  test('✓ creates a chat message with image', async () => {
    const dataUrl = 'data:image/png;base64,abc123';
    const chat = await createChatHelper(ticketId, 'user', '', dataUrl);
    expect(chat.imageUrl).toBe(dataUrl);
    expect(chat.sender).toBe('user');
  });

  test('✓ null imageUrl stored as null (not empty string)', async () => {
    const chat = await createChatHelper(ticketId, 'support', 'Text message', null);
    expect(chat.imageUrl).toBeNull();
  });

  test('✓ sets companyId when provided', async () => {
    const fakeCompanyId = new mongoose.Types.ObjectId();
    const chat = await createChatHelper(ticketId, 'user', 'Test', null, fakeCompanyId);
    expect(String(chat.companyId)).toBe(String(fakeCompanyId));
  });

  test('✓ stores agentName for support messages', async () => {
    const chat = await createChatHelper(ticketId, 'support', 'Hello!', null, null, 'Ravi Kumar');
    expect(chat.agentName).toBe('Ravi Kumar');
  });

  test('✓ agentName defaults to null when not provided', async () => {
    const chat = await createChatHelper(ticketId, 'user', 'Hi', null, null);
    expect(chat.agentName).toBeNull();
  });
});

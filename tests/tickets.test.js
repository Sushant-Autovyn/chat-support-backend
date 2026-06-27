const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth.middleware');
const Agent = require('../models/agent.model');
const Ticket = require('../models/ticket.model');

const app = express();
app.use(express.json());
app.use('/api/tickets', require('../routes/ticket.routes'));

let adminToken;
let agentToken;

beforeEach(async () => {
  const admin = await Agent.create({
    name: 'Admin', email: 'admin@test.com',
    password: await bcrypt.hash('pass', 10),
    department: 'Mgmt', role: 'admin', status: 'active', activeChats: 0
  });
  const agent = await Agent.create({
    name: 'Agent', email: 'agent@test.com',
    password: await bcrypt.hash('pass', 10),
    department: 'Support', role: 'agent', status: 'active', activeChats: 0
  });
  adminToken = generateToken(admin._id.toString(), 'admin');
  agentToken = generateToken(agent._id.toString(), 'agent');
});

describe('POST /api/tickets', () => {
  test('✓ creates ticket without auth (public endpoint)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ name: 'John', email: 'john@test.com', phone: '1234567890', issue: 'Need help' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.status).toBe('pending');
    expect(res.body.email).toBe('john@test.com');
  });

  test('✓ returns 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ name: 'John', email: 'john@test.com' });

    expect(res.status).toBe(400);
  });

  test('✓ returns 400 for input too long', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ name: 'A'.repeat(101), email: 'j@t.com', phone: '123', issue: 'Test' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/tickets', () => {
  beforeEach(async () => {
    await Ticket.create([
      { name: 'Alice', email: 'a@test.com', phone: '111', issue: 'Issue 1', status: 'pending' },
      { name: 'Bob', email: 'b@test.com', phone: '222', issue: 'Issue 2', status: 'solved' }
    ]);
  });

  test('✓ requires authentication', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  test('✓ returns tickets for authenticated agent', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body).toHaveProperty('total', 2);
    expect(res.body).toHaveProperty('page', 1);
  });

  test('✓ paginates results', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=1')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.pages).toBe(2);
  });

  test('✓ filters by status', async () => {
    const res = await request(app)
      .get('/api/tickets?status=pending')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].status).toBe('pending');
  });
});

describe('GET /api/tickets/:id', () => {
  let ticketId;

  beforeEach(async () => {
    const t = await Ticket.create({ name: 'Alice', email: 'a@test.com', phone: '111', issue: 'Test' });
    ticketId = t._id.toString();
  });

  test('✓ returns ticket without auth (public — for chatbot)', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(ticketId);
  });

  test('✓ returns 404 for non-existent ticket', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/api/tickets/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tickets/:id/status', () => {
  let ticketId;

  beforeEach(async () => {
    const t = await Ticket.create({ name: 'Alice', email: 'a@test.com', phone: '111', issue: 'Test' });
    ticketId = t._id.toString();
  });

  test('✓ updates status to solved (the broken bug — now fixed)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'solved' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('solved');
  });

  test('✓ updates status to pending', async () => {
    await Ticket.findByIdAndUpdate(ticketId, { status: 'solved' });
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  test('✓ requires authentication', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .send({ status: 'solved' });

    expect(res.status).toBe(401);
  });

  test('✓ rejects invalid status', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  test('✓ returns 404 for non-existent ticket', async () => {
    const res = await request(app)
      .put('/api/tickets/507f1f77bcf86cd799439011/status')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'solved' });

    expect(res.status).toBe(404);
  });

  test('✓ concurrent updates — last write wins atomically', async () => {
    // Simulate two agents updating the same ticket concurrently
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ status: 'solved' }),
      request(app)
        .put(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending' })
    ]);

    // Both should succeed (no deadlock/crash)
    expect([200]).toContain(res1.status);
    expect([200]).toContain(res2.status);

    // Final state should be consistent (one of the two values)
    const final = await Ticket.findById(ticketId);
    expect(['pending', 'solved']).toContain(final.status);
  });
});

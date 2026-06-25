const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth.middleware');
const Agent = require('../models/agent.model');

const app = express();
app.use(express.json());
app.use('/api/agents', require('../routes/agent.routes'));

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

describe('GET /api/agents', () => {
  test('✓ returns agents for authenticated user', async () => {
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    // Password must never appear in response
    res.body.forEach(a => expect(a).not.toHaveProperty('password'));
  });

  test('✓ requires authentication', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/agents', () => {
  test('✓ admin can create agent', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Agent', email: 'new@test.com', password: 'password123', department: 'Support', role: 'agent', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'New Agent');
    expect(res.body).not.toHaveProperty('password');
  });

  test('✓ non-admin cannot create agent', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'New', email: 'new@test.com', password: 'password123', department: 'Support', role: 'agent', status: 'active' });

    expect(res.status).toBe(403);
  });

  test('✓ rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: 'agent@test.com', password: 'password123', department: 'Support', role: 'agent', status: 'active' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('✓ rejects short password', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New', email: 'new2@test.com', password: '123', department: 'Support', role: 'agent', status: 'active' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 characters/i);
  });

  test('✓ password is hashed in database', async () => {
    await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hash Test', email: 'hash@test.com', password: 'mypassword', department: 'Support', role: 'agent', status: 'active' });

    const agent = await Agent.findOne({ email: 'hash@test.com' });
    expect(agent.password).not.toBe('mypassword');
    expect(agent.password).toMatch(/^\$2/);
    expect(await bcrypt.compare('mypassword', agent.password)).toBe(true);
  });
});

describe('PUT /api/agents/:id', () => {
  test('✓ admin can update agent', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const res = await request(app)
      .put(`/api/agents/${agent._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name', department: 'Billing', status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.department).toBe('Billing');
  });

  test('✓ password is ignored in regular update', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const originalHash = agent.password;
    await request(app)
      .put(`/api/agents/${agent._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Name', password: 'shouldbeignored' });

    const updated = await Agent.findById(agent._id);
    expect(updated.password).toBe(originalHash);
  });
});

describe('PUT /api/agents/:id/password', () => {
  test('✓ admin can reset password', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const res = await request(app)
      .put(`/api/agents/${agent._id}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(200);
    const updated = await Agent.findById(agent._id);
    expect(await bcrypt.compare('newpassword123', updated.password)).toBe(true);
  });

  test('✓ rejects short password on reset', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const res = await request(app)
      .put(`/api/agents/${agent._id}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: '123' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/agents/:id', () => {
  test('✓ admin can delete agent', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const res = await request(app)
      .delete(`/api/agents/${agent._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    const deleted = await Agent.findById(agent._id);
    expect(deleted).toBeNull();
  });

  test('✓ non-admin cannot delete', async () => {
    const agent = await Agent.findOne({ email: 'agent@test.com' });
    const res = await request(app)
      .delete(`/api/agents/${agent._id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
  });
});

const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Bootstrap minimal app for tests
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth.routes'));

const Agent = require('../models/agent.model');

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await Agent.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: await bcrypt.hash('password123', 10),
      department: 'Management',
      role: 'admin',
      status: 'active',
      activeChats: 0
    });
    await Agent.create({
      name: 'Inactive Agent',
      email: 'inactive@test.com',
      password: await bcrypt.hash('password123', 10),
      department: 'Support',
      role: 'agent',
      status: 'inactive',
      activeChats: 0
    });
  });

  test('✓ returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('name', 'Test Admin');
    expect(res.body).toHaveProperty('role', 'admin');
    expect(res.body).not.toHaveProperty('password');
  });

  test('✓ returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('✓ returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('✓ returns 403 for inactive account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });

  test('✓ returns 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(400);
  });

  test('✓ upgrades legacy plaintext password to bcrypt on login', async () => {
    await Agent.create({
      name: 'Legacy Agent',
      email: 'legacy@test.com',
      password: 'plaintext123',
      department: 'Support',
      role: 'agent',
      status: 'active',
      activeChats: 0
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'legacy@test.com', password: 'plaintext123' });

    expect(res.status).toBe(200);

    // Verify password was upgraded to bcrypt
    const agent = await Agent.findOne({ email: 'legacy@test.com' });
    expect(agent.password).toMatch(/^\$2/);
  });
});

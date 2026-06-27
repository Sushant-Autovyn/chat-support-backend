const request = require('supertest');
const express = require('express');
const Company = require('../models/company.model');
const { createCompany, getCompany, updateCompanySettings } = require('../controllers/company.controller');

const app = express();
app.use(express.json());

// Mount controllers directly (no auth needed for these tests)
app.post('/api/companies', createCompany);
app.get('/api/companies/:slug', getCompany);
app.put('/api/companies/settings', (req, res, next) => {
  // Simulate validateCompany having set companyId
  req.companyId = req._companyId;
  next();
}, updateCompanySettings);

// Helper to create a company and attach its id for settings update route
app.put('/api/companies/:id/settings', async (req, res, next) => {
  req.companyId = req.params.id;
  return updateCompanySettings(req, res, next);
});

describe('POST /api/companies — createCompany', () => {
  test('✓ creates a company and returns apiKey', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'Acme Corp', email: 'acme@test.com', slug: 'acme' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'Acme Corp');
    expect(res.body).toHaveProperty('apiKey');
    expect(res.body.apiKey).toMatch(/^sk_/);
    expect(res.body.slug).toBe('acme');
  });

  test('✓ lowercases slug', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'Beta Co', email: 'beta@test.com', slug: 'BETA' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('beta');
  });

  test('✓ returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'No Slug', email: 'x@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test('✓ returns 400 on duplicate slug (code 11000)', async () => {
    await request(app)
      .post('/api/companies')
      .send({ name: 'First', email: 'first@test.com', slug: 'dup' });

    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'Second', email: 'second@test.com', slug: 'dup' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

describe('GET /api/companies/:slug — getCompany', () => {
  test('✓ returns company by slug', async () => {
    await Company.create({
      name: 'Test Co', email: 'test@test.com', slug: 'testco',
      apiKey: 'sk_test_key'
    });

    const res = await request(app).get('/api/companies/testco');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slug', 'testco');
    expect(res.body).toHaveProperty('name', 'Test Co');
  });

  test('✓ returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/companies/doesnotexist');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe('PUT /api/companies/:id/settings — updateCompanySettings', () => {
  test('✓ updates company settings', async () => {
    const company = await Company.create({
      name: 'Settings Co', email: 'settings@test.com', slug: 'settingsco',
      apiKey: 'sk_settings_key'
    });

    const res = await request(app)
      .put(`/api/companies/${company._id}/settings`)
      .send({ chatbotName: 'HelpBot', brandColor: '#FF0000' });

    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ chatbotName: 'HelpBot', brandColor: '#FF0000' });
  });
});

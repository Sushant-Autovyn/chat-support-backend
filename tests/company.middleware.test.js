const express = require('express');
const request = require('supertest');
const Company = require('../models/company.model');
const { validateCompany } = require('../middleware/company.middleware');

const app = express();
app.use(express.json());

app.get('/protected', validateCompany, (req, res) => {
  res.json({ companyId: req.companyId.toString() });
});

let validApiKey;

beforeEach(async () => {
  const company = await Company.create({
    name: 'Test Corp', email: 'test@test.com', slug: 'testcorp',
    apiKey: 'sk_valid_key_123', status: 'active'
  });
  validApiKey = company.apiKey;
});

describe('validateCompany middleware', () => {
  test('✓ returns 401 when no API key provided', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/API key required/i);
  });

  test('✓ returns 401 for invalid API key', async () => {
    const res = await request(app)
      .get('/protected')
      .set('x-api-key', 'sk_invalid_key');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  test('✓ returns 403 when company is inactive', async () => {
    await Company.findOneAndUpdate({ apiKey: validApiKey }, { status: 'inactive' });

    const res = await request(app)
      .get('/protected')
      .set('x-api-key', validApiKey);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
  });

  test('✓ passes with valid active API key (header)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('x-api-key', validApiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('companyId');
  });

  test('✓ accepts API key from request body', async () => {
    const res = await request(app)
      .get('/protected')
      .send({ apiKey: validApiKey });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('companyId');
  });
});

const { generateToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const mongoose = require('mongoose');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('generateToken', () => {
  test('✓ creates a JWT token', () => {
    const token = generateToken('agent123', 'agent');
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('✓ different roles produce different tokens', () => {
    const t1 = generateToken('id1', 'admin');
    const t2 = generateToken('id1', 'agent');
    expect(t1).not.toBe(t2);
  });
});

describe('requireAuth middleware', () => {
  test('✓ rejects request without Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('✓ rejects request with invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('✓ allows request with valid JWT token', () => {
    const token = generateToken('agent-id-123', 'agent');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.agentId).toBe('agent-id-123');
    expect(req.agentRole).toBe('agent');
  });

  test('✓ rejects legacy mock token (bypass removed for security)', () => {
    const req = { headers: { authorization: 'Bearer mock-jwt-token-agentid123-1234567' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin middleware', () => {
  test('✓ allows admin through', () => {
    const token = generateToken('admin-id', 'admin');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('✓ blocks agent from admin-only route', () => {
    const token = generateToken('agent-id', 'agent');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

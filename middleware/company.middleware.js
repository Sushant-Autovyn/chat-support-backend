const Company = require('../models/company.model');
const logger = require('../utils/logger');

// Middleware to verify API key and attach companyId to request
const validateCompany = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.body?.apiKey;

    if (!apiKey) {
      return res.status(401).json({ message: 'API key required' });
    }

    const company = await Company.findOne({ apiKey });
    if (!company) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    if (company.status !== 'active') {
      return res.status(403).json({ message: 'Company account is inactive' });
    }

    req.companyId = company._id;
    req.company = company;
    next();
  } catch (error) {
    logger.error('Company validation error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { validateCompany };

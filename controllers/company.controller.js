const crypto = require('crypto');
const Company = require('../models/company.model');

const createCompany = async (req, res) => {
  try {
    const { name, email, slug } = req.body;
    if (!name || !email || !slug) {
      return res.status(400).json({ message: 'Name, email, and slug are required' });
    }

    const apiKey = `sk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const company = new Company({
      name,
      email,
      slug: slug.toLowerCase(),
      apiKey
    });

    const savedCompany = await company.save();
    res.status(201).json({
      ...savedCompany.toObject(),
      apiKey
    });
  } catch (error) {
    console.error('Error creating company:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Company name or slug already exists' });
    }
    res.status(500).json({ message: 'Server error, failed to create company' });
  }
};

const getCompany = async (req, res) => {
  try {
    const { slug } = req.params;
    const company = await Company.findOne({ slug });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCompanySettings = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.companyId,
      { settings: req.body },
      { new: true }
    );
    res.json(company);
  } catch (error) {
    console.error('Error updating company settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createCompany, getCompany, updateCompanySettings };

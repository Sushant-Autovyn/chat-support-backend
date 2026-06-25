const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    email: { type: String, required: true },
    logo: { type: String, default: null },
    website: { type: String, default: null },
    apiKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    settings: {
      chatbotName: { type: String, default: 'Support' },
      welcomeMessage: { type: String, default: 'Welcome! How can we help?' },
      brandColor: { type: String, default: '#4F46E5' },
      responseTime: { type: Number, default: 120 }
    },
    limits: {
      monthlyMessages: { type: Number, default: 100000 },
      activeAgents: { type: Number, default: 10 },
      storageGB: { type: Number, default: 50 }
    },
    billingEmail: String,
    paymentStatus: { type: String, enum: ['active', 'past_due', 'cancelled'], default: 'active' }
  },
  { timestamps: true }
);

// Index for fast company lookups
CompanySchema.index({ apiKey: 1 });
CompanySchema.index({ slug: 1 });
CompanySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Company', CompanySchema);

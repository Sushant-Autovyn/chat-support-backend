const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200
    },
    password: { type: String, required: true },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    // Real-time work state the agent sets themselves (distinct from account status).
    availability: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline', index: true },
    activeChats: { type: Number, default: 0, min: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
      }
    }
  }
);

// Unique email (global — not per company since we're single-tenant for now)
agentSchema.index({ email: 1 }, { unique: true });
agentSchema.index({ companyId: 1, status: 1 });
agentSchema.index({ companyId: 1, role: 1 });

module.exports = mongoose.model('Agent', agentSchema);

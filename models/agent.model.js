const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['admin', 'agent'],
      default: 'agent'
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    activeChats: {
      type: Number,
      default: 0
    }
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

// Unique email per company
agentSchema.index({ companyId: 1, email: 1 }, { unique: true });
// Fast lookups for agents in company
agentSchema.index({ companyId: 1, status: 1 });
agentSchema.index({ companyId: 1, role: 1 });

const Agent = mongoose.model('Agent', agentSchema);

module.exports = Agent;

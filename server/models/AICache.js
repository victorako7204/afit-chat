const mongoose = require('mongoose');
const crypto = require('crypto');

const aiCacheSchema = new mongoose.Schema({
  topicHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  topic: {
    type: String,
    required: true
  },
  moduleData: {
    type: Object,
    required: true
  },
  provider: {
    type: String,
    default: 'gemini-3.5-flash'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '24h'
  }
});

function hashTopic(topic) {
  const normalized = topic.toLowerCase().trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

aiCacheSchema.statics.findByTopic = async function (topic) {
  const topicHash = hashTopic(topic);
  return this.findOne({ topicHash });
};

aiCacheSchema.statics.saveCache = async function (topic, moduleData, provider) {
  const topicHash = hashTopic(topic);
  const normalized = topic.toLowerCase().trim();
  return this.findOneAndUpdate(
    { topicHash },
    {
      topicHash,
      topic: normalized,
      moduleData,
      provider: provider || 'gemini-3.5-flash',
      createdAt: new Date()
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('AICache', aiCacheSchema);

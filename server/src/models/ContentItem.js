import mongoose from 'mongoose';
const contentItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['service', 'resource', 'job'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  category: { type: String, trim: true, maxlength: 100, default: '' },
  url: { type: String, trim: true, maxlength: 1000, default: '' },
  organization: { type: String, trim: true, maxlength: 180, default: '' },
  deadline: { type: String, trim: true, maxlength: 120, default: '' },
  status: { type: String, trim: true, maxlength: 80, default: 'Published' },
  isPublished: { type: Boolean, default: true },
  slug: { type: String, trim: true, maxlength: 180, default: '' },
  label: { type: String, trim: true, maxlength: 100, default: '' },
  type: { type: String, trim: true, maxlength: 100, default: '' }
}, { timestamps: true });
export default mongoose.model('ContentItem', contentItemSchema);

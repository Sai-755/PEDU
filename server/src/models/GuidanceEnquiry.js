import mongoose from 'mongoose';

const guidanceEnquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  audience: { type: String, enum: ['school student', 'college student', 'graduate', 'job seeker', 'other'], default: 'other' },
  topic: { type: String, enum: ['technical skills', 'government exams', 'career guidance', 'study materials', 'other'], default: 'other' },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 1500 },
  status: { type: String, enum: ['new', 'in-progress', 'resolved'], default: 'new' }
}, { timestamps: true });

export default mongoose.model('GuidanceEnquiry', guidanceEnquirySchema);

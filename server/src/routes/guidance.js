import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof message !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !message.trim()
    ) {
      return res.status(400).json({
        message: 'Name, email, and message are required.'
      });
    }

    if (
      name.trim().length > 150 ||
      email.trim().length > 254 ||
      (typeof phone === 'string' && phone.length > 30) ||
      (typeof subject === 'string' && subject.length > 200) ||
      message.trim().length > 10000
    ) {
      return res.status(400).json({
        message: 'One or more fields exceed the permitted length.'
      });
    }

    // Format subject or append phone if provided
    const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    let finalSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'Talk to PVGJ Inquiry';
    if (cleanPhone) {
      finalSubject += ` (Phone: ${cleanPhone})`;
    }

    const [result] = await db.execute(
      `INSERT INTO contact_queries
       (name, email, subject, message, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        finalSubject,
        message.trim()
      ]
    );

    return res.status(201).json({
      message: 'Your inquiry was submitted successfully. Our team will review it and reply via email.',
      id: result.insertId
    });
  } catch (error) {
    console.error('Guidance enquiry submission failed:', error.message);

    return res.status(500).json({
      message: 'Unable to submit your enquiry. Please try again.'
    });
  }
});

export default router;
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({
  label = 'Password',
  value,
  onChange,
  placeholder = 'Enter password',
  required = true,
  autoComplete = 'current-password',
  showRequirements = false
}) {
  const [visible, setVisible] = useState(false);

  const criteria = [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(value) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(value) },
    { label: 'One number (0-9)', met: /\d/.test(value) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value) }
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'inherit' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 42px 10px 12px',
            borderRadius: '6px',
            border: '1px solid #ccd8c8',
            fontSize: '0.92rem',
            fontFamily: 'inherit'
          }}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: '#6b7d72'
          }}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {showRequirements && value.length > 0 && (
        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8faf7', borderRadius: '6px', border: '1px solid #e1e8df' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.76rem', fontWeight: 600, color: '#173b2d' }}>Password requirements:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.75rem', lineHeight: '1.4' }}>
            {criteria.map((rule, idx) => (
              <li key={idx} style={{ color: rule.met ? '#2e7d32' : '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold' }}>{rule.met ? '✓' : '•'}</span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
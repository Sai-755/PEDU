import { useEffect, useMemo, useState } from 'react';
import { Search, Mail, Send, CheckCircle2, AlertCircle, X, CornerDownRight } from 'lucide-react';

export default function AdminQueries({ apiBaseUrl, token }) {
  const [queries, setQueries] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'replied'
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchQueries = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/admin/queries`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load inquiries.');
      setQueries(data.queries || []);
    } catch (err) {
      setError(err.message || 'Network error loading inquiries.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [apiBaseUrl, token]);

  const handleSendReply = async (queryId) => {
    if (!replyText.trim()) return;
    setSending(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${apiBaseUrl}/admin/queries/${queryId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ replyMessage: replyText.trim() })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch email reply.');

      setNotice('Reply sent successfully via Brevo to user email.');
      setReplyText('');
      setActiveReplyId(null);
      await fetchQueries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(() => {
    return queries.filter((item) => {
      const matchesFilter =
        filter === 'all' ? true : filter === 'pending' ? item.status === 'pending' : item.status === 'replied';

      const searchTarget = `${item.name || ''} ${item.email || ''} ${item.subject || ''} ${item.message || ''}`.toLowerCase();
      const matchesSearch = searchTarget.includes(query.trim().toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [queries, filter, query]);

  const pendingCount = queries.filter((q) => q.status === 'pending').length;
  const repliedCount = queries.filter((q) => q.status === 'replied').length;

  return (
    <div className="admin-section-card">
      <div className="section-heading">
        <div>
          <h3>Inquiry & Guidance Enquiries</h3>
          <p>Review queries from "Talk to PVGJ" and send email replies directly.</p>
        </div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className={filter === 'all' ? 'admin-primary' : 'admin-secondary'}
            onClick={() => setFilter('all')}
          >
            All ({queries.length})
          </button>
          <button
            type="button"
            className={filter === 'pending' ? 'admin-primary' : 'admin-secondary'}
            onClick={() => setFilter('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={filter === 'replied' ? 'admin-primary' : 'admin-secondary'}
            onClick={() => setFilter('replied')}
          >
            Replied ({repliedCount})
          </button>
        </div>
      </div>

      {notice && (
        <div className="admin-notice" role="status" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          {notice}
          <button onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="admin-error inline-error" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder="Search enquiries by name, email, or keywords…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span>{filtered.length} records</span>
      </div>

      {busy ? (
        <div className="empty-state">Loading enquiries…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Mail size={30} />
          <b>No enquiries found</b>
          <span>{query ? 'Try another search term.' : 'New inquiries from learners will appear here.'}</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PERSON</th>
                <th>SUBJECT & MESSAGE</th>
                <th>RECEIVED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isReplied = item.status === 'replied';
                const isReplying = activeReplyId === item.id;

                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      <a className="email-link" href={`mailto:${item.email}`}>
                        {item.email}
                      </a>
                    </td>

                    <td className="message-cell" style={{ maxWidth: 360 }}>
                      <strong style={{ display: 'block', color: 'var(--text, #173b2d)', marginBottom: 4 }}>
                        {item.subject || 'Talk to PVGJ Inquiry'}
                      </strong>
                      <div style={{ whiteSpace: 'pre-line', color: 'var(--muted, #555)' }}>
                        {item.message}
                      </div>

                      {isReplied && item.admin_reply && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            background: '#f4f6f1',
                            borderLeft: '3px solid #173b2d',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.85rem'
                          }}
                        >
                          <small style={{ display: 'block', fontWeight: 'bold', color: '#173b2d', marginBottom: 2 }}>
                            Replied on {item.replied_at ? new Date(item.replied_at).toLocaleString('en-IN') : '—'}
                          </small>
                          {item.admin_reply}
                        </div>
                      )}

                      {isReplying && (
                        <div style={{ marginTop: 12 }}>
                          <textarea
                            rows={4}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Write reply email to ${item.name}…`}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: 10,
                              borderRadius: 6,
                              border: '1px solid #ccd8c8',
                              fontFamily: 'inherit',
                              fontSize: '0.88rem'
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              className="admin-primary"
                              disabled={sending}
                              onClick={() => handleSendReply(item.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <Send size={14} />
                              {sending ? 'Sending…' : 'Send via Brevo'}
                            </button>
                            <button
                              type="button"
                              className="cancel-btn"
                              onClick={() => {
                                setActiveReplyId(null);
                                setReplyText('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </td>

                    <td>
                      <span className={`status-pill ${isReplied ? 'published' : 'draft'}`}>
                        {isReplied ? 'Replied' : 'Pending'}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        {!isReplied && !isReplying && (
                          <button
                            type="button"
                            className="admin-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => {
                              setActiveReplyId(item.id);
                              setReplyText('');
                            }}
                          >
                            <CornerDownRight size={14} /> Reply
                          </button>
                        )}
                        {isReplied && <span style={{ fontSize: '0.8rem', color: '#7a8c80' }}>Sent ✓</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
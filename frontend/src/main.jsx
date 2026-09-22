import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';

const API_BASE = '/api';
const TOKEN_KEY = 'iosh_token';

function decodeToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isUsableToken(token) {
  const payload = token && decodeToken(token);
  return Boolean(payload?.sub && payload?.role && (!payload.exp || payload.exp * 1000 > Date.now()));
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}, onUnauthorized) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    const error = new Error(payload.error ?? payload.message ?? `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function uploadAttachment(token, ticketId, file, onUnauthorized) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API_BASE}/tickets/${encodeURIComponent(ticketId)}/attachments`, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    const error = new Error(payload.error ?? payload.message ?? `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function downloadAttachment(token, ticketId, attachment, onUnauthorized) {
  const response = await fetch(`${API_BASE}/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachment.id)}`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function statusClass(status) {
  return `status-${status.toLowerCase().replaceAll(' ', '-')}`;
}

function StatusBadge({ status }) {
  return <span className={`badge badge-status ${statusClass(status)}`}>{status}</span>;
}

function queueLabel(queue) {
  return queue ? `${queue.name} · ${queue.department}` : 'Queue details unavailable';
}

function ownerLabel(ticket) {
  return ticket.user ? `${ticket.user.name} (${ticket.user.id})` : `Unknown owner (${ticket.userId})`;
}

const EDITABLE_STATUSES = ['Submitted', 'Pending Review', 'Routed'];

async function editTicket(token, ticketId, updates, onUnauthorized) {
  return request(`/tickets/${encodeURIComponent(ticketId)}/edit`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  }, onUnauthorized);
}

function TicketDetails({ ticket, token, onUnauthorized, canEdit, onTicketUpdated, onAdvanceStatus, isAdvancingStatus }) {
  const [downloadError, setDownloadError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: ticket.title, description: ticket.description, priority: ticket.priority });
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  async function handleDownload(attachment) {
    setDownloadError(null);
    try {
      await downloadAttachment(token, ticket.id, attachment, onUnauthorized);
    } catch (error) {
      setDownloadError(error);
    }
  }

  function startEditing() {
    setEditForm({ title: ticket.title, description: ticket.description, priority: ticket.priority });
    setEditError(null);
    setIsEditing(true);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    setIsSaving(true);
    setEditError(null);
    try {
      await editTicket(token, ticket.id, editForm, onUnauthorized);
      setIsEditing(false);
      await onTicketUpdated?.();
    } catch (error) {
      setEditError(error);
    } finally {
      setIsSaving(false);
    }
  }

  const isEditable = EDITABLE_STATUSES.includes(ticket.status);

  return (
    <dl className="ticket-details">
      <div><dt>Ticket ID</dt><dd>{ticket.id}</dd></div>
      {isEditing ? (
        <>
          <div><dt>Title</dt><dd><input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required /></dd></div>
          <div><dt>Description</dt><dd><textarea rows="4" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} required /></dd></div>
          <div><dt>Priority</dt><dd>
            <select value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </dd></div>
        </>
      ) : (
        <>
          <div><dt>Title</dt><dd>{ticket.title}</dd></div>
          <div><dt>Description</dt><dd>{ticket.description}</dd></div>
          <div><dt>Priority</dt><dd><span className="badge badge-priority">{ticket.priority}</span></dd></div>
        </>
      )}
      <div><dt>Status</dt><dd><StatusBadge status={ticket.status} /></dd></div>
      <div><dt>Owner</dt><dd>{ownerLabel(ticket)}</dd></div>
      <div><dt>Department queue</dt><dd>{queueLabel(ticket.queue)}</dd></div>
      <div><dt>Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
      {onAdvanceStatus && (
        <div>
          <dt>Advance status</dt>
          <dd>
            {(() => {
              const currentIndex = BOARD_COLUMNS.indexOf(ticket.status);
              const forwardStates = currentIndex >= 0 ? BOARD_COLUMNS.slice(currentIndex + 1) : [];
              if (!forwardStates.length) return <span className="empty-copy">This ticket is Resolved. No further steps.</span>;
              return (
                <div className="status-actions">
                  {forwardStates.map((status, index) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onAdvanceStatus(status)}
                      disabled={index !== 0 || isAdvancingStatus}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              );
            })()}
          </dd>
        </div>
      )}
      {canEdit && (
        <div>
          <dt>Edit</dt>
          <dd>
            {isEditable ? (
              isEditing ? (
                <form className="ticket-edit-form" onSubmit={handleSaveEdit}>
                  <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</button>
                  <button type="button" className="button-quiet" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
                  {editError && <p className="attachment-error">{editError.message}</p>}
                </form>
              ) : (
                <button type="button" onClick={startEditing}>Edit</button>
              )
            ) : (
              <span className="empty-copy">This ticket is being processed and can no longer be edited</span>
            )}
          </dd>
        </div>
      )}
      <div>
        <dt>Attachments</dt>
        <dd>
          {ticket.attachments?.length ? (
            <ul className="attachment-list">
              {ticket.attachments.map((attachment) => (
                <li key={attachment.id} className="attachment-item">
                  <span>{attachment.filename}</span>
                  <span className="attachment-size">{formatFileSize(attachment.size)}</span>
                  <button type="button" className="button-quiet" onClick={() => handleDownload(attachment)}>Download</button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="empty-copy">No attachments yet.</span>
          )}
          {downloadError && <p className="attachment-error">{downloadError.message}</p>}
        </dd>
      </div>
    </dl>
  );
}

function TicketRow({ ticket, onSelect, action }) {
  return (
    <article className={`ticket-row${ticket.status === 'Resolved' ? ' ticket-row-resolved' : ''}`}>
      <button className="ticket-select" type="button" onClick={() => onSelect(ticket.id)}>
        <span className="ticket-row-top"><strong>{ticket.title}</strong><StatusBadge status={ticket.status} /></span>
        <span className="ticket-row-bottom"><span>Owner: {ownerLabel(ticket)}</span><span>{queueLabel(ticket.queue)}</span><span className="badge badge-priority">{ticket.priority}</span></span>
      </button>
      {action}
    </article>
  );
}

function Shell({ account, onLogout, children }) {
  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="masthead-top"><p className="eyebrow">Internal Operations Service Hub</p><span className="phase-mark">WORKFLOW / ROUTED</span></div>
        <h1>Work requests, with the rules visible.</h1>
        <p className="intro">A small operations desk for creating requests, checking ownership, and moving department work forward.</p>
        <div className="session-bar"><span>Logged in as <strong>{account.name}</strong> <small>({account.email})</small>, role: <strong>{account.role}</strong>{account.department ? ` / ${account.department}` : ''}</span><button className="button-quiet" type="button" onClick={onLogout}>Log out</button></div>
      </header>
      {children}
    </main>
  );
}

function LoginPage({ onLogin, message }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'alice@example.com', password: 'password123' });
  const [error, setError] = useState(message ?? null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      const response = await request('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      const payload = decodeToken(response.access_token);
      if (!payload?.sub || !payload.role) throw new Error('Invalid login response');
      let name = form.email;
      let email = form.email;
      try {
        const profile = await request(`/users/${encodeURIComponent(payload.sub)}`, { headers: authHeaders(response.access_token) });
        name = profile.name;
        email = profile.email ?? form.email;
      } catch {
        // The JWT is still sufficient to choose the dashboard.
      }
      const account = { ...payload, email, name };
      onLogin(response.access_token, account);
      navigate(payload.role === 'Employee' ? '/employee' : payload.role === 'Department Agent' ? '/agent' : '/no-dashboard');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className="app-shell login-page">
      <header className="masthead">
        <div className="masthead-top"><p className="eyebrow">Internal Operations Service Hub</p><span className="phase-mark">IDENTITY / LOGIN</span></div>
        <h1>Work requests, with the rules visible.</h1>
        <p className="intro">Sign in to reach the workspace for your role.</p>
      </header>
      <section className="panel login-panel" aria-labelledby="login-heading">
        <div className="section-heading"><span className="step-number">00</span><div><p className="section-kicker">Identity checkpoint</p><h2 id="login-heading">Log in to continue</h2></div></div>
        <form onSubmit={handleSubmit} className="login-form">
          <Field label="Email" name="email" type="email" value={form.email} onChange={updateField} required />
          <Field label="Password" name="password" type="password" value={form.password} onChange={updateField} required />
          <button type="submit" disabled={isLoggingIn}>{isLoggingIn ? 'Checking...' : 'Log in'}</button>
        </form>
        {error && <div className="result result-error"><p className="result-label">Login failed</p><p>{error}</p></div>}
      </section>
    </main>
  );
}

function EmployeePage({ token, account, onLogout, onUnauthorized }) {
  const [submitForm, setSubmitForm] = useState({ title: '', description: '', queueId: 'queue-1', priority: 'medium' });
  const [submitFile, setSubmitFile] = useState(null);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [attachmentWarning, setAttachmentWarning] = useState(null);
  const [hadAttachment, setHadAttachment] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiRawText, setAiRawText] = useState('');
  const [aiError, setAiError] = useState(null);
  const [isGettingAiSuggestion, setIsGettingAiSuggestion] = useState(false);
  const [myTickets, setMyTickets] = useState(null);
  const [myTicketsError, setMyTicketsError] = useState(null);
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const [queues, setQueues] = useState(null);
  const [queueListError, setQueueListError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailError, setDetailError] = useState(null);

  async function loadMine() {
    setIsLoadingMine(true);
    setMyTicketsError(null);
    try {
      setMyTickets(await request('/tickets/mine', { headers: authHeaders(token) }, onUnauthorized));
    } catch (error) {
      setMyTicketsError(error);
    } finally {
      setIsLoadingMine(false);
    }
  }

  async function loadQueues() {
    setQueueListError(null);
    try {
      setQueues(await request('/queues'));
    } catch (error) {
      setQueueListError(error);
    }
  }

  useEffect(() => { loadMine(); loadQueues(); }, [token]);

  async function handleAiSuggestion(event) {
    event.preventDefault();
    if (!aiRawText.trim()) return;

    setIsGettingAiSuggestion(true);
    setAiError(null);
    try {
      const response = await request('/tickets/suggest', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ rawText: aiRawText.trim() }),
      }, onUnauthorized);

      const suggestion = response?.success === true ? response.suggestion : null;
      const matchingQueue = suggestion && queues?.find((queue) => queue.id === suggestion.queueId);
      const normalizedPriority = suggestion?.priority?.toLowerCase();
      if (
        !suggestion?.title
        || !suggestion?.description
        || !matchingQueue
        || !['low', 'medium', 'high', 'urgent'].includes(normalizedPriority)
      ) {
        throw new Error('AI suggestion unavailable');
      }

      setSubmitForm((current) => ({
        ...current,
        title: suggestion.title,
        description: suggestion.description,
        queueId: matchingQueue.id,
        priority: normalizedPriority,
      }));
    } catch (error) {
      setAiError(error);
    } finally {
      setIsGettingAiSuggestion(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setCreatedTicket(null);
    setSubmitError(null);
    setAttachmentWarning(null);
    setHadAttachment(Boolean(submitFile));
    try {
      const ticket = await request('/tickets', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ ...submitForm, userId: account.sub }) }, onUnauthorized);
      setCreatedTicket(ticket);
      if (submitFile) {
        try {
          await uploadAttachment(token, ticket.id, submitFile, onUnauthorized);
        } catch (attachmentError) {
          setAttachmentWarning(attachmentError);
        }
      }
      setSubmitFile(null);
      event.target.reset();
      await loadMine();
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectTicket(ticketId) {
    setDetailError(null);
    try {
      setSelectedTicket(await request(`/tickets/${encodeURIComponent(ticketId)}`, { headers: authHeaders(token) }, onUnauthorized));
    } catch (error) {
      setSelectedTicket(null);
      setDetailError(error);
    }
  }

  return (
    <Shell account={account} onLogout={onLogout}>
      <section className="panel history-panel" aria-labelledby="mine-heading">
        <div className="section-heading"><span className="step-number">01</span><div><p className="section-kicker">Employee workspace</p><h2 id="mine-heading">My Tickets</h2></div><button className="button-quiet refresh-button" type="button" onClick={loadMine} disabled={isLoadingMine}>{isLoadingMine ? 'Refreshing...' : 'Refresh'}</button></div>
        <p className="workspace-welcome">Welcome, <strong>{account.name}</strong>. Your requests are listed newest first.</p>
        {myTicketsError && <div className="result result-error"><p>{myTicketsError.message}</p></div>}
        {!myTickets && !myTicketsError && <div className="result result-neutral"><p>Loading your tickets...</p></div>}
        {myTickets && !myTickets.length && <div className="result result-neutral"><p>You have no tickets yet.</p></div>}
        {myTickets?.length > 0 && <div className="ticket-list">{myTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onSelect={handleSelectTicket} />)}</div>}
      </section>
      <div className="flow-grid">
        <section className="panel" aria-labelledby="submit-heading">
          <div className="section-heading"><span className="step-number">02</span><div><p className="section-kicker">New request</p><h2 id="submit-heading">Submit a ticket</h2></div></div>
          <div className="ai-assist" aria-labelledby="ai-assist-heading">
            <p className="section-kicker">Optional assist</p>
            <h3 id="ai-assist-heading">Start with your own words</h3>
            <p className="assist-copy">Describe what is going wrong and AI can suggest the ticket fields for you to review.</p>
            <form className="ai-assist-form" onSubmit={handleAiSuggestion}>
              <label className="field"><span>Describe your issue in your own words</span><textarea value={aiRawText} onChange={(event) => setAiRawText(event.target.value)} placeholder="For example: my laptop cannot connect to the office Wi-Fi" rows="4" /></label>
              <button type="submit" disabled={isGettingAiSuggestion || !aiRawText.trim() || !queues}>{isGettingAiSuggestion ? 'Getting suggestion...' : 'Get AI suggestion'}</button>
            </form>
            {aiError && <p className="ai-assist-error" role="status">AI suggestion unavailable — please fill out the form below manually</p>}
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Title" name="title" value={submitForm.title} onChange={(event) => setSubmitForm({ ...submitForm, title: event.target.value })} placeholder="What needs attention?" required />
            <label className="field"><span>Description</span><textarea name="description" value={submitForm.description} onChange={(event) => setSubmitForm({ ...submitForm, description: event.target.value })} placeholder="Give the operations team enough context to help." rows="5" required /></label>
            <label className="field"><span>Department queue</span><select name="queueId" value={submitForm.queueId} onChange={(event) => setSubmitForm({ ...submitForm, queueId: event.target.value })} required disabled={!queues}><option value="" disabled>{queues ? 'Choose a department queue' : 'Loading queues...'}</option>{queues?.map((queue) => <option key={queue.id} value={queue.id}>{queue.name} ({queue.department})</option>)}</select></label>
            <label className="field"><span>Priority</span><select name="priority" value={submitForm.priority} onChange={(event) => setSubmitForm({ ...submitForm, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label className="field"><span>Attach a file (optional)</span><input type="file" aria-label="Attach a file" onChange={(event) => setSubmitFile(event.target.files?.[0] ?? null)} /></label>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Create ticket'}</button>
          </form>
          {createdTicket && <div className="result result-success"><p className="result-label">{attachmentWarning ? 'Ticket created' : hadAttachment ? 'Ticket created and file attached' : 'Ticket created'}</p><strong>{createdTicket.id}</strong><p>Owner: <b>{ownerLabel(createdTicket)}</b></p><p>Status: <b>{createdTicket.status}</b></p></div>}
          {attachmentWarning && <div className="result result-error"><p className="result-label">Attachment failed</p><p>The ticket was created, but the file could not be attached: {attachmentWarning.message}</p></div>}
          {submitError && <div className="result result-error"><p className="result-label">Request rejected</p><p>{submitError.message}</p></div>}
          {queueListError && <div className="result result-error"><p className="result-label">Queues unavailable</p><p>{queueListError.message}</p></div>}
        </section>
        <section className="panel" aria-labelledby="detail-heading">
          <div className="section-heading"><span className="step-number">03</span><div><p className="section-kicker">Selected request</p><h2 id="detail-heading">Ticket detail</h2></div></div>
          {!selectedTicket && !detailError && <div className="result result-neutral"><p>Select a ticket from your history to inspect it.</p></div>}
          {selectedTicket && <div className="result result-success"><p className="result-label">Access granted</p><TicketDetails ticket={selectedTicket} token={token} onUnauthorized={onUnauthorized} canEdit={selectedTicket.userId === account.sub} onTicketUpdated={async () => { await handleSelectTicket(selectedTicket.id); await loadMine(); }} /></div>}
          {detailError && <div className="result result-error"><p className="result-label">{detailError.status === 403 ? 'Access denied' : detailError.status === 404 ? 'Ticket not found' : detailError.status === 401 ? 'Identity required' : 'Request failed'}</p><p>{detailError.message}</p><span className="status-code">HTTP {detailError.status}</span></div>}
        </section>
      </div>
    </Shell>
  );
}

const BOARD_COLUMNS = ['Submitted', 'Pending Review', 'Routed', 'In Progress', 'Resolved'];

function AgentPage({ token, account, onLogout, onUnauthorized }) {
  const [queueTickets, setQueueTickets] = useState(null);
  const [queueSearch, setQueueSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(BOARD_COLUMNS[0]);
  const [queueError, setQueueError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  async function loadQueue() {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      setQueueTickets(await request('/tickets/queue', { headers: authHeaders(token) }, onUnauthorized));
    } catch (error) {
      setQueueError(error);
    } finally {
      setIsLoadingQueue(false);
    }
  }

  useEffect(() => { loadQueue(); }, [token]);

  async function handleSelectTicket(ticketId) {
    try {
      setSelectedTicket(await request(`/tickets/${encodeURIComponent(ticketId)}`, { headers: authHeaders(token) }, onUnauthorized));
    } catch (error) {
      setSelectedTicket(null);
      setStatusError(error);
    }
  }

  async function handleStatusUpdate(ticketId, status) {
    setUpdatingTicketId(ticketId);
    setStatusError(null);
    try {
      await request(`/tickets/${encodeURIComponent(ticketId)}/status`, { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ status }) }, onUnauthorized);
      await loadQueue();
      if (selectedTicket?.id === ticketId) await handleSelectTicket(ticketId);
    } catch (error) {
      setStatusError(error);
    } finally {
      setUpdatingTicketId(null);
    }
  }

  const visibleQueue = (queueTickets ?? []).filter((ticket) => `${ticket.title} ${ticket.id}`.toLowerCase().includes(queueSearch.toLowerCase()));
  const ticketsForStatus = visibleQueue.filter((ticket) => ticket.status === selectedStatus);

  return (
    <Shell account={account} onLogout={onLogout}>
      <section className="panel queue-panel agent-dashboard" aria-labelledby="queue-heading">
        <div className="section-heading"><span className="step-number">01</span><div><p className="section-kicker">Agent workspace</p><h2 id="queue-heading">My department's queue</h2></div><button className="button-quiet refresh-button" type="button" onClick={loadQueue} disabled={isLoadingQueue}>{isLoadingQueue ? 'Refreshing...' : 'Refresh'}</button></div>
        <p className="queue-context">Showing <strong>{account.department}</strong> tickets assigned to your department.</p>
        <div className="queue-toolbar">
          <input aria-label="Search queue" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="Search title or ticket ID" />
          <label className="field status-filter"><span>State</span>
            <select aria-label="Filter by state" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              {BOARD_COLUMNS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        {queueError && <div className="result result-error"><p className="result-label">Queue unavailable</p><p>{queueError.message}</p></div>}
        {statusError && <div className="result result-error"><p className="result-label">Status update rejected</p><p>{statusError.message}</p></div>}
        <div className="queue-heading"><h3>{selectedStatus}</h3><span>{ticketsForStatus.length}</span></div>
        {ticketsForStatus.length ? (
          <div className="ticket-list">{ticketsForStatus.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onSelect={handleSelectTicket} />)}</div>
        ) : (
          <p className="empty-copy">No tickets match this search.</p>
        )}
      </section>
      <section className="panel" aria-labelledby="detail-heading">
        <div className="section-heading"><span className="step-number">02</span><div><p className="section-kicker">Selected request</p><h2 id="detail-heading">Ticket detail</h2></div></div>
        {selectedTicket ? (
          <div className="result result-success">
            <p className="result-label">Queue ticket</p>
            <TicketDetails
              ticket={selectedTicket}
              token={token}
              onUnauthorized={onUnauthorized}
              onAdvanceStatus={(status) => handleStatusUpdate(selectedTicket.id, status)}
              isAdvancingStatus={updatingTicketId === selectedTicket.id}
            />
          </div>
        ) : (
          <div className="result result-neutral"><p>Select a queue ticket to inspect it.</p></div>
        )}
      </section>
    </Shell>
  );
}

function ProtectedRoute({ account, role, children }) {
  const location = useLocation();
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (account.role !== role) return <Navigate to={account.role === 'Employee' ? '/employee' : account.role === 'Department Agent' ? '/agent' : '/no-dashboard'} replace />;
  return children;
}

function NoDashboard({ account, onLogout }) {
  return <Shell account={account} onLogout={onLogout}><section className="panel result-neutral no-dashboard"><h2>No dashboard available for this role yet</h2><p>The {account.role} workspace will arrive in a later phase.</p></section></Shell>;
}

function App() {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  const initialPayload = isUsableToken(initialToken) ? decodeToken(initialToken) : null;
  const [token, setToken] = useState(initialPayload ? initialToken : null);
  const [account, setAccount] = useState(initialPayload ? { ...initialPayload, email: initialPayload.email ?? initialPayload.sub, name: initialPayload.name ?? initialPayload.email ?? initialPayload.sub } : null);
  const [sessionMessage, setSessionMessage] = useState(null);
  const navigate = useNavigate();

  function logout(message = null) {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAccount(null);
    setSessionMessage(message);
    navigate('/login', { replace: true, state: message ? { message } : undefined });
  }

  function handleLogin(nextToken, nextAccount) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setAccount(nextAccount);
    setSessionMessage(null);
  }

  useEffect(() => {
    if (initialToken && !initialPayload) localStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (!token || !account?.sub || account.name !== account.email && account.name !== account.sub) return;
    request(`/users/${encodeURIComponent(account.sub)}`, { headers: authHeaders(token) }, () => logout('Your session expired, please log in again')).then((profile) => {
      setAccount((current) => ({ ...current, name: profile.name }));
    }).catch(() => {});
  }, [token]);

  const handleUnauthorized = () => logout('Your session expired, please log in again');
  const message = sessionMessage;

  return (
    <Routes>
      <Route path="/login" element={account ? <Navigate to={account.role === 'Employee' ? '/employee' : account.role === 'Department Agent' ? '/agent' : '/no-dashboard'} replace /> : <LoginPage onLogin={handleLogin} message={message} />} />
      <Route path="/employee" element={<ProtectedRoute account={account} role="Employee"><EmployeePage token={token} account={account} onLogout={() => logout()} onUnauthorized={handleUnauthorized} /></ProtectedRoute>} />
      <Route path="/agent" element={<ProtectedRoute account={account} role="Department Agent"><AgentPage token={token} account={account} onLogout={() => logout()} onUnauthorized={handleUnauthorized} /></ProtectedRoute>} />
      <Route path="/no-dashboard" element={account ? <NoDashboard account={account} onLogout={() => logout()} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={account ? (account.role === 'Employee' ? '/employee' : account.role === 'Department Agent' ? '/agent' : '/no-dashboard') : '/login'} replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error ?? payload.message ?? `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function TicketDetails({ ticket }) {
  return (
    <dl className="ticket-details">
      <div><dt>Ticket ID</dt><dd>{ticket.id}</dd></div>
      <div><dt>Title</dt><dd>{ticket.title}</dd></div>
      <div><dt>Description</dt><dd>{ticket.description}</dd></div>
      <div><dt>Status</dt><dd><span className="badge badge-status">{ticket.status}</span></dd></div>
      <div><dt>Priority</dt><dd><span className="badge badge-priority">{ticket.priority}</span></dd></div>
      <div><dt>Owner</dt><dd>{ticket.userId}</dd></div>
      <div><dt>Queue</dt><dd>{ticket.queueId}</dd></div>
      <div><dt>Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
    </dl>
  );
}

function App() {
  const [submitForm, setSubmitForm] = useState({
    title: '',
    description: '',
    userId: 'user-1',
    queueId: 'queue-1',
    priority: 'medium',
  });
  const [createdTicket, setCreatedTicket] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewForm, setViewForm] = useState({ ticketId: 'ticket-1', userId: 'user-1' });
  const [viewResult, setViewResult] = useState(null);
  const [isViewing, setIsViewing] = useState(false);

  function updateSubmitField(event) {
    setSubmitForm({ ...submitForm, [event.target.name]: event.target.value });
  }

  function updateViewField(event) {
    setViewForm({ ...viewForm, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setCreatedTicket(null);
    setSubmitError(null);

    try {
      const ticket = await request('/tickets', {
        method: 'POST',
        body: JSON.stringify(submitForm),
      });
      setCreatedTicket(ticket);
      setViewForm({ ticketId: ticket.id, userId: submitForm.userId });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleView(event) {
    event.preventDefault();
    setIsViewing(true);
    setViewResult({ state: 'loading' });

    try {
      const ticket = await request(`/tickets/${encodeURIComponent(viewForm.ticketId)}`, {
        headers: viewForm.userId ? { 'x-user-id': viewForm.userId } : {},
      });
      setViewResult({ state: 'success', ticket });
    } catch (error) {
      setViewResult({ state: 'error', error });
    } finally {
      setIsViewing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <p className="eyebrow">Internal Operations Service Hub</p>
        <h1>Tickets, with the rules visible.</h1>
        <p className="intro">Create a service request, then test who can read it. Identity is represented by the <code>x-user-id</code> header.</p>
      </header>

      <div className="flow-grid">
        <section className="panel" aria-labelledby="submit-heading">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div><p className="section-kicker">New request</p><h2 id="submit-heading">Submit a ticket</h2></div>
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Title" name="title" value={submitForm.title} onChange={updateSubmitField} placeholder="What needs attention?" required />
            <label className="field"><span>Description</span><textarea name="description" value={submitForm.description} onChange={updateSubmitField} placeholder="Give the operations team enough context to help." rows="5" required /></label>
            <div className="form-row"><Field label="Acting as user ID" name="userId" value={submitForm.userId} onChange={updateSubmitField} placeholder="user-1" required /><Field label="Queue ID" name="queueId" value={submitForm.queueId} onChange={updateSubmitField} placeholder="queue-1" required /></div>
            <label className="field"><span>Priority</span><select name="priority" value={submitForm.priority} onChange={updateSubmitField}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Create ticket'}</button>
          </form>
          {createdTicket && <div className="result result-success"><p className="result-label">Ticket created</p><strong>{createdTicket.id}</strong><p>Status: <b>{createdTicket.status}</b></p></div>}
          {submitError && <div className="result result-error"><p className="result-label">Request rejected</p><p>{submitError.message}</p></div>}
        </section>

        <section className="panel" aria-labelledby="view-heading">
          <div className="section-heading"><span className="step-number">02</span><div><p className="section-kicker">Access check</p><h2 id="view-heading">View a ticket by ID</h2></div></div>
          <form onSubmit={handleView}>
            <Field label="Ticket ID" name="ticketId" value={viewForm.ticketId} onChange={updateViewField} placeholder="ticket-1" required />
            <Field label="Your user ID" name="userId" value={viewForm.userId} onChange={updateViewField} placeholder="user-1" />
            <button type="submit" disabled={isViewing}>{isViewing ? 'Checking access...' : 'View ticket'}</button>
          </form>
          {viewResult?.state === 'loading' && <div className="result result-neutral"><p>Checking the ticket owner rule...</p></div>}
          {viewResult?.state === 'success' && <div className="result result-success"><p className="result-label">Access granted</p><TicketDetails ticket={viewResult.ticket} /></div>}
          {viewResult?.state === 'error' && <div className={`result result-error error-${viewResult.error.status}`}><p className="result-label">{viewResult.error.status === 403 ? 'Access denied' : viewResult.error.status === 401 ? 'Identity required' : viewResult.error.status === 404 ? 'Ticket not found' : 'Request failed'}</p><p>{viewResult.error.message}</p><span className="status-code">HTTP {viewResult.error.status}</span></div>}
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
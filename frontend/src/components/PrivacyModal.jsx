import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldIcon, XIcon, CheckIcon } from './Icons';

export const PrivacyModal = () => {
  const { privacyModal, closePrivacyPolicy, acceptPrivacyPolicy } = useApp();
  const [agreedCheck, setAgreedCheck] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (privacyModal.open) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [privacyModal.open]);

  if (!privacyModal.open) return null;

  const isConsentMode = privacyModal.mode === 'consent';

  const handleAgree = async () => {
    if (!agreedCheck) return;
    setSubmitting(true);
    try {
      await acceptPrivacyPolicy();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-back"
      onClick={isConsentMode ? undefined : closePrivacyPolicy}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacyModalTitle"
    >
      <div
        className="modal privacy-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="privacy-head-title">
            <span className="privacy-ic" aria-hidden="true">
              <ShieldIcon size={22} />
            </span>
            <h2 id="privacyModalTitle">Privacy Policy & Data Notice</h2>
          </div>
          {!isConsentMode && (
            <button
              type="button"
              className="icon-btn"
              onClick={closePrivacyPolicy}
              aria-label="Close"
            >
              <XIcon />
            </button>
          )}
        </div>

        <div className="modal-body privacy-body">
          {/* Reason Banner Required by User */}
          <div className="dpdp-banner">
            <div className="dpdp-badge">
              <ShieldIcon size={14} />
              <span>DPDP Act 2023 Compliance</span>
            </div>
            <div className="dpdp-reason">
              <strong>Why this policy was added:</strong> Due to the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> enacted by the Parliament of India, MyDeepwork provides this statutory notice to inform you of what digital personal data is processed, the specific purposes of processing, and your rights as a Data Principal.
            </div>
          </div>

          <div className="privacy-intro">
            Welcome to <strong>MyDeepwork</strong>. We respect your digital privacy and are committed to safeguarding your personal data in accordance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and applicable Indian data protection principles.
          </div>

          {/* Section 1 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">1. Statutory Background: DPDP Act 2023</h3>
            <p>
              In compliance with Sections 5 and 6 of the <strong>Digital Personal Data Protection Act, 2023</strong>, this notice is furnished prior to or at the time of seeking your consent for processing personal data. MyDeepwork operates as a <em>Data Fiduciary</em> determining the purpose and means of processing data strictly to provide you with personal and collaborative workspace services.
            </p>
          </div>

          {/* Section 2 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">2. Digital Personal Data We Collect</h3>
            <p>We process only the personal data that is strictly necessary for your workspace functionality:</p>
            <ul className="privacy-list">
              <li>
                <strong>Account & Identity Data:</strong> Username, display name, optional profile picture, and securely salted/hashed credentials (passwords or PINs).
              </li>
              <li>
                <strong>Workspace Productivity Content:</strong> Task lists, todo items, formatted notes, freehand ink canvas drawings, and daily personal journal reflections created by you.
              </li>
              <li>
                <strong>Team CRM Records (Optional / Authorized):</strong> Member full names, phone numbers (optional), email addresses, LinkedIn profile URLs, plan stages, and consultation session notes.
              </li>
              <li>
                <strong>Security & System Audit Logs:</strong> Timestamped records of administrative actions (e.g. record creations, edits, deletions, and rollback/undo steps) to guarantee system integrity, prevent data loss, and maintain tamper-proof audit trails.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">3. Specified Purposes for Processing</h3>
            <p>Your digital personal data is processed exclusively for the following specified, legitimate purposes:</p>
            <ul className="privacy-list">
              <li>To provide, operate, maintain, and synchronize your real-time productivity workspace across devices.</li>
              <li>To authenticate your identity, prevent unauthorized access, and protect your account security.</li>
              <li>To facilitate document collaboration and public reading only when you explicitly generate share links.</li>
              <li>To support data recovery, backup snapshots, and instant undo of accidental deletions.</li>
            </ul>
            <div className="privacy-highlight">
              <strong>Our Privacy Pledge:</strong> We <u>never</u> sell, rent, monetize, or trade your personal data. We do not inspect your private documents or journal entries for third-party advertising or public AI training.
            </div>
          </div>

          {/* Section 4 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">4. Data Storage & Technical Security Measures</h3>
            <ul className="privacy-list">
              <li><strong>Transport Security:</strong> All communications between your browser and our servers are encrypted using modern Transport Layer Security (HTTPS / TLS 1.3).</li>
              <li><strong>Credential Protection:</strong> Passwords and PINs are cryptographically hashed using one-way bcrypt with random salt factors. Plaintext passwords are never stored.</li>
              <li><strong>Database Protection:</strong> Data is persisted in isolated, access-controlled MongoDB clusters with automated snapshot backups.</li>
              <li><strong>Data Retention:</strong> Personal data is retained only for as long as your account remains active or until you delete specific items. When an item or account is deleted, it is removed from active databases.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">5. Your Statutory Rights Under the DPDP Act 2023</h3>
            <p>As a Data Principal, the DPDP Act 2023 guarantees you the following legal rights:</p>
            <ul className="privacy-list">
              <li>
                <strong>Right to Access Information:</strong> You have the right to obtain a summary of personal data being processed by us, which is readily visible and exportable in your workspace.
              </li>
              <li>
                <strong>Right to Correction & Erasure:</strong> You can modify or delete your notes, tasks, CRM members, and profile information at any time directly through the user interface.
              </li>
              <li>
                <strong>Right of Grievance Redressal:</strong> You have the right to register concerns or grievances regarding personal data processing with our Data Protection Officer / Administrator.
              </li>
              <li>
                <strong>Right to Nominate:</strong> You have the right to designate another individual to exercise your rights under the DPDP Act 2023 in the event of death or incapacity.
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> You may withdraw your consent at any time by deleting your content, signing out, or requesting complete account deletion from your admin.
              </li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="privacy-sec">
            <h3 className="privacy-sec-title">6. Data Fiduciary Contact & Grievances</h3>
            <p>
              For any queries, privacy concerns, or exercising your statutory rights under the DPDP Act 2023, you can reach out directly:
            </p>
            <div className="privacy-contact-card">
              <div><strong>Service:</strong> MyDeepwork (by WowEvents)</div>
              <div><strong>Domain:</strong> <a href="https://mydeepwork.in" target="_blank" rel="noopener noreferrer">mydeepwork.in</a></div>
              <div><strong>Grievance Officer:</strong> Data Protection Administrator</div>
              <div><strong>Email:</strong> admin@mydeepwork.in</div>
            </div>
          </div>
        </div>

        <div className="modal-foot privacy-foot">
          {isConsentMode ? (
            <div className="privacy-consent-box">
              <label className="privacy-check-label">
                <input
                  type="checkbox"
                  checked={agreedCheck}
                  onChange={e => setAgreedCheck(e.target.checked)}
                />
                <span>
                  I have read and agree to the <strong>Privacy Policy & Data Notice</strong> under the <strong>DPDP Act 2023</strong>.
                </span>
              </label>
              <button
                type="button"
                className="btn-agree"
                disabled={!agreedCheck || submitting}
                onClick={handleAgree}
              >
                <CheckIcon size={18} />
                <span>{submitting ? 'Saving…' : 'I Agree & Continue'}</span>
              </button>
            </div>
          ) : (
            <div className="privacy-view-foot">
              <span className="privacy-updated">Policy Effective: DPDP Act 2023 · Version 1.0</span>
              <button
                type="button"
                className="pill plain"
                onClick={closePrivacyPolicy}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

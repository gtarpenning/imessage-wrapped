"use client";

import { useState } from "react";
import styles from "./UnlockButton.module.css";

export default function UnlockButton({ isUnlocked, isUnlocking, error, onUnlock, onReset, hasContactData = true }) {
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await onUnlock(code);
    if (success) {
      setShowModal(false);
      setCode("");
    }
  };

  const handleLock = () => {
    if (confirm("Are you sure you want to lock contact names again?")) {
      onReset();
    }
  };

  if (isUnlocked) {
    return (
      <div className={styles.unlockBanner}>
        <div className={styles.unlockBannerContent}>
          <span className={styles.unlockBannerIcon}>🔓</span>
          <span className={styles.unlockBannerText}>Contact names visible</span>
          <button 
            onClick={handleLock}
            className={styles.lockButton}
            title="Hide contact names"
          >
            🔒 Lock
          </button>
        </div>
      </div>
    );
  }

  if (!hasContactData) {
    return (
      <div className={styles.unlockBanner} style={{background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'}}>
        <div className={styles.unlockBannerContent}>
          <span className={styles.unlockBannerIcon}>ℹ️</span>
          <span className={styles.unlockBannerText}>Contact names not available - re-analyze with &quot;--with-contacts&quot; or use &quot;Analyze with contacts&quot; in the menu bar app</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.unlockBanner}>
        <div className={styles.unlockBannerContent}>
          <span className={styles.unlockBannerIcon}>🔒</span>
          <span className={styles.unlockBannerText}>Contact names hidden</span>
          <button 
            onClick={() => setShowModal(true)}
            className={styles.unlockButton}
          >
            🔓 Unlock with code
          </button>
        </div>
      </div>

      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.modalClose}
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            
            <h2 className={styles.modalTitle}>🔓 Unlock Contact Names</h2>
            <p className={styles.modalDescription}>
              Enter the 6-character unlock code that was shown when you created this wrapped.
              You can find it in your terminal output or in the menu bar app.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g., ABC123)"
                className={styles.codeInput}
                maxLength={6}
                autoFocus
                disabled={isUnlocking}
              />

              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={styles.cancelButton}
                  disabled={isUnlocking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isUnlocking || code.length !== 6}
                >
                  {isUnlocking ? "Unlocking..." : "Unlock"}
                </button>
              </div>
            </form>

            <div className={styles.modalFooter}>
              <small>
                🔒 Your unlock code is only known to you and is never shared.
              </small>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


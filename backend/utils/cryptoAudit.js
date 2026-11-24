'use strict';

const crypto = require('crypto');

/**
 * Generates a SHA-256 hash-chain block for a single audit event.
 *
 * @param {object} opts
 * @param {string} opts.action          - Human-readable lifecycle event, e.g. 'ISSUE_CREATED'
 * @param {string} opts.actorId         - MongoDB _id of the user performing the action
 * @param {string} opts.actorRole       - Role of that user ('citizen', 'sub-admin', 'super-admin')
 * @param {string} [opts.previousHash]  - currentHash of the preceding block; 'GENESIS' for block 0
 * @returns {{ action, timestamp, actorId, actorRole, previousHash, currentHash }}
 */
function generateAuditEntry({ action, actorId, actorRole, previousHash = 'GENESIS' }) {
  const timestamp = new Date().toISOString();

  // Deterministic payload — field order must stay stable for verification
  const payload = `${action}|${timestamp}|${actorId}|${actorRole}|${previousHash}`;

  const currentHash = crypto.createHash('sha256').update(payload).digest('hex');

  return {
    action,
    timestamp,
    actorId:      String(actorId),
    actorRole,
    previousHash,
    currentHash,
  };
}

/**
 * Verifies the mathematical integrity of an issue's complete audit chain.
 *
 * Checks two invariants for every block i:
 *   1. block[i].previousHash === (i === 0 ? 'GENESIS' : block[i-1].currentHash)
 *   2. SHA-256( action|timestamp|actorId|actorRole|previousHash ) === block[i].currentHash
 *
 * @param {Array} auditLogs - The issue.auditLogs array from MongoDB
 * @returns {{ valid: boolean, brokenAt: number|null, reason: string|null }}
 */
function verifyAuditChain(auditLogs = []) {
  if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
    return { valid: true, brokenAt: null, reason: null };
  }

  for (let i = 0; i < auditLogs.length; i++) {
    const block = auditLogs[i];
    const expectedPrevious = i === 0 ? 'GENESIS' : auditLogs[i - 1].currentHash;

    // ── Link integrity ──────────────────────────────────────────────────────
    if (block.previousHash !== expectedPrevious) {
      return {
        valid:    false,
        brokenAt: i,
        reason:   `Block ${i}: previousHash mismatch — chain link broken`,
      };
    }

    // ── Content integrity ───────────────────────────────────────────────────
    const payload = [
      block.action,
      new Date(block.timestamp).toISOString(), // normalise timezone drift
      String(block.actorId),
      block.actorRole,
      block.previousHash,
    ].join('|');

    const recomputed = crypto.createHash('sha256').update(payload).digest('hex');

    if (recomputed !== block.currentHash) {
      return {
        valid:    false,
        brokenAt: i,
        reason:   `Block ${i}: hash mismatch — data may have been modified directly in the database`,
      };
    }
  }

  return { valid: true, brokenAt: null, reason: null };
}

module.exports = { generateAuditEntry, verifyAuditChain };

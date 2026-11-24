const mongoose = require('mongoose');
const { Issue } = require('../models');
const { Notification } = require('../models');
const { User } = require('../models');
const { generateAuditEntry } = require('../utils/cryptoAudit');

/**
 * SLA Escalation Worker
 * 
 * Runs periodically to check for overdue tickets where:
 * - status !== 'Solved'
 * - Date.now() > slaDeadline
 * 
 * When found:
 * 1. Updates issue status to 'Escalated'
 * 2. Sets isEscalated = true
 * 3. Records escalatedAt timestamp
 * 4. Notifies Super Admins
 * 5. Records an SLA breach audit block
 */

async function checkSLABreaches() {
  try {
    const now = new Date();

    // Find all overdue, non-resolved issues
    const overdueIssues = await Issue.find({
      status: { $ne: 'Solved' },
      slaDeadline: { $lt: now },
      isEscalated: false, // Only escalate once
    });

    console.log(`[SLA Worker] Found ${overdueIssues.length} overdue issues to escalate`);

    if (overdueIssues.length === 0) {
      return;
    }

    // Find all super-admins to notify
    const superAdmins = await User.find({ role: 'super-admin' });

    for (const issue of overdueIssues) {
      // Update issue status
      issue.status = 'Escalated';
      issue.isEscalated = true;
      issue.escalatedAt = now;

      // Add audit log
      const lastHash = issue.auditLogs.length
        ? issue.auditLogs[issue.auditLogs.length - 1].currentHash
        : 'GENESIS';

      issue.auditLogs.push(generateAuditEntry({
        action:       'SLA_BREACH_ESCALATED',
        actorId:      'SYSTEM',
        actorRole:    'AUTOMATED_WORKER',
        previousHash: lastHash,
      }));

      await issue.save();

      console.log(`[SLA Worker] Escalated issue ${issue._id} (SLA deadline: ${issue.slaDeadline})`);

      // Notify super-admins
      for (const admin of superAdmins) {
        await Notification.create({
          userId: admin._id,
          type: 'escalation',
          text: `⚠️ SLA BREACH: Issue "${issue.title}" has exceeded its deadline and has been auto-escalated. Priority: ${issue.severityLevel}`,
          issueId: issue._id,
        }).catch((err) => console.error('[SLA Worker] Failed to create notification:', err.message));
      }
    }

    console.log(`[SLA Worker] Escalation complete for ${overdueIssues.length} issues`);
  } catch (error) {
    console.error('[SLA Worker] Error:', error.message);
  }
}

/**
 * Start the SLA worker as an in-process interval.
 * Called by server.js after app.listen() — mongoose is already connected at that point.
 * @returns {NodeJS.Timeout} The interval handle (useful for cleanup in tests).
 */
function startSlaWorker() {
  console.log('[SLA Worker] Starting in-process SLA escalation worker (15 min interval)');
  checkSLABreaches();
  const id = setInterval(checkSLABreaches, 15 * 60 * 1000);
  return id;
}

// Run immediately if called directly (standalone mode)
if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('[SLA Worker] Connected to MongoDB');
      return checkSLABreaches();
    })
    .then(() => mongoose.disconnect())
    .then(() => {
      console.log('[SLA Worker] Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { checkSLABreaches, startSlaWorker };

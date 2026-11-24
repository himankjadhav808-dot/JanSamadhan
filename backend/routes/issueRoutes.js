const express = require('express');
const {
  createIssue,
  getNearbyIssues,
  toggleVote,
  getAssignedQueue,
  getIssueById,
  validateResolution,
  searchIssues,
  getMyIssues,
  addComment,
  deleteComment,
  toggleCommentLike,
  getIssueAudit,
} = require('../controllers/issueController');
const { resolveIssue } = require('../controllers/resolutionController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createIssue);
router.get('/nearby', getNearbyIssues);
router.get('/search', searchIssues);
router.get('/my-issues', protect, getMyIssues);       // ← before /:id
router.get('/queue', protect, authorizeRoles('sub-admin', 'super-admin'), getAssignedQueue);
router.get('/:id', getIssueById);
router.get('/:id/audit', getIssueAudit);              // public — read-only chain verification
router.put('/:id/vote', protect, toggleVote);
router.post('/:id/resolve', protect, authorizeRoles('sub-admin', 'super-admin'), resolveIssue);
router.put('/:id/validate', protect, authorizeRoles('citizen'), validateResolution);
router.post('/:id/comments', protect, addComment);
router.delete('/:issueId/comments/:commentId', protect, deleteComment);
router.post('/:issueId/comments/:commentId/like', protect, toggleCommentLike);

module.exports = router;

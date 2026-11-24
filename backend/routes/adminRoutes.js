const express = require('express');
const { getAdminStats, createSubAdmin, getSubAdmins, getAllIssues, updateSubAdmin } = require('../controllers/adminController');
const { wipeAllIssues: wipeAllIssuesFromIssues } = require('../controllers/issueController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/stats', protect, authorizeRoles('super-admin'), getAdminStats);
router.post('/subadmins', protect, authorizeRoles('super-admin'), createSubAdmin);
router.get('/subadmins', protect, authorizeRoles('super-admin'), getSubAdmins);
router.put('/subadmins/:id', protect, authorizeRoles('super-admin'), updateSubAdmin);
router.get('/issues/all', protect, authorizeRoles('super-admin'), getAllIssues);
router.delete('/issues/wipe', protect, authorizeRoles('super-admin'), wipeAllIssuesFromIssues);

module.exports = router;

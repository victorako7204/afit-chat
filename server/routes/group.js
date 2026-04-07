const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  createGroup,
  getGroups,
  getGroup,
  joinGroup,
  joinByInvite,
  leaveGroup,
  deleteGroup,
  getMyGroups,
  toggleLock,
  makeAdmin,
  regenerateInviteCode,
  updateGroup
} = require('../controllers/groupController');

router.post('/', auth, createGroup);
router.get('/', auth, getGroups);
router.get('/my', auth, getMyGroups);
router.get('/:id', auth, getGroup);
router.post('/join-by-invite', auth, joinByInvite);
router.put('/:id/join', auth, joinGroup);
router.put('/:id/leave', auth, leaveGroup);
router.put('/:id/toggle-lock', auth, toggleLock);
router.put('/:id/make-admin', auth, makeAdmin);
router.put('/:id/regenerate-code', auth, regenerateInviteCode);
router.put('/:id', auth, updateGroup);
router.delete('/:id', auth, deleteGroup);

module.exports = router;

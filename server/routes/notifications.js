const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const webpush = require('web-push');
const {
  announce,
  getNotifications,
  markAsRead,
  markAllAsRead,
  createLostFoundNotification
} = require('../controllers/NotificationController');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || 'admin@afit-chat.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

router.get('/', auth, getNotifications);
router.post('/announce', auth, announce);
router.post('/lost-found', auth, createLostFoundNotification);
router.put('/:notificationId/read', auth, markAsRead);
router.put('/read-all', auth, markAllAsRead);

router.post('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    await PushSubscription.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        endpoint,
        keys
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Failed to save subscription' });
  }
});

router.delete('/unsubscribe', auth, async (req, res) => {
  try {
    await PushSubscription.deleteOne({ userId: req.user.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to remove subscription' });
  }
});

const sendPushNotification = async (userId, payload) => {
  try {
    const subscription = await PushSubscription.findOne({ userId });
    
    if (!subscription) {
      return false;
    }

    await webpush.sendNotification(subscription.toJSON(), JSON.stringify(payload));
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
      return false;
    }
    console.error('Push notification error:', error);
    return false;
  }
};

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;

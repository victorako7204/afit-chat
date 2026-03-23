const Notification = require('../models/Notification');

const announce = async (req, res, next) => {
  try {
    const { title, message, type } = req.body;
    const userId = req.user._id;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const notificationType = type || 'ANNOUNCEMENT';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const notification = new Notification({
      type: notificationType,
      title,
      message,
      sender: userId,
      senderName: req.user.name,
      isGlobal: true,
      expiresAt
    });

    await notification.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('globalAnnouncement', {
        id: notification._id,
        title,
        message,
        type: notificationType,
        sender: req.user.name,
        createdAt: notification.createdAt
      });

      io.emit('newNotification', {
        id: notification._id,
        type: notificationType,
        title,
        message,
        isGlobal: true
      });
    }

    res.status(201).json({
      message: 'Announcement sent successfully',
      notification
    });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { limit = 50 } = req.query;

    const notifications = await Notification.getUserNotifications(userId, parseInt(limit));
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await Notification.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

const createLostFoundNotification = async (req, res, next) => {
  try {
    const { description, itemType } = req.body;
    const userId = req.user._id;

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const notification = await Notification.createLostFound(
      userId,
      req.user.name,
      itemType || 'lost',
      description
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('globalAnnouncement', {
        id: notification._id,
        title: itemType === 'lost' ? 'Item Lost' : 'Item Found',
        message: `${req.user.name} reported: ${description}`,
        type: 'LOST_FOUND',
        sender: req.user.name,
        createdAt: notification.createdAt
      });
    }

    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  announce,
  getNotifications,
  markAsRead,
  markAllAsRead,
  createLostFoundNotification
};

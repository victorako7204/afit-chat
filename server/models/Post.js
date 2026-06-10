const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    required: true,
    maxLength: 500
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
});

const postSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    required: true,
    maxLength: 500
  },
  image: {
    type: String,
    default: null
  },
  imagePublicId: {
    type: String,
    default: null
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  department: {
    type: String,
    default: ''
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  commentCount: {
    type: Number,
    default: 0
  },
  comments: [commentSchema],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  replyToAuthor: {
    type: String,
    default: null
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ authorId: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ department: 1, isDeleted: 1, createdAt: -1 });

postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

postSchema.methods.softDelete = async function(userId, isAdmin = false) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
  return this;
};

postSchema.methods.addComment = async function(data) {
  this.comments.push({
    authorId: data.authorId,
    authorName: data.authorName || '',
    content: data.content,
    isAnonymous: data.isAnonymous || false,
    createdAt: new Date()
  });
  this.commentCount = this.comments.length;
  await this.save();
  return this.comments[this.comments.length - 1];
};

postSchema.methods.removeComment = async function(commentId, userId, isAdmin = false) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.code = 'COMMENT_NOT_FOUND';
    throw err;
  }
  if (String(comment.authorId) !== String(userId) && !isAdmin) {
    const err = new Error('Not authorized to delete this comment');
    err.code = 'NOT_AUTHORIZED';
    throw err;
  }
  comment.isDeleted = true;
  this.commentCount = this.comments.filter(c => !c.isDeleted).length;
  await this.save();
  return comment;
};

postSchema.methods.toggleLike = async function(userId) {
  const idx = this.likes.findIndex(id => String(id) === String(userId));
  if (idx > -1) {
    this.likes.splice(idx, 1);
  } else {
    this.likes.push(userId);
  }
  await this.save();
  return {
    likeCount: this.likes.length,
    isLikedByUser: idx === -1
  };
};

postSchema.methods.editPost = async function(newContent, userId) {
  if (String(this.authorId) !== String(userId)) {
    const err = new Error('Not authorized to edit this post');
    err.code = 'NOT_AUTHORIZED';
    throw err;
  }
  const fifteenMin = 15 * 60 * 1000;
  const postAge = Date.now() - new Date(this.createdAt).getTime();
  if (postAge > fifteenMin) {
    const err = new Error('Cannot edit posts older than 15 minutes');
    err.code = 'EDIT_WINDOW_EXPIRED';
    throw err;
  }
  this.content = newContent.trim();
  this.editedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('Post', postSchema);

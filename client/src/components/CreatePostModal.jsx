import React, { useState, useRef, useCallback } from 'react';
import { X, Image, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1200;

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_IMAGE_WIDTH) {
          height = (height * MAX_IMAGE_WIDTH) / width;
          width = MAX_IMAGE_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image compression failed'));
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const CreatePostModal = ({ isOpen, onClose, onSubmit, user, isSubmitting }) => {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const handleClose = useCallback(() => {
    setContent('');
    setIsAnonymous(false);
    setImageFile(null);
    setImagePreview(null);
    setErrors({});
    onClose();
  }, [onClose]);

  const validate = () => {
    const errs = {};
    if (!content.trim() && !imageFile) {
      errs.content = 'Add text or an image to post';
    }
    if (content.length > 500) {
      errs.content = 'Maximum 500 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrors({ image: 'Image must be under 5MB' });
      return;
    }

    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
      setErrors({});
    } catch {
      setErrors({ image: 'Failed to process image' });
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    const formData = {
      content: content.trim(),
      isAnonymous,
      image: null
    };

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        formData.image = reader.result;
        await onSubmit(formData, () => handleClose());
      };
      reader.readAsDataURL(imageFile);
    } else {
      await onSubmit(formData, () => handleClose());
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[500px] rounded-t-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={handleClose} className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <span className="text-sm font-semibold">New Post</span>
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && !imageFile) || isSubmitting}
            className="text-sm font-semibold"
            style={{ color: (content.trim() || imageFile) ? 'var(--accent)' : 'var(--text-tertiary)' }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Share'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                {user?.name?.[0] || 'U'}
              </div>
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1 w-full resize-none text-sm leading-relaxed bg-transparent border-none outline-none"
                style={{ color: 'var(--text-primary)', minHeight: 120 }}
                rows={5}
                maxLength={500}
              />
              <div className="text-right text-xs mt-1" style={{ color: content.length > 450 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                {content.length}/500
              </div>
              {errors.content && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.content}</p>
              )}
            </div>
          </div>

          {imagePreview && (
            <div className="relative mt-3 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1 rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {errors.image && (
            <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.image}</p>
          )}

          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Image size={20} />
                Add Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-9 h-5 rounded-full transition-colors relative ${isAnonymous ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
              Anonymous
            </label>
          </div>
        </form>
      </div>
    </div>
  );
};

export default React.memo(CreatePostModal);

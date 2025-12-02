const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../prisma');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const isRenderProd =
  process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

const AUTH_COOKIE_NAME = 'token';

function getAuthCookieClearOptions() {
  if (!isRenderProd) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    };
  }

  const base = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  };

  const domain = process.env.COOKIE_DOMAIN;
  if (domain) {
    return { ...base, domain };
  }

  return base;
}

// every chat route needs login
router.use(requireAuth);

router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'user is protected and working',
    userId: req.user.id,
  });
});

// Update save history preference
router.patch('/save-history', async (req, res) => {
  const { saveHistoryEnabled } = req.body || {};

  if (typeof saveHistoryEnabled !== 'boolean') {
    return res.status(400).json({ message: 'Invalid value for saveHistoryEnabled' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { saveHistoryEnabled },
    });

    return res.json({
      message: 'Save history preference updated',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
        saveHistoryEnabled: updatedUser.saveHistoryEnabled,
      },
    });
  } catch (err) {
    console.error('Error updating save history preference:', err);
    return res.status(500).json({ message: 'Failed to update save history preference' });
  }
});

// Ensure uploads directory exists (server/uploads)
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const original = file.originalname || 'upload.jpg';
    let ext = path.extname(original).toLowerCase();
    const validExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    if (!validExts.has(ext)) {
      ext = '.jpg';
    }
    const baseSource = file.originalname || 'upload';
    const base = (path.basename(baseSource, path.extname(baseSource)) || 'upload').replace(/[^a-z0-9_-]/gi, '') || 'upload';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`;
    cb(null, name);
  },
});

const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
function fileFilter(req, file, cb) {
  try {
    let mime = (file.mimetype || '').toLowerCase();
    const name = file.originalname || '';
    const looksLikeHeic = /\.(heic|heif)$/i.test(name);

    // Normalize unknown or generic mimetypes coming from iOS
    if (!mime || mime === 'application/octet-stream' || mime === 'image/blob') {
      if (looksLikeHeic) {
        mime = 'image/jpeg';
      }
    }

    if (looksLikeHeic) {
      mime = 'image/jpeg';
    }

    if (mime) {
      file.mimetype = mime;
    }

    if (!mime || !mime.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }

    if (!allowed.has(mime)) {
      return cb(new Error('Only JPEG, PNG or WEBP images are allowed'));
    }

    return cb(null, true);
  } catch (e) {
    return cb(new Error('Only image uploads are allowed'));
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const relativePath = `/uploads/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl: relativePath },
    });

    return res.json({
      message: 'Photo uploaded',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
        createdAt: updatedUser.createdAt,
        saveHistoryEnabled: updatedUser.saveHistoryEnabled,
        photoUrl: updatedUser.photoUrl,
      },
    });
  } catch (err) {
    console.error('Upload photo error:', err);
    return res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// Update profile (name)
router.patch('/profile', async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
    });
    return res.json({
      message: 'Profile updated',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
        createdAt: updatedUser.createdAt,
        saveHistoryEnabled: updatedUser.saveHistoryEnabled,
        photoUrl: updatedUser.photoUrl,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Change password
router.patch('/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All password fields are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New password and confirmation do not match' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Failed to update password' });
  }
});

// Export all user data (GDPR-style JSON export)
router.get('/export', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let messages = [];
    if (user.saveHistoryEnabled) {
      messages = await prisma.message.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          characterId: true,
          content: true, // decrypted transparently by Prisma middleware
          createdAt: true,
        },
      });
    }

    const usage = await prisma.usage.findMany({ where: { userId: user.id } });

    const exportPayload = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.createdAt,
        saveHistoryEnabled: user.saveHistoryEnabled,
        photoUrl: user.photoUrl,
      },
      messages,
      usage,
    };

    const json = JSON.stringify(exportPayload, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="asrarai-data-export.json"'
    );
    return res.status(200).send(json);
  } catch (err) {
    console.error('User export error:', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to export data' });
  }
});

// Delete account and all related data (messages, usage, avatar file)
router.delete('/delete', async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'DELETE') {
    return res.status(400).json({ message: 'Confirmation must be "DELETE"' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete DB records in a single transaction
    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { userId: user.id } });
      await tx.usage.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });

    // Best-effort avatar cleanup (outside the transaction)
    try {
      if (user.photoUrl && typeof user.photoUrl === 'string') {
        const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
        let relative = user.photoUrl;
        if (relative.startsWith('/uploads/')) {
          relative = relative.replace('/uploads/', '');
        } else if (relative.startsWith('uploads/')) {
          relative = relative.replace('uploads/', '');
        }
        const filePath = path.join(uploadsRoot, relative);
        if (filePath.startsWith(uploadsRoot)) {
          fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('Failed to delete avatar file:', err.message || err);
            }
          });
        }
      }
    } catch (fileErr) {
      console.error('Avatar cleanup error:', fileErr && fileErr.message ? fileErr.message : fileErr);
    }

    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
    return res.json({ success: true, message: 'Account and all data deleted.' });
  } catch (err) {
    console.error('Delete account+data error:', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to delete account and data' });
  }
});

module.exports = router;

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure documents directory exists
const documentsDir = path.join(__dirname, '../../documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, documentsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter - accept images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|webp)$/i;
  const allowedMimeTypes = /^(image\/(jpeg|jpg|png|gif|webp|x-png)|application\/pdf)$/i;
  
  const extname = allowedExtensions.test(path.extname(file.originalname));
  // Check mimetype if it exists, otherwise just check extension
  const mimetype = file.mimetype ? allowedMimeTypes.test(file.mimetype) : false;

  // Accept if extension is valid OR mimetype is valid (lenient for webcam captures)
  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error(`Only image files (jpeg, jpg, png, gif, webp) and PDF files are allowed! Got: ${file.mimetype || 'no mimetype'}, extension: ${path.extname(file.originalname)}`));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;


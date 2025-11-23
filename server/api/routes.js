const express = require("express");
const router = express.Router();
const passport = require("passport");
const upload = require("../config/upload");
const { notFound, home } = require("./controllers/home");
const {
  register,
  login,
  getClientData,
  getBankList,
  request,
  updateRecord,
  updateSocket,
  getSocket,
  getBankProfile,
  getBankRequests,
  createBankRequest,
  accessClientData,
} = require("./controllers/userController");

router.get("/", home);
// Register with file upload support (3 files: panFile, aadharFile, selfieFile)
router.post("/register", (req, res, next) => {
  upload.fields([
    { name: 'panFile', maxCount: 1 },
    { name: 'aadharFile', maxCount: 1 },
    { name: 'selfieFile', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      // Handle multer errors
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
        error: err.code || 'UPLOAD_ERROR'
      });
    }
    next();
  });
}, register);
router.post("/login", login);
router.get("/getClientData",passport.authenticate("jwt", { session: false }),getClientData);
router.get("/getBankList", passport.authenticate("jwt", { session: false }), getBankList);
router.post("/request", passport.authenticate("jwt", { session: false }), request);
// Update record with file upload support
router.post("/updateRecord", passport.authenticate("jwt", { session: false }), upload.fields([
  { name: 'documentFile', maxCount: 1 }
]), updateRecord);
// Upload documents endpoint for banks
router.post("/uploadDocuments", upload.fields([
  { name: 'panFile', maxCount: 1 },
  { name: 'aadharFile', maxCount: 1 }
]), (req, res) => {
  try {
    const panPath = req.files?.panFile ? `/documents/${req.files.panFile[0].filename}` : null;
    const aadharPath = req.files?.aadharFile ? `/documents/${req.files.aadharFile[0].filename}` : null;
    
    res.status(200).json({
      success: true,
      panPath,
      aadharPath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.post("/updateSocket", passport.authenticate("jwt", { session: false }), updateSocket);
router.post("/getSocket", getSocket);
router.get("/bank/profile", passport.authenticate("jwt", { session: false }), getBankProfile);
router.get("/bank/requests", passport.authenticate("jwt", { session: false }), getBankRequests);
router.post("/bank/request", passport.authenticate("jwt", { session: false }), createBankRequest);
router.post("/bank/access", passport.authenticate("jwt", { session: false }), accessClientData);


router.get("*", notFound);

module.exports = router;

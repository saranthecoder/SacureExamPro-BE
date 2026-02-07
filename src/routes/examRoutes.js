const express = require("express");
const router = express.Router();
const multer = require("multer");
const isAdmin = require("../middleware/adminMiddleware");
const {
  createExam,
  submitExam,
  getExamByCode,
    getAllExams
} = require("../controller/examController");

const upload = multer({ dest: "uploads/" });

router.post(
  "/create",
  upload.single("file"),
  createExam
);

router.get("/all", getAllExams);

// 🔥 Student fetch questions
router.get(
  "/:examCode",
  getExamByCode
);

// 🔥 Student submit
router.post(
  "/submit/:examCode",
  submitExam
);

module.exports = router;

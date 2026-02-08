const mongoose = require("mongoose");
const Exam = require("../models/Exam");
// const resultSchema = require("../models/Result");
const XLSX = require("xlsx");
const fs = require("fs");

exports.createExam = async (req, res) => {
  try {
    const { title, examCode, duration, startTime, endTime, adminEmail } = req.body;

    examCodeUpper = examCode.toUpperCase().trim();

    // 🔥 Check if examCode already exists
    const existingExam = await Exam.findOne({ examCode: examCodeUpper });

    if (existingExam) {
      return res.status(400).json({
        message: "Exam code already exists. Please use a different code."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Excel file is required"
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const questions = data.map(q => ({
      question: q["Question"],
      options: {
        A: q["Option A"],
        B: q["Option B"],
        C: q["Option C"],
        D: q["Option D"]
      },
      correctAnswer: q["Correct Answer"],
      marks: q["Marks"]
    }));

    const exam = await Exam.create({
      title,
      examCode: examCodeUpper,
      duration,
      startTime,
      endTime,
      questions,
      createdBy: adminEmail
    });

    fs.unlinkSync(req.file.path);

    res.status(201).json({ message: "Exam created", exam });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Exam code already exists. Please choose a different code."
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// 🔥 GET ALL EXAMS
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: exams.length,
      exams
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getExamByCode = async (req, res) => {
  try {
    const { examCode } = req.params;
    const { email } = req.query;

    const exam = await Exam.findOne({ examCode });

    if (!exam)
      return res.status(404).json({ message: "Exam not found" });

    const now = new Date();

    if (now < exam.startTime)
      return res.status(400).json({ message: "Exam not started yet" });

    if (now > exam.endTime)
      return res.status(400).json({ message: "Exam ended" });

    // ===============================
    // 🔥 DYNAMIC COLLECTION CHECK
    // ===============================

    if (email) {
      const collectionName = `${examCode}_results`;

      const resultCollection = mongoose.connection.collection(collectionName);

      const existingResult = await resultCollection.findOne({
        studentEmail: email,
      });

      if (existingResult) {
        return res.status(403).json({
          message: "You have already submitted this exam.",
        });
      }
    }


    // ===============================
    // Send Questions (without answers)
    // ===============================

    const questionsForStudent = exam.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
    }));

    res.json({
      title: exam.title,
      duration: exam.duration,
      examCode: exam.examCode,
      questions: questionsForStudent,
    });
  } catch (error) {
    console.error("Error fetching exam:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.submitExam = async (req, res) => {
  try {
    const { examCode } = req.params;

    const {
      answers,
      studentName,
      studentEmail,
      terminated = false,
      tabSwitched = false,
      tabSwitchCount = 0
    } = req.body;


    const exam = await Exam.findOne({ examCode });

    if (!exam)
      return res.status(404).json({ message: "Exam not found" });

    const now = new Date();

    if (now < exam.startTime)
      return res.status(400).json({ message: "Exam not started yet" });

    if (now > exam.endTime)
      return res.status(400).json({ message: "Exam ended" });

    let score = 0;
    let totalMarks = 0;

    exam.questions.forEach(q => {
      totalMarks += q.marks;

      const ans = answers.find(
        a => a.questionId === q._id.toString()
      );

      if (ans && ans.selectedOption === q.correctAnswer) {
        score += q.marks;
      }
    });

    // 🔥 Auto-terminate rule (optional)
    let finalTerminated = terminated;

    if (tabSwitchCount >= 3) {
      finalTerminated = true;
    }

    // 🔥 Dynamic Schema with Anti-cheating fields
    const resultSchema = new mongoose.Schema({
      studentName: {
        type: String,
        required: true
      },
      studentEmail: String,
      answers: [{
        questionId: mongoose.Schema.Types.ObjectId,
        selectedOption: String
      }],
      score: Number,
      totalMarks: Number,
      terminated: {
        type: Boolean,
        default: false
      },
      tabSwitched: {
        type: Boolean,
        default: false
      },
      tabSwitchCount: {
        type: Number,
        default: 0
      },
      submittedAt: Date
    }, { timestamps: true });

    const collectionName = `${examCode}_results`;

    const DynamicResult =
      mongoose.models[collectionName] ||
      mongoose.model(collectionName, resultSchema, collectionName);

    // 🔥 Prevent Duplicate Submission
    const alreadySubmitted = await DynamicResult.findOne({
      studentEmail
    });

    if (alreadySubmitted)
      return res.status(400).json({ message: "Already submitted" });

    await DynamicResult.create({
      studentName,
      studentEmail,
      answers,
      score,
      totalMarks,
      terminated: finalTerminated,
      tabSwitched,
      tabSwitchCount,
      submittedAt: new Date()
    });

    res.json({
      message: "Exam submitted successfully",
      score,
      totalMarks,
      terminated: finalTerminated,
      storedIn: collectionName
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};




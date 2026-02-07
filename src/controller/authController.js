const User = require("../models/User");

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    res.status(201).json({
      message: "User created",
      user
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.password !== password)
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      message: "Login successful",
      user
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


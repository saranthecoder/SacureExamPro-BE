const User = require("../models/User");

const isAdmin = async (req, res, next) => {
  const { adminEmail } = req.body;

  const user = await User.findOne({ email: adminEmail });

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }

  next();
};

module.exports = isAdmin;

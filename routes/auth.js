const express = require("express");
const User = require("../models/User");
const {
  normalizeEmail,
  isAllowedEmail,
  hashPassword,
  verifyPassword,
} = require("../utils/password");

const router = express.Router();
const SYSTEM_ROLES = {
  "vishalroy2574@gmail.com": "admin",
  "nilesh23@gmail.com": "authority",
};

function homeForRole(role) {
  if (role === "admin" || role === "authority") {
    return "/authority";
  }
  return "/dashboard";
}

function renderLogin(res, extras = {}) {
  return res.status(extras.status || 200).render("login", {
    title: "Multi Model Road Damage Detection Reporting And Monitoring",
    error: extras.error || "",
    info: extras.info || "",
  });
}

function startSession(req, user) {
  const normalizedEmail = normalizeEmail(user.emailId);
  req.session.user = {
    userId: normalizedEmail,
    emailId: normalizedEmail,
    name: user.name || user.emailId.split("@")[0],
    role: SYSTEM_ROLES[normalizedEmail] || user.role || "user",
    isActive: user.isActive !== false,
  };
}

router.get("/login", (req, res) => {
  if (req.session?.user) {
    return res.redirect(homeForRole(req.session.user.role));
  }
  return renderLogin(res);
});

router.post("/signup", async (req, res) => {
  try {
    if (req.session?.user) {
      return res.redirect(homeForRole(req.session.user.role));
    }

    const email = normalizeEmail(req.body?.emailId);
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim();

    if (!email || !password) {
      return renderLogin(res, { status: 400, error: "Email and password are required." });
    }
    if (!isAllowedEmail(email)) {
      return renderLogin(res, { status: 400, error: "Only @gmail.com addresses are allowed." });
    }
    if (password.length < 6) {
      return renderLogin(res, { status: 400, error: "Password must be at least 6 characters." });
    }

    const exists = await User.findOne({ emailId: email });
    if (exists) {
      return renderLogin(res, { status: 400, error: "An account with that email already exists." });
    }

    const user = await User.create({
      userId: email,
      emailId: email,
      name: name || email.split("@")[0],
      passwordHash: hashPassword(password),
      role: "user",
    });

    startSession(req, user);
    return res.redirect(homeForRole(req.session.user.role));
  } catch (err) {
    console.error(err);
    return renderLogin(res, { status: 500, error: "Could not create account right now." });
  }
});

router.post("/login", async (req, res) => {
  try {
    if (req.session?.user) {
      return res.redirect(homeForRole(req.session.user.role));
    }

    const email = normalizeEmail(req.body?.emailId);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return renderLogin(res, { status: 400, error: "Email and password are required." });
    }
    if (!isAllowedEmail(email)) {
      return renderLogin(res, { status: 400, error: "Only @gmail.com addresses are allowed." });
    }

    const user = await User.findOne({ emailId: email });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return renderLogin(res, { status: 400, error: "Invalid email or password." });
    }
    if (user.isActive === false) {
      return renderLogin(res, { status: 403, error: "This account is suspended." });
    }

    const role = SYSTEM_ROLES[email] || user.role || "user";
    if (user.role !== role) {
      user.role = role;
      await user.save();
    }

    startSession(req, user);
    return res.redirect(homeForRole(req.session.user.role));
  } catch (err) {
    console.error(err);
    return renderLogin(res, { status: 500, error: "Could not log you in right now." });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

router.get("/auth/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json(null);
  }
  return res.json(req.session.user);
});

module.exports = router;

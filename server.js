const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");
const config = require("./config");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const { requireUser } = require("./middleware/requireUser");
const { requireRole } = require("./middleware/requireRole");
const User = require("./models/User");
const Report = require("./models/Report");
const { formatReport } = require("./utils/formatReport");
const { compareReportsByReviewPriority } = require("./utils/sortReports");
const { hashPassword, normalizeEmail } = require("./utils/password");

const ADMIN_EMAIL = normalizeEmail("vishalroy2574@gmail.com");
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "vishalroy2574";
const AUTHORITY_EMAIL = normalizeEmail("nilesh23@gmail.com");

function systemRoleFor(email) {
  const normalized = normalizeEmail(email);
  if (normalized === ADMIN_EMAIL) return "admin";
  if (normalized === AUTHORITY_EMAIL) return "authority";
  return null;
}

async function ensureAdminAccount() {
  await User.findOneAndUpdate(
    { emailId: ADMIN_EMAIL },
    {
      $set: {
        userId: ADMIN_EMAIL,
        emailId: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureAuthorityAccount() {
  await User.findOneAndUpdate(
    { emailId: AUTHORITY_EMAIL },
    {
      $set: {
        userId: AUTHORITY_EMAIL,
        emailId: AUTHORITY_EMAIL,
        role: "authority",
        isActive: true,
      },
      $setOnInsert: {
        name: "nilesh23",
        passwordHash: hashPassword("Authority@123"),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  })
);

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.mongoUri,
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true },
  })
);

app.use(async (req, res, next) => {
  if (!req.session?.user?.emailId) {
    return next();
  }

  try {
    const currentUser = await User.findOne({ emailId: req.session.user.emailId }).select("role isActive");
    if (currentUser && currentUser.isActive === false) {
      return req.session.destroy(() => res.redirect("/login"));
    }

    const role = systemRoleFor(req.session.user.emailId) || currentUser?.role || req.session.user.role;
    if (role && req.session.user.role !== role) {
      req.session.user.role = role;
    }
    if (currentUser && currentUser.role !== role) {
      await User.updateOne({ emailId: req.session.user.emailId }, { $set: { role, isActive: true } });
    }
  } catch (err) {
    console.error("Failed to sync system role:", err.message);
  }

  next();
});

app.use((req, res, next) => {
  res.locals.appUrl = config.appBaseUrl();
  res.locals.user = req.session?.user || null;
  next();
});

app.use(authRoutes);
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  if (req.session?.user) {
    const role = req.session.user.role;
    if (role === "admin" || role === "authority") {
      return res.redirect("/authority");
    }
    return res.redirect("/dashboard");
  }
  return res.redirect("/home/index.html");
});

app.get("/home", (_req, res) => {
  return res.redirect("/home/index.html");
});

app.get("/dashboard", requireUser, async (req, res) => {
  try {
    const rows = await Report.find({});
    rows.sort(compareReportsByReviewPriority);
    res.render("dashboard", {
      title: "All Reports",
      reports: rows.map(formatReport),
    });
  } catch (e) {
    console.error(e);
    res.status(500).render("error", { title: "Error", message: "Could not load reports." });
  }
});

app.get("/authority", requireRole(["authority", "admin"]), async (req, res) => {
  try {
    const rows = await Report.find({});
    rows.sort(compareReportsByReviewPriority);
    const uniqueIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    const reporterUsers = await User.find({ userId: { $in: uniqueIds } }).select("userId emailId name role");
    const usersById = new Map(reporterUsers.map((u) => [u.userId, u]));
    const reports = rows.map((report) => {
      const formatted = formatReport(report);
      const user = usersById.get(report.userId);
      return {
        ...formatted,
        reporterName: user?.name || (report.userId ? report.userId.split("@")[0] : "Unknown"),
        reporterEmail: user?.emailId || report.userId,
        reporterRole: user?.role || "user",
      };
    });
    const pendingCount = reports.filter((r) => r.status !== "completed" && r.status !== "cancelled").length;
    const approvedCount = reports.filter((r) => r.status === "approved").length;
    const workingCount = reports.filter((r) => r.status === "working").length;
    const completedCount = reports.filter((r) => r.status === "completed").length;
    let adminUsers = [];
    if (req.session.user.role === "admin") {
      const userRows = await User.find({}).sort({ createdAt: 1 }).select("userId emailId name role isActive createdAt updatedAt");
      adminUsers = userRows.map((u) => ({
        userId: u.userId,
        emailId: u.emailId,
        name: u.name,
        role: u.role || "user",
        isActive: u.isActive !== false,
        createdAt: u.createdAt,
        isProtected: u.emailId === ADMIN_EMAIL || u.emailId === AUTHORITY_EMAIL,
      }));
    }
    res.render("authority", {
      title: "Authority Panel",
      reports,
      pendingCount,
      approvedCount,
      workingCount,
      completedCount,
      users: adminUsers,
      canEditStatus: req.session.user.role === "authority",
    });
  } catch (e) {
    console.error(e);
    res.status(500).render("error", { title: "Error", message: "Could not load authority panel." });
  }
});

app.get("/admin", requireRole("admin"), (_req, res) => {
  return res.redirect("/authority");
});

app.get("/report", requireUser, (req, res) => {
  res.render("report", { title: "New report" });
});

app.get("/routing", requireUser, (req, res) => {
  res.render("routing", { title: "Route it" });
});

app.get("/profile", requireUser, async (req, res) => {
  try {
    const rows = await Report.find({ userId: req.session.user.userId });
    const completedCount = rows.filter((r) => r.status === "completed").length;
    const approvedCount =
      rows.filter((r) => r.status === "approved").length + completedCount;
    const submittedCount =
      rows.filter((r) => r.status === "submitted").length + approvedCount;
    let score = 0;
    if (submittedCount > 0 && approvedCount > 0) {
      score = Math.ceil(
        ((approvedCount / submittedCount) * 0.7 + (completedCount / approvedCount) * 0.3) * 100
      );
    }
    res.render("profile", {
      title: "Profile",
      submittedCount,
      approvedCount,
      completedCount,
      score: score || 0,
    });
  } catch (e) {
    console.error(e);
    res.status(500).render("error", { title: "Error", message: "Could not load profile." });
  }
});

app.use((req, res) => {
  res.status(404).render("error", { title: "Not found", message: "Page not found." });
});

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    await ensureAdminAccount();
    await ensureAuthorityAccount();
    app.listen(config.PORT, () => {
      console.log(`Pathole listening on http://localhost:${config.PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

start();

function requireUser(req, res, next) {
  if (!req.session?.user?.userId) {
    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(401).json({ error: "login required" });
    }
    return res.redirect("/login");
  }
  res.locals.user = req.session.user;
  next();
}

module.exports = { requireUser };

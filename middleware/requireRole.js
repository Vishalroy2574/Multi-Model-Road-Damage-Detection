function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return function (req, res, next) {
    const role = req.session?.user?.role || "user";
    if (!req.session?.user?.userId) {
      if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
        return res.status(401).json({ error: "login required" });
      }
      return res.redirect("/login");
    }
    if (roles.length && !roles.includes(role)) {
      return res.status(403).render("error", {
        title: "Forbidden",
        message: "You do not have access to this page.",
      });
    }
    res.locals.user = req.session.user;
    next();
  };
}

module.exports = { requireRole };

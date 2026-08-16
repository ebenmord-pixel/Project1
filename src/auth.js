function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).render('error', { message: 'אין לך הרשאה לצפות בעמוד זה', user: req.session.user });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };

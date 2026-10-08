/**
 * Middleware to restrict route access to specific roles
 * @param  {...string} roles Allowed roles (e.g. 'system_admin', 'shop_owner', 'customer')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' is not authorized to access this route.`,
      });
    }

    next();
  };
};

module.exports = { authorize };

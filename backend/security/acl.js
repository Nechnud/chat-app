const aclRules = require('./acl-rules.json');

module.exports = function (route, req) {
    let userRole = req.session.user ? req.session.user.userRole : 'visitor';
    let method = req.method.toLowerCase();
    let allowed = aclRules?.[userRole]?.[route]?.[method];
    return !!allowed;
}
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

let opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'dev_jwt_secret'
};

const User  = require('../models/User');
const Bank  = require('../models/Bank');

passport.use(new JwtStrategy(opts, async function (jwt_payload, done) {
    try {
        let user = await User.findOne({ email: jwt_payload.email });
        if (user) {
            user.userType = 'client';
            return done(null, user);
        }
        let bank = await Bank.findOne({ email: jwt_payload.email });
        if (bank) {
            bank.userType = 'bank';
            return done(null, bank);
        }
        return done(null, false);
    } catch (err) {
        return done(err, false);
    }
}));
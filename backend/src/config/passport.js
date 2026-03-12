const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const avatar = profile.photos?.[0]?.value || null;
        const googleId = profile.id;

        const { rows } = await db.query(
            `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]
        );

        let user;

        if (rows.length > 0) {
            user = rows[0];
            // Update google_id and avatar if not set
            await db.query(
                `UPDATE users SET
                 google_id = COALESCE(google_id, $1),
                 avatar_url = COALESCE(avatar_url, $2),
                 auth_provider = CASE WHEN auth_provider = 'local' AND google_id IS NULL THEN 'google' ELSE auth_provider END,
                 is_email_verified = true,
                 updated_at = NOW()
                 WHERE id = $3`,
                [googleId, avatar, user.id]
            );
        } else {
            const { rows: newRows } = await db.query(
                `INSERT INTO users
                 (name, email, is_email_verified,
                  is_active, avatar_url, role,
                  google_id, auth_provider)
                 VALUES ($1,$2,true,true,$3,'customer',$4,'google')
                 RETURNING *`,
                [name, email, avatar, googleId]
            );
            user = newRows[0];
        }

        if (!user || !user.is_active) {
            return done(null, false,
                { message: 'Account is disabled' });
        }

        const jwtAccess = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES }
        );
        const jwtRefresh = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES }
        );

        // Update user login info
        await db.query(
            `UPDATE users SET refresh_token=$1,
             last_login=NOW(),
             login_count=login_count+1
             WHERE id=$2`,
            [jwtRefresh, user.id]
        );

        // Track session
        try {
            const userAgent = req?.headers?.['user-agent'] || '';
            const deviceType = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
            await db.query(
                `INSERT INTO user_sessions
                 (user_id, session_token, ip_address, user_agent,
                  auth_provider, device_type, expires_at)
                 VALUES ($1, $2, $3, $4, 'google', $5, NOW() + INTERVAL '7 days')`,
                [user.id, jwtAccess, req?.ip || '', userAgent, deviceType]
            );
        } catch (sessionErr) {
            console.error('Google session tracking failed:', sessionErr.message);
        }

        // ✅ FIX: Return user data with tokens - the redirect happens in the route handler
        return done(null, {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url
            },
            accessToken: jwtAccess,
            refreshToken: jwtRefresh
        });
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((data, done) =>
    done(null, data));
passport.deserializeUser((data, done) =>
    done(null, data));

module.exports = passport;
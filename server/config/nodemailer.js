const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const oAuth2Client = new google.auth.OAuth2(process.env.OAUTH_CLIENT, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token:process.env.REFRESH_TOKEN });

async function getAccessToken(){
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        return accessToken;
    } catch (error) {
        console.error("Error getting OAuth2 access token:", error.message);
        return null;
    }
}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    service:'gmail',
    auth: {
        type:'OAuth2',
        user:'ayushtest935@gmail.com',
        clientId: process.env.OAUTH_CLIENT,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: getAccessToken()
    }
});

// Test email configuration on startup (non-blocking)
getAccessToken().then(token => {
    if (token) {
        console.log("Email service configured successfully");
    } else {
        console.warn("Email service configuration failed - emails will be skipped");
    }
}).catch(err => {
    console.warn("Email service not available - emails will be skipped:", err.message);
});

module.exports = transporter;
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// Check if OAuth2 credentials are available
const hasOAuth2Credentials = process.env.OAUTH_CLIENT && process.env.CLIENT_SECRET && process.env.REFRESH_TOKEN;

let oAuth2Client = null;
if (hasOAuth2Credentials) {
    oAuth2Client = new google.auth.OAuth2(process.env.OAUTH_CLIENT, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
}

async function getAccessToken(){
    if (!oAuth2Client) {
        return null;
    }
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        return accessToken;
    } catch (error) {
        console.error("Error getting OAuth2 access token:", error.message);
        return null;
    }
}

// Create transporter with proper async access token handling
// Only create OAuth2 transporter if credentials are available
let transporter;
if (hasOAuth2Credentials) {
    // Nodemailer OAuth2 requires accessToken to be a function that returns a Promise
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        service:'gmail',
        auth: {
            type:'OAuth2',
            user:'ayushtest935@gmail.com',
            clientId: process.env.OAUTH_CLIENT,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN,
            // Nodemailer will call this function to get a fresh access token
            accessToken: getAccessToken
        }
    });
    
    // Verify the transporter configuration
    transporter.verify(function(error, success) {
        if (error) {
            console.warn("Email transporter verification failed:", error.message);
            console.warn("Emails may not work. Please check your OAuth2 credentials.");
        } else {
            console.log("Email transporter is ready to send messages");
        }
    });
} else {
    // Create a dummy transporter that will fail gracefully
    console.warn("OAuth2 credentials not found. Email functionality will be disabled.");
    console.warn("Please set OAUTH_CLIENT, CLIENT_SECRET, and REFRESH_TOKEN environment variables to enable email.");
    transporter = {
        sendMail: async () => {
            throw new Error('Email service not configured. Please set up OAuth2 credentials.');
        }
    };
}

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
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(cors({
  origin: '*', // Be cautious with this in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Generate token endpoint
app.get('/api/token', (req, res) => {
  try {
    console.log("Generating token with environment variables.");

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: 'browser-client' }
    );

    const grant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });
    token.addGrant(grant);

    res.send({ token: token.toJwt() });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).send({ error: 'Failed to generate token' });
  }
});

// Simulated incoming call endpoint (for testing)
app.post('/api/test-incoming-call', async (req, res) => {
  try {
    console.log("Triggering simulated incoming call...");
    const simulatedCall = await client.calls.create({
      url: `${process.env.SERVER_BASE_URL}/api/receive-call`,
      to: process.env.TWILIO_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    res.json({ success: true, callSid: simulatedCall.sid });
    console.log('Simulated incoming call SID:', simulatedCall.sid);
  } catch (error) {
    console.error('Error triggering simulated incoming call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dial call endpoint
app.post('/api/dial', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }

  try {
    const call = await client.calls.create({
      url: `${process.env.SERVER_BASE_URL}/voice`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error dialing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Voice Response for Outgoing Calls
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.say('Hello from Twilio! This call is working correctly.');
  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle incoming calls
app.post('/api/receive-call', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.say('You have an incoming call. Please hold.');
  twiml.dial().client('browser-client');  // Connects to the client app in the browser
  res.type('text/xml');
  res.send(twiml.toString());
});

// Mute call endpoint
app.post('/api/mute', async (req, res) => {
  const { callSid, mute } = req.body;
  try {
    await client.calls(callSid).update({ muted: mute });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating mute status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hang up call endpoint
app.post('/api/hangup', async (req, res) => {
  const { callSid } = req.body;
  try {
    await client.calls(callSid).update({ status: 'completed' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error hanging up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

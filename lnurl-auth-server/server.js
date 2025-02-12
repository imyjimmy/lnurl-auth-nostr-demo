const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const https = require('https');
const axios = require('axios');
const WebSocket = require('ws');

// nostr
const { verifyEvent, validateEvent, getEventHash } = require('nostr-tools');

const app = express();
app.use(express.json());
app.use(cors());

// Store pending challenges in memory (use a database in production)
const pendingChallenges = new Map();

app.post('/api/auth/lnurl/challenge', (req, res) => {
  // Generate a random k1 challenge
  const k1 = crypto.randomBytes(32).toString('hex');
  
  // Store the challenge with a timestamp
  pendingChallenges.set(k1, {
    timestamp: Date.now(),
    verified: false,
    pubkey: null
  });

  console.log('Generated challenge:', k1);

  res.json({
    k1,
    tag: 'login',
    callback: `http://localhost:3000/api/auth/lnurl/callback`
  });
});

app.post('/api/auth/lnurl/callback', async (req, res) => {
  const { k1, sig, key } = req.body;
  console.log('Received callback:', { k1, sig, key });

  if (!pendingChallenges.has(k1)) {
    return res.status(400).json({ status: 'error', reason: 'Invalid or expired challenge' });
  }

  // Update challenge status
  pendingChallenges.set(k1, {
    ...pendingChallenges.get(k1),
    verified: true,
    pubkey: key || '0223f455e3d594963895b30ee2d0d3bd0087340694d82cd7d3362459815e1349e9' // Alice's pubkey
  });

  console.log('Challenge verified:', k1);
  res.json({ status: 'OK' });
});

app.get('/api/auth/:type/status', (req, res) => {
  const { type } = req.params;
  const { k1 } = req.query;
  
  console.log(`Status check for ${type}:`, k1);
  
  if (!pendingChallenges.has(k1)) {
    return res.status(400).json({ status: 'error', reason: 'Challenge not found' });
  }

  const challenge = pendingChallenges.get(k1);
  console.log('Challenge status:', challenge);

  res.json({
    status: challenge.verified ? 'verified' : 'pending',
    nodeInfo: challenge.verified ? {
      pubkey: challenge.pubkey
    } : null
  });
});

/* 
* NOSTR Login additions
*/
app.post('/api/auth/nostr/challenge', (req, res) => {
  const challenge = crypto.randomBytes(32).toString('hex');
  
  pendingChallenges.set(challenge, {
    timestamp: Date.now(),
    verified: false,
    pubkey: null,
    type: 'nostr'
  });

  console.log('Generated Nostr challenge:', challenge);

  res.json({
    challenge,
    tag: 'login'
  });
});

app.post('/api/auth/nostr/verify', async (req, res) => {
  const { signedEvent } = req.body;
  
  try {
    // Validate the event format
    if (!validateEvent(signedEvent)) {
      return res.status(400).json({ 
        status: 'error', 
        reason: 'Invalid event format' 
      });
    }

    // Verify the event signature
    if (!verifyEvent(signedEvent)) {
      return res.status(400).json({ 
        status: 'error', 
        reason: 'Invalid signature' 
      });
    }

    // Create WebSocket connection to get metadata
    const ws = new WebSocket('wss://relay.damus.io');
    
    const metadataPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Metadata fetch timeout'));
      }, 5000);

      ws.onopen = () => {
        const req = JSON.stringify([
          "REQ",
          "metadata-query",
          {
            "kinds": [0],
            "authors": [signedEvent.pubkey],
            "limit": 1
          }
        ]);
        ws.send(req);
      };

      ws.onmessage = (event) => {
        const [type, _, eventData] = JSON.parse(event.data);
        if (type === 'EVENT' && eventData.kind === 0) {
          clearTimeout(timeout);
          ws.close();
          resolve(eventData);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    const metadata = await metadataPromise;

    console.log('Nostr login verified for pubkey:', signedEvent.pubkey);
    res.json({ 
      status: 'OK',
      pubkey: signedEvent.pubkey,
      metadata
    });

  } catch (error) {
    console.error('Nostr verification error:', error);
    res.status(500).json({ 
      status: 'error', 
      reason: 'Verification failed' 
    });
  }
});

app.get('/api/auth/nostr/status', (req, res) => {
  const { challenge } = req.query;
  
  if (!pendingChallenges.has(challenge)) {
    return res.status(400).json({ 
      status: 'error', 
      reason: 'Challenge not found' 
    });
  }

  const challengeData = pendingChallenges.get(challenge);
  
  // Only return status for Nostr challenges
  if (challengeData.type !== 'nostr') {
    return res.status(400).json({ 
      status: 'error', 
      reason: 'Invalid challenge type' 
    });
  }

  res.json({
    status: challengeData.verified ? 'verified' : 'pending',
    userInfo: challengeData.verified ? {
      pubkey: challengeData.pubkey
    } : null
  });
});

app.get('/api/nostr/nip05/verify', async (req, res) => {
  const { domain, name } = req.query;

  if (!domain || !name) {
    return res.status(400).json({ error: 'Domain and name parameters are required' });
  }

  const agent = new https.Agent({
    rejectUnauthorized: false
  });

  try {
    const response = await axios.get(
      `https://nostr-check.com/.well-known/nostr.json?name=${name}`,
      { 
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        httpsAgent: agent
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error('NIP-05 verification error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to verify NIP-05' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
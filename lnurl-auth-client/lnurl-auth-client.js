const fs = require('fs');
const path = require('path');
const lnService = require('ln-service');

class LNURLAuthClient {
  constructor(nodeConfig) {
    this.config = nodeConfig;
    this.lnd = null;
  }

  async connect() {
    try {
      // Read the TLS cert and macaroon files
      const cert = fs.readFileSync(this.config.tlsCertPath);
      const macaroon = fs.readFileSync(this.config.macaroonPath);

      // Connect to the LND node
      const { lnd } = lnService.authenticatedLndGrpc({
        cert: cert.toString('base64'),
        macaroon: macaroon.toString('hex'),
        socket: this.config.grpcHost,
      });

      this.lnd = lnd;
      
      // Get node info to verify connection
      const nodeInfo = await lnService.getWalletInfo({ lnd });
      console.log('Connected to node:', nodeInfo.public_key);
      
      return nodeInfo.public_key;
    } catch (error) {
      console.error('Failed to connect to LND:', error);
      throw error;
    }
  }

  async signAuthChallenge(k1) {
    try {
      if (!this.lnd) {
        throw new Error('Not connected to LND node');
      }

      // Sign the k1 challenge
      const { signature } = await lnService.signMessage({
        lnd: this.lnd,
        message: k1,
      });

      return signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }

  async authenticateWithServer(serverUrl, k1) {
    try {
      // Get node info for the pubkey
      const nodeInfo = await lnService.getWalletInfo({ lnd: this.lnd });
      const pubkey = nodeInfo.public_key;

      // Sign the challenge
      const signature = await this.signAuthChallenge(k1);

      // Send the signed response back
      const authResponse = await fetch(`${serverUrl}/api/auth/lnurl/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          k1,
          sig: signature,
          key: pubkey
        }),
      });

      return await authResponse.json();
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }
}

// Example usage:
async function main() {
  // Get challenge from command line argument
  const k1 = process.argv[2];
  if (!k1) {
    console.error('Please provide the challenge (k1) as an argument');
    console.error('Usage: node lnurl-auth-client.js <challenge>');
    process.exit(1);
  }

  const aliceConfig = {
    grpcHost: '127.0.0.1:10001',
    tlsCertPath: '/Users/imyjimmy/.polar/networks/1/volumes/lnd/alice/tls.cert',
    macaroonPath: '/Users/imyjimmy/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon',
  };

  const client = new LNURLAuthClient(aliceConfig);
  
  try {
    // Connect to Alice's node
    await client.connect();
    
    // Authenticate with your local development server
    const result = await client.authenticateWithServer('http://localhost:3000', k1);
    console.log('Authentication result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = LNURLAuthClient;
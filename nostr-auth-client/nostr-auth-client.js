// nostr-auth-client.js
// usage: node nostr-auth-client.js <challenge>
import { generatePrivateKey, getPublicKey, nip44 } from 'nostr-tools';

class NostrAuthClient {
  constructor(relayUrls) {
    this.relayUrls = relayUrls;
    this.clientKeypair = {
      privateKey: generatePrivateKey(),
      publicKey: null
    };
    this.clientKeypair.publicKey = getPublicKey(this.clientKeypair.privateKey);
    this.remoteSignerPubkey = null;
    this.websockets = new Map();
  }

  async connect(remoteSignerPubkey, secret = null) {
    this.remoteSignerPubkey = remoteSignerPubkey;
    
    // Connect to all specified relays
    for (const url of this.relayUrls) {
      const ws = new WebSocket(url);
      this.websockets.set(url, ws);
      
      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.kind === 24133) {
          this.handleResponse(response);
        }
      };
    }

    // Send connect request
    const request = {
      id: crypto.randomUUID(),
      method: 'connect',
      params: [remoteSignerPubkey, secret]
    };

    return this.sendRequest(request);
  }

  async sendRequest(request) {
    const encrypted = await nip44.encrypt(
      request,
      this.clientKeypair.privateKey,
      this.remoteSignerPubkey
    );

    const event = {
      kind: 24133,
      pubkey: this.clientKeypair.publicKey,
      content: encrypted,
      tags: [['p', this.remoteSignerPubkey]],
      created_at: Math.floor(Date.now() / 1000)
    };

    // Send to all connected relays
    for (const ws of this.websockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['EVENT', event]));
      }
    }

    return new Promise((resolve, reject) => {
      // Store promise handlers to resolve when response is received
      this.pendingRequests.set(request.id, { resolve, reject });
    });
  }

  async handleResponse(response) {
    const decrypted = await nip44.decrypt(
      response.content,
      this.clientKeypair.privateKey,
      response.pubkey
    );

    const pendingRequest = this.pendingRequests.get(decrypted.id);
    if (pendingRequest) {
      if (decrypted.error) {
        pendingRequest.reject(new Error(decrypted.error));
      } else {
        pendingRequest.resolve(decrypted.result);
      }
      this.pendingRequests.delete(decrypted.id);
    }
  }

  async getUserPubkey() {
    const request = {
      id: crypto.randomUUID(),
      method: 'get_public_key',
      params: []
    };
    return this.sendRequest(request);
  }

  disconnect() {
    for (const ws of this.websockets.values()) {
      ws.close();
    }
    this.websockets.clear();
  }
}

// Example usage:
async function main() {
  // Initialize client with relay URLs
  const client = new NostrAuthClient([
    'wss://relay.damus.io',
    'wss://relay.nostr.band'
  ]);

  try {
    // Generate nostrconnect:// URL parameters
    const params = new URLSearchParams({
      relay: 'wss://relay.damus.io',
      secret: crypto.randomUUID(),
      perms: 'sign_event',
      name: 'Lightning Login'
    });

    // Create connection URL with client's pubkey
    const connectUrl = `nostrconnect://${client.clientKeypair.publicKey}?${params.toString()}`;
    console.log('Scan this URL with your Nostr signer:', connectUrl);

    // Wait for user to approve connection in their signer
    const connectResult = await client.connect(connectUrl);
    console.log('Connection result:', connectResult);

    // Get user's pubkey after successful connection
    const userPubkey = await client.getUserPubkey();
    console.log('User pubkey:', userPubkey);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

// Run if called directly
if (typeof window !== 'undefined' && require.main === module) {
  main();
}
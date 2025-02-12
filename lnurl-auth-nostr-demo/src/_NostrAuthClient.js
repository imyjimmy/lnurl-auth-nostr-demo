// NostrAuthClient.js
import { generateSecretKey, getPublicKey, finalizeEvent, getEventHash } from 'nostr-tools';

class NostrAuthClient {
  constructor(relayUrls) {
    try {
      this.relayUrls = relayUrls;
      const privateKey = generateSecretKey();
      this.clientKeypair = {
        privateKey,
        publicKey: getPublicKey(privateKey)
      };
      this.remoteSignerPubkey = null;
      this.websockets = new Map();
      this.pendingRequests = new Map();
    } catch (error) {
      console.error('Failed to initialize NostrAuthClient:', error);
      throw error;
    }
  }

  async connect(remoteSignerPubkey, secret = null) {
    this.remoteSignerPubkey = remoteSignerPubkey;
    
    // Connect to all specified relays
    for (const url of this.relayUrls) {
      const ws = new WebSocket(url);
      this.websockets.set(url, ws);
      
      ws.onmessage = (message) => {
        const response = JSON.parse(message.data);
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
    const nostrEvent = {
      kind: 24133,
      pubkey: this.clientKeypair.publicKey,
      content: JSON.stringify(request),
      tags: [['p', this.remoteSignerPubkey]],
      created_at: Math.floor(Date.now() / 1000)
    };
    
    finalizeEvent(nostrEvent, this.clientKeypair.privateKey);

    // Send to all connected relays
    for (const ws of this.websockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(['EVENT', nostrEvent]));
      }
    }

    return new Promise((resolve, reject) => {
      // Store promise handlers to resolve when response is received
      this.pendingRequests.set(request.id, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  async handleResponse(response) {
    try {
      const parsedContent = JSON.parse(response.content);
      const pendingRequest = this.pendingRequests.get(parsedContent.id);
      
      if (pendingRequest) {
        if (parsedContent.error) {
          pendingRequest.reject(new Error(parsedContent.error));
        } else {
          pendingRequest.resolve(parsedContent.result);
        }
        this.pendingRequests.delete(parsedContent.id);
      }
    } catch (error) {
      console.error('Error handling response:', error);
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
    this.pendingRequests.clear();
  }
}

export default NostrAuthClient;
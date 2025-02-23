# Intro
This repo is a suite of projects that work together to demonstrate nostr login AND lnurl-auth. It consists of the following:

* `lnurl-auth-nostr-demo`: this is the frontend that shows a generic website that poses a challenge for lnurl-auth *or* a login with nostr button.

* `lnurl-auth-client`: simulates a lightning wallet, can scan the QR code challenge posed by the frontend, *requires a lightning testnet* we can run one via Polar

replace `aliceConfig` with your own values from Polar.

* `lnurl-auth-server`: should really be called auth-server, as it accepts either lnurl or nostr challenges and either invalidates the login attempt or accepts the login

Replace alice's pubkey with your own test node's pubkey


# Installation / Running Steps

clone this directory, then `npm install` in `lnurl-auth-client`, `lnurl-auth-nostr-demo` and `lnurl-auth-server`

`lnurl-auth-nostr-demo`: `npm run start`
`lnurl-auth-server`: `node server.js`

## lnurl login: 
Make sure [polar](https://lightningpolar.com/) is running and replace the pubkey in `lnurl-auth-server/server.js` ("Alice's pubkey") with your own test node's pubkey.

`node lnurl-auth-client.js [challenge]`

## nostr login
use a nos2x plugin
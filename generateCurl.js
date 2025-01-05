// const fs = require('fs');
// const jwt = require('jsonwebtoken');

// // Load your service account credentials
// const serviceAccount = require('./miewebauthapp-97c46635fcd5.json');

// function getAccessToken() {
//   const token = jwt.sign({
//     iss: serviceAccount.client_email,
//     scope: 'https://www.googleapis.com/auth/firebase.messaging',
//     aud: serviceAccount.token_uri,
//     exp: Math.floor(Date.now() / 1000) + 3600,
//     iat: Math.floor(Date.now() / 1000)
//   }, serviceAccount.private_key, { algorithm: 'RS256' });

//   return token;
// }

// console.log(getAccessToken());

const express = require('express');
const app = express();

app.use(express.json());

app.post('/user-action-response', (req, res) => {
  console.log('Received user action:', req.body);
  res.json({ success: true, message: 'Action received', data: req.body });
});

app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});

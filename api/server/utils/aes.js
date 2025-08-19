const crypto = require('crypto');

const DEFAULT_AES_KEY = process.env.AES_KEY || '0123456789abcdef'; // 16 bytes for AES-128
const DEFAULT_AES_IV = process.env.AES_IV || 'abcdef0123456789'; // 16 bytes IV

function getKeyIv() {
  const key = Buffer.from(DEFAULT_AES_KEY, 'utf8');
  const iv = Buffer.from(DEFAULT_AES_IV, 'utf8');
  if (key.length !== 16 || iv.length !== 16) {
    throw new Error('[AES] Key and IV must be 16 bytes for AES-128-CBC');
  }
  return { key, iv };
}

function encryptAESCBC(payload) {
  const { key, iv } = getKeyIv();
  const plaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decryptAESCBC(base64Text) {
  const { key, iv } = getKeyIv();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(base64Text, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

module.exports = {
  encryptAESCBC,
  decryptAESCBC,
  DEFAULT_AES_KEY,
  DEFAULT_AES_IV,
}; 
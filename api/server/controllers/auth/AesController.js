const { encryptAESCBC, decryptAESCBC } = require('~/server/utils/aes');

const encryptAesController = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const ts = Date.now();
    const payload = encryptAESCBC({ email: email.trim(), ts });
    return res.status(200).json({ payload, ts });
  } catch (err) {
    return res.status(500).json({ message: 'Encrypt error' });
  }
};

const decryptAesController = async (req, res) => {
  try {
    const { payload } = req.query;
    if (!payload) {
      return res.status(400).json({ message: 'Payload is required' });
    }
    const data = decryptAESCBC(payload);
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(400).json({ message: 'Decrypt error' });
  }
};

module.exports = {
  encryptAesController,
  decryptAesController,
}; 
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3004;

// 启用 CORS
app.use(cors());

// 提供静态文件
app.use(express.static(__dirname));

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-loginOSS-redirect.html'));
});

// 代理到后端获取加密 payload，避免浏览器 CORS
app.get('/api/auth/aes/encrypt', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    console.log('email', email);
    const url = `http://localhost:3090/api/auth/aes/encrypt?email=${encodeURIComponent(email)}`;
    const resp = await axios.get(url);
    res.status(resp.status).json(resp.data);
    console.log('resp', resp.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ message: 'Proxy error' });
    }
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 测试页面服务器已启动!`);
  console.log(`📱 请在浏览器中访问: http://localhost:${PORT}`);
  console.log(`🔗 或者直接访问: http://localhost:${PORT}/test-loginOSS-redirect.html`);
  console.log(`\n💡 这样可以避免 CORS 问题，因为现在是从 http://localhost:3001 访问 http://localhost:3090`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  process.exit(0);
});

const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { findUser } = require('~/models');
const { logger } = require('~/config');
const { decryptAESCBC } = require('~/server/utils/aes');

const loginOSSController = async (req, res) => {
  try {
    const { payload, email: emailQuery } = req.query;

    let email;
    if (payload) {
      try {
        const data = decryptAESCBC(payload);
        if (!data || typeof data.email !== 'string' || typeof data.ts !== 'number') {
          return res.status(400).json({ message: 'Invalid payload structure' });
        }
        const now = Date.now();
        const threeMinutes = 3 * 60 * 1000;
        if (now - data.ts > threeMinutes) {
          return res.status(400).json({ message: 'Payload expired' });
        }
        if (data.ts - now > 30 * 1000) {
          return res.status(400).json({ message: 'Invalid timestamp (in future)' });
        }
        email = data.email.trim();
      } catch (e) {
        return res.status(400).json({ message: 'Failed to decrypt payload' });
      }
    } 
    // else if (emailQuery) {
    //   email = String(emailQuery).trim();
    // } 
    else {
      return res.status(400).json({ message: 'Email or payload is required' });
    }

    // 查找用户，只通过邮箱验证
    const user = await findUser({ email });
    
    if (!user) {
      logger.error(`[loginOSSController] User not found for email: ${email}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // 检查用户是否被禁用
    if (user.expiresAt && new Date() > user.expiresAt) {
      logger.error(`[loginOSSController] User account expired for email: ${email}`);
      return res.status(403).json({ message: 'Account expired' });
    }

    // 检查双因素认证
    if (user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }

    // 清理敏感信息
    const { password: _p, totpSecret: _t, __v, ...userInfo } = user;
    userInfo.id = userInfo._id.toString();

    // 生成认证令牌并设置 cookie
    const token = await setAuthTokens(user._id, res);

    logger.info(`[loginOSSController] OSS login successful for email: ${email}`);
    
    // 返回 HTML 页面，自动跳转到目标页面
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录成功 - 正在跳转</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        
        .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 40px;
            color: white;
        }
        
        h1 {
            color: #10b981;
            margin-bottom: 10px;
            font-size: 24px;
        }
        
        .message {
            color: #6b7280;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .countdown {
            font-size: 48px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 20px;
        }
        
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #10b981);
            border-radius: 3px;
            transition: width 0.1s ease;
        }
        
        .manual-link {
            margin-top: 20px;
        }
        
        .manual-link a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        
        .manual-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>登录成功！</h1>
        <p class="message">欢迎回来！正在为您跳转到新对话页面...</p>
        
        <div class="countdown" id="countdown">3</div>
        
        <div class="progress-bar">
            <div class="progress-fill" id="progress"></div>
        </div>
        
        <div class="manual-link">
            <a href="/c/new" id="manualLink">点击这里立即跳转</a>
        </div>
    </div>
    
    <script>
        let count = 3;
        const countdown = document.getElementById('countdown');
        const progress = document.getElementById('progress');
        const manualLink = document.getElementById('manualLink');
        
        // 倒计时和进度条
        const timer = setInterval(() => {
            count--;
            countdown.textContent = count;
            
            // 更新进度条
            const progressPercent = ((3 - count) / 3) * 100;
            progress.style.width = progressPercent + '%';
            
            if (count <= 0) {
                clearInterval(timer);
                // 自动跳转
                window.location.href = '/c/new';
            }
        }, 1000);
        
        // 点击链接立即跳转
        manualLink.addEventListener('click', (e) => {
            e.preventDefault();
            clearInterval(timer);
            window.location.href = '/c/new';
        });
        
        // 3秒后自动跳转（备用方案）
        setTimeout(() => {
            if (count > 0) {
                clearInterval(timer);
                window.location.href = '/c/new';
            }
        }, 3000);
    </script>
</body>
</html>`;

    // 设置响应头，告诉浏览器这是 HTML 内容
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    logger.error('[loginOSSController] Error:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  loginOSSController,
}; 
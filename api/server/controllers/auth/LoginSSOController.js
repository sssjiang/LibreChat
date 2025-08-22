const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { findUser } = require('~/models');
const { logger } = require('~/config');
const { decryptAESCBC } = require('~/server/utils/aes');

const sendErrorPage = (res, { status = 400, title = '登录失败', message = '请求出现错误', redirectUrl = '/' } = {}) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      background: white;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 40px;
      color: white;
    }
    h1 {
      color: #ef4444;
      margin-bottom: 8px;
      font-size: 22px;
    }
    .message {
      color: #6b7280;
      margin-bottom: 24px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .countdown { font-size: 36px; font-weight: bold; color: #ef4444; margin-bottom: 16px; }
    .progress-bar { width: 100%; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 16px; }
    .progress-fill { height: 100%; background: #ef4444; border-radius: 3px; transition: width 0.1s ease; }
    .manual-link a { color: #2563eb; text-decoration: none; font-weight: 500; }
    .manual-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">✕</div>
    <h1>${title}</h1>
    <p class="message">${message}</p>
    <div class="countdown" id="countdown">5</div>
    <div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
    <div class="manual-link">
      <a href="${redirectUrl}" id="manualLink">点击这里返回</a>
    </div>
  </div>
  <script>
    let count = 5;
    const countdown = document.getElementById('countdown');
    const progress = document.getElementById('progress');
    const manualLink = document.getElementById('manualLink');
    const duration = 5;
    const timer = setInterval(() => {
      count--;
      countdown.textContent = count;
      const progressPercent = ((duration - count) / duration) * 100;
      progress.style.width = progressPercent + '%';
      if (count <= 0) {
        clearInterval(timer);
        window.location.href = '${redirectUrl}';
      }
    }, 1000);
    manualLink.addEventListener('click', (e) => {
      e.preventDefault();
      clearInterval(timer);
      window.location.href = '${redirectUrl}';
    });
    setTimeout(() => {
      if (count > 0) {
        clearInterval(timer);
        window.location.href = '${redirectUrl}';
      }
    }, duration * 1000);
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(html);
};

const loginSSOController = async (req, res) => {
  try {
    const { payload, email: emailQuery } = req.query;

    let email;
    if (payload) {
      try {
        const data = decryptAESCBC(payload);
        if (!data || typeof data.email !== 'string' || typeof data.ts !== 'number') {
          return sendErrorPage(res, { status: 400, title: '登录失败', message: '无效的请求数据' });
        }
        const now = Date.now();
        const threeMinutes = 3 * 60 * 1000;
        if (now - data.ts > threeMinutes) {
          return sendErrorPage(res, { status: 400, title: '登录失败', message: '请求已过期，请重试' });
        }
        if (data.ts - now > 30 * 1000) {
          return sendErrorPage(res, { status: 400, title: '登录失败', message: '无效的时间戳' });
        }
        email = data.email.trim();
      } catch (e) {
        return sendErrorPage(res, { status: 400, title: '登录失败', message: '解密失败，请重试' });
      }
    } 
    // else if (emailQuery) {
    //   email = String(emailQuery).trim();
    // } 
    else {
      return sendErrorPage(res, { status: 400, title: '登录失败', message: '缺少必要参数' });
    }

    // 查找用户，只通过邮箱验证
    const user = await findUser({ email });
    
    if (!user) {
      logger.error(`[loginSSOController] User not found for email: ${email}`);
      return sendErrorPage(res, { status: 404, title: '登录失败', message: '用户不存在或未注册' });
    }

    // 检查用户是否被禁用
    if (user.expiresAt && new Date() > user.expiresAt) {
      logger.error(`[loginSSOController] User account expired for email: ${email}`);
      return sendErrorPage(res, { status: 403, title: '账号不可用', message: '账户已过期，请联系管理员' });
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

    logger.info(`[loginSSOController] SSO login successful for email: ${email}`);
    
    // 直接重定向到新对话页面
    return res.redirect('/c/new');
  } catch (err) {
    logger.error('[loginSSOController] Error:', err);
    return sendErrorPage(res, { status: 500, title: '服务器错误', message: '服务器错误，请稍后再试' });
  }
};

module.exports = {
  loginSSOController,
}; 
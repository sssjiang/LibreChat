const axios = require('axios');

// 测试 loginOSS API
async function testLoginOSS() {
  try {
    const email = 'test@gmail.com'; // 替换为实际的邮箱地址
    const url = `http://localhost:3090/api/auth/loginOSS?email=${encodeURIComponent(email)}`;
    
    console.log('Testing loginOSS API...');
    console.log('URL:', url);
    
    const response = await axios.get(url);
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.token) {
      console.log('✅ Login successful! Token received.');
    }
    
  } catch (error) {
    console.error('❌ Error testing loginOSS API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// 运行测试
testLoginOSS(); 
const axios = require('axios');

async function stressTest() {
  // 先登录
  const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
    email: 'demo@example.com', 
    password: 'demo123'
  });
  const token = loginResponse.data.data.token;
  
  console.log('开始压力测试...');
  
  // 发送10个并发请求
  const promises = [];
  for (let i = 1; i <= 10; i++) {
    const promise = axios.post('http://localhost:3001/api/ai-chat/stream', {
      message: `并发测试消息 ${i}`,
      conversationHistory: []
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }).then(() => {
      console.log(`请求 ${i} 完成`);
    }).catch(error => {
      console.error(`请求 ${i} 失败:`, error.message);
    });
    
    promises.push(promise);
  }
  
  await Promise.all(promises);
  
  // 检查后端状态
  try {
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('压力测试后后端状态:', healthResponse.data);
  } catch (error) {
    console.error('后端可能已崩溃:', error.message);
  }
}

stressTest();

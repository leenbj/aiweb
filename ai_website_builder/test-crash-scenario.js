const axios = require('axios');

async function loginAndChat() {
  try {
    // 1. 登录
    console.log('正在登录...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'demo@example.com',
      password: 'demo123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('登录成功，token获取完成');
    
    // 2. 模拟多次AI对话
    for (let i = 1; i <= 3; i++) {
      console.log(`开始第 ${i} 次对话...`);
      
      try {
        const response = await axios.post('http://localhost:3001/api/ai-chat/stream', {
          message: `这是第 ${i} 条测试消息`,
          conversationHistory: []
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30秒超时
        });
        
        console.log(`第 ${i} 次对话成功完成`);
      } catch (error) {
        console.error(`第 ${i} 次对话失败:`, error.message);
      }
      
      // 等待2秒再下一次请求
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 3. 检查后端是否还活着
    console.log('检查后端状态...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('后端状态正常:', healthResponse.data);
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

loginAndChat();

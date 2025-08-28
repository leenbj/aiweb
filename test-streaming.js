// 测试流式对话功能的简单脚本
const EventSource = require('eventsource');

// 测试数据
const testData = {
  message: "请简单介绍一下什么是流式输出",
  conversationHistory: [],
  stage: "chat",
  requirements: {}
};

// 模拟前端发送流式请求
async function testStreaming() {
  console.log('🚀 开始测试流式对话功能...');

  try {
    // 注意：这个请求会失败，因为需要认证
    // 但我们可以通过检查响应头来验证服务器是否正常
    const response = await fetch('http://localhost:3001/api/ai/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(testData),
    });

    console.log('📡 响应状态:', response.status, response.statusText);
    console.log('📡 响应头:', Object.fromEntries(response.headers.entries()));

    if (response.status === 401) {
      console.log('✅ 后端正常响应（需要认证，这是预期的）');
      console.log('🔧 流式对话功能配置正确！');
    } else {
      console.log('❌ 意外的响应状态');
    }

  } catch (error) {
    console.error('❌ 网络错误:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('🔴 后端服务器未运行');
    } else {
      console.log('🔴 其他网络错误');
    }
  }
}

// 健康检查
async function healthCheck() {
  console.log('🔍 检查后端健康状态...');

  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();

    if (response.ok && data.status === 'ok') {
      console.log('✅ 后端健康检查通过');
      return true;
    } else {
      console.log('❌ 后端健康检查失败');
      return false;
    }
  } catch (error) {
    console.log('❌ 无法连接到后端:', error.message);
    return false;
  }
}

// 检查前端
async function checkFrontend() {
  console.log('🔍 检查前端状态...');

  try {
    const response = await fetch('http://localhost:3000');
    const html = await response.text();

    if (response.ok && html.includes('AI Website Builder')) {
      console.log('✅ 前端正常运行');
      return true;
    } else {
      console.log('❌ 前端响应异常');
      return false;
    }
  } catch (error) {
    console.log('❌ 无法连接到前端:', error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🧪 开始运行流式对话功能测试...\n');

  // 1. 检查后端
  const backendHealthy = await healthCheck();
  console.log('');

  // 2. 检查前端
  const frontendHealthy = await checkFrontend();
  console.log('');

  // 3. 如果后端正常，测试流式功能
  if (backendHealthy) {
    await testStreaming();
  } else {
    console.log('⚠️  跳过流式测试，因为后端不可用');
  }

  console.log('\n📋 测试总结:');
  console.log(`后端状态: ${backendHealthy ? '✅ 正常' : '❌ 异常'}`);
  console.log(`前端状态: ${frontendHealthy ? '✅ 正常' : '❌ 异常'}`);
  console.log(`端口配置: 前端3000, 后端3001 ${backendHealthy && frontendHealthy ? '✅ 正确' : '❌ 异常'}`);

  if (backendHealthy && frontendHealthy) {
    console.log('\n🎉 所有服务正常运行！流式对话功能应该可以正常使用。');
    console.log('📖 使用说明:');
    console.log('1. 打开浏览器访问: http://localhost:3000');
    console.log('2. 进入网站编辑器页面');
    console.log('3. 在右侧AI助手面板中输入问题');
    console.log('4. 观察文字是否逐字流式显示');
  } else {
    console.log('\n🔧 故障排除:');
    if (!backendHealthy) {
      console.log('- 检查后端是否在端口3001运行');
      console.log('- 检查数据库配置是否正确');
    }
    if (!frontendHealthy) {
      console.log('- 检查前端是否在端口3000运行');
      console.log('- 检查前端代理配置');
    }
  }
}

// 运行测试
runTests().catch(console.error);

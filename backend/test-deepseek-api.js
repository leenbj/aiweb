const { config } = require('dotenv');
const OpenAI = require('openai');

// 加载环境变量
config();

async function testDeepSeekAPI() {
  console.log('测试DeepSeek API连接...');
  console.log('API Key:', process.env.DEEPSEEK_API_KEY ? `${process.env.DEEPSEEK_API_KEY.substring(0, 8)}...` : '未设置');
  console.log('Base URL:', process.env.DEEPSEEK_BASE_URL);
  console.log('Model:', process.env.DEEPSEEK_MODEL);

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  });

  try {
    console.log('\n开始API测试...');
    
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'user', content: '你好，请简单回复一下测试连接' }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    console.log('\n✅ API测试成功!');
    console.log('回复:', response.choices[0].message.content);
    console.log('Token使用:', response.usage);

  } catch (error) {
    console.error('\n❌ API测试失败:');
    console.error('错误信息:', error.message);
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应:', error.response.data);
    }
  }
}

testDeepSeekAPI();
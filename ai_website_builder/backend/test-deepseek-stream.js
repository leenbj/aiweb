// 独立测试DeepSeek流式响应时机
const OpenAI = require('openai');

// 临时测试，先跳过真实API测试
console.log('❗ 跳过实际DeepSeek API测试（需要配置API密钥）');
console.log('📋 基于现有代码分析，问题可能在于：');
console.log('1. DeepSeek R1推理模型可能不支持真正的流式输出');
console.log('2. deepseek-chat模型应该支持流式，但可能有不同的行为');
console.log('3. 系统提示词过于复杂，导致AI需要长时间思考');

process.exit(0);

const client = new OpenAI({
  apiKey: 'sk-test', // process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function testDeepSeekStream() {
  console.log('🧪 开始测试DeepSeek流式响应时机...');
  console.log('🕐 开始时间:', new Date().toISOString());
  
  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: '你是一个助手，请简短回复用户的问题。' 
        },
        { 
          role: 'user', 
          content: '请用中文说"你好"然后数数从1到10' 
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
      stream: true,
    });

    let chunkCount = 0;
    let startTime = Date.now();
    let firstChunkTime = null;
    let totalContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        chunkCount++;
        totalContent += content;
        
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          console.log(`⚡ 首个chunk接收时间: ${new Date().toISOString()}`);
          console.log(`⏱️  从开始到首个chunk: ${firstChunkTime - startTime}ms`);
        }
        
        console.log(`📦 Chunk ${chunkCount} [${Date.now() - startTime}ms]: "${content}"`);
      }
    }

    console.log('\n✅ 流式响应完成');
    console.log(`🔢 总chunk数: ${chunkCount}`);
    console.log(`⏱️  总耗时: ${Date.now() - startTime}ms`);
    console.log(`📄 完整内容: "${totalContent}"`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testDeepSeekStream();

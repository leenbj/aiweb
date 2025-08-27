#!/usr/bin/env node

/**
 * AI聊天模块集成测试脚本
 */

const https = require('http');
const EventSource = require('eventsource');

// 测试配置
const BASE_URL = 'http://localhost:3001';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtZXFwbWh4bTAwMDBoNDRvc2VzdHh3bGUiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaWF0IjoxNzU2MTgwNDIxLCJleHAiOjE3NTY3ODUyMjF9.V0JN--gTK2JFcZLbACZTccyz_NaXr0BCn4UflyBwRJ4';

async function testHealthCheck() {
  console.log('\n🔍 测试健康检查...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/ai-chat/health`);
    const data = await response.json();
    
    if (data.success && data.data.status === 'healthy') {
      console.log('✅ 健康检查通过');
      return true;
    } else {
      console.log('❌ 健康检查失败:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ 健康检查错误:', error.message);
    return false;
  }
}

async function testStreamingChat() {
  console.log('\n🔍 测试流式聊天...');
  
  return new Promise((resolve) => {
    const requestBody = JSON.stringify({
      message: '请用一句话介绍React',
      conversationHistory: []
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/ai-chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`📡 响应状态: ${res.statusCode}`);
      
      if (res.statusCode !== 200) {
        console.log('❌ 流式聊天失败');
        resolve(false);
        return;
      }

      let fullContent = '';
      let chunkCount = 0;
      let hasConnected = false;
      let hasCompleted = false;

      res.on('data', (chunk) => {
        const data = chunk.toString();
        const lines = data.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              const eventData = JSON.parse(jsonStr);
              
              switch (eventData.event) {
                case 'connected':
                  console.log('🔗 已连接到AI聊天服务');
                  hasConnected = true;
                  break;
                  
                case 'chunk':
                  chunkCount++;
                  fullContent = eventData.data.fullContent || fullContent + eventData.data.content;
                  process.stdout.write(eventData.data.content);
                  break;
                  
                case 'done':
                  console.log(`\n✅ 流式完成: ${chunkCount}个数据块, ${fullContent.length}字符`);
                  hasCompleted = true;
                  resolve(hasConnected && hasCompleted && chunkCount > 0);
                  break;
                  
                case 'error':
                  console.log('\n❌ AI响应错误:', eventData.data.message);
                  resolve(false);
                  break;
              }
            } catch (parseError) {
              // 忽略解析错误，继续处理其他数据
            }
          }
        }
      });

      res.on('end', () => {
        if (!hasCompleted) {
          console.log('\n⚠️  连接结束但未收到完成信号');
          resolve(false);
        }
      });

      res.on('error', (error) => {
        console.log('\n❌ 连接错误:', error.message);
        resolve(false);
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求错误:', error.message);
      resolve(false);
    });

    req.write(requestBody);
    req.end();

    // 设置超时
    setTimeout(() => {
      console.log('\n⏰ 测试超时');
      resolve(false);
    }, 30000);
  });
}

async function runTests() {
  console.log('🚀 开始AI聊天模块集成测试\n');
  
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ 测试失败: 健康检查未通过');
    process.exit(1);
  }
  
  const streamOk = await testStreamingChat();
  if (!streamOk) {
    console.log('\n❌ 测试失败: 流式聊天未通过');
    process.exit(1);
  }
  
  console.log('\n🎉 所有测试通过！新的AI助手模块工作正常。');
  console.log('\n📊 测试结果:');
  console.log('✅ 健康检查API');
  console.log('✅ 流式聊天API');
  console.log('✅ Server-Sent Events');
  console.log('✅ 数据块传输');
  console.log('✅ 连接管理');
}

// 添加fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

runTests().catch(console.error);

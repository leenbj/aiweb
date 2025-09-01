import { motion } from 'framer-motion';
import { Code } from 'lucide-react';

// 静态占位符组件 - 更丰富的默认图案展示
export const StaticPreviewPlaceholder = () => {
  return (
    <div className="h-full flex items-center justify-center bg-white relative overflow-hidden">
      {/* 美观的预览占位符，带有设备模拟和图案 */}
      <div className="text-center space-y-8 max-w-md">
        {/* 模拟设备框架 */}
        <motion.div 
          className="mx-auto relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-80 h-48 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* 模拟浏览器顶部 */}
            <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-3">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 mx-4">
                <div className="h-4 bg-gray-200 rounded-full w-40"></div>
              </div>
            </div>
            
            {/* 模拟网页内容 */}
            <div className="p-4 space-y-3">
              <motion.div 
                className="h-3 bg-blue-200 rounded w-3/4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div 
                className="h-2 bg-gray-200 rounded w-full"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              />
              <motion.div 
                className="h-2 bg-gray-200 rounded w-5/6"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
              />
              <motion.div 
                className="h-6 bg-purple-200 rounded w-20 mt-3"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
              />
            </div>
          </div>
          
          {/* 装饰性图标 */}
          <motion.div 
            className="absolute -top-3 -right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm"
            animate={{ 
              y: [0, -5, 0],
              rotate: [0, 10, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ✨
          </motion.div>
          <motion.div 
            className="absolute -bottom-2 -left-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs"
            animate={{ 
              y: [0, -3, 0],
              rotate: [0, -10, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          >
            🎨
          </motion.div>
          <motion.div 
            className="absolute top-8 -left-4 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs"
            animate={{ 
              x: [0, -3, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, delay: 2 }}
          >
            💡
          </motion.div>
        </motion.div>

        {/* 文字说明 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-700">
            开始创建你的网站
          </h2>
          
          <p className="text-gray-500">
            在左侧AI助手中描述你想要的网站<br/>
            AI将为你生成完整的网页代码
          </p>
          
          <div className="flex justify-center space-x-4 mt-4">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>响应式设计</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>现代化UI</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>AI生成</span>
            </div>
          </div>
        </div>
      </div>

      {/* 背景装饰网格 */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="border border-gray-400"></div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 代码区域静态占位符
export const StaticCodePlaceholder = () => {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 max-w-md">
        {/* 代码图标 */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Code className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* 文本 */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-700">
            代码编辑器
          </h3>
          <p className="text-gray-500 text-sm">
            开始对话生成代码，这里将显示生成的HTML/CSS代码
          </p>
        </div>

        {/* 装饰线条 */}
        <div className="space-y-2">
          <div className="h-1 bg-gray-200 rounded w-full"></div>
          <div className="h-1 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-1 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

// 生成时的动画组件 - 类似12.png的风格
export const GenerationAnimation = () => {
  return (
    <div className="h-full flex items-center justify-center bg-white relative overflow-hidden">
      {/* 主要内容区域 */}
      <motion.div 
        className="text-center space-y-6 max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* 主图标区域 - 动画版本的设备框架 */}
        <div className="relative">
          <motion.div
            className="flex justify-center mb-6"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="relative">
              {/* 外层设备框架 - 添加动画效果 */}
              <motion.div 
                className="w-32 h-48 bg-white border-2 border-gray-300 rounded-2xl shadow-lg overflow-hidden"
                animate={{ 
                  boxShadow: [
                    "0 4px 20px rgba(0, 0, 0, 0.1)",
                    "0 8px 30px rgba(59, 130, 246, 0.2)",
                    "0 4px 20px rgba(0, 0, 0, 0.1)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {/* 顶部状态栏 */}
                <div className="h-6 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                  <motion.div 
                    className="flex space-x-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </motion.div>
                </div>
                
                {/* 内容区域 - 添加加载动画 */}
                <div className="p-4 space-y-3">
                  <motion.div 
                    className="h-2 bg-gray-200 rounded"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                  ></motion.div>
                  <motion.div 
                    className="h-2 bg-gray-200 rounded w-3/4"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                  ></motion.div>
                  <motion.div 
                    className="h-8 bg-blue-100 rounded flex items-center justify-center mt-4"
                    animate={{ 
                      backgroundColor: ["#dbeafe", "#93c5fd", "#dbeafe"],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                  >
                    <motion.div 
                      className="w-4 h-4 bg-blue-400 rounded"
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    ></motion.div>
                  </motion.div>
                  <div className="space-y-2 mt-4">
                    <motion.div 
                      className="h-1.5 bg-gray-200 rounded"
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
                    ></motion.div>
                    <motion.div 
                      className="h-1.5 bg-gray-200 rounded w-2/3"
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.8 }}
                    ></motion.div>
                    <motion.div 
                      className="h-1.5 bg-gray-200 rounded w-1/2"
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 1 }}
                    ></motion.div>
                  </div>
                </div>
              </motion.div>
              
              {/* 周围的装饰点 - 添加动画 */}
              <motion.div 
                className="absolute -top-2 -right-2 w-3 h-3 bg-blue-400 rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              ></motion.div>
              <motion.div 
                className="absolute -bottom-2 -left-2 w-2 h-2 bg-green-400 rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              ></motion.div>
              <motion.div 
                className="absolute top-4 -left-4 w-2 h-2 bg-purple-400 rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              ></motion.div>
              <motion.div 
                className="absolute bottom-4 -right-4 w-2 h-2 bg-orange-400 rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.9 }}
              ></motion.div>
            </div>
          </motion.div>
        </div>

        {/* 主要文本 */}
        <motion.div
          className="space-y-3"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <h2 className="text-xl font-medium text-gray-700">
            正在生成网站...
          </h2>
          
          <p className="text-sm text-gray-500">
            AI正在为你创建精美的网页
          </p>
        </motion.div>

        {/* 底部指示 */}
        <div className="flex justify-center space-x-2 mt-6">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              animate={{
                backgroundColor: i === 1 ? ["#3b82f6", "#60a5fa", "#3b82f6"] : "#d1d5db",
                scale: i === 1 ? [1, 1.2, 1] : 1
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* 背景装饰网格 - 添加微妙动画 */}
      <motion.div 
        className="absolute inset-0 opacity-3"
        animate={{ opacity: [0.02, 0.05, 0.02] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="border border-gray-300"></div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

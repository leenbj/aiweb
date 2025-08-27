import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Code, Sparkles } from 'lucide-react';

interface GenerationProgressBarProps {
  progress: number;
  stage: string;
  currentCode?: string;
  isVisible: boolean;
  estimatedTotal?: number;
}

export const GenerationProgressBar: React.FC<GenerationProgressBarProps> = ({
  progress,
  stage,
  currentCode = '',
  isVisible,
  estimatedTotal = 5000, // 预估总代码长度
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [codeProgress, setCodeProgress] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);

  // 基于代码长度计算实际进度
  useEffect(() => {
    if (currentCode) {
      const newCodeProgress = Math.min((currentCode.length / estimatedTotal) * 100, 90);
      setCodeProgress(newCodeProgress);
    }
  }, [currentCode, estimatedTotal]);

  // 综合计算显示进度（结合传入的进度和代码进度）
  useEffect(() => {
    const combinedProgress = Math.max(progress, codeProgress);
    setDisplayProgress(combinedProgress);
  }, [progress, codeProgress]);

  // 平滑进度动画
  useEffect(() => {
    let animationFrame: number;
    const targetProgress = displayProgress;
    
    const animate = () => {
      setSmoothProgress(current => {
        const diff = targetProgress - current;
        if (Math.abs(diff) < 0.1) {
          return targetProgress;
        }
        return current + diff * 0.1;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [displayProgress]);

  // 进度阶段配置
  const progressStages = [
    { threshold: 0, icon: Sparkles, label: '初始化', color: 'from-blue-400 to-blue-500' },
    { threshold: 20, icon: Code, label: '分析需求', color: 'from-purple-400 to-purple-500' },
    { threshold: 40, icon: Zap, label: '生成结构', color: 'from-indigo-400 to-indigo-500' },
    { threshold: 60, icon: Code, label: '编写代码', color: 'from-violet-400 to-violet-500' },
    { threshold: 80, icon: Sparkles, label: '优化样式', color: 'from-pink-400 to-pink-500' },
    { threshold: 95, icon: Zap, label: '最终优化', color: 'from-emerald-400 to-emerald-500' },
  ];

  const currentStage = progressStages
    .slice()
    .reverse()
    .find(stage => smoothProgress >= stage.threshold) || progressStages[0];

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="bg-white/95 backdrop-blur-lg border border-gray-200/60 rounded-xl shadow-2xl p-4 min-w-[400px]">
        {/* 头部信息 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className={`p-2 bg-gradient-to-r ${currentStage.color} rounded-lg`}
            >
              <currentStage.icon className="h-4 w-4 text-white" />
            </motion.div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">AI网站生成中</h3>
              <p className="text-xs text-gray-600">{stage || currentStage.label}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-800">
              {Math.round(smoothProgress)}%
            </div>
            <div className="text-xs text-gray-500">
              {currentCode ? `${Math.round(currentCode.length / 1000 * 10) / 10}K 字符` : '准备中...'}
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${currentStage.color} rounded-full shadow-sm`}
              initial={{ width: '0%' }}
              animate={{ width: `${smoothProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          {/* 动态光效 */}
          <motion.div
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
            style={{ width: '20px' }}
            animate={{
              x: [`-20px`, `${(smoothProgress / 100) * 400}px`],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* 阶段指示器 */}
        <div className="flex items-center justify-between mt-3 text-xs">
          {progressStages.map((stageInfo, index) => (
            <div
              key={index}
              className={`flex flex-col items-center space-y-1 ${
                smoothProgress >= stageInfo.threshold
                  ? 'text-gray-800'
                  : 'text-gray-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  smoothProgress >= stageInfo.threshold
                    ? `bg-gradient-to-r ${stageInfo.color}`
                    : 'bg-gray-300'
                }`}
              />
              <span className="text-[10px] text-center leading-tight">
                {stageInfo.label}
              </span>
            </div>
          ))}
        </div>

        {/* 底部信息 */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div className="flex space-x-1">
              <motion.div
                className="w-1 h-1 bg-blue-500 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.div
                className="w-1 h-1 bg-purple-500 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-1 h-1 bg-pink-500 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
              />
            </div>
            <span>实时生成中...</span>
          </div>
          <div className="text-xs text-gray-500">
            预计还需 {Math.max(0, Math.round((100 - smoothProgress) * 0.5))} 秒
          </div>
        </div>
      </div>
    </motion.div>
  );
};
// HTML代码提取工具函数
export const extractHTMLCode = (text: string): string | null => {
  // 匹配 ```html 到 ``` 之间的内容
  const htmlMatch = text.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlMatch) {
    return htmlMatch[1].trim();
  }
  
  // 匹配 <!DOCTYPE html> 开头的完整HTML文档
  const doctypeMatch = text.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i);
  if (doctypeMatch) {
    return doctypeMatch[1].trim();
  }
  
  // 匹配 <html> 开头的HTML文档
  const htmlTagMatch = text.match(/(<html[\s\S]*?<\/html>)/i);
  if (htmlTagMatch) {
    return htmlTagMatch[1].trim();
  }
  
  return null;
};
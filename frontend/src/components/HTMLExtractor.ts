// HTML代码提取工具函数
export const extractHTMLCode = (text: string): string | null => {
  // 匹配 ```html 到 ``` 之间的内容（改进版，处理各种格式）
  const htmlMatch = text.match(/```html\s*\n?([\s\S]*?)\n?\s*```/i);
  if (htmlMatch) {
    let extractedContent = htmlMatch[1].trim();

    // 额外检查并移除可能遗留的代码块标记
    if (extractedContent.includes('```')) {
      extractedContent = extractedContent.replace(/^```(?:html)?\s*\n?/gm, '');
      extractedContent = extractedContent.replace(/\n?\s*```\s*$/gm, '');
      extractedContent = extractedContent.replace(/```\s*$/gm, '');
    }

    return extractedContent;
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
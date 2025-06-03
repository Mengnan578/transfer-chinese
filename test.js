/**
 * 此脚本用于从 PO 文件（GNU gettext 格式）中提取英文-中文翻译对
 * 支持处理单个 PO 文件或包含多个 PO 文件的目录
 * 输出为 JSON 文件，格式为 { "英文原文": "中文翻译" }
 * 
 * 使用方法: node test.js <po_path> [output_path]
 *   po_path:      PO 文件目录或单个 PO 文件路径
 *   output_path:  输出 JSON 文件路径（默认: test.json）
 */

import fs from 'fs';
import path from 'path';
import gettextParser from 'gettext-parser';

/**
 * 从单个 PO 文件中提取翻译对
 * @param {string} poFilePath - PO 文件路径
 * @returns {Object} 翻译对对象 { 英文: 中文 }
 */
function extractTranslations(poFilePath) {
    // 读取 PO 文件内容
    const content = fs.readFileSync(poFilePath, 'utf8');
    // 解析 PO 文件
    const po = gettextParser.po.parse(content);
    const translations = {};
    
    // 遍历所有翻译上下文
    for (const context of Object.values(po.translations)) {
        // 遍历当前上下文中的所有翻译项
        for (const [msgid, translation] of Object.entries(context)) {
            // 跳过空 msgid（头部信息部分）
            if (msgid === '') continue;
            
            // 处理多行英文原文（拼接多行为单字符串）
            const english = Array.isArray(translation.msgid) 
                ? translation.msgid.join('\n') 
                : translation.msgid;
            
            // 处理多行中文翻译（拼接多行为单字符串）
            const chinese = translation.msgstr && translation.msgstr.length > 0
                ? Array.isArray(translation.msgstr)
                    ? translation.msgstr.join('\n')
                    : translation.msgstr
                : '';  // 无翻译时使用空字符串
            
            // 仅当存在有效英文和中文时才保存
            if (english && chinese) {
                translations[english] = chinese;
            }
        }
    }
    
    return translations;
}

/**
 * 处理 PO 文件路径（目录或文件）
 * @param {string} inputPath - 输入路径（目录或文件）
 * @returns {Object} 合并后的所有翻译对
 * @throws 当输入路径无效时抛出错误
 */
function processPoPath(inputPath) {
    // 获取路径状态信息
    const stats = fs.statSync(inputPath);
    const allTranslations = {};
    
    if (stats.isDirectory()) {
        // 处理目录：遍历所有 PO 文件
        const files = fs.readdirSync(inputPath);
        for (const file of files) {
            // 仅处理 .po 扩展名文件
            if (path.extname(file) === '.po') {
                const poPath = path.join(inputPath, file);
                // 提取当前文件的翻译
                const translations = extractTranslations(poPath);
                // 合并到总翻译对象
                Object.assign(allTranslations, translations);
            }
        }
    } else if (stats.isFile() && path.extname(inputPath) === '.po') {
        // 处理单个 PO 文件
        const translations = extractTranslations(inputPath);
        Object.assign(allTranslations, translations);
    } else {
        // 无效路径类型时抛出错误
        throw new Error(`输入路径必须是目录或 .po 文件: ${inputPath}`);
    }
    
    return allTranslations;
}

// 主程序入口
if (process.argv.length < 3) {
    console.log('使用方法: node test.js <po_path> [output_path]');
    console.log('  po_path:      PO 文件目录或单个 PO 文件路径');
    console.log('  output_path:  输出 JSON 文件路径（默认: test.json）');
    process.exit(1);
}

// 获取命令行参数
const poPath = process.argv[2];
const outputPath = process.argv[3] || 'test.json';

// 执行翻译提取
const translations = processPoPath(poPath);

// 确保输出目录存在
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
    // 递归创建目录
    fs.mkdirSync(outputDir, { recursive: true });
}

// 写入 JSON 文件（格式化缩进2空格）
fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));
console.log(`成功提取 ${Object.keys(translations).length} 条翻译至 ${outputPath}`);

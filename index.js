// translate-po.js

import fs from 'fs';
import path from 'path';
import gettextParser from 'gettext-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';

// 加载环境变量
dotenv.config();

// 配置
// const INPUT_PO_FILE = `D:/work/uqpay-admin-panel/src/locales/zh/messages.po`; // 输入的 .po 文件路径
// const OUTPUT_PO_FILE = 'D:/work/transfer-chinese/message_translated.po'; // 输出的 .po 文件路径
const INPUT_PO_FILE = 'D:/work/uqpay-webapp/src/locales/zh/messages.po'
const OUTPUT_PO_FILE = 'D:/work/transfer-chinese/message_translated.po';
const SOURCE_LANG = 'en'; // 源语言代码
const TARGET_LANG = 'zh'; // 目标语言代码（百度翻译使用语言简码，如 'zh' 表示中文）
const BAIDU_APP_ID = process.env.BAIDU_APP_ID; // 从 .env 文件读取 APP ID
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY; // 从 .env 文件读取密钥
// const CACHE_FILE = path.resolve('D:/work/transfer-chinese/translation_cache.json'); // 缓存文件路径
const CACHE_FILE = path.resolve('D:/work/transfer-chinese/test.json');
const RETRY_LIMIT = 3; // 重试次数
const RETRY_DELAY_BASE = 1000; // 基础重试延迟（毫秒）
const REQUEST_DELAY = 1000; // 每次请求后等待的时间（毫秒）

// 检查必要的环境变量
if (!BAIDU_APP_ID || !BAIDU_SECRET_KEY) {
  console.error('请在 .env 文件中设置 BAIDU_APP_ID 和 BAIDU_SECRET_KEY');
  process.exit(1);
}

// 读取缓存
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  const cacheContent = fs.readFileSync(CACHE_FILE, 'utf8');
  try {
    cache = JSON.parse(cacheContent);
  } catch (error) {
    console.error('解析缓存文件时出错。将使用空缓存。');
    cache = {};
  }
}

// 保存缓存
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// 生成百度翻译签名
function getBaiduSign(query, salt) {
  const str = BAIDU_APP_ID + query + salt + BAIDU_SECRET_KEY;
  return crypto.createHash('md5').update(str).digest('hex');
}

// 等待指定的毫秒数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 翻译函数，带重试机制和缓存
async function translateText(text, retries = RETRY_LIMIT) {
  if (cache[text]) {
    console.log(`使用缓存翻译: "${text}"`);
    return cache[text];
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const salt = Date.now();
      const sign = getBaiduSign(text, salt);
      const params = new URLSearchParams();
      params.append('q', text);
      params.append('from', SOURCE_LANG);
      params.append('to', TARGET_LANG);
      params.append('appid', BAIDU_APP_ID);
      params.append('salt', salt);
      params.append('sign', sign);

      const response = await axios.post('https://fanyi-api.baidu.com/api/trans/vip/translate', params);

      if (response.data && response.data.trans_result) {
        const translatedText = response.data.trans_result.map(item => item.dst).join('\n').trim();

        // 更新缓存
        cache[text] = translatedText;
        saveCache();

        return translatedText;
      } else {
        throw new Error(`Unexpected response structure: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      console.error(`翻译 "${text}" 时出错 (尝试 ${attempt}): ${errorMsg}`);
      if (attempt === retries) {
        console.error(`在 ${retries} 次尝试后仍未成功翻译。将使用原文。`);
        return text; // 如果所有尝试都失败，返回原文
      }
      // 等待一段时间再重试（指数退避）
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      console.log(`等待 ${delay} 毫秒后重试...`);
      await sleep(delay);
    }
  }
}

// 主函数
async function main() {
  try {
    // 读取并解析 .po 文件
    const input = fs.readFileSync(INPUT_PO_FILE);
    const po = gettextParser.po.parse(input);

    // 遍历每个翻译条目
    for (const [context, contextTranslations] of Object.entries(po.translations)) {
      for (const [msgid, translation] of Object.entries(contextTranslations)) {
        // 跳过空的 msgid（通常是文件头）
        if (msgid === '') continue;

        // 检查是否已经有翻译
        if (!translation.msgstr || translation.msgstr.join('').trim() === '') {
          console.log(`正在翻译 msgid: "${msgid}"`);

          // 如果 msgid 是多行，合并为单个字符串
          const originalText = Array.isArray(translation.msgid) ? translation.msgid.join('') : translation.msgid;

          // 翻译文本
          const translatedText = await translateText(originalText);

          // 处理多行翻译，保持原有格式
          if (originalText.includes('\n')) {
            const translatedLines = translatedText.split('\n').map(line => line).join('\n');
            translation.msgstr = [translatedLines];
          } else {
            translation.msgstr = [translatedText];
          }

          console.log(`翻译结果: "${translatedText}"`);

          // 等待一秒钟再进行下一个请求
          await sleep(REQUEST_DELAY);
        }
      }
    }

    // 编译更新后的 .po 文件内容
    const output = gettextParser.po.compile(po);

    // 写入新的 .po 文件
    fs.writeFileSync(OUTPUT_PO_FILE, output);

    console.log(`翻译完成。更新后的文件已保存为 "${OUTPUT_PO_FILE}"。`);
  } catch (error) {
    console.error('发生意外错误:', error.message);
  }
}

main();
